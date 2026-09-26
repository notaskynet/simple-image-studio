import { CircleAlert, Clipboard, ImageOff, PencilLine, RefreshCw, WandSparkles } from 'lucide-react'

import { EXAMPLE_PROMPTS, formatBySize, STYLES } from '../../lib/presets'
import type { AssistantTurn, GenerationMeta, ImageSize, Session, UserTurn } from '../../types'
import { Thumb } from '../Thumb'
import { TypingDots } from '../TypingDots'
import { focusRing } from '../ui'
import { StudioImage, type ImageActions } from './StudioImage'

export interface PendingJob {
  sessionId: string
  requestId: string
  size: ImageSize
  count: number
  edit: boolean
  startedAt: number
}

interface FeedProps {
  session: Session | undefined
  byId: Map<string, GenerationMeta>
  job: PendingJob | null
  elapsed: number
  pinnedId: string | undefined
  actions: ImageActions
  onRetry: (turn: UserTurn) => void
  onCopyText: (text: string) => void
  onExample: (text: string) => void
  onCancel: () => void
}

const smallButton = `inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`

function gridClass(count: number): string {
  return count > 1 ? 'grid gap-3 sm:grid-cols-2' : 'grid max-w-md gap-3'
}

function UserBubble({ turn, byId, onRetry, onCopyText, busy }: {
  turn: UserTurn
  byId: Map<string, GenerationMeta>
  onRetry: (turn: UserTurn) => void
  onCopyText: (text: string) => void
  busy: boolean
}) {
  const base = turn.baseId ? byId.get(turn.baseId) : undefined
  const attachments = turn.attachmentIds.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m)
  const styleLabels = STYLES.filter((s) => turn.styles.includes(s.id)).map((s) => s.label)
  const meta = [formatBySize(turn.size).ratio, `${turn.count} шт.`, ...styleLabels]
  if (turn.includeOriginal) meta.push('с исходником')

  return (
    <div className="group flex flex-col items-end gap-1.5">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-violet-600 px-4 py-3 text-[15px] leading-relaxed text-white shadow-sm shadow-violet-600/20">
        {(turn.baseId || attachments.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {turn.baseId && (
              <span className="flex items-center gap-2 rounded-xl bg-white/15 py-1 pr-2.5 pl-1 text-xs font-medium">
                {base ? <Thumb meta={base} className="size-7 rounded-lg" /> : <ImageOff className="size-4" aria-hidden="true" />}
                <PencilLine className="size-3.5" aria-hidden="true" />
                Правка v{base?.version ?? 1}
              </span>
            )}
            {attachments.map((item) => (
              <Thumb key={item.id} meta={item} className="size-10 rounded-lg ring-1 ring-white/30" />
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
        <button
          type="button"
          className={smallButton}
          onClick={() => onRetry(turn)}
          disabled={busy}
          aria-label="Повторить запрос"
          title="Повторить"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function AssistantBubble({ turn, byId, pinnedId, actions, request, onRetry, busy }: {
  turn: AssistantTurn
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  actions: ImageActions
  request: UserTurn | undefined
  onRetry: (turn: UserTurn) => void
  busy: boolean
}) {
  if (turn.error) {
    return (
      <div className="flex max-w-[85%] items-start gap-3 rounded-3xl rounded-bl-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="space-y-2">
          <p>{turn.error}</p>
          {request && (
            <button
              type="button"
              onClick={() => onRetry(request)}
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

  const images = turn.imageIds.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m)
  if (images.length === 0) {
    return <p className="text-sm text-zinc-500 italic dark:text-zinc-400">Изображения удалены</p>
  }
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

function PendingBubble({ job, elapsed, onCancel }: { job: PendingJob; elapsed: number; onCancel: () => void }) {
  const format = formatBySize(job.size)
  return (
    <div className="space-y-3" role="status" aria-label="Идёт генерация изображений">
      <div className="inline-flex items-center gap-3 rounded-3xl rounded-bl-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        <TypingDots className="text-violet-500" />
        <span>{job.edit ? 'Вношу правки' : job.count > 1 ? 'Создаю изображения' : 'Создаю изображение'}</span>
        <span className="text-zinc-400 tabular-nums dark:text-zinc-500">{elapsed} с</span>
      </div>
      <div className={gridClass(job.count)}>
        {Array.from({ length: job.count }, (_, i) => (
          <div
            key={i}
            className="shimmer relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800"
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <button type="button" onClick={onCancel} className={`${smallButton} text-rose-600! dark:text-rose-400!`}>
        Отменить
      </button>
    </div>
  )
}

export function Feed({ session, byId, job, elapsed, pinnedId, actions, onRetry, onCopyText, onExample, onCancel }: FeedProps) {
  const turns = session?.turns ?? []
  const pending = job && session && job.sessionId === session.id ? job : null
  const busy = job !== null

  if (turns.length === 0 && !pending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
          <WandSparkles className="size-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Что создадим?</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Опишите изображение в поле ниже или прикрепите своё фото. Когда картинка будет готова, просто напишите,
          что в ней изменить — предыдущие правки учитываются автоматически.
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
            <UserBubble turn={turn} byId={byId} onRetry={onRetry} onCopyText={onCopyText} busy={busy} />
          ) : (
            <AssistantBubble
              turn={turn}
              byId={byId}
              pinnedId={pinnedId}
              actions={actions}
              request={requests.get(turn.requestId)}
              onRetry={onRetry}
              busy={busy}
            />
          )}
        </li>
      ))}
      {pending && (
        <li>
          <PendingBubble job={pending} elapsed={elapsed} onCancel={onCancel} />
        </li>
      )}
    </ol>
  )
}
