import { Images, PanelLeftClose, Search, Sparkles, SquarePen, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Session } from '../types'
import { TypingDots } from './TypingDots'
import { focusRing } from './ui'

export type View = 'studio' | 'gallery'

interface SidebarProps {
  open: boolean
  sessions: Session[]
  currentId: string | null
  view: View
  galleryCount: number
  busyIds: Set<string>
  onClose: () => void
  onNew: () => void
  onOpenGallery: () => void
  onOpenSession: (session: Session) => void
  onDeleteSession: (session: Session) => void
}

const DAY = 24 * 60 * 60 * 1000

function groupLabel(timestamp: number, todayStart: number): string {
  if (timestamp >= todayStart) return 'Сегодня'
  if (timestamp >= todayStart - DAY) return 'Вчера'
  if (timestamp >= todayStart - 7 * DAY) return 'Последние 7 дней'
  if (timestamp >= todayStart - 30 * DAY) return 'Последние 30 дней'
  return 'Ранее'
}

const navItem = `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${focusRing}`

export function Sidebar(props: SidebarProps) {
  const { open, sessions, currentId, view } = props
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const q = query.trim().toLowerCase()
    const result: { label: string; items: Session[] }[] = []
    for (const session of sessions) {
      if (q && !session.title.toLowerCase().includes(q)) continue
      const label = groupLabel(session.updatedAt, todayStart)
      const group = result.at(-1)
      if (group && group.label === label) group.items.push(session)
      else result.push({ label, items: [session] })
    }
    return result
  }, [sessions, query])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-sm transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={props.onClose}
        aria-hidden="true"
      />
      <aside
        id="sidebar"
        aria-label="История сессий"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 overflow-hidden border-r border-zinc-200 bg-zinc-100 transition-[transform,width] duration-300 ease-out md:sticky md:top-0 md:z-auto md:h-dvh md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900 ${
          open ? 'translate-x-0 md:w-72' : '-translate-x-full md:w-0 md:border-r-0'
        }`}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="flex h-16 items-center justify-between gap-2 px-3">
            <div className="flex min-w-0 items-center gap-2.5 px-1">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-semibold tracking-tight">Simple Image Studio</span>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className={`inline-flex size-9 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`}
              aria-label="Скрыть боковую панель"
              aria-controls="sidebar"
              title="Скрыть панель"
            >
              <PanelLeftClose className="size-5" aria-hidden="true" />
            </button>
          </div>

          <nav className="space-y-0.5 px-3" aria-label="Навигация">
            <button
              type="button"
              onClick={props.onNew}
              className={`${navItem} font-medium text-zinc-800 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-800`}
            >
              <SquarePen className="size-4" aria-hidden="true" />
              Новая сессия
            </button>
            <button
              type="button"
              onClick={props.onOpenGallery}
              aria-current={view === 'gallery' ? 'page' : undefined}
              className={`${navItem} ${
                view === 'gallery'
                  ? 'bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <Images className="size-4" aria-hidden="true" />
              Галерея
              {props.galleryCount > 0 && (
                <span className="ml-auto text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{props.galleryCount}</span>
              )}
            </button>
          </nav>

          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск сессий"
                aria-label="Поиск сессий"
                className="w-full rounded-xl border border-transparent bg-zinc-200/70 py-2 pr-3 pl-8 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:bg-white focus:outline-none dark:bg-zinc-800/70 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-950"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
            {groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {query ? 'Ничего не найдено' : 'Здесь появятся ваши сессии'}
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.label} className="pt-4" aria-label={group.label}>
                  <h3 className="px-3 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{group.label}</h3>
                  <ul className="space-y-0.5">
                    {group.items.map((session) => {
                      const active = view === 'studio' && session.id === currentId
                      return (
                        <li key={session.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => props.onOpenSession(session)}
                            aria-current={active ? 'page' : undefined}
                            className={`${navItem} pr-10 text-left ${
                              active
                                ? 'bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                                : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                            }`}
                          >
                            <span className="truncate">{session.title || 'Без названия'}</span>
                            {props.busyIds.has(session.id) && <TypingDots className="ml-auto shrink-0 scale-75 text-violet-500" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => props.onDeleteSession(session)}
                            className={`absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-zinc-300 hover:text-rose-600 pointer-coarse:opacity-100 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-rose-400 ${focusRing}`}
                            aria-label={`Удалить сессию «${session.title}»`}
                            title="Удалить"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
