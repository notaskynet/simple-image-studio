import { History, Moon, Plus, Settings, Sparkles, Sun, WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDialog } from './components/ConfirmDialog'
import { Gallery } from './components/Gallery'
import { SessionList } from './components/history/SessionList'
import type { CardActions } from './components/ImageCard'
import { Lightbox } from './components/Lightbox'
import { Onboarding } from './components/Onboarding'
import { SettingsDialog } from './components/SettingsDialog'
import { Composer, type PendingAttachment } from './components/studio/Composer'
import { Feed, type PendingJob } from './components/studio/Feed'
import type { ImageActions } from './components/studio/StudioImage'
import { VersionStrip } from './components/studio/VersionStrip'
import { focusRing, iconButton } from './components/ui'
import { useElapsed } from './hooks/useElapsed'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { ApiError, generateImages } from './lib/api'
import { buildPrompt, getLineage } from './lib/context'
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
} from './lib/db'
import { buildFileName, copyImageToClipboard, copyText, downloadBlob } from './lib/image'
import { DEFAULT_MODEL } from './lib/presets'
import { nextVersion, sessionImages, sessionTitle } from './lib/sessions'
import { settings } from './lib/settings'
import type { AssistantTurn, GenerationMeta, ImageSize, Session, StudioRequest, StyleId, UserTurn } from './types'

type Tab = 'studio' | 'history'

interface LightboxState {
  ids: string[]
  index: number
  studio: boolean
}

type ConfirmState = { kind: 'clear' } | { kind: 'session'; session: Session } | null

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Что-то пошло не так'
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function App() {
  const notify = useToast()
  const [theme, toggleTheme] = useTheme()
  const [tab, setTab] = useState<Tab>('studio')
  const [baseUrl, setBaseUrl] = useState(settings.getBaseUrl)
  const [apiKey, setApiKey] = useState(settings.getApiKey)
  const [model, setModel] = useState(() => settings.getModel() ?? DEFAULT_MODEL)
  const [history, setHistory] = useState<GenerationMeta[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentId, setCurrentId] = useState<string | null>(settings.getSessionId)
  const [text, setText] = useState(settings.getDraft)
  const [size, setSize] = useState<ImageSize>('1024x1024')
  const [count, setCount] = useState(1)
  const [styles, setStyles] = useState<StyleId[]>([])
  const [baseId, setBaseId] = useState<string | undefined>()
  const [includeOriginal, setIncludeOriginal] = useState(false)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [job, setJob] = useState<PendingJob | null>(null)
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionsRef = useRef(sessions)
  const historyRef = useRef(history)
  const elapsed = useElapsed(job?.startedAt ?? null)

  useEffect(() => {
    sessionsRef.current = sessions
    historyRef.current = history
  })

  useEffect(() => {
    Promise.all([loadHistory(), loadSessions()])
      .then(([metas, stored]) => {
        setHistory(metas)
        setSessions(stored)
      })
      .catch(() => notify('Не удалось загрузить историю', 'error'))
  }, [notify])

  useEffect(() => {
    const timer = setTimeout(() => settings.setDraft(text), 300)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    settings.setSessionId(currentId)
  }, [currentId])

  const byId = useMemo(() => new Map(history.map((m) => [m.id, m])), [history])
  const currentSession = sessions.find((s) => s.id === currentId)
  const versions = useMemo(
    () =>
      currentSession
        ? sessionImages(currentSession, byId).sort((a, b) => (a.version ?? 0) - (b.version ?? 0))
        : [],
    [currentSession, byId],
  )
  const base = baseId ? byId.get(baseId) : undefined
  const lineage = useMemo(() => getLineage(base, byId), [base, byId])
  const original = lineage.length > 1 ? lineage[0] : undefined

  const gallery = useMemo(() => {
    const query = search.trim().toLowerCase()
    return history.filter(
      (m) =>
        m.kind !== 'upload' && (!favoritesOnly || m.favorite) && (!query || m.prompt.toLowerCase().includes(query)),
    )
  }, [history, search, favoritesOnly])
  const galleryTotal = useMemo(() => history.filter((m) => m.kind !== 'upload').length, [history])

  const turnCount = currentSession?.turns.length ?? 0
  useEffect(() => {
    if (tab !== 'studio' || turnCount === 0) return
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }))
  }, [tab, turnCount, job, currentId])

  const commitSession = useCallback(
    (session: Session) => {
      setSessions((list) => [session, ...list.filter((s) => s.id !== session.id)])
      saveSession(session).catch(() => notify('Не удалось сохранить сессию', 'error'))
    },
    [notify],
  )

  const pin = useCallback((meta: GenerationMeta | undefined) => {
    setBaseId(meta?.id)
    setIncludeOriginal(false)
    if (meta) setSize(meta.size)
  }, [])

  const send = useCallback(
    async (request: StudioRequest, files: PendingAttachment[], targetId: string | null): Promise<boolean> => {
      if (controllerRef.current) return false
      if (!request.text.trim()) {
        notify('Напишите, что нужно сделать', 'info')
        textareaRef.current?.focus()
        return false
      }
      const now = Date.now()
      let session: Session = sessionsRef.current.find((s) => s.id === targetId) ?? {
        id: createId(),
        title: sessionTitle(request.text),
        createdAt: now,
        updatedAt: now,
        turns: [],
      }

      const uploads: { meta: GenerationMeta; blob: Blob }[] = files.map((file, i) => ({
        blob: file.blob,
        meta: {
          id: createId(),
          prompt: '',
          styles: [],
          model: '',
          size: request.size,
          createdAt: now + i,
          favorite: false,
          mime: file.blob.type || 'image/png',
          kind: 'upload',
          sessionId: session.id,
        },
      }))
      try {
        await Promise.all(uploads.map((u) => saveGeneration(u.meta, u.blob)))
      } catch {
        notify('Не удалось сохранить прикреплённые фото', 'error')
        return false
      }
      const attachmentIds = [...request.attachmentIds, ...uploads.map((u) => u.meta.id)]
      if (uploads.length) setHistory((items) => [...uploads.map((u) => u.meta), ...items])

      const userTurn: UserTurn = {
        id: createId(),
        role: 'user',
        text: request.text.trim(),
        styles: request.styles,
        size: request.size,
        count: request.count,
        baseId: request.baseId,
        attachmentIds,
        includeOriginal: request.includeOriginal,
        createdAt: now,
      }
      session = { ...session, updatedAt: now, turns: [...session.turns, userTurn] }
      commitSession(session)
      setCurrentId(session.id)

      const controller = new AbortController()
      controllerRef.current = controller
      setJob({ sessionId: session.id, requestId: userTurn.id, size: request.size, count: request.count, startedAt: now })

      let assistant: AssistantTurn
      let pinTarget: GenerationMeta | undefined
      try {
        const metasById = new Map(historyRef.current.map((m) => [m.id, m]))
        uploads.forEach((u) => metasById.set(u.meta.id, u.meta))
        const baseMeta = request.baseId ? metasById.get(request.baseId) : undefined
        if (request.baseId && !baseMeta) throw new ApiError('Изображение для доработки было удалено')
        const chain = getLineage(baseMeta, metasById)
        const inputs: GenerationMeta[] = []
        if (baseMeta) inputs.push(baseMeta)
        if (baseMeta && request.includeOriginal && chain.length > 1) inputs.push(chain[0])
        attachmentIds.forEach((id) => {
          const meta = metasById.get(id)
          if (meta) inputs.push(meta)
        })
        const blobs = await Promise.all(
          inputs.map(async (meta) => {
            const blob = await getImageBlob(meta)
            if (!blob) throw new ApiError('Не удалось прочитать исходное изображение')
            return blob
          }),
        )

        const images = await generateImages({
          baseUrl,
          apiKey,
          model,
          prompt: buildPrompt({
            text: request.text,
            styles: request.styles,
            lineage: chain,
            attachmentCount: attachmentIds.length,
            includeOriginal: request.includeOriginal,
          }),
          size: request.size,
          count: request.count,
          images: blobs.length ? blobs : undefined,
          signal: controller.signal,
        })

        const latest = sessionsRef.current.find((s) => s.id === session.id) ?? session
        const firstVersion = nextVersion(latest, metasById)
        const createdAt = Date.now()
        const metas = await Promise.all(
          images.map(async (image, i) => {
            const meta: GenerationMeta = {
              id: createId(),
              prompt: userTurn.text,
              styles: request.styles,
              model,
              size: request.size,
              createdAt: createdAt + i,
              favorite: false,
              mime: image.blob?.type ?? 'image/png',
              remoteUrl: image.blob ? undefined : image.url,
              kind: 'generated',
              sessionId: session.id,
              parentId: baseMeta?.id,
              inputIds: attachmentIds.length ? attachmentIds : undefined,
              includeOriginal: request.includeOriginal || undefined,
              version: firstVersion + i,
            }
            await saveGeneration(meta, image.blob)
            return meta
          }),
        )
        setHistory((items) => [...[...metas].reverse(), ...items])
        assistant = { id: createId(), role: 'assistant', requestId: userTurn.id, imageIds: metas.map((m) => m.id), createdAt }
        if (metas.length === 1) pinTarget = metas[0]
        if (metas.length < request.count) notify(`Получено изображений: ${metas.length} из ${request.count}`, 'info')
      } catch (error) {
        const aborted = isAbort(error) || controller.signal.aborted
        assistant = {
          id: createId(),
          role: 'assistant',
          requestId: userTurn.id,
          imageIds: [],
          error: aborted ? 'Генерация отменена' : errorMessage(error),
          createdAt: Date.now(),
        }
        if (!aborted) notify(errorMessage(error), 'error')
      } finally {
        controllerRef.current = null
        setJob(null)
      }

      const latest = sessionsRef.current.find((s) => s.id === session.id)
      if (latest) {
        commitSession({ ...latest, updatedAt: Date.now(), turns: [...latest.turns, assistant] })
        if (pinTarget) pin(pinTarget)
      }
      return true
    },
    [baseUrl, apiKey, model, notify, commitSession, pin],
  )

  const cancel = useCallback(() => controllerRef.current?.abort(), [])

  const submit = useCallback(() => {
    const files = attachments
    void send({ text, styles, size, count, baseId, attachmentIds: [], includeOriginal }, files, currentId).then(
      (started) => {
        if (!started) return
        setText('')
        setAttachments([])
        files.forEach((f) => URL.revokeObjectURL(f.url))
      },
    )
  }, [send, text, styles, size, count, baseId, includeOriginal, attachments, currentId])

  const retry = useCallback(
    (turn: UserTurn) => {
      void send(
        {
          text: turn.text,
          styles: turn.styles,
          size: turn.size,
          count: turn.count,
          baseId: turn.baseId,
          attachmentIds: turn.attachmentIds,
          includeOriginal: turn.includeOriginal,
        },
        [],
        currentId,
      )
    },
    [send, currentId],
  )

  const focusComposer = useCallback((value?: string) => {
    if (value !== undefined) setText(value)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }, [])

  const refine = useCallback(
    (meta: GenerationMeta) => {
      if (meta.sessionId && sessionsRef.current.some((s) => s.id === meta.sessionId)) setCurrentId(meta.sessionId)
      pin(meta)
      setTab('studio')
      focusComposer()
    },
    [pin, focusComposer],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter((f) => f.size <= 25 * 1024 * 1024)
      if (valid.length < files.length) notify('Файлы больше 25 МБ пропущены', 'info')
      setAttachments((items) => [
        ...items,
        ...valid.slice(0, Math.max(0, 8 - items.length)).map((blob) => ({ id: createId(), blob, url: URL.createObjectURL(blob) })),
      ])
    },
    [notify],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((items) => {
      const target = items.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return items.filter((i) => i.id !== id)
    })
  }, [])

  const newSession = useCallback(() => {
    setCurrentId(null)
    pin(undefined)
    setTab('studio')
    focusComposer()
  }, [pin, focusComposer])

  const openSession = useCallback(
    (session: Session) => {
      setCurrentId(session.id)
      const images = sessionImages(session, byId)
      pin(images.at(-1))
      setTab('studio')
    },
    [byId, pin],
  )

  const download = useCallback(
    async (meta: GenerationMeta) => {
      try {
        const blob = await getImageBlob(meta)
        if (!blob) throw new Error('Изображение не найдено')
        downloadBlob(blob, buildFileName(meta, blob.type || meta.mime))
        notify('Скачано')
      } catch {
        if (meta.remoteUrl) {
          window.open(meta.remoteUrl, '_blank', 'noopener')
          notify('Изображение открыто в новой вкладке', 'info')
        } else notify('Не удалось скачать изображение', 'error')
      }
    },
    [notify],
  )

  const copyImage = useCallback(
    async (meta: GenerationMeta) => {
      try {
        await copyImageToClipboard(() => getImageBlob(meta))
        notify('Скопировано')
      } catch (error) {
        notify(`Не удалось скопировать: ${errorMessage(error)}`, 'error')
      }
    },
    [notify],
  )

  const copyPrompt = useCallback(
    async (value: string) => {
      try {
        await copyText(value)
        notify('Скопировано')
      } catch {
        notify('Не удалось скопировать текст', 'error')
      }
    },
    [notify],
  )

  const toggleFavorite = useCallback(
    async (meta: GenerationMeta) => {
      const updated = { ...meta, favorite: !meta.favorite }
      setHistory((items) => items.map((m) => (m.id === meta.id ? updated : m)))
      try {
        await updateMeta(updated)
      } catch {
        setHistory((items) => items.map((m) => (m.id === meta.id ? meta : m)))
        notify('Не удалось сохранить', 'error')
      }
    },
    [notify],
  )

  const remove = useCallback(
    async (meta: GenerationMeta) => {
      try {
        await deleteGeneration(meta.id)
        setHistory((items) => items.filter((m) => m.id !== meta.id))
        setBaseId((id) => (id === meta.id ? undefined : id))
        notify('Удалено')
      } catch {
        notify('Не удалось удалить', 'error')
      }
    },
    [notify],
  )

  const studioActions = useMemo<ImageActions>(
    () => ({
      onOpen: (meta) => {
        const ids = versions.map((m) => m.id)
        setLightbox({ ids, index: Math.max(0, ids.indexOf(meta.id)), studio: true })
      },
      onRefine: (meta) => {
        pin(meta)
        focusComposer()
      },
      onDownload: download,
      onCopyImage: copyImage,
      onToggleFavorite: toggleFavorite,
      onDelete: remove,
    }),
    [versions, pin, focusComposer, download, copyImage, toggleFavorite, remove],
  )

  const galleryActions = useMemo<CardActions>(
    () => ({
      onOpen: (meta) => {
        const ids = gallery.map((m) => m.id)
        setLightbox({ ids, index: Math.max(0, ids.indexOf(meta.id)), studio: false })
      },
      onDownload: download,
      onCopyImage: copyImage,
      onCopyPrompt: (meta) => void copyPrompt(meta.prompt),
      onRepeat: (meta) => {
        const target = meta.sessionId && sessionsRef.current.some((s) => s.id === meta.sessionId) ? meta.sessionId : currentId
        setTab('studio')
        void send(
          {
            text: meta.prompt,
            styles: meta.styles,
            size: meta.size,
            count: 1,
            baseId: meta.parentId,
            attachmentIds: meta.inputIds ?? [],
            includeOriginal: !!meta.includeOriginal,
          },
          [],
          target,
        )
      },
      onRefine: refine,
      onToggleFavorite: toggleFavorite,
      onDelete: remove,
    }),
    [gallery, download, copyImage, copyPrompt, currentId, send, refine, toggleFavorite, remove],
  )

  const scrollToVersion = useCallback((meta: GenerationMeta) => {
    document.getElementById(`img-${meta.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const lightboxItems = useMemo(
    () => (lightbox ? lightbox.ids.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m) : []),
    [lightbox, byId],
  )
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const getParent = useCallback((meta: GenerationMeta) => (meta.parentId ? byId.get(meta.parentId) : undefined), [byId])

  async function confirmAction(): Promise<void> {
    const current = confirm
    setConfirm(null)
    if (!current) return
    try {
      if (current.kind === 'clear') {
        cancel()
        await clearHistory()
        setHistory([])
        setSessions([])
        setCurrentId(null)
        pin(undefined)
        notify('История очищена')
      } else {
        const ids = historyRef.current.filter((m) => m.sessionId === current.session.id).map((m) => m.id)
        await deleteSession(current.session, ids)
        setSessions((list) => list.filter((s) => s.id !== current.session.id))
        setHistory((items) => items.filter((m) => m.sessionId !== current.session.id))
        if (currentId === current.session.id) {
          setCurrentId(null)
          pin(undefined)
        }
        notify('Сессия удалена')
      }
    } catch {
      notify('Не удалось удалить', 'error')
    }
  }

  function saveConnection(values: { baseUrl: string; apiKey: string }): void {
    settings.setBaseUrl(values.baseUrl)
    settings.setApiKey(values.apiKey)
    setBaseUrl(values.baseUrl)
    setApiKey(values.apiKey)
  }

  if (!apiKey || !baseUrl) {
    return <Onboarding initialBaseUrl={baseUrl} initialApiKey={apiKey} onSave={saveConnection} />
  }

  const tabButton = (value: Tab, label: string, Icon: typeof History) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${focusRing} ${
        tab === value
          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <h1 className="hidden truncate text-base font-semibold tracking-tight lg:block">Simple Image Studio</h1>
            <span className="sr-only lg:hidden">Simple Image Studio</span>
          </div>
          <div
            role="tablist"
            aria-label="Разделы"
            className="flex gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {tabButton('studio', 'Студия', WandSparkles)}
            {tabButton('history', 'История', History)}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden max-w-48 truncate rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 xl:inline dark:bg-zinc-900 dark:text-zinc-400">
              {model}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className={iconButton}
              aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className={iconButton} aria-label="Настройки" title="Настройки">
              <Settings className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {tab === 'studio' ? (
        <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col px-4 sm:px-6" aria-label="Студия">
          <div className="sticky top-16 z-20 -mx-4 border-b border-zinc-200/70 bg-zinc-50/90 px-4 pt-3 backdrop-blur-lg sm:-mx-6 sm:px-6 dark:border-zinc-800/70 dark:bg-zinc-950/90">
            <div className="flex items-center justify-between gap-3 pb-2">
              <h2 className="truncate text-sm font-semibold">{currentSession?.title ?? 'Новая сессия'}</h2>
              <button
                type="button"
                onClick={newSession}
                disabled={!currentSession}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${focusRing}`}
              >
                <Plus className="size-4" aria-hidden="true" />
                Новая сессия
              </button>
            </div>
            <VersionStrip versions={versions} byId={byId} pinnedId={baseId} onSelect={scrollToVersion} />
          </div>

          <Feed
            session={currentSession}
            byId={byId}
            job={job}
            elapsed={elapsed}
            pinnedId={baseId}
            actions={studioActions}
            onRetry={retry}
            onCopyText={(value) => void copyPrompt(value)}
            onExample={(value) => focusComposer(value)}
            onCancel={cancel}
          />

          <Composer
            text={text}
            onTextChange={setText}
            size={size}
            onSizeChange={setSize}
            count={count}
            onCountChange={setCount}
            styles={styles}
            onToggleStyle={(id) => setStyles((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]))}
            base={base}
            onClearBase={() => pin(undefined)}
            original={original}
            includeOriginal={includeOriginal}
            onIncludeOriginalChange={setIncludeOriginal}
            attachments={attachments}
            onAddFiles={addFiles}
            onRemoveAttachment={removeAttachment}
            busy={job !== null}
            elapsed={elapsed}
            onSend={submit}
            onCancel={cancel}
            textareaRef={textareaRef}
          />
        </main>
      ) : (
        <main className="mx-auto max-w-[1600px] space-y-10 px-4 py-6 sm:px-6" aria-label="История">
          <SessionList
            sessions={sessions}
            byId={byId}
            currentId={currentId}
            onOpen={openSession}
            onDelete={(session) => setConfirm({ kind: 'session', session })}
            onNew={newSession}
          />
          <Gallery
            total={galleryTotal}
            items={gallery}
            search={search}
            onSearchChange={setSearch}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            onClear={() => setConfirm({ kind: 'clear' })}
            onExample={(value) => {
              setTab('studio')
              focusComposer(value)
            }}
            actions={galleryActions}
            busy={job !== null}
          />
        </main>
      )}

      {settingsOpen && (
        <SettingsDialog
          baseUrl={baseUrl}
          apiKey={apiKey}
          model={model}
          onClose={() => setSettingsOpen(false)}
          onSave={(values) => {
            settings.setBaseUrl(values.baseUrl)
            settings.setApiKey(values.apiKey)
            settings.setModel(values.model === DEFAULT_MODEL ? null : values.model)
            setBaseUrl(values.baseUrl)
            setApiKey(values.apiKey)
            setModel(values.model)
            setSettingsOpen(false)
            notify('Настройки сохранены')
          }}
          onForgetKey={() => {
            cancel()
            settings.setApiKey(null)
            setApiKey('')
            setSettingsOpen(false)
            notify('Ключ удалён из браузера', 'info')
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'clear' ? 'Очистить историю?' : 'Удалить сессию?'}
          message={
            confirm.kind === 'clear'
              ? 'Все сессии, изображения и промпты будут удалены из этого браузера без возможности восстановления.'
              : `Сессия «${confirm.session.title}» и все её изображения будут удалены без возможности восстановления.`
          }
          confirmLabel={confirm.kind === 'clear' ? 'Очистить' : 'Удалить'}
          onConfirm={() => void confirmAction()}
          onClose={() => setConfirm(null)}
        />
      )}

      {lightbox && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          index={Math.min(lightbox.index, lightboxItems.length - 1)}
          onIndexChange={(index) => setLightbox((s) => (s ? { ...s, index } : s))}
          onClose={closeLightbox}
          onDownload={(meta) => void download(meta)}
          getParent={getParent}
          onRefine={lightbox.studio ? studioActions.onRefine : refine}
        />
      )}
    </div>
  )
}
