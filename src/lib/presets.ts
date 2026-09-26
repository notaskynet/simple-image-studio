import type { ImageSize, StyleId } from '../types'

export interface FormatOption {
  size: ImageSize
  label: string
  ratio: string
  width: number
  height: number
}

export const FORMATS: FormatOption[] = [
  { size: '1024x1024', label: 'Квадрат', ratio: '1:1', width: 1024, height: 1024 },
  { size: '1536x1024', label: 'Горизонталь', ratio: '3:2', width: 1536, height: 1024 },
  { size: '1024x1536', label: 'Вертикаль', ratio: '2:3', width: 1024, height: 1536 },
]

export interface StyleOption {
  id: StyleId
  label: string
  description: string
}

export const STYLES: StyleOption[] = [
  {
    id: 'photo',
    label: 'Фото',
    description: 'photorealistic photograph, natural lighting, high detail, shallow depth of field',
  },
  {
    id: 'anime',
    label: 'Аниме',
    description: 'anime style illustration, cel shading, vibrant colors, clean line art',
  },
  {
    id: 'watercolor',
    label: 'Акварель',
    description: 'watercolor painting, soft washes of color, visible paper texture, delicate brush strokes',
  },
  {
    id: '3d',
    label: '3D',
    description: '3D render, soft global illumination, realistic materials, high detail',
  },
  {
    id: 'pixel',
    label: 'Пиксель-арт',
    description: 'pixel art, 16-bit retro game style, crisp pixels, limited color palette',
  },
  {
    id: 'minimal',
    label: 'Минимализм',
    description: 'minimalist design, clean composition, flat colors, generous negative space',
  },
]

export const EXAMPLE_PROMPTS: string[] = [
  'Уютная кофейня в дождливый вечер, тёплый свет из окон, отражения на мокрой брусчатке',
  'Рыжий кот-астронавт парит в открытом космосе на фоне Земли',
  'Футуристический город на парящих островах среди облаков на рассвете',
]

export const COUNT_OPTIONS: number[] = [1, 2, 3, 4]

export const DEFAULT_MODEL = 'gpt-image-2'

export function formatBySize(size: ImageSize): FormatOption {
  return FORMATS.find((f) => f.size === size) ?? FORMATS[0]
}
