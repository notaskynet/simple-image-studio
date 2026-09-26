import { useCallback, useEffect, useRef, useState } from 'react'

import { AGENT_TOOLS, buildAgentMessages, imageLabel, parseToolArgs, toolResult } from '../lib/agent'
import { ApiError, generateImages } from '../lib/api'
import { streamChat, type ChatMessage } from '../lib/chat'
import { buildPrompt, getLineage } from '../lib/context'
import {
  clearHistory,
  deleteGeneration,
  deleteSession,
  getImageBlob,
  loadHistory,
  loadSessions,
  saveGeneration,
  saveSession,
  updateMeta,
} from '../lib/db'
import { sessionTitle } from '../lib/sessions'
import type {
  AgentStep,
  AgentTurn,
  AssistantTurn,
  ComposeMode,
  GenerationMeta,
  ImageSize,
  Session,
  StudioRequest,
  StyleId,
  ToolCallRecord,
  Turn,
  UserTurn,
} from '../types'
import type { ToastKind } from './useToast'

export interface EngineConfig {
  baseUrl: string
  apiKey: string
  model: string
  chatModel: string
  systemPrompt: string
  vision: boolean
}

interface EngineOptions {
  config: EngineConfig
  notify: (message: string, kind?: ToastKind) => void
  onCreated: (sessionId: string, metas: GenerationMeta[]) => void
}

interface ExecuteParams {
  sessionId: string
  prompt: string
  displayPrompt: string
  styles: StyleId[]
  size: ImageSize
  count: number
  sources: GenerationMeta[]
  parentId?: string
  inputIds?: string[]
  includeOriginal?: boolean
  signal: AbortSignal
}

const MAX_AGENT_STEPS = 6
const INTERRUPTED = 'Прервано: страница была перезагружена'

export function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Что-то пошло не так'
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(blob)
  })
}

function recoverTurn(turn: Turn): Turn {
  if (turn.role === 'user' || turn.status !== 'pending') return turn
  if (turn.role === 'assistant') return { ...turn, status: 'error', error: INTERRUPTED }
  return {
    ...turn,
    status: 'error',
    error: INTERRUPTED,
    steps: turn.steps.map((step) => ({
      ...step,
      toolCalls: step.toolCalls.map((c) =>
        c.status === 'running' ? { ...c, status: 'error' as const, error: INTERRUPTED, result: INTERRUPTED } : c,
      ),
    })),
  }
}

export function useStudioEngine({ config, notify, onCreated }: EngineOptions) {
  const [sessions, setSessionsState] = useState<Session[]>([])
  const [history, setHistoryState] = useState<GenerationMeta[]>([])
  const sessionsRef = useRef<Session[]>([])
  const historyRef = useRef<GenerationMeta[]>([])
  const controllers = useRef(new Map<string, { controller: AbortController; sessionId: string }>())
  const configRef = useRef(config)
  const onCreatedRef = useRef(onCreated)

  useEffect(() => {
    configRef.current = config
    onCreatedRef.current = onCreated
  })

  const setSessions = useCallback((next: Session[]) => {
    sessionsRef.current = next
    setSessionsState(next)
  }, [])

  const setHistory = useCallback((next: GenerationMeta[]) => {
    historyRef.current = next
    setHistoryState(next)
  }, [])

  useEffect(() => {
    Promise.all([loadHistory(), loadSessions()])
      .then(([metas, stored]) => {
        const recovered = stored.map((session) => {
          if (!session.turns.some((t) => t.role !== 'user' && t.status === 'pending')) return session
          const fixed = { ...session, turns: session.turns.map(recoverTurn) }
          void saveSession(fixed)
          return fixed
        })
        setHistory(metas)
        setSessions(recovered)
      })
      .catch(() => notify('Не удалось загрузить историю', 'error'))
  }, [notify, setHistory, setSessions])

  const persist = useCallback(
    (session: Session) => {
      saveSession(session).catch(() => notify('Не удалось сохранить сессию', 'error'))
    },
    [notify],
  )

  const patchSession = useCallback(
    (id: string, fn: (session: Session) => Session, save = true) => {
      const current = sessionsRef.current.find((s) => s.id === id)
      if (!current) return
      const next = fn(current)
      if (save) {
        const bumped = { ...next, updatedAt: Date.now() }
        setSessions([bumped, ...sessionsRef.current.filter((s) => s.id !== id)])
        persist(bumped)
      } else {
        setSessions(sessionsRef.current.map((s) => (s.id === id ? next : s)))
      }
    },
    [persist, setSessions],
  )

  const patchTurn = useCallback(
    <T extends Turn>(sessionId: string, turnId: string, fn: (turn: T) => T, save = true) => {
      patchSession(
        sessionId,
        (session) => ({ ...session, turns: session.turns.map((t) => (t.id === turnId ? fn(t as T) : t)) }),
        save,
      )
    },
    [patchSession],
  )

  const addTurn = useCallback(
    (sessionId: string, turn: Turn) => patchSession(sessionId, (s) => ({ ...s, turns: [...s.turns, turn] })),
    [patchSession],
  )

  const addMetas = useCallback(
    (metas: GenerationMeta[]) => setHistory([...[...metas].reverse(), ...historyRef.current]),
    [setHistory],
  )

  const metasById = useCallback(() => new Map(historyRef.current.map((m) => [m.id, m])), [])

  const executeImages = useCallback(
    async (params: ExecuteParams): Promise<GenerationMeta[]> => {
      const blobs = await Promise.all(
        params.sources.map(async (meta) => {
          const blob = await getImageBlob(meta)
          if (!blob) throw new ApiError(`Не удалось прочитать изображение ${imageLabel(meta)}`)
          return blob
        }),
      )
      const { baseUrl, apiKey, model } = configRef.current
      const images = await generateImages({
        baseUrl,
        apiKey,
        model,
        prompt: params.prompt,
        size: params.size,
        count: params.count,
        images: blobs.length ? blobs : undefined,
        signal: params.signal,
      })
      const existing = historyRef.current.filter((m) => m.sessionId === params.sessionId && m.kind !== 'upload')
      const firstVersion = existing.reduce((max, m) => Math.max(max, m.version ?? 0), 0) + 1
      const createdAt = Date.now()
      const metas = images.map(
        (image, i): GenerationMeta => ({
          id: createId(),
          prompt: params.displayPrompt,
          styles: params.styles,
          model,
          size: params.size,
          createdAt: createdAt + i,
          favorite: false,
          mime: image.blob?.type ?? 'image/png',
          remoteUrl: image.blob ? undefined : image.url,
          kind: 'generated',
          sessionId: params.sessionId,
          parentId: params.parentId,
          inputIds: params.inputIds?.length ? params.inputIds : undefined,
          includeOriginal: params.includeOriginal || undefined,
          version: firstVersion + i,
        }),
      )
      addMetas(metas)
      await Promise.all(metas.map((meta, i) => saveGeneration(meta, images[i].blob)))
      if (metas.length < params.count) notify(`Получено изображений: ${metas.length} из ${params.count}`, 'info')
      return metas
    },
    [addMetas, notify],
  )

  const track = useCallback((turnId: string, sessionId: string): AbortController => {
    const controller = new AbortController()
    controllers.current.set(turnId, { controller, sessionId })
    return controller
  }, [])

  const runDirect = useCallback(
    async (sessionId: string, request: UserTurn) => {
      const byId = metasById()
      const base = request.baseId ? byId.get(request.baseId) : undefined
      const attachments = request.attachmentIds.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m)
      const turn: AssistantTurn = {
        id: createId(),
        role: 'assistant',
        requestId: request.id,
        imageIds: [],
        status: 'pending',
        size: request.size,
        count: request.count,
        edit: !!base || attachments.length > 0,
        createdAt: Date.now(),
      }
      addTurn(sessionId, turn)
      const controller = track(turn.id, sessionId)
      try {
        if (request.baseId && !base) throw new ApiError('Изображение для правки было удалено')
        const chain = getLineage(base, byId)
        const sources = [
          ...(base ? [base] : []),
          ...(base && request.includeOriginal && chain.length > 1 ? [chain[0]] : []),
          ...attachments,
        ]
        const metas = await executeImages({
          sessionId,
          prompt: buildPrompt({
            text: request.text,
            styles: request.styles,
            lineage: chain,
            attachmentCount: attachments.length,
            includeOriginal: request.includeOriginal,
          }),
          displayPrompt: request.text,
          styles: request.styles,
          size: request.size,
          count: request.count,
          sources,
          parentId: base?.id,
          inputIds: request.attachmentIds,
          includeOriginal: request.includeOriginal,
          signal: controller.signal,
        })
        patchTurn<AssistantTurn>(sessionId, turn.id, (t) => ({ ...t, status: 'done', imageIds: metas.map((m) => m.id) }))
        onCreatedRef.current(sessionId, metas)
      } catch (error) {
        const aborted = isAbort(error, controller.signal)
        patchTurn<AssistantTurn>(sessionId, turn.id, (t) => ({
          ...t,
          status: 'error',
          error: aborted ? 'Генерация отменена' : errorMessage(error),
        }))
        if (!aborted) notify(errorMessage(error), 'error')
      } finally {
        controllers.current.delete(turn.id)
      }
    },
    [addTurn, executeImages, metasById, notify, patchTurn, track],
  )

  const runTool = useCallback(
    async (
      sessionId: string,
      turnId: string,
      call: ToolCallRecord,
      signal: AbortSignal,
    ): Promise<{ result: string; metas: GenerationMeta[] }> => {
      const update = (fn: (c: ToolCallRecord) => ToolCallRecord, save = true) =>
        patchTurn<AgentTurn>(
          sessionId,
          turnId,
          (t) => ({
            ...t,
            steps: t.steps.map((step) => ({
              ...step,
              toolCalls: step.toolCalls.map((c) => (c.id === call.id ? fn(c) : c)),
            })),
          }),
          save,
        )
      try {
        if (call.name !== 'generate_image' && call.name !== 'edit_image') {
          throw new Error(`Неизвестный инструмент: ${call.name}`)
        }
        const args = parseToolArgs(call.args)
        const sessionImages = historyRef.current.filter((m) => m.sessionId === sessionId)
        const sources =
          call.name === 'edit_image'
            ? args.imageIds.map((ref) => {
                const key = ref.trim().toLowerCase()
                const found = sessionImages.find((m) => imageLabel(m).toLowerCase() === key || m.id === ref)
                if (!found) throw new Error(`Изображение ${ref} не найдено`)
                return found
              })
            : []
        if (call.name === 'edit_image' && sources.length === 0) throw new Error('Не указано изображение для правки')
        const size = args.size ?? sources[0]?.size ?? '1024x1024'
        update((c) => ({ ...c, prompt: args.prompt, size, count: args.count, sourceIds: sources.map((m) => m.id) }), false)
        const metas = await executeImages({
          sessionId,
          prompt: args.prompt,
          displayPrompt: args.prompt,
          styles: [],
          size,
          count: args.count,
          sources,
          parentId: sources[0]?.id,
          inputIds: sources.slice(1).map((m) => m.id),
          signal,
        })
        const result = toolResult(metas)
        update((c) => ({ ...c, status: 'done', imageIds: metas.map((m) => m.id), result }))
        return { result, metas }
      } catch (error) {
        const message = isAbort(error, signal) ? 'Отменено пользователем' : errorMessage(error)
        const result = JSON.stringify({ ok: false, error: message })
        update((c) => ({ ...c, status: 'error', error: message, result }))
        return { result, metas: [] }
      }
    },
    [executeImages, patchTurn],
  )

  const runAgent = useCallback(
    async (sessionId: string, request: UserTurn) => {
      const turn: AgentTurn = {
        id: createId(),
        role: 'agent',
        requestId: request.id,
        steps: [],
        status: 'pending',
        createdAt: Date.now(),
      }
      addTurn(sessionId, turn)
      const controller = track(turn.id, sessionId)
      const created: GenerationMeta[] = []
      const patchSteps = (fn: (steps: AgentStep[]) => AgentStep[], save = true) =>
        patchTurn<AgentTurn>(sessionId, turn.id, (t) => ({ ...t, steps: fn(t.steps) }), save)

      try {
        const { baseUrl, apiKey, chatModel, systemPrompt, vision } = configRef.current
        const byId = metasById()
        const session = sessionsRef.current.find((s) => s.id === sessionId)
        if (!session) return
        const visionUrls = vision
          ? await Promise.all(
              request.attachmentIds.map(async (id) => {
                const meta = byId.get(id)
                const blob = meta ? await getImageBlob(meta) : null
                return blob ? blobToDataUrl(blob) : null
              }),
            ).then((urls) => urls.filter((u): u is string => !!u))
          : []
        const messages: ChatMessage[] = buildAgentMessages({ systemPrompt, session, byId, request, visionUrls })

        for (let step = 0; step < MAX_AGENT_STEPS; step++) {
          patchSteps((steps) => [...steps, { text: '', toolCalls: [] }], false)
          const setLastText = (text: string) =>
            patchSteps((steps) => steps.map((s, i) => (i === steps.length - 1 ? { ...s, text } : s)), false)
          const result = await streamChat({
            baseUrl,
            apiKey,
            model: chatModel,
            messages,
            tools: AGENT_TOOLS,
            signal: controller.signal,
            onText: setLastText,
          })
          const now = Date.now()
          const records: ToolCallRecord[] = result.toolCalls.map((c) => ({
            id: c.id,
            name: c.function.name,
            args: c.function.arguments,
            status: 'running',
            imageIds: [],
            startedAt: now,
          }))
          patchSteps((steps) =>
            steps.map((s, i) => (i === steps.length - 1 ? { text: result.text, toolCalls: records } : s)),
          )
          if (records.length === 0) break
          messages.push({ role: 'assistant', content: result.text || null, tool_calls: result.toolCalls })
          const outputs = await Promise.all(records.map((r) => runTool(sessionId, turn.id, r, controller.signal)))
          records.forEach((r, i) => messages.push({ role: 'tool', tool_call_id: r.id, content: outputs[i].result }))
          outputs.forEach((o) => created.push(...o.metas))
          if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        }
        patchTurn<AgentTurn>(sessionId, turn.id, (t) => ({
          ...t,
          status: 'done',
          steps: t.steps.filter((s) => s.text || s.toolCalls.length),
        }))
        if (created.length) onCreatedRef.current(sessionId, created)
      } catch (error) {
        const aborted = isAbort(error, controller.signal)
        patchTurn<AgentTurn>(sessionId, turn.id, (t) => ({
          ...t,
          status: 'error',
          error: aborted ? 'Остановлено' : errorMessage(error),
          steps: t.steps
            .filter((s) => s.text || s.toolCalls.length)
            .map((s) => ({
              ...s,
              toolCalls: s.toolCalls.map((c) =>
                c.status === 'running' ? { ...c, status: 'error' as const, error: 'Отменено', result: 'Отменено' } : c,
              ),
            })),
        }))
        if (!aborted) notify(errorMessage(error), 'error')
      } finally {
        controllers.current.delete(turn.id)
      }
    },
    [addTurn, metasById, notify, patchTurn, runTool, track],
  )

  const send = useCallback(
    async (
      request: StudioRequest,
      files: Blob[],
      targetId: string | null,
      mode: ComposeMode,
    ): Promise<string | null> => {
      if (!request.text.trim()) return null
      const now = Date.now()
      let session = sessionsRef.current.find((s) => s.id === targetId)
      if (!session) {
        session = { id: createId(), title: sessionTitle(request.text), createdAt: now, updatedAt: now, turns: [] }
        setSessions([session, ...sessionsRef.current])
        persist(session)
      }
      const sessionId = session.id
      const uploadsBefore = historyRef.current.filter((m) => m.sessionId === sessionId && m.kind === 'upload').length
      const uploads = files.map(
        (blob, i): GenerationMeta => ({
          id: createId(),
          prompt: '',
          styles: [],
          model: '',
          size: request.size,
          createdAt: now + i,
          favorite: false,
          mime: blob.type || 'image/png',
          kind: 'upload',
          sessionId,
          label: `a${uploadsBefore + i + 1}`,
        }),
      )
      if (uploads.length) {
        addMetas(uploads)
        try {
          await Promise.all(uploads.map((meta, i) => saveGeneration(meta, files[i])))
        } catch {
          notify('Не удалось сохранить прикреплённые фото', 'error')
          return null
        }
      }
      const userTurn: UserTurn = {
        id: createId(),
        role: 'user',
        text: request.text.trim(),
        styles: request.styles,
        size: request.size,
        count: request.count,
        baseId: request.baseId,
        attachmentIds: [...request.attachmentIds, ...uploads.map((u) => u.id)],
        includeOriginal: request.includeOriginal,
        mode,
        createdAt: now,
      }
      addTurn(sessionId, userTurn)
      if (mode === 'agent') void runAgent(sessionId, userTurn)
      else void runDirect(sessionId, userTurn)
      return sessionId
    },
    [addMetas, addTurn, notify, persist, runAgent, runDirect, setSessions],
  )

  const cancel = useCallback((turnId: string) => controllers.current.get(turnId)?.controller.abort(), [])

  const cancelSession = useCallback((sessionId: string | null) => {
    for (const entry of controllers.current.values()) {
      if (sessionId === null || entry.sessionId === sessionId) entry.controller.abort()
    }
  }, [])

  const toggleFavorite = useCallback(
    async (meta: GenerationMeta) => {
      const updated = { ...meta, favorite: !meta.favorite }
      setHistory(historyRef.current.map((m) => (m.id === meta.id ? updated : m)))
      try {
        await updateMeta(updated)
      } catch {
        setHistory(historyRef.current.map((m) => (m.id === meta.id ? meta : m)))
        notify('Не удалось сохранить', 'error')
      }
    },
    [notify, setHistory],
  )

  const removeImage = useCallback(
    async (meta: GenerationMeta): Promise<boolean> => {
      try {
        await deleteGeneration(meta.id)
        setHistory(historyRef.current.filter((m) => m.id !== meta.id))
        return true
      } catch {
        notify('Не удалось удалить', 'error')
        return false
      }
    },
    [notify, setHistory],
  )

  const removeSession = useCallback(
    async (session: Session) => {
      cancelSession(session.id)
      const ids = historyRef.current.filter((m) => m.sessionId === session.id).map((m) => m.id)
      await deleteSession(session, ids)
      setSessions(sessionsRef.current.filter((s) => s.id !== session.id))
      setHistory(historyRef.current.filter((m) => m.sessionId !== session.id))
    },
    [cancelSession, setHistory, setSessions],
  )

  const clearAll = useCallback(async () => {
    cancelSession(null)
    await clearHistory()
    setSessions([])
    setHistory([])
  }, [cancelSession, setHistory, setSessions])

  return {
    sessions,
    history,
    send,
    cancel,
    toggleFavorite,
    removeImage,
    removeSession,
    clearAll,
  }
}
