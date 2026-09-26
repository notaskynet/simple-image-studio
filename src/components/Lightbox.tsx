import { ChevronLeft, ChevronRight, Columns2, Download, Wand, X } from 'lucide-react'
import { useEffect, useRef, useState, type TouchEvent } from 'react'

import { useImageUrl } from '../hooks/useImageUrl'
import { formatBySize } from '../lib/presets'
import type { GenerationMeta } from '../types'
import { focusRing } from './ui'

interface LightboxProps {
  items: GenerationMeta[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onDownload: (meta: GenerationMeta) => void
  getParent?: (meta: GenerationMeta) => GenerationMeta | undefined
  onRefine?: (meta: GenerationMeta) => void
}

const controlButton = `inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-30 ${focusRing}`

function LightboxImage({ meta }: { meta: GenerationMeta }) {
  const url = useImageUrl(meta, true)
  if (!url) return <div className="shimmer size-64 rounded-2xl opacity-30" aria-hidden="true" />
  return (
    <img
      key={meta.id}
      src={url}
      alt={meta.prompt}
      className="size-full animate-fade-in object-contain drop-shadow-2xl select-none"
      draggable={false}
    />
  )
}

function CompareView({ before, after }: { before: GenerationMeta; after: GenerationMeta }) {
  const beforeUrl = useImageUrl(before, true)
  const afterUrl = useImageUrl(after, true)
  const [position, setPosition] = useState(50)
  const format = formatBySize(after.size)
  const ratio = format.width / format.height

  return (
    <div className="flex size-full items-center justify-center" style={{ containerType: 'size' }}>
      <div
        className="relative overflow-hidden rounded-xl select-none"
        style={{ width: `min(100cqw, calc(100cqh * ${ratio}))`, aspectRatio: `${format.width} / ${format.height}` }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {beforeUrl && <img src={beforeUrl} alt={`До: v${before.version ?? 1}`} className="absolute inset-0 size-full object-contain" draggable={false} />}
        {afterUrl && (
          <img
            src={afterUrl}
            alt={`После: v${after.version ?? 1}`}
            className="absolute inset-0 size-full object-contain"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
            draggable={false}
          />
        )}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" style={{ left: `${position}%` }} aria-hidden="true" />
        <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-zinc-950/70 px-2.5 py-1 text-xs font-semibold">
          v{before.version ?? 1}
        </span>
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-violet-600/90 px-2.5 py-1 text-xs font-semibold">
          v{after.version ?? 1}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
          aria-label={`Сравнение: v${before.version ?? 1} и v${after.version ?? 1}`}
        />
      </div>
    </div>
  )
}

export function Lightbox({ items, index, onIndexChange, onClose, onDownload, getParent, onRefine }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [showPrompt, setShowPrompt] = useState(true)
  const [compareId, setCompareId] = useState<string | null>(null)
  const meta = items[index]
  const parent = meta && getParent ? getParent(meta) : undefined
  const comparing = !!parent && compareId === meta?.id
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  const stateRef = useRef({ index, hasPrev, hasNext, onIndexChange, onClose })
  useEffect(() => {
    stateRef.current = { index, hasPrev, hasNext, onIndexChange, onClose }
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent): void {
      const s = stateRef.current
      if (event.key === 'Escape') s.onClose()
      else if (event.key === 'ArrowLeft' && s.hasPrev) s.onIndexChange(s.index - 1)
      else if (event.key === 'ArrowRight' && s.hasNext) s.onIndexChange(s.index + 1)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (!meta) onClose()
  }, [meta, onClose])

  if (!meta) return null

  function onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function onTouchEnd(event: TouchEvent): void {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) {
      if (dy > 100 && Math.abs(dy) > Math.abs(dx)) onClose()
      return
    }
    if (dx < 0 && hasNext) onIndexChange(index + 1)
    if (dx > 0 && hasPrev) onIndexChange(index - 1)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-toast-in flex-col bg-zinc-950/95 text-white backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          {parent && (
            <button
              type="button"
              className={`${controlButton} ${comparing ? 'bg-violet-600! hover:bg-violet-500!' : ''}`}
              onClick={() => setCompareId(comparing ? null : meta.id)}
              aria-pressed={comparing}
              aria-label={`Сравнить с v${parent.version ?? 1}`}
              title={`Сравнить с v${parent.version ?? 1}`}
            >
              <Columns2 className="size-5" aria-hidden="true" />
            </button>
          )}
          {onRefine && (
            <button
              type="button"
              className={controlButton}
              onClick={() => {
                onRefine(meta)
                onClose()
              }}
              aria-label="Доработать"
              title="Доработать"
            >
              <Wand className="size-5" aria-hidden="true" />
            </button>
          )}
          <button type="button" className={controlButton} onClick={() => onDownload(meta)} aria-label="Скачать">
            <Download className="size-5" aria-hidden="true" />
          </button>
          <button ref={closeRef} type="button" className={controlButton} onClick={onClose} aria-label="Закрыть (Esc)">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-20"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {comparing && parent ? (
          <CompareView key={meta.id} before={parent} after={meta} />
        ) : (
          <LightboxImage key={meta.id} meta={meta} />
        )}
        <button
          type="button"
          className={`${controlButton} absolute left-4 top-1/2 hidden -translate-y-1/2 sm:inline-flex`}
          onClick={() => onIndexChange(index - 1)}
          disabled={!hasPrev}
          aria-label="Предыдущее изображение"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${controlButton} absolute right-4 top-1/2 hidden -translate-y-1/2 sm:inline-flex`}
          onClick={() => onIndexChange(index + 1)}
          disabled={!hasNext}
          aria-label="Следующее изображение"
        >
          <ChevronRight className="size-6" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className={`mx-auto block max-w-3xl rounded-xl px-2 text-center text-sm leading-relaxed text-white/80 ${focusRing} ${
            showPrompt ? '' : 'line-clamp-1'
          }`}
          aria-expanded={showPrompt}
        >
          {meta.prompt}
        </button>
        <div className="mt-3 flex justify-center gap-3 sm:hidden">
          <button
            type="button"
            className={controlButton}
            onClick={() => onIndexChange(index - 1)}
            disabled={!hasPrev}
            aria-label="Предыдущее изображение"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={controlButton}
            onClick={() => onIndexChange(index + 1)}
            disabled={!hasNext}
            aria-label="Следующее изображение"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
