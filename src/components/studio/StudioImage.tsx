import { Copy, Download, ImageOff, PencilLine, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { useImageUrl } from '../../hooks/useImageUrl'
import { formatBySize } from '../../lib/presets'
import type { GenerationMeta } from '../../types'
import { focusRing } from '../ui'

export interface ImageActions {
  onOpen: (meta: GenerationMeta) => void
  onRefine: (meta: GenerationMeta) => void
  onDownload: (meta: GenerationMeta) => void
  onCopyImage: (meta: GenerationMeta) => void
  onToggleFavorite: (meta: GenerationMeta) => void
  onDelete: (meta: GenerationMeta) => void
}

interface StudioImageProps {
  meta: GenerationMeta
  parent: GenerationMeta | undefined
  pinned: boolean
  actions: ImageActions
}

const tool = `inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:scale-90 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`

export function StudioImage({ meta, parent, pinned, actions }: StudioImageProps) {
  const url = useImageUrl(meta, true)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const format = formatBySize(meta.size)

  return (
    <figure
      id={`img-${meta.id}`}
      className={`group scroll-mt-40 overflow-hidden rounded-3xl border bg-white shadow-sm transition dark:bg-zinc-900 ${
        pinned ? 'border-violet-500 ring-4 ring-violet-500/15' : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <button
        type="button"
        onClick={() => actions.onOpen(meta)}
        className={`relative block w-full overflow-hidden ${focusRing} focus-visible:-outline-offset-4`}
        style={{ aspectRatio: `${format.width} / ${format.height}` }}
        aria-label={`Открыть v${meta.version ?? 1} на весь экран`}
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
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 size-full object-cover ${loaded ? 'animate-fade-in' : 'opacity-0'}`}
          />
        )}
        {pinned && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            <PencilLine className="size-3.5" aria-hidden="true" />
            Редактируется
          </span>
        )}
        <span className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="rounded-full bg-zinc-950/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            v{meta.version ?? 1}
          </span>
          {parent && (
            <span className="rounded-full bg-zinc-950/50 px-2 py-1 text-[11px] text-white/90 backdrop-blur">
              из v{parent.version ?? 1}
            </span>
          )}
        </span>
      </button>
      <figcaption className="flex items-center gap-0.5 p-2" role="toolbar" aria-label={`Действия с v${meta.version ?? 1}`}>
        {pinned ? (
          <span className="mr-1 px-2 text-xs text-violet-600 dark:text-violet-400">Опишите правку в поле ниже</span>
        ) : (
          <button
            type="button"
            onClick={() => actions.onRefine(meta)}
            className={`mr-1 inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-violet-700 transition hover:bg-violet-50 active:scale-95 dark:text-violet-300 dark:hover:bg-violet-500/10 ${focusRing}`}
          >
            <PencilLine className="size-4" aria-hidden="true" />
            Изменить
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          className={tool}
          onClick={() => actions.onToggleFavorite(meta)}
          aria-label={meta.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          aria-pressed={meta.favorite}
          title="Избранное"
        >
          <Star className={`size-4 ${meta.favorite ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden="true" />
        </button>
        <button type="button" className={tool} onClick={() => actions.onDownload(meta)} aria-label="Скачать" title="Скачать">
          <Download className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={tool}
          onClick={() => actions.onCopyImage(meta)}
          aria-label="Копировать изображение"
          title="Копировать изображение"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${tool} hover:text-rose-600! dark:hover:text-rose-400!`}
          onClick={() => actions.onDelete(meta)}
          aria-label="Удалить"
          title="Удалить"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </figcaption>
    </figure>
  )
}
