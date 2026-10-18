import type { Ref } from '@/types'

export interface Draft {
  prompt: string
  negative: string
  size: string
  quality: string
  n: number
  background: boolean
  refs: Ref[]
}

export const DEFAULT_DRAFT: Draft = {
  prompt: '',
  negative: '',
  size: '1024x1024',
  quality: 'medium',
  n: 1,
  background: false,
  refs: [],
}
