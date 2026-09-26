import { Sparkles, X } from 'lucide-react'
import { useLayoutEffect, type KeyboardEvent, type ReactNode, type RefObject } from 'react'

import { COUNT_OPTIONS, FORMATS, STYLES } from '../lib/presets'
import type { ImageSize, StyleId } from '../types'
import { buttonPrimary, focusRing } from './ui'

interface PromptPanelProps {
  prompt: string
  onPromptChange: (value: string) => void
  size: ImageSize
  onSizeChange: (value: ImageSize) => void
  count: number
  onCountChange: (value: number) => void
  styles: StyleId[]
  onToggleStyle: (value: StyleId) => void
  onGenerate: () => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  generateBar: ReactNode
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

export function PromptPanel(props: PromptPanelProps) {
  const { prompt, onPromptChange, size, onSizeChange, count, onCountChange, styles, onToggleStyle, textareaRef } =
    props

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [prompt, textareaRef])

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      props.onGenerate()
    }
  }

  return (
    <section aria-label="Параметры генерации" className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="prompt" className="text-sm font-medium">
            Описание изображения
          </label>
          {prompt && (
            <button
              type="button"
              onClick={() => {
                onPromptChange('')
                textareaRef.current?.focus()
              }}
              className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${focusRing}`}
            >
              <X className="size-3" aria-hidden="true" />
              Очистить
            </button>
          )}
        </div>
        <textarea
          id="prompt"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder="Например: маяк на скалистом берегу во время шторма, драматичное небо"
          aria-describedby="prompt-hint"
          className="block min-h-24 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <p id="prompt-hint" className="hidden text-xs text-zinc-500 md:block dark:text-zinc-400">
          <kbd className="rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-sans text-[11px] dark:border-zinc-700 dark:bg-zinc-800">
            {isMac ? '⌘' : 'Ctrl'} + Enter
          </kbd>{' '}
          — сгенерировать
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Формат</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Формат">
          {FORMATS.map((format) => {
            const selected = format.size === size
            const scale = 28 / Math.max(format.width, format.height)
            return (
              <button
                key={format.size}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSizeChange(format.size)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition active:scale-[0.97] ${focusRing} ${
                  selected
                    ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-500/10 dark:text-violet-300'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                <span className="flex h-8 items-center justify-center" aria-hidden="true">
                  <span
                    className={`block rounded-[5px] border-2 transition ${
                      selected ? 'border-violet-500 bg-violet-500/20' : 'border-current opacity-60'
                    }`}
                    style={{ width: format.width * scale, height: format.height * scale }}
                  />
                </span>
                <span className="text-xs font-medium">{format.label}</span>
                <span className="text-[10px] tabular-nums opacity-70">{format.size.replace('x', '×')}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Количество</legend>
        <div
          className="grid grid-cols-4 gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
          role="radiogroup"
          aria-label="Количество изображений"
        >
          {COUNT_OPTIONS.map((value) => {
            const selected = value === count
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onCountChange(value)}
                className={`rounded-xl py-2 text-sm font-medium tabular-nums transition ${focusRing} ${
                  selected
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {value}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Стиль <span className="font-normal text-zinc-500 dark:text-zinc-400">— необязательно</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((style) => {
            const selected = styles.includes(style.id)
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleStyle(style.id)}
                title={style.description}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition active:scale-95 ${focusRing} ${
                  selected
                    ? 'border-violet-500 bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {style.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="hidden md:block">{props.generateBar}</div>
    </section>
  )
}

interface GenerateBarProps {
  busy: boolean
  disabled: boolean
  elapsed: number
  count: number
  onGenerate: () => void
  onCancel: () => void
}

export function GenerateBar({ busy, disabled, elapsed, count, onGenerate, onCancel }: GenerateBarProps) {
  if (busy) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
          <span className="relative flex size-2.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-500 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-violet-500" />
          </span>
          <span>
            Генерация… <span className="tabular-nums">{elapsed} с</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${focusRing}`}
        >
          Отмена
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={onGenerate} disabled={disabled} className={`${buttonPrimary} w-full py-3.5`}>
      <Sparkles className="size-4" aria-hidden="true" />
      {count > 1 ? `Сгенерировать ${count}` : 'Сгенерировать'}
    </button>
  )
}
