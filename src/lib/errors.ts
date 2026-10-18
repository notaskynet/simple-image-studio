export type ErrorCode =
  | 'invalid_key'
  | 'no_balance'
  | 'model_unavailable'
  | 'edits_unsupported'
  | 'network'
  | 'empty'
  | 'http'
  | 'param_rejected'
  | 'mask_unsupported'
  | 'image_missing'
  | 'heic'
  | 'canvas'
  | 'clipboard'
  | 'interrupted'
  | 'cancelled'
  | 'unknown'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number | null
  readonly detail: string | null
  readonly param: string | null
  /** Тело ответа провайдера как есть — чтобы видеть реальную причину ошибки. */
  readonly raw: string | null

  constructor(
    code: ErrorCode,
    options: { status?: number | null; detail?: string | null; param?: string | null; raw?: string | null } = {},
  ) {
    super(options.detail ?? code)
    this.name = 'AppError'
    this.code = code
    this.status = options.status ?? null
    this.detail = options.detail ?? null
    this.param = options.param ?? null
    this.raw = options.raw ?? null
  }
}

export interface StoredError {
  code: ErrorCode
  detail?: string
  status?: number
  raw?: string
}

export function toStoredError(error: unknown): StoredError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      detail: error.detail ?? undefined,
      status: error.status ?? undefined,
      raw: error.raw ?? undefined,
    }
  }
  if (error instanceof Error && error.message) return { code: 'unknown', detail: error.message }
  return { code: 'unknown' }
}

export function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return !!signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')
}
