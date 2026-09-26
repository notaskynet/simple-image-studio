import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { ToastContext, type Notify, type ToastKind } from '../hooks/useToast'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
} as const

const ICON_COLORS: Record<ToastKind, string> = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  info: 'text-violet-500',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback<Notify>(
    (message, kind = 'success') => {
      const id = nextId.current++
      setToasts((items) => [...items.slice(-3), { id, kind, message }])
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 2500)
    },
    [dismiss],
  )

  const value = useMemo(() => notify, [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind]
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : undefined}
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 text-sm shadow-lg shadow-zinc-900/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-black/40"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${ICON_COLORS[toast.kind]}`} aria-hidden="true" />
              <p className="flex-1 break-words">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-m-1 rounded-lg p-1 text-zinc-400 transition hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:text-zinc-200"
                aria-label="Закрыть уведомление"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
