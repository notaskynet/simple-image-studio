import type { ImageSize } from '../types'

const ENDPOINT = 'https://api.aitunnel.ru/v1/images/generations'

export interface GeneratedImage {
  blob?: Blob
  url?: string
}

export interface GenerateParams {
  apiKey: string
  model: string
  prompt: string
  size: ImageSize
  count: number
  signal: AbortSignal
}

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiImageItem {
  b64_json?: string
  url?: string
}

interface ApiResponse {
  data?: ApiImageItem[]
  error?: { message?: string } | string
  message?: string
}

const BALANCE_PATTERN = /insufficient|balance|quota|credit|funds|баланс|средств/i
const MODEL_PATTERN = /model|модел/i

function extractMessage(body: ApiResponse | null): string | null {
  if (!body) return null
  if (typeof body.error === 'string') return body.error
  return body.error?.message ?? body.message ?? null
}

function toUserMessage(status: number, message: string | null, model: string): string {
  if (status === 401) return 'Неверный ключ'
  if (status === 402 || (message && BALANCE_PATTERN.test(message))) return 'Пополните баланс'
  if (status === 404 || (status === 400 && message && MODEL_PATTERN.test(message))) {
    return `Модель «${model}» недоступна${message ? `: ${message}` : ''}`
  }
  return message ?? `Ошибка HTTP ${status}`
}

function detectMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
  return 'image/png'
}

function base64ToBlob(b64: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: detectMime(bytes) })
}

async function urlToImage(url: string, signal: AbortSignal): Promise<GeneratedImage> {
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return { url }
    const blob = await response.blob()
    return blob.type.startsWith('image/') ? { blob } : { url }
  } catch (error) {
    if (signal.aborted) throw error
    return { url }
  }
}

async function requestImages(params: GenerateParams, n: number): Promise<GeneratedImage[]> {
  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: params.model, prompt: params.prompt, size: params.size, n }),
      signal: params.signal,
    })
  } catch (error) {
    if (params.signal.aborted) throw error
    throw new ApiError('Нет соединения')
  }

  let body: ApiResponse | null = null
  try {
    body = (await response.json()) as ApiResponse
  } catch (error) {
    if (params.signal.aborted) throw error
  }

  if (!response.ok) {
    throw new ApiError(toUserMessage(response.status, extractMessage(body), params.model), response.status)
  }

  const items = body?.data ?? []
  const images = await Promise.all(
    items.map(async (item): Promise<GeneratedImage | null> => {
      if (item.b64_json) return { blob: base64ToBlob(item.b64_json) }
      if (item.url) return urlToImage(item.url, params.signal)
      return null
    }),
  )
  const result = images.filter((image): image is GeneratedImage => image !== null)
  if (result.length === 0) throw new ApiError(extractMessage(body) ?? 'Сервер не вернул изображений')
  return result
}

async function requestParallel(params: GenerateParams, count: number): Promise<GeneratedImage[]> {
  const settled = await Promise.allSettled(Array.from({ length: count }, () => requestImages(params, 1)))
  const images = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (images.length > 0) return images
  const failure = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  throw failure?.reason ?? new ApiError('Сервер не вернул изображений')
}

function isNotSupportedN(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status === null) return false
  return error.status === 400 || error.status === 422
}

const singleImageModels = new Set<string>()

export async function generateImages(params: GenerateParams): Promise<GeneratedImage[]> {
  if (params.count <= 1) return requestImages(params, 1)
  if (singleImageModels.has(params.model)) return requestParallel(params, params.count)

  let images: GeneratedImage[]
  try {
    images = await requestImages(params, params.count)
  } catch (error) {
    if (!isNotSupportedN(error)) throw error
    const result = await requestParallel(params, params.count)
    singleImageModels.add(params.model)
    return result
  }

  const missing = params.count - images.length
  if (missing <= 0) return images.slice(0, params.count)
  try {
    return [...images, ...(await requestParallel(params, missing))]
  } catch (error) {
    if (params.signal.aborted) throw error
    return images
  }
}
