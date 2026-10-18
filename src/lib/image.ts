import { AppError } from './errors'
import type { Version } from '../types'

const MAX_SIDE = 2048

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function buildFileName(version: Version, mime: string): string {
  const slug =
    version.recipe.prompt
      .trim()
      .toLowerCase()
      .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? '')
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'image'
  const d = new Date(version.createdAt)
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  return `${slug}_v${version.number}_${stamp}.${EXTENSIONS[mime] ?? 'png'}`
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new AppError('canvas'))), type, quality)
  })
}

export async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob)
  } catch {
    throw new AppError('canvas')
  }
}

function newCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new AppError('canvas')
  return { canvas, context }
}

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob
  const bitmap = await loadBitmap(blob)
  const { canvas, context } = newCanvas(bitmap.width, bitmap.height)
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvasToBlob(canvas)
}

export async function copyImageToClipboard(load: () => Promise<Blob | null>): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new AppError('clipboard')
  const png = load().then((blob) => {
    if (!blob) throw new AppError('image_missing')
    return toPng(blob)
  })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

function isHeic(file: Blob & { name?: string }): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name ?? '')
}

/** Уменьшает загружаемые фото до разумного размера, чтобы запрос не отклонили и он не был медленным. */
export async function prepareUpload(file: Blob & { name?: string }): Promise<Blob> {
  if (isHeic(file)) throw new AppError('heic')
  const bitmap = await loadBitmap(file)
  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    const supported = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
    if (longest <= MAX_SIDE && supported) return file
    const scale = Math.min(1, MAX_SIDE / longest)
    const { canvas, context } = newCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return file.type === 'image/jpeg' ? await canvasToBlob(canvas, 'image/jpeg', 0.92) : await canvasToBlob(canvas)
  } finally {
    bitmap.close()
  }
}

export interface ImageSize {
  width: number
  height: number
}

/** Закрашенное кистью (непрозрачное) → маска в формате OpenAI: «перерисовать» = прозрачные пиксели. */
export async function toNativeMask(paint: Blob, size: ImageSize): Promise<Blob> {
  const bitmap = await loadBitmap(paint)
  const { canvas, context } = newCanvas(size.width, size.height)
  context.fillStyle = '#000'
  context.fillRect(0, 0, size.width, size.height)
  context.globalCompositeOperation = 'destination-out'
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  return canvasToBlob(canvas)
}

/** Копия картинки с красной разметкой поверх закрашенной области — для моделей без поддержки маски. */
export async function toMarkedImage(base: Blob, paint: Blob): Promise<Blob> {
  const [image, paintBitmap] = await Promise.all([loadBitmap(base), loadBitmap(paint)])
  const { canvas, context } = newCanvas(image.width, image.height)
  context.drawImage(image, 0, 0)
  const layer = newCanvas(image.width, image.height)
  layer.context.drawImage(paintBitmap, 0, 0, image.width, image.height)
  layer.context.globalCompositeOperation = 'source-in'
  layer.context.fillStyle = '#ff0000'
  layer.context.fillRect(0, 0, image.width, image.height)
  context.globalAlpha = 0.55
  context.drawImage(layer.canvas, 0, 0)
  image.close()
  paintBitmap.close()
  return canvasToBlob(canvas)
}

export async function imageSizeOf(blob: Blob): Promise<ImageSize> {
  const bitmap = await loadBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}
