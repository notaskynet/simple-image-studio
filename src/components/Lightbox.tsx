import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useEffect, useRef, useState, type TouchEvent } from 'react'

import { useImageUrl } from '../hooks/useImageUrl'
import type { GenerationMeta } from '../types'
import { focusRing } from './ui'

interface LightboxProps {
  items: GenerationMeta[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onDownload: (meta: GenerationMeta) => void
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

export function Lightbox({ items, index, onIndexChange, onClose, onDownload }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [showPrompt, setShowPrompt] = useState(true)
  const meta = items[index]
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
        <LightboxImage key={meta.id} meta={meta} />
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
