import { Images, Search, Star, Trash2, WandSparkles } from 'lucide-react'

import { EXAMPLE_PROMPTS } from '../lib/presets'
import type { GenerationMeta } from '../types'
import { ImageCard, type CardActions } from './ImageCard'
import { focusRing } from './ui'

interface GalleryProps {
  total: number
  items: GenerationMeta[]
  search: string
  onSearchChange: (value: string) => void
  favoritesOnly: boolean
  onFavoritesOnlyChange: (value: boolean) => void
  onClear: () => void
  onExample: (prompt: string) => void
  actions: CardActions
  busy: boolean
}

export function Gallery(props: GalleryProps) {
  const { total, items, search, favoritesOnly, actions, busy } = props

  if (total === 0) {
    return (
      <section
        aria-labelledby="gallery-title"
        className="flex flex-col items-center rounded-3xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-800"
      >
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
          <Images className="size-7" aria-hidden="true" />
        </div>
        <h2 id="gallery-title" className="text-lg font-semibold">
          Здесь появятся ваши изображения
        </h2>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Опишите, что хотите увидеть, выберите формат и нажмите «Сгенерировать». Или попробуйте один из примеров:
        </p>
        <ul className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => props.onExample(prompt)}
                className={`flex h-full w-full flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-left text-sm leading-snug text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md active:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/50 ${focusRing}`}
              >
                <WandSparkles className="size-4 text-violet-500" aria-hidden="true" />
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section aria-labelledby="gallery-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gallery-title" className="text-lg font-semibold tracking-tight">
          История <span className="text-sm font-normal text-zinc-500 tabular-nums dark:text-zinc-400">{total}</span>
        </h2>
        <button
          type="button"
          onClick={props.onClear}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 ${focusRing}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Очистить историю
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Поиск по промптам"
            aria-label="Поиск по промптам"
            className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pr-4 pl-10 text-sm transition placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
          />
        </div>
        <button
          type="button"
          aria-pressed={favoritesOnly}
          onClick={() => props.onFavoritesOnlyChange(!favoritesOnly)}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] ${focusRing} ${
            favoritesOnly
              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-400/60 dark:bg-amber-400/10 dark:text-amber-300'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
        >
          <Star className={`size-4 ${favoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden="true" />
          Только избранное
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {favoritesOnly && !search ? 'В избранном пока пусто — отмечайте понравившиеся звёздочкой.' : 'Ничего не найдено.'}
        </p>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
          {items.map((meta) => (
            <ImageCard key={meta.id} meta={meta} actions={actions} busy={busy} />
          ))}
        </div>
      )}
    </section>
  )
}
