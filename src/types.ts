export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export type StyleId = 'photo' | 'anime' | 'watercolor' | '3d' | 'pixel' | 'minimal'

export type Theme = 'light' | 'dark'

export type ImageKind = 'generated' | 'upload'

export interface GenerationMeta {
  id: string
  prompt: string
  styles: StyleId[]
  model: string
  size: ImageSize
  createdAt: number
  favorite: boolean
  mime: string
  remoteUrl?: string
  kind?: ImageKind
  sessionId?: string
  parentId?: string
  inputIds?: string[]
  includeOriginal?: boolean
  version?: number
}

export interface UserTurn {
  id: string
  role: 'user'
  text: string
  styles: StyleId[]
  size: ImageSize
  count: number
  baseId?: string
  attachmentIds: string[]
  includeOriginal: boolean
  createdAt: number
}

export interface AssistantTurn {
  id: string
  role: 'assistant'
  requestId: string
  imageIds: string[]
  error?: string
  createdAt: number
}

export type Turn = UserTurn | AssistantTurn

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  turns: Turn[]
}

export interface StudioRequest {
  text: string
  styles: StyleId[]
  size: ImageSize
  count: number
  baseId?: string
  attachmentIds: string[]
  includeOriginal: boolean
}
