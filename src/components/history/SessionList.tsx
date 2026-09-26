import { MessagesSquare, Plus, Trash2 } from 'lucide-react'

import { sessionImages } from '../../lib/sessions'
import type { GenerationMeta, Session } from '../../types'
import { Thumb } from '../Thumb'
import { focusRing } from '../ui'

interface SessionListProps {
  sessions: Session[]
  byId: Map<string, GenerationMeta>
  currentId: string | null
  onOpen: (session: Session) => void
  onDelete: (session: Session) => void
  onNew: () => void
}

export function SessionList({ sessions, byId, currentId, onOpen, onDelete, onNew }: SessionListProps) {
  return (
    <section aria-labelledby="sessions-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sessions-title" className="text-lg font-semibold tracking-tight">
          Сессии <span className="text-sm font-normal text-zinc-500 tabular-nums dark:text-zinc-400">{sessions.length}</span>
        </h2>
        <button
          type="button"
          onClick={onNew}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10 ${focusRing}`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Новая сессия
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-zinc-300 px-6 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Здесь появятся ваши диалоги из Студии.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => {
            const images = sessionImages(session, byId)
            const cover = images.at(-1)
            const date = new Date(session.updatedAt).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <li key={session.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(session)}
                  className={`flex w-full items-center gap-3 rounded-3xl border bg-white p-3 pr-12 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900 ${focusRing} ${
                    session.id === currentId ? 'border-violet-400 dark:border-violet-500/60' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {cover ? (
                    <Thumb meta={cover} className="size-16 shrink-0 rounded-2xl" />
                  ) : (
                    <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                      <MessagesSquare className="size-6" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium leading-snug">{session.title || 'Без названия'}</span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      {date} · версий: {images.length}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(session)}
                  className={`absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 ${focusRing}`}
                  aria-label={`Удалить сессию «${session.title}»`}
                  title="Удалить сессию"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
