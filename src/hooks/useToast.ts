import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type Notify = (message: string, kind?: ToastKind) => void

export const ToastContext = createContext<Notify>(() => undefined)

export function useToast(): Notify {
  return useContext(ToastContext)
}
