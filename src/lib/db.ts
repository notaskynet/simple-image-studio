import { clear, createStore, del, get, set, values } from 'idb-keyval'

import type { GenerationMeta, Session } from '../types'

const metaStore = createStore('aitunnel-history', 'meta')
const imageStore = createStore('aitunnel-images', 'images')
const sessionStore = createStore('studio-sessions', 'sessions')

const urlCache = new Map<string, string>()

function revoke(id: string): void {
  const url = urlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(id)
}

export async function loadHistory(): Promise<GenerationMeta[]> {
  const items = await values<GenerationMeta>(metaStore)
  return items.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveGeneration(meta: GenerationMeta, blob: Blob | undefined): Promise<void> {
  if (blob) {
    await set(meta.id, blob, imageStore)
    urlCache.set(meta.id, URL.createObjectURL(blob))
  }
  await set(meta.id, meta, metaStore)
}

export async function updateMeta(meta: GenerationMeta): Promise<void> {
  await set(meta.id, meta, metaStore)
}

export async function deleteGeneration(id: string): Promise<void> {
  await Promise.all([del(id, metaStore), del(id, imageStore)])
  revoke(id)
}

export async function clearHistory(): Promise<void> {
  await Promise.all([clear(metaStore), clear(imageStore), clear(sessionStore)])
  for (const id of [...urlCache.keys()]) revoke(id)
}

export async function getImageBlob(meta: GenerationMeta): Promise<Blob | null> {
  const blob = await get<Blob>(meta.id, imageStore)
  if (blob) return blob
  if (!meta.remoteUrl) return null
  const response = await fetch(meta.remoteUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.blob()
}

export async function getImageUrl(meta: GenerationMeta): Promise<string | null> {
  const cached = urlCache.get(meta.id)
  if (cached) return cached
  const blob = await get<Blob>(meta.id, imageStore)
  if (!blob) return meta.remoteUrl ?? null
  const url = URL.createObjectURL(blob)
  urlCache.set(meta.id, url)
  return url
}

export function peekImageUrl(meta: GenerationMeta): string | null {
  return urlCache.get(meta.id) ?? null
}

export async function loadSessions(): Promise<Session[]> {
  const items = await values<Session>(sessionStore)
  return items.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveSession(session: Session): Promise<void> {
  await set(session.id, session, sessionStore)
}

export async function deleteSession(session: Session, imageIds: string[]): Promise<void> {
  await del(session.id, sessionStore)
  await Promise.all(imageIds.map((id) => deleteGeneration(id)))
}
