import type { GenerationMeta } from '../types'

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

export function buildFileName(meta: GenerationMeta, mime: string): string {
  const slug =
    meta.prompt
      .trim()
      .toLowerCase()
      .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? '')
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'image'
  const d = new Date(meta.createdAt)
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  return `${slug}_${stamp}.${EXTENSIONS[mime] ?? 'png'}`
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

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas недоступен')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('Не удалось конвертировать'))), 'image/png')
  })
}

export async function copyImageToClipboard(load: () => Promise<Blob | null>): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Браузер не поддерживает копирование изображений')
  }
  const png = load().then((blob) => {
    if (!blob) throw new Error('Изображение не найдено')
    return toPng(blob)
  })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
