import { loadLegacy, saveProject, saveVersion } from './db'
import { DEFAULT_MODEL } from './models'
import { settings } from './settings'
import type { Project, Version } from '../types'

interface LegacyMeta {
  id: string
  prompt: string
  model: string
  size: string
  createdAt: number
  favorite: boolean
  mime: string
  remoteUrl?: string
  kind?: 'generated' | 'upload'
  sessionId?: string
  parentId?: string
  inputIds?: string[]
  version?: number
}

interface LegacySession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

const IMPORT_PROJECT_ID = 'legacy-import'

/** Переносит историю прежней версии (сессии и изображения) в проекты и версии. Выполняется один раз. */
export async function migrateLegacy(importTitle: string): Promise<boolean> {
  if (settings.isMigrated()) return false
  const { metas, sessions } = await loadLegacy<LegacyMeta, LegacySession>()
  const generated = metas.filter((m) => m.kind !== 'upload')
  if (generated.length === 0) {
    settings.setMigrated()
    return false
  }

  const projects = new Map<string, Project>()
  for (const session of sessions) {
    projects.set(session.id, {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })
  }

  const ids = new Set(generated.map((m) => m.id))
  const ordered = [...generated].sort((a, b) => a.createdAt - b.createdAt)
  const counters = new Map<string, number>()

  const versions: Version[] = ordered.map((meta) => {
    const projectId = meta.sessionId && projects.has(meta.sessionId) ? meta.sessionId : IMPORT_PROJECT_ID
    if (!projects.has(projectId)) {
      projects.set(projectId, { id: projectId, title: importTitle, createdAt: meta.createdAt, updatedAt: meta.createdAt })
    }
    const number = (counters.get(projectId) ?? 0) + 1
    counters.set(projectId, number)
    const project = projects.get(projectId)
    if (project && meta.createdAt > project.updatedAt) project.updatedAt = meta.createdAt
    return {
      id: meta.id,
      projectId,
      parentId: meta.parentId && ids.has(meta.parentId) ? meta.parentId : undefined,
      number,
      createdAt: meta.createdAt,
      kind: meta.parentId ? 'edit' : 'generate',
      status: 'done',
      recipe: {
        model: meta.model || DEFAULT_MODEL,
        prompt: meta.prompt,
        size: meta.size,
        n: 1,
        refs: (meta.inputIds ?? []).map((imageId) => ({ imageId, role: 'other' as const })),
      },
      imageId: meta.id,
      mime: meta.mime,
      remoteUrl: meta.remoteUrl,
      favorite: meta.favorite || undefined,
    }
  })

  await Promise.all([...projects.values()].map(saveProject))
  await Promise.all(versions.map(saveVersion))
  settings.setMigrated()
  return true
}
