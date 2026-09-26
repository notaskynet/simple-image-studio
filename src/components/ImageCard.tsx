import { Clipboard, Copy, Download, ImageOff, RefreshCw, Star, Trash2, Wand } from 'lucide-react'
import { useState } from 'react'

import { useImageUrl } from '../hooks/useImageUrl'
import { useInView } from '../hooks/useInView'
import { formatBySize } from '../lib/presets'
import type { GenerationMeta } from '../types'
import { focusRing } from './ui'

export interface CardActions {
  onOpen: (meta: GenerationMeta) => void
  onDownload: (meta: GenerationMeta) => void
  onCopyImage: (meta: GenerationMeta) => void
  onCopyPrompt: (meta: GenerationMeta) => void
  onRepeat: (meta: GenerationMeta) => void
  onRefine: (meta: GenerationMeta) => void
  onToggleFavorite: (meta: GenerationMeta) => void
  onDelete: (meta: GenerationMeta) => void
}

interface ImageCardProps {
  meta: GenerationMeta
  actions: CardActions
  busy: boolean
}

const actionButton = `inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`

export function ImageCard({ meta, actions, busy }: ImageCardProps) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const url = useImageUrl(meta, inView)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const format = formatBySize(meta.size)
  const date = new Date(meta.createdAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <article
      ref={ref}
      className="group mb-4 break-inside-avoid overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-lg hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-black/30"
    >
      <button
        type="button"
        onClick={() => actions.onOpen(meta)}
        className={`relative block w-full overflow-hidden ${focusRing} focus-visible:-outline-offset-4`}
        style={{ aspectRatio: `${format.width} / ${format.height}` }}
        aria-label={`Открыть изображение: ${meta.prompt}`}
      >
        {!loaded && !failed && <span className="shimmer absolute inset-0" aria-hidden="true" />}
        {failed && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <ImageOff className="size-6" aria-hidden="true" />
            Изображение недоступно
          </span>
        )}
        {url && !failed && (
          <img
            src={url}
            alt={meta.prompt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.02] ${
              loaded ? 'animate-fade-in' : 'opacity-0'
            }`}
          />
        )}
      </button>

      <div className="space-y-2 p-3">
        <p className="line-clamp-2 px-1 text-sm leading-snug text-zinc-700 dark:text-zinc-300" title={meta.prompt}>
          {meta.prompt}
        </p>
        <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="truncate">
            {date} · {meta.model}
          </span>
          <span className="shrink-0 tabular-nums">{meta.size.replace('x', '×')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Действия с изображением">
          <button
            type="button"
            className={actionButton}
            onClick={() => actions.onToggleFavorite(meta)}
            aria-label={meta.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={meta.favorite}
            title={meta.favorite ? 'Убрать из избранного' : 'В избранное'}
          >
            <Star
              className={`size-4 ${meta.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={() => actions.onDownload(meta)}
            aria-label="Скачать"
            title="Скачать"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={() => actions.onCopyImage(meta)}
            aria-label="Копировать изображение"
            title="Копировать изображение"
          >
            <Copy className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={() => actions.onCopyPrompt(meta)}
            aria-label="Копировать промпт"
            title="Копировать промпт"
          >
            <Clipboard className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={() => actions.onRepeat(meta)}
            disabled={busy}
            aria-label="Повторить"
            title="Повторить"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={() => actions.onRefine(meta)}
            aria-label="Изменить в Студии"
            title="Изменить"
          >
            <Wand className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${actionButton} ml-auto hover:text-rose-600! dark:hover:text-rose-400!`}
            onClick={() => actions.onDelete(meta)}
            aria-label="Удалить"
            title="Удалить"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
