import { AppError } from './errors'

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
  size: string
  count: number
  quality?: string
  background?: string
  negativePrompt?: string
  inputFidelity?: string
  images?: Blob[]
  mask?: Blob
  /** Модель не принимает n > 1: варианты создаются отдельными запросами. */
  singleOnly?: boolean
  signal: AbortSignal
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

const KNOWN_PATHS = [GENERATIONS_PATH, EDITS_PATH]

export function resolveApiUrl(baseUrl: string, path: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '')
  const known = KNOWN_PATHS.find((p) => base.endsWith(p))
  if (known) base = base.slice(0, -known.length)
  return `${base}${path}`
}

export function isEdit(params: Pick<GenerateParams, 'images'>): boolean {
  return !!params.images && params.images.length > 0
}

/** Текстовые поля запроса — ровно то, что уходит в API (и показывается в инспекторе). */
export function requestFields(params: GenerateParams, n: number): Record<string, string> {
  const fields: Record<string, string> = {
    model: params.model,
    prompt: params.prompt,
    size: params.size,
    n: String(n),
  }
  if (params.quality) fields.quality = params.quality
  if (params.background) fields.background = params.background
  if (params.negativePrompt) fields.negative_prompt = params.negativePrompt
  if (isEdit(params) && params.inputFidelity) fields.input_fidelity = params.inputFidelity
  return fields
}

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function buildBody(params: GenerateParams, n: number): { body: BodyInit; json: boolean } {
  const fields = requestFields(params, n)
  if (!isEdit(params)) return { body: JSON.stringify({ ...fields, n }), json: true }

  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  const images = params.images ?? []
  const field = images.length > 1 ? 'image[]' : 'image'
  images.forEach((blob, i) => {
    form.append(field, blob, `image-${i + 1}.${EXTENSIONS[blob.type] ?? 'png'}`)
  })
  if (params.mask) form.append('mask', params.mask, 'mask.png')
  return { body: form, json: false }
}

const MAX_RAW = 4000
const BALANCE_PATTERN = /insufficient|balance|quota|credit|funds|баланс|средств/i
const MODEL_PATTERN = /model|модел/i
const REJECTABLE = ['quality', 'background', 'negative_prompt', 'input_fidelity', 'mask'] as const
const COUNT_PATTERN = /\bn\b|number of images|num_images|max_images|too many images|count/i

export function extractMessage(body: ApiResponse | null): string | null {
  if (!body) return null
  if (typeof body.error === 'string') return body.error
  return body.error?.message ?? body.message ?? null
}

export function findRejectedParam(message: string | null): string | null {
  if (!message) return null
  const lower = message.toLowerCase()
  return REJECTABLE.find((name) => lower.includes(name)) ?? null
}

function classify(status: number, message: string | null, raw: string): AppError {
  if (status === 401) return new AppError('invalid_key', { status, raw })
  if (status === 402 || (message && BALANCE_PATTERN.test(message))) return new AppError('no_balance', { status, raw })
  if (status === 400 || status === 422) {
    const param = findRejectedParam(message)
    if (param === 'mask') return new AppError('mask_unsupported', { status, detail: message, param, raw })
    if (param) return new AppError('param_rejected', { status, detail: message, param, raw })
  }
  if (status === 404 || (status === 400 && message && MODEL_PATTERN.test(message))) {
    return new AppError('model_unavailable', { status, detail: message, raw })
  }
  return new AppError('http', { status, detail: message ?? `HTTP ${status}`, raw })
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
  const edit = isEdit(params)
  const { body: requestBody, json } = buildBody(params, n)
  const headers: Record<string, string> = { Authorization: `Bearer ${params.apiKey}` }
  if (json) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(resolveApiUrl(params.baseUrl, edit ? EDITS_PATH : GENERATIONS_PATH), {
      method: 'POST',
      headers,
      body: requestBody,
      signal: params.signal,
    })
  } catch (error) {
    if (params.signal.aborted) throw error
    throw new AppError('network')
  }

  let text = ''
  try {
    text = await response.text()
  } catch (error) {
    if (params.signal.aborted) throw error
  }
  let body: ApiResponse | null = null
  try {
    body = JSON.parse(text) as ApiResponse
  } catch {
    body = null
  }
  const raw = text.slice(0, MAX_RAW)

  if (!response.ok) {
    const message = extractMessage(body)
    // 404 с упоминанием модели — это не «правка не поддерживается», а неверная модель: покажет classify().
    if (edit && (response.status === 404 || response.status === 405) && !(message && MODEL_PATTERN.test(message))) {
      throw new AppError('edits_unsupported', { status: response.status, detail: message, raw })
    }
    throw classify(response.status, message, raw)
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
  if (result.length === 0) {
    const message = extractMessage(body)
    throw message ? new AppError('http', { detail: message, raw }) : new AppError('empty', { raw })
  }
  return result
}

async function requestParallel(params: GenerateParams, count: number): Promise<GeneratedImage[]> {
  const settled = await Promise.allSettled(Array.from({ length: count }, () => requestImages(params, 1)))
  const images = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (images.length > 0) return images
  const failure = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  throw failure?.reason ?? new AppError('empty')
}

/** Ошибка похожа на «параметр n не поддерживается», а не на мусорный prompt, размер или модерацию. */
function isNotSupportedN(error: unknown): boolean {
  if (!(error instanceof AppError)) return false
  if (error.status !== 400 && error.status !== 422) return false
  if (error.code !== 'http' && error.code !== 'model_unavailable') return false
  if (!error.detail || error.detail.startsWith('HTTP ')) return error.code === 'http'
  return COUNT_PATTERN.test(error.detail)
}

const singleImageModels = new Set<string>()

function modelKey(params: GenerateParams): string {
  return `${isEdit(params) ? 'edit' : 'gen'}:${params.model}`
}

export async function generateImages(params: GenerateParams): Promise<GeneratedImage[]> {
  if (params.count <= 1) return requestImages(params, 1)
  if (params.singleOnly || singleImageModels.has(modelKey(params))) return requestParallel(params, params.count)

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
