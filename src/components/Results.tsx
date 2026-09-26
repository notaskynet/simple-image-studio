import { formatBySize } from '../lib/presets'
import type { GenerationMeta, ImageSize } from '../types'
import { ImageCard, type CardActions } from './ImageCard'
import { focusRing } from './ui'

export interface PendingJob {
  size: ImageSize
  count: number
  startedAt: number
}

interface ResultsProps {
  job: PendingJob | null
  elapsed: number
  items: GenerationMeta[]
  actions: CardActions
  onCancel: () => void
}

export function Results({ job, elapsed, items, actions, onCancel }: ResultsProps) {
  if (!job && items.length === 0) return null

  return (
    <section aria-labelledby="results-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="results-title" className="text-lg font-semibold tracking-tight">
          Результат
        </h2>
        {job && (
          <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums" aria-live="off">
              {elapsed} с
            </span>
            <button
              type="button"
              onClick={onCancel}
              className={`rounded-xl px-3 py-1.5 font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 ${focusRing}`}
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {job ? (
        <div
          className={`grid gap-4 ${job.count > 1 ? 'sm:grid-cols-2' : 'max-w-xl'}`}
          role="status"
          aria-label="Идёт генерация изображений"
        >
          {Array.from({ length: job.count }, (_, i) => {
            const format = formatBySize(job.size)
            return (
              <div
                key={i}
                className="shimmer relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800"
                style={{ aspectRatio: `${format.width} / ${format.height}` }}
                aria-hidden="true"
              >
                <span className="absolute bottom-3 left-3 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-zinc-600 tabular-nums backdrop-blur dark:bg-zinc-900/70 dark:text-zinc-300">
                  {elapsed} с
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={`grid items-start gap-4 ${items.length > 1 ? 'sm:grid-cols-2' : 'max-w-xl'}`}>
          {items.map((meta) => (
            <ImageCard key={meta.id} meta={meta} actions={actions} busy={false} />
          ))}
        </div>
      )}
    </section>
  )
}
