import type { StoredError } from './lib/errors'

export type Theme = 'light' | 'dark'

export type Lang = 'ru' | 'en'

export type RefRole = 'style' | 'subject' | 'character' | 'other' | 'custom'

export interface Ref {
  imageId: string
  role: RefRole
  /** Описание роли для role = 'custom'. */
  note?: string
}

export type Background = 'auto' | 'transparent'

/** Всё, что пользователь задаёт для одной генерации. */
export interface Recipe {
  model: string
  prompt: string
  negative?: string
  size: string
  quality?: string
  n: number
  background?: Background
  maskId?: string
  refs: Ref[]
}

/** Что реально ушло в API (показывается в инспекторе запроса). */
export interface SentRequest {
  endpoint: 'generations' | 'edits'
  fields: Record<string, string>
  imageCount: number
  maskKind?: 'native' | 'visual'
  omitted: string[]
  at: number
}

export type VersionKind = 'generate' | 'edit' | 'upload'

export type VersionStatus = 'pending' | 'done' | 'error'

export interface Version {
  id: string
  projectId: string
  parentId?: string
  batchId?: string
  number: number
  createdAt: number
  kind: VersionKind
  status: VersionStatus
  error?: StoredError
  recipe: Recipe
  sent?: SentRequest
  /** Ответы провайдера без картинок: usage, стоимость и т.п. */
  response?: Record<string, unknown>[]
  imageId?: string
  mime?: string
  remoteUrl?: string
  favorite?: boolean
}

export interface Project {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}
