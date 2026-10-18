import { clear, createStore, del, get, set, values } from 'idb-keyval'

import type { Project, Version } from '../types'

// Хранилище изображений осталось от прежней версии приложения, чтобы не копировать blob-ы при миграции.
const imageStore = createStore('aitunnel-images', 'images')
const projectStore = createStore('studio-projects', 'projects')
const versionStore = createStore('studio-versions', 'versions')
const legacyMetaStore = createStore('aitunnel-history', 'meta')
const legacySessionStore = createStore('studio-sessions', 'sessions')

const urlCache = new Map<string, string>()

function revoke(id: string): void {
  const url = urlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(id)
}

export async function saveImage(id: string, blob: Blob): Promise<void> {
  await set(id, blob, imageStore)
  revoke(id)
  urlCache.set(id, URL.createObjectURL(blob))
}

export async function getImageBlob(id: string | undefined, remoteUrl?: string): Promise<Blob | null> {
  if (id) {
    const blob = await get<Blob>(id, imageStore)
    if (blob) return blob
  }
  if (!remoteUrl) return null
  const response = await fetch(remoteUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.blob()
}

export async function getImageUrl(id: string | undefined, remoteUrl?: string): Promise<string | null> {
  if (id) {
    const cached = urlCache.get(id)
    if (cached) return cached
    const blob = await get<Blob>(id, imageStore)
    if (blob) {
      const url = URL.createObjectURL(blob)
      urlCache.set(id, url)
      return url
    }
  }
  return remoteUrl ?? null
}

export function peekImageUrl(id: string | undefined): string | null {
  return id ? (urlCache.get(id) ?? null) : null
}

export async function deleteImages(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => del(id, imageStore)))
  ids.forEach(revoke)
}

export async function loadProjects(): Promise<Project[]> {
  const items = await values<Project>(projectStore)
  return items.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveProject(project: Project): Promise<void> {
  await set(project.id, project, projectStore)
}

export async function loadVersions(): Promise<Version[]> {
  return values<Version>(versionStore)
}

export async function saveVersion(version: Version): Promise<void> {
  await set(version.id, version, versionStore)
}

export async function removeVersionRecord(id: string): Promise<void> {
  await del(id, versionStore)
}

export async function removeProjectRecords(projectId: string, versionIds: string[]): Promise<void> {
  await Promise.all([del(projectId, projectStore), ...versionIds.map((id) => del(id, versionStore))])
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    clear(projectStore),
    clear(versionStore),
    clear(imageStore),
    clear(legacyMetaStore),
    clear(legacySessionStore),
  ])
  for (const id of [...urlCache.keys()]) revoke(id)
}

export async function loadLegacy<M, S>(): Promise<{ metas: M[]; sessions: S[] }> {
  const [metas, sessions] = await Promise.all([values<M>(legacyMetaStore), values<S>(legacySessionStore)])
  return { metas, sessions }
}
