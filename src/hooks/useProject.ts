import { useCallback, useEffect, useRef, useState } from 'react'

import { generateImages } from '../lib/api'
import {
  clearAll,
  deleteImages,
  loadProjects,
  loadVersions,
  removeProjectRecords,
  removeVersionRecord,
  saveImage,
  saveProject,
  saveVersion,
} from '../lib/db'
import { AppError, isAbort, toStoredError } from '../lib/errors'
import { migrateLegacy } from '../lib/migrate'
import { disableParam, getDisabled, getProfile, rememberModel } from '../lib/models'
import { buildRequest } from '../lib/request'
import type { Project, Recipe, Version } from '../types'

export function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export interface ProjectApiConfig {
  baseUrl: string
  apiKey: string
}

export interface ProjectEvents {
  onError: (error: unknown) => void
  onPartial: (got: number, total: number) => void
  onParamDisabled: (param: string, model: string) => void
  onMigrated: () => void
  onLoadFailed: () => void
  onSaveFailed: () => void
}

export interface RunInput {
  projectId: string
  recipe: Recipe
  baseId?: string
  /** Вызывается синхронно, сразу после создания версий в статусе pending. */
  onCreated?: (versions: Version[]) => void
}

export function useProject(config: ProjectApiConfig, events: ProjectEvents, importTitle: string) {
  const [projects, setProjectsState] = useState<Project[]>([])
  const [versions, setVersionsState] = useState<Version[]>([])
  const [ready, setReady] = useState(false)
  const projectsRef = useRef<Project[]>([])
  const versionsRef = useRef<Version[]>([])
  const controllers = useRef(new Map<string, AbortController>())
  const configRef = useRef(config)
  const eventsRef = useRef(events)

  useEffect(() => {
    configRef.current = config
    eventsRef.current = events
  })

  const setProjects = useCallback((next: Project[]) => {
    projectsRef.current = next
    setProjectsState(next)
  }, [])

  const setVersions = useCallback((next: Version[]) => {
    versionsRef.current = next
    setVersionsState(next)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const migrated = await migrateLegacy(importTitle)
        const [storedProjects, storedVersions] = await Promise.all([loadProjects(), loadVersions()])
        const recovered = storedVersions.map((v): Version => {
          if (v.status !== 'pending') return v
          const fixed: Version = { ...v, status: 'error', error: { code: 'interrupted' } }
          void saveVersion(fixed)
          return fixed
        })
        if (!active) return
        setProjects(storedProjects)
        setVersions(recovered)
        if (migrated) eventsRef.current.onMigrated()
      } catch {
        if (active) eventsRef.current.onLoadFailed()
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [importTitle, setProjects, setVersions])

  const persistVersion = useCallback((version: Version) => {
    saveVersion(version).catch(() => eventsRef.current.onSaveFailed())
  }, [])

  const touchProject = useCallback(
    (projectId: string) => {
      const current = projectsRef.current.find((p) => p.id === projectId)
      if (!current) return
      const next = { ...current, updatedAt: Date.now() }
      setProjects([next, ...projectsRef.current.filter((p) => p.id !== projectId)])
      saveProject(next).catch(() => eventsRef.current.onSaveFailed())
    },
    [setProjects],
  )

  const patchVersion = useCallback(
    (id: string, patch: Partial<Version>, save = true) => {
      const current = versionsRef.current.find((v) => v.id === id)
      if (!current) return
      const next = { ...current, ...patch }
      setVersions(versionsRef.current.map((v) => (v.id === id ? next : v)))
      if (save) persistVersion(next)
    },
    [persistVersion, setVersions],
  )

  const addVersions = useCallback(
    (added: Version[]) => {
      setVersions([...versionsRef.current, ...added])
      added.forEach(persistVersion)
    },
    [persistVersion, setVersions],
  )

  const nextNumber = useCallback(
    (projectId: string) =>
      versionsRef.current.filter((v) => v.projectId === projectId).reduce((max, v) => Math.max(max, v.number), 0) + 1,
    [],
  )

  const createProject = useCallback(
    (title: string): Project => {
      const now = Date.now()
      const project: Project = { id: createId(), title, createdAt: now, updatedAt: now }
      setProjects([project, ...projectsRef.current])
      saveProject(project).catch(() => eventsRef.current.onSaveFailed())
      return project
    },
    [setProjects],
  )

  const renameProject = useCallback(
    (id: string, title: string) => {
      const current = projectsRef.current.find((p) => p.id === id)
      if (!current || !title.trim()) return
      const next = { ...current, title: title.trim() }
      setProjects(projectsRef.current.map((p) => (p.id === id ? next : p)))
      saveProject(next).catch(() => eventsRef.current.onSaveFailed())
    },
    [setProjects],
  )

  const collectImageIds = useCallback((list: Version[]): string[] => {
    const ids = new Set<string>()
    for (const v of list) {
      if (v.imageId) ids.add(v.imageId)
      if (v.recipe.maskId) ids.add(v.recipe.maskId)
      v.recipe.refs.forEach((r) => ids.add(r.imageId))
    }
    return [...ids]
  }, [])

  const cancelBatch = useCallback((batchId: string) => controllers.current.get(batchId)?.abort(), [])

  const removeProject = useCallback(
    async (id: string) => {
      const owned = versionsRef.current.filter((v) => v.projectId === id)
      owned.forEach((v) => v.batchId && controllers.current.get(v.batchId)?.abort())
      await removeProjectRecords(
        id,
        owned.map((v) => v.id),
      )
      await deleteImages(collectImageIds(owned))
      setProjects(projectsRef.current.filter((p) => p.id !== id))
      setVersions(versionsRef.current.filter((v) => v.projectId !== id))
    },
    [collectImageIds, setProjects, setVersions],
  )

  /** Удаляет версию; её потомки переходят к родителю удалённой версии. */
  const removeVersion = useCallback(
    async (id: string) => {
      const target = versionsRef.current.find((v) => v.id === id)
      if (!target) return
      if (target.batchId && target.status === 'pending') controllers.current.get(target.batchId)?.abort()
      const children = versionsRef.current.filter((v) => v.parentId === id)
      const reparented = children.map((c) => ({ ...c, parentId: target.parentId }))
      await Promise.all(reparented.map(saveVersion))
      await removeVersionRecord(id)
      const stillUsed = new Set(collectImageIds(versionsRef.current.filter((v) => v.id !== id)))
      await deleteImages(collectImageIds([target]).filter((imageId) => !stillUsed.has(imageId)))
      setVersions(
        versionsRef.current
          .filter((v) => v.id !== id)
          .map((v) => reparented.find((c) => c.id === v.id) ?? v),
      )
    },
    [collectImageIds, setVersions],
  )

  const toggleFavorite = useCallback(
    (id: string) => {
      const current = versionsRef.current.find((v) => v.id === id)
      if (current) patchVersion(id, { favorite: !current.favorite || undefined })
    },
    [patchVersion],
  )

  /** Своё фото как корневая версия — его можно править так же, как сгенерированное. */
  const addUpload = useCallback(
    async (projectId: string, blob: Blob, model: string, size: string): Promise<Version> => {
      const imageId = createId()
      await saveImage(imageId, blob)
      const version: Version = {
        id: createId(),
        projectId,
        number: nextNumber(projectId),
        createdAt: Date.now(),
        kind: 'upload',
        status: 'done',
        recipe: { model, prompt: '', size, n: 1, refs: [] },
        imageId,
        mime: blob.type || 'image/png',
      }
      addVersions([version])
      touchProject(projectId)
      return version
    },
    [addVersions, nextNumber, touchProject],
  )

  /** Сохраняет картинку без создания версии (референс или маска). */
  const saveAsset = useCallback(async (blob: Blob): Promise<string> => {
    const id = createId()
    await saveImage(id, blob)
    return id
  }, [])

  const run = useCallback(
    async ({ projectId, recipe, baseId, onCreated }: RunInput): Promise<Version[]> => {
      const base = baseId ? versionsRef.current.find((v) => v.id === baseId) : undefined
      const batchId = createId()
      const now = Date.now()
      const first = nextNumber(projectId)
      const pending = Array.from(
        { length: recipe.n },
        (_, i): Version => ({
          id: createId(),
          projectId,
          parentId: base?.id,
          batchId,
          number: first + i,
          createdAt: now + i,
          kind: base ? 'edit' : 'generate',
          status: 'pending',
          recipe,
        }),
      )
      addVersions(pending)
      touchProject(projectId)
      rememberModel(recipe.model)
      onCreated?.(pending)

      const controller = new AbortController()
      controllers.current.set(batchId, controller)
      const fail = (error: unknown) => {
        const cancelled = isAbort(error, controller.signal)
        const stored = cancelled ? { code: 'cancelled' as const } : toStoredError(error)
        pending.forEach((v) => patchVersion(v.id, { status: 'error', error: stored }))
        if (!cancelled) eventsRef.current.onError(error)
      }

      try {
        const profile = getProfile(recipe.model)
        let images: Awaited<ReturnType<typeof generateImages>> | null = null
        let sentRequest: Version['sent']
        for (let attempt = 0; attempt < 4 && !images; attempt++) {
          const built = await buildRequest({ recipe, base, profile, disabled: getDisabled(recipe.model) })
          sentRequest = built.sent
          pending.forEach((v) => patchVersion(v.id, { sent: built.sent }, false))
          try {
            images = await generateImages({ ...configRef.current, ...built.params, signal: controller.signal })
          } catch (error) {
            // Провайдер отклонил необязательный параметр: отключаем его для модели и повторяем без него.
            if (error instanceof AppError && error.code === 'param_rejected' && error.param) {
              disableParam(recipe.model, error.param)
              eventsRef.current.onParamDisabled(error.param, recipe.model)
              continue
            }
            throw error
          }
        }
        if (!images) throw new AppError('empty')
        const result = images

        await Promise.all(
          pending.map(async (version, i) => {
            const image = result[i]
            if (!image) {
              patchVersion(version.id, { status: 'error', error: { code: 'empty' } })
              return
            }
            const imageId = createId()
            if (image.blob) await saveImage(imageId, image.blob)
            patchVersion(version.id, {
              status: 'done',
              sent: sentRequest,
              imageId: image.blob ? imageId : undefined,
              mime: image.blob?.type ?? 'image/png',
              remoteUrl: image.blob ? undefined : image.url,
            })
          }),
        )
        if (result.length < pending.length) eventsRef.current.onPartial(result.length, pending.length)
      } catch (error) {
        fail(error)
      } finally {
        controllers.current.delete(batchId)
      }
      return pending
    },
    [addVersions, nextNumber, patchVersion, touchProject],
  )

  const reset = useCallback(async () => {
    controllers.current.forEach((c) => c.abort())
    await clearAll()
    setProjects([])
    setVersions([])
  }, [setProjects, setVersions])

  return {
    ready,
    projects,
    versions,
    createProject,
    renameProject,
    removeProject,
    removeVersion,
    toggleFavorite,
    addUpload,
    saveAsset,
    run,
    cancelBatch,
    reset,
  }
}
