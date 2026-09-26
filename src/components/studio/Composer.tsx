import { ArrowUp, Bot, ChevronDown, ImagePlus, PencilLine, Plus, SlidersHorizontal, X, Zap } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from 'react'

import { formatBySize, STYLES } from '../../lib/presets'
import { imageLabel } from '../../lib/agent'
import type { ComposeMode, GenerationMeta, ImageSize, StyleId } from '../../types'
import { Thumb } from '../Thumb'
import { focusRing } from '../ui'
import { OptionsPanel } from './OptionsPanel'

export interface PendingAttachment {
  id: string
  blob: Blob
  url: string
}

interface ComposerProps {
  text: string
  onTextChange: (value: string) => void
  size: ImageSize
  onSizeChange: (value: ImageSize) => void
  count: number
  onCountChange: (value: number) => void
  styles: StyleId[]
  onToggleStyle: (value: StyleId) => void
  base: GenerationMeta | undefined
  onClearBase: () => void
  original: GenerationMeta | undefined
  includeOriginal: boolean
  onIncludeOriginalChange: (value: boolean) => void
  attachments: PendingAttachment[]
  onAddFiles: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  mode: ComposeMode
  onModeChange: (value: ComposeMode) => void
  onSend: () => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const finePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

export function Composer(props: ComposerProps) {
  const { text, base, original, attachments, mode, textareaRef } = props
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const optionsId = useId()
  const hintId = useId()
  const canSend = text.trim().length > 0
  const direct = mode === 'direct'
  const styleLabels = STYLES.filter((s) => props.styles.includes(s.id)).map((s) => s.label)
  const summary = [formatBySize(props.size).ratio, `${props.count} шт.`, ...styleLabels].join(' · ')

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [text, textareaRef])

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    const modifier = event.ctrlKey || event.metaKey
    if (modifier || (finePointer && !event.shiftKey)) {
      event.preventDefault()
      if (canSend) props.onSend()
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
    const files = imageFiles(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    props.onAddFiles(files)
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    const files = imageFiles(event.dataTransfer.files)
    if (files.length > 0) props.onAddFiles(files)
  }

  const hasTray = !!base || attachments.length > 0

  return (
    <div className="sticky bottom-0 z-30 -mx-4 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 dark:from-zinc-950 dark:via-zinc-950/95">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setDragging(true)
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mx-auto max-w-3xl rounded-3xl border bg-white shadow-xl shadow-zinc-900/5 transition dark:bg-zinc-900 dark:shadow-black/30 ${
          dragging ? 'border-violet-500 ring-4 ring-violet-500/15' : 'border-zinc-200 dark:border-zinc-800'
        }`}
      >
        {direct && optionsOpen && (
          <div className="animate-pop-in border-b border-zinc-200 p-4 dark:border-zinc-800">
            <OptionsPanel
              id={optionsId}
              size={props.size}
              onSizeChange={props.onSizeChange}
              count={props.count}
              onCountChange={props.onCountChange}
              styles={props.styles}
              onToggleStyle={props.onToggleStyle}
            />
          </div>
        )}

        {hasTray && (
          <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
            {base && (
              <div className="flex items-center gap-2 rounded-2xl bg-violet-50 py-1 pr-3 pl-1 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                <Thumb meta={base} className="size-9 rounded-xl" />
                <PencilLine className="size-3.5" aria-hidden="true" />
                <span className="font-medium">Изменяем {imageLabel(base)}</span>
              </div>
            )}
            {base && (
              <button
                type="button"
                onClick={props.onClearBase}
                className={`inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`}
                title="Следующее сообщение создаст новое изображение с нуля"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Новое изображение
              </button>
            )}
            {direct && base && original && (
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 px-2.5 py-2 text-xs text-zinc-600 select-none dark:border-zinc-800 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={props.includeOriginal}
                  onChange={(e) => props.onIncludeOriginalChange(e.target.checked)}
                  className="size-3.5 accent-violet-600"
                />
                Приложить исходник v{original.version ?? 1}
              </label>
            )}
            {attachments.map((item) => (
              <div key={item.id} className="relative">
                <img src={item.url} alt="Прикреплённое изображение" className="size-11 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => props.onRemoveAttachment(item.id)}
                  className={`absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white shadow dark:bg-zinc-100 dark:text-zinc-900 ${focusRing}`}
                  aria-label="Убрать прикреплённое изображение"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label htmlFor="prompt" className="sr-only">
          {base ? `Что изменить в ${imageLabel(base)}` : direct ? 'Описание изображения' : 'Сообщение агенту'}
        </label>
        <textarea
          id="prompt"
          ref={textareaRef}
          value={text}
          onChange={(e) => props.onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder={
            base
              ? `Что изменить в ${imageLabel(base)}? Например: сделай небо закатным`
              : direct
                ? 'Опишите новое изображение…'
                : 'Расскажите агенту, что хотите создать…'
          }
          aria-describedby={hintId}
          className="block max-h-60 min-h-14 w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <p id={hintId} className="sr-only">
          {finePointer ? 'Enter — отправить, Shift + Enter — новая строка' : `${isMac ? 'Cmd' : 'Ctrl'} + Enter — отправить`}
        </p>

        <div className="flex items-center gap-1 px-2 pb-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              props.onAddFiles(imageFiles(e.target.files))
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`inline-flex size-10 items-center justify-center rounded-2xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`}
            aria-label="Прикрепить изображение"
            title="Прикрепить фото"
          >
            <ImagePlus className="size-5" aria-hidden="true" />
          </button>
          <div
            role="radiogroup"
            aria-label="Режим"
            className="flex shrink-0 rounded-2xl border border-zinc-200 p-0.5 dark:border-zinc-800"
          >
            {(
              [
                ['agent', 'Агент', Bot, 'Чат с моделью: она уточнит идею и сама напишет промпт'],
                ['direct', 'Напрямую', Zap, 'Текст сразу уходит в генерацию изображения'],
              ] as const
            ).map(([value, label, Icon, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => props.onModeChange(value)}
                title={hint}
                className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition ${focusRing} ${
                  mode === value
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </button>
            ))}
          </div>
          {direct && (
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            aria-expanded={optionsOpen}
            aria-controls={optionsId}
            className={`inline-flex h-10 min-w-0 items-center gap-2 rounded-2xl px-3 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing} ${
              optionsOpen ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : ''
            }`}
          >
            <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{summary}</span>
            <ChevronDown className={`size-4 shrink-0 transition ${optionsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          )}

          <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={props.onSend}
                disabled={!canSend}
                className={`inline-flex size-10 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none dark:disabled:bg-zinc-700 ${focusRing}`}
                aria-label={direct ? (base ? `Изменить ${imageLabel(base)}` : 'Создать изображение') : 'Отправить агенту'}
                title={direct ? (base ? 'Изменить' : 'Создать') : 'Отправить'}
              >
                <ArrowUp className="size-5" aria-hidden="true" />
              </button>
          </div>
        </div>
      </div>
    </div>
  )
}
