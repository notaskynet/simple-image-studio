import { COUNT_OPTIONS, FORMATS, STYLES } from '../../lib/presets'
import type { ImageSize, StyleId } from '../../types'
import { focusRing } from '../ui'

interface OptionsPanelProps {
  id: string
  size: ImageSize
  onSizeChange: (value: ImageSize) => void
  count: number
  onCountChange: (value: number) => void
  styles: StyleId[]
  onToggleStyle: (value: StyleId) => void
}

export function OptionsPanel({ id, size, onSizeChange, count, onCountChange, styles, onToggleStyle }: OptionsPanelProps) {
  return (
    <div id={id} className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Формат</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Формат">
          {FORMATS.map((format) => {
            const selected = format.size === size
            const scale = 22 / Math.max(format.width, format.height)
            return (
              <button
                key={format.size}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSizeChange(format.size)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition active:scale-[0.97] ${focusRing} ${
                  selected
                    ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                <span className="flex h-6 items-center justify-center" aria-hidden="true">
                  <span
                    className={`block rounded-[4px] border-2 ${selected ? 'border-violet-500 bg-violet-500/20' : 'border-current opacity-60'}`}
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
        <legend className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Количество</legend>
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

      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Стиль — необязательно</legend>
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
                className={`rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${focusRing} ${
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
    </div>
  )
}
