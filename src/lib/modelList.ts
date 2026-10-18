import { resolveApiUrl } from './api'
import { AppError } from './errors'

export interface RemoteModels {
  /** Модели, похожие на модели изображений. Если таких нет — все модели провайдера. */
  models: string[]
  total: number
}

interface RemoteEntry {
  id?: string
  architecture?: { output_modalities?: string[] }
  output_modalities?: string[]
}

const IMAGE_PATTERN =
  /image|dall-?e|flux|sdxl|stable-diffusion|(^|[/-])sd\d|imagen|midjourney|nano[-\s]?banana|seedream|recraft|ideogram|kolors|hunyuan|qwen-image/i

function isImageModel(entry: RemoteEntry): boolean {
  const modalities = entry.architecture?.output_modalities ?? entry.output_modalities
  if (modalities) return modalities.includes('image')
  return IMAGE_PATTERN.test(entry.id ?? '')
}

/**
 * Список моделей через GET /models. Стандартный API отдаёт только идентификаторы, поэтому параметры модели
 * по-прежнему определяются профилем по имени (их можно поправить в настройках).
 */
export async function fetchModels(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<RemoteModels> {
  let response: Response
  try {
    response = await fetch(resolveApiUrl(baseUrl, '/models'), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new AppError('network')
  }
  if (response.status === 401) throw new AppError('invalid_key', { status: 401 })
  if (!response.ok) throw new AppError('http', { status: response.status, detail: `HTTP ${response.status}` })

  const body = (await response.json().catch(() => null)) as { data?: RemoteEntry[] } | RemoteEntry[] | null
  const entries = (Array.isArray(body) ? body : body?.data) ?? []
  const all = entries.filter((e): e is RemoteEntry & { id: string } => typeof e.id === 'string' && e.id !== '')
  const images = all.filter(isImageModel).map((e) => e.id)
  const ids = images.length > 0 ? images : all.map((e) => e.id)
  return { models: [...new Set(ids)].sort((a, b) => a.localeCompare(b)), total: all.length }
}
