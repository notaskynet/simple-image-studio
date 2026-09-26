import { Bot, ChevronRight, CircleAlert, Clipboard, ImageOff, ImagePlus, PencilLine, RefreshCw, WandSparkles } from 'lucide-react'

import { useElapsed } from '../../hooks/useElapsed'
import { imageLabel } from '../../lib/agent'
import { EXAMPLE_PROMPTS, formatBySize, STYLES } from '../../lib/presets'
import type { AgentTurn, AssistantTurn, GenerationMeta, ImageSize, Session, ToolCallRecord, UserTurn } from '../../types'
import { Thumb } from '../Thumb'
import { TypingDots } from '../TypingDots'
import { focusRing } from '../ui'
import { StudioImage, type ImageActions } from './StudioImage'

interface FeedProps {
  session: Session | undefined
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  actions: ImageActions
  onRetry: (turn: UserTurn) => void
  onCopyText: (text: string) => void
  onExample: (text: string) => void
  onCancel: (turnId: string) => void
}

const smallButton = `inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`

const cancelButton = `${smallButton} text-rose-600! dark:text-rose-400!`

function gridClass(count: number): string {
  return count > 1 ? 'grid gap-3 sm:grid-cols-2' : 'grid max-w-md gap-3'
}

function resolve(ids: string[], byId: Map<string, GenerationMeta>): GenerationMeta[] {
  return ids.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m)
}

function Skeletons({ size, count, startedAt }: { size: ImageSize; count: number; startedAt: number }) {
  const elapsed = useElapsed(startedAt)
  const format = formatBySize(size)
  return (
    <div className={gridClass(count)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="shimmer relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800"
          style={{ aspectRatio: `${format.width} / ${format.height}` }}
        >
          <span className="absolute bottom-3 left-3 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-zinc-600 tabular-nums backdrop-blur dark:bg-zinc-900/70 dark:text-zinc-300">
            {elapsed} с
          </span>
        </div>
      ))}
    </div>
  )
}

function StatusPill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-3xl rounded-bl-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
      <TypingDots className="text-violet-500" />
      <span>{label}</span>
    </div>
  )
}

function ErrorBox({ message, onRetry, busy }: { message: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div className="flex max-w-[85%] items-start gap-3 rounded-3xl rounded-bl-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-2">
        <p className="break-words">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg font-medium underline-offset-2 hover:underline disabled:opacity-50 ${focusRing}`}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  )
}

function ImagesGrid({ images, byId, pinnedId, actions }: {
  images: GenerationMeta[]
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  actions: ImageActions
}) {
  return (
    <div className={gridClass(images.length)}>
      {images.map((meta) => (
        <StudioImage
          key={meta.id}
          meta={meta}
          parent={meta.parentId ? byId.get(meta.parentId) : undefined}
          pinned={meta.id === pinnedId}
          actions={actions}
        />
      ))}
    </div>
  )
}

function UserBubble({ turn, byId, onRetry, onCopyText }: {
  turn: UserTurn
  byId: Map<string, GenerationMeta>
  onRetry: (turn: UserTurn) => void
  onCopyText: (text: string) => void
}) {
  const base = turn.baseId ? byId.get(turn.baseId) : undefined
  const attachments = resolve(turn.attachmentIds, byId)
  const styleLabels = STYLES.filter((s) => turn.styles.includes(s.id)).map((s) => s.label)
  const meta =
    turn.mode === 'agent'
      ? ['агент']
      : [formatBySize(turn.size).ratio, `${turn.count} шт.`, ...styleLabels, ...(turn.includeOriginal ? ['с исходником'] : [])]

  return (
    <div className="group flex flex-col items-end gap-1.5">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-violet-600 px-4 py-3 text-[15px] leading-relaxed text-white shadow-sm shadow-violet-600/20">
        {(turn.baseId || attachments.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {turn.baseId && (
              <span className="flex items-center gap-2 rounded-xl bg-white/15 py-1 pr-2.5 pl-1 text-xs font-medium">
                {base ? <Thumb meta={base} className="size-7 rounded-lg" /> : <ImageOff className="size-4" aria-hidden="true" />}
                <PencilLine className="size-3.5" aria-hidden="true" />
                Правка {base ? imageLabel(base) : ''}
              </span>
            )}
            {attachments.map((item) => (
              <span key={item.id} className="relative">
                <Thumb meta={item} className="size-10 rounded-lg ring-1 ring-white/30" />
                <span className="absolute -right-1 -bottom-1 rounded-md bg-zinc-950/70 px-1 text-[10px] font-semibold">{imageLabel(item)}</span>
              </span>
            ))}
          </div>
        )}
        <p className="break-words whitespace-pre-wrap">{turn.text}</p>
      </div>
      <div className="flex items-center gap-1 pr-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{meta.join(' · ')}</span>
        <button type="button" className={smallButton} onClick={() => onCopyText(turn.text)} aria-label="Копировать текст запроса">
          <Clipboard className="size-3.5" aria-hidden="true" />
        </button>
        <button type="button" className={smallButton} onClick={() => onRetry(turn)} aria-label="Повторить запрос" title="Повторить">
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function DirectBubble({ turn, request, byId, pinnedId, actions, onRetry, onCancel }: {
  turn: AssistantTurn
  request: UserTurn | undefined
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  actions: ImageActions
  onRetry: (turn: UserTurn) => void
  onCancel: (turnId: string) => void
}) {
  if (turn.status === 'pending') {
    return (
      <div className="space-y-3" role="status" aria-label="Идёт генерация изображений">
        <StatusPill label={turn.edit ? 'Вношу правки' : (turn.count ?? 1) > 1 ? 'Создаю изображения' : 'Создаю изображение'} />
        <Skeletons size={turn.size ?? '1024x1024'} count={turn.count ?? 1} startedAt={turn.createdAt} />
        <button type="button" onClick={() => onCancel(turn.id)} className={cancelButton}>
          Отменить
        </button>
      </div>
    )
  }
  if (turn.error) return <ErrorBox message={turn.error} onRetry={request ? () => onRetry(request) : undefined} />
  const images = resolve(turn.imageIds, byId)
  if (images.length === 0) return <p className="text-sm text-zinc-500 italic dark:text-zinc-400">Изображения удалены</p>
  return <ImagesGrid images={images} byId={byId} pinnedId={pinnedId} actions={actions} />
}

function ToolCallView({ call, byId, pinnedId, actions }: {
  call: ToolCallRecord
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  actions: ImageActions
}) {
  const sources = resolve(call.sourceIds ?? [], byId)
  const editing = call.name === 'edit_image'
  const title = editing
    ? `${call.status === 'running' ? 'Изменяю' : 'Изменение'} ${sources.map(imageLabel).join(', ')}`
    : call.status === 'running'
      ? (call.count ?? 1) > 1
        ? 'Создаю изображения'
        : 'Создаю изображение'
      : 'Новое изображение'
  const images = resolve(call.imageIds, byId)

  return (
    <div className="space-y-2" role={call.status === 'running' ? 'status' : undefined}>
      <details className="group/details max-w-[85%] text-sm">
        <summary
          className={`flex cursor-pointer list-none items-center gap-2 rounded-2xl px-1 py-1 text-zinc-600 select-none [&::-webkit-details-marker]:hidden dark:text-zinc-300 ${focusRing}`}
        >
          {editing ? (
            <PencilLine className="size-4 text-violet-500" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-4 text-violet-500" aria-hidden="true" />
          )}
          <span className="font-medium">{title}</span>
          {call.status === 'running' && <TypingDots className="scale-75 text-violet-500" />}
          <ChevronRight className="size-4 text-zinc-400 transition group-open/details:rotate-90" aria-hidden="true" />
          <span className="sr-only">Показать промпт</span>
        </summary>
        {call.prompt && (
          <p className="mt-1 ml-7 rounded-2xl bg-zinc-100 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            {call.prompt}
          </p>
        )}
      </details>
      {call.status === 'running' && <Skeletons size={call.size ?? '1024x1024'} count={call.count ?? 1} startedAt={call.startedAt} />}
      {call.status === 'error' && <ErrorBox message={call.error ?? 'Ошибка'} />}
      {call.status === 'done' && images.length > 0 && (
        <ImagesGrid images={images} byId={byId} pinnedId={pinnedId} actions={actions} />
      )}
      {call.status === 'done' && images.length === 0 && (
        <p className="text-sm text-zinc-500 italic dark:text-zinc-400">Изображения удалены</p>
      )}
    </div>
  )
}

function AgentBubble({ turn, request, byId, pinnedId, actions, onRetry, onCancel }: {
  turn: AgentTurn
  request: UserTurn | undefined
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  actions: ImageActions
  onRetry: (turn: UserTurn) => void
  onCancel: (turnId: string) => void
}) {
  const last = turn.steps.at(-1)
  const thinking = turn.status === 'pending' && (!last || (!last.text && last.toolCalls.length === 0))
  const running = turn.status === 'pending'

  return (
    <div className="flex gap-3">
      <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
        <Bot className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {turn.steps.map((step, i) => (
          <div key={i} className="space-y-3">
            {step.text && (
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                {step.text}
              </p>
            )}
            {step.toolCalls.map((call) => (
              <ToolCallView key={call.id} call={call} byId={byId} pinnedId={pinnedId} actions={actions} />
            ))}
          </div>
        ))}
        {thinking && <StatusPill label="Думаю" />}
        {turn.error && <ErrorBox message={turn.error} onRetry={request ? () => onRetry(request) : undefined} />}
        {running && (
          <button type="button" onClick={() => onCancel(turn.id)} className={cancelButton}>
            Остановить
          </button>
        )}
      </div>
    </div>
  )
}

export function Feed({ session, byId, pinnedId, actions, onRetry, onCopyText, onExample, onCancel }: FeedProps) {
  const turns = session?.turns ?? []

  if (turns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
          <WandSparkles className="size-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Что создадим?</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Расскажите, что хотите получить — агент уточнит детали, напишет промпт и создаст изображение. Потом
          просто пишите, что изменить.
        </p>
        <ul className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onExample(prompt)}
                className={`flex h-full w-full flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-left text-sm leading-snug text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/50 ${focusRing}`}
              >
                <WandSparkles className="size-4 text-violet-500" aria-hidden="true" />
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const requests = new Map(turns.filter((t): t is UserTurn => t.role === 'user').map((t) => [t.id, t]))

  return (
    <ol className="flex flex-1 flex-col gap-5 py-6" aria-label="Диалог">
      {turns.map((turn) => (
        <li key={turn.id}>
          {turn.role === 'user' ? (
            <UserBubble turn={turn} byId={byId} onRetry={onRetry} onCopyText={onCopyText} />
          ) : turn.role === 'agent' ? (
            <AgentBubble
              turn={turn}
              request={requests.get(turn.requestId)}
              byId={byId}
              pinnedId={pinnedId}
              actions={actions}
              onRetry={onRetry}
              onCancel={onCancel}
            />
          ) : (
            <DirectBubble
              turn={turn}
              request={requests.get(turn.requestId)}
              byId={byId}
              pinnedId={pinnedId}
              actions={actions}
              onRetry={onRetry}
              onCancel={onCancel}
            />
          )}
        </li>
      ))}
    </ol>
  )
}
