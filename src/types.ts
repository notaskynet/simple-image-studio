export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export type StyleId = 'photo' | 'anime' | 'watercolor' | '3d' | 'pixel' | 'minimal'

export type Theme = 'light' | 'dark'

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
}

export interface GenerationRequest {
  prompt: string
  styles: StyleId[]
  size: ImageSize
  count: number
}
