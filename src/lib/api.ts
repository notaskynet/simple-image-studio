import type { ImageSize } from '../types'

const GENERATIONS_PATH = '/images/generations'
const EDITS_PATH = '/images/edits'

export interface GeneratedImage {
  blob?: Blob
  url?: string
}

export interface GenerateParams {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  size: ImageSize
  count: number
  images?: Blob[]
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

export interface ApiResponse {
  data?: ApiImageItem[]
  error?: { message?: string } | string
  message?: string
}

export function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  } catch {
    return null
  }
  return trimmed
}

const KNOWN_PATHS = [GENERATIONS_PATH, EDITS_PATH, '/chat/completions']

export function resolveApiUrl(baseUrl: string, path: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '')
  const known = KNOWN_PATHS.find((p) => base.endsWith(p))
  if (known) base = base.slice(0, -known.length)
  return `${base}${path}`
}

function resolveEndpoint(baseUrl: string, edit: boolean): string {
  return resolveApiUrl(baseUrl, edit ? EDITS_PATH : GENERATIONS_PATH)
}

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function buildBody(params: GenerateParams, n: number): { body: BodyInit; json: boolean } {
  if (!params.images || params.images.length === 0) {
    return {
      body: JSON.stringify({ model: params.model, prompt: params.prompt, size: params.size, n }),
      json: true,
    }
  }
  const form = new FormData()
  form.append('model', params.model)
  form.append('prompt', params.prompt)
  form.append('size', params.size)
  form.append('n', String(n))
  const field = params.images.length > 1 ? 'image[]' : 'image'
  params.images.forEach((blob, i) => {
    form.append(field, blob, `image-${i + 1}.${EXTENSIONS[blob.type] ?? 'png'}`)
  })
  return { body: form, json: false }
}

const BALANCE_PATTERN = /insufficient|balance|quota|credit|funds|баланс|средств/i
const MODEL_PATTERN = /model|модел/i

export function extractMessage(body: ApiResponse | null): string | null {
  if (!body) return null
  if (typeof body.error === 'string') return body.error
  return body.error?.message ?? body.message ?? null
}

export function toUserMessage(status: number, message: string | null, model: string): string {
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
  const edit = !!params.images && params.images.length > 0
  const { body: requestBody, json } = buildBody(params, n)
  const headers: Record<string, string> = { Authorization: `Bearer ${params.apiKey}` }
  if (json) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(resolveEndpoint(params.baseUrl, edit), {
      method: 'POST',
      headers,
      body: requestBody,
      signal: params.signal,
    })
  } catch (error) {
    if (params.signal.aborted) throw error
    throw new ApiError('Нет соединения с API — проверьте URL и подключение к сети')
  }

  let body: ApiResponse | null = null
  try {
    body = (await response.json()) as ApiResponse
  } catch (error) {
    if (params.signal.aborted) throw error
  }

  if (!response.ok) {
    if (edit && (response.status === 404 || response.status === 405)) {
      throw new ApiError('API не поддерживает доработку изображений (/images/edits)', response.status)
    }
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

function modelKey(params: GenerateParams): string {
  return `${params.images?.length ? 'edit' : 'gen'}:${params.model}`
}

export async function generateImages(params: GenerateParams): Promise<GeneratedImage[]> {
  if (params.count <= 1) return requestImages(params, 1)
  if (singleImageModels.has(modelKey(params))) return requestParallel(params, params.count)

  let images: GeneratedImage[]
  try {
    images = await requestImages(params, params.count)
  } catch (error) {
    if (!isNotSupportedN(error)) throw error
    const result = await requestParallel(params, params.count)
    singleImageModels.add(modelKey(params))
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
