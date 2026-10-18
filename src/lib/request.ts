import { isEdit, requestFields, type GenerateParams } from './api'
import { getImageBlob } from './db'
import { AppError } from './errors'
import { imageSizeOf, toMarkedImage, toNativeMask } from './image'
import type { ModelProfile } from './models'
import type { RefRole, Recipe, SentRequest, Version } from '../types'

export type RequestParams = Omit<GenerateParams, 'baseUrl' | 'apiKey' | 'signal'>

export interface BuiltRequest {
  params: RequestParams
  sent: SentRequest
}

interface BuildInput {
  recipe: Recipe
  /** Версия, от которой идёт правка. Без неё — новая генерация. */
  base?: Version
  profile: ModelProfile
  disabled: string[]
}

const ROLE_LINES: Record<RefRole, (n: number, note?: string) => string> = {
  style: (n) => `Image ${n} is a style reference: match its look and feel, not its content.`,
  subject: (n) => `Image ${n} shows an object to include in the result.`,
  character: (n) => `Image ${n} shows a character; keep their appearance consistent.`,
  other: (n) => `Image ${n} is an additional reference.`,
  custom: (n, note) => (note?.trim() ? `Image ${n}: ${note.trim()}` : `Image ${n} is an additional reference.`),
}

type MaskKind = 'native' | 'visual'

function composePrompt(recipe: Recipe, edit: boolean, mask: MaskKind | undefined): string {
  const text = recipe.prompt.trim()
  const firstRef = edit ? 2 : 1
  const roles = recipe.refs.map((ref, i) => ROLE_LINES[ref.role](firstRef + i, ref.note))
  const refBlock = roles.length > 0 ? `\n\n${roles.join('\n')}` : ''

  if (!edit) return `${text}${refBlock}`
  if (mask === 'visual') {
    return `Change only the area highlighted in red: ${text}\nRemove the red highlight from the result. Keep everything else exactly the same.${refBlock}`
  }
  if (mask === 'native') {
    return `Change: ${text}\nKeep everything outside the masked area exactly the same.${refBlock}`
  }
  return `Change: ${text}\nKeep everything else exactly the same.${refBlock}`
}

async function requireBlob(imageId: string | undefined, remoteUrl?: string): Promise<Blob> {
  let blob: Blob | null = null
  try {
    blob = await getImageBlob(imageId, remoteUrl)
  } catch {
    blob = null
  }
  if (!blob) throw new AppError('image_missing')
  return blob
}

/**
 * Собирает запрос к API. Состояние правки — это сама картинка (одно изображение + короткая инструкция),
 * а не история прошлых правок.
 */
export async function buildRequest({ recipe, base, profile, disabled }: BuildInput): Promise<BuiltRequest> {
  const edit = !!base
  const baseBlob = base ? await requireBlob(base.imageId, base.remoteUrl) : undefined
  const maxRefs = Math.max(0, profile.maxRefs - (edit ? 1 : 0))
  const refBlobs = await Promise.all(recipe.refs.slice(0, maxRefs).map((ref) => requireBlob(ref.imageId)))

  let maskKind: MaskKind | undefined
  let mask: Blob | undefined
  let primary = baseBlob
  if (baseBlob && recipe.maskId && profile.mask !== 'none') {
    const paint = await requireBlob(recipe.maskId)
    if (profile.mask === 'native') {
      mask = await toNativeMask(paint, await imageSizeOf(baseBlob))
      maskKind = 'native'
    } else {
      primary = await toMarkedImage(baseBlob, paint)
      maskKind = 'visual'
    }
  }

  const images = [...(primary ? [primary] : []), ...refBlobs]
  const omitted: string[] = []

  const sendQuality = profile.quality.length > 0 && !!recipe.quality && !disabled.includes('quality')
  const sendBackground = profile.background && recipe.background === 'transparent' && !disabled.includes('background')
  const negative = recipe.negative?.trim()
  const sendNegative = profile.negative && !!negative && !disabled.includes('negative_prompt')
  const sendFidelity = edit && profile.inputFidelity && !disabled.includes('input_fidelity')

  if (recipe.quality && !sendQuality) omitted.push('quality')
  if (recipe.background === 'transparent' && !sendBackground) omitted.push('background')
  if (negative && !sendNegative) omitted.push('negative_prompt')
  if (recipe.maskId && edit && profile.mask === 'none') omitted.push('mask')

  const params: RequestParams = {
    model: recipe.model,
    prompt: composePrompt(recipe, edit, maskKind),
    size: profile.sizes.includes(recipe.size) ? recipe.size : (profile.sizes[0] ?? recipe.size),
    count: recipe.n,
    quality: sendQuality ? recipe.quality : undefined,
    background: sendBackground ? 'transparent' : undefined,
    negativePrompt: sendNegative ? negative : undefined,
    inputFidelity: sendFidelity ? 'high' : undefined,
    images: images.length > 0 ? images : undefined,
    mask,
    singleOnly: !profile.n,
  }

  const sent: SentRequest = {
    endpoint: isEdit(params) ? 'edits' : 'generations',
    fields: requestFields({ ...params, baseUrl: '', apiKey: '', signal: new AbortController().signal }, params.singleOnly ? 1 : params.count),
    imageCount: images.length,
    maskKind,
    omitted,
    at: Date.now(),
  }
  return { params, sent }
}
