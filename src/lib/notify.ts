import { toast } from 'sonner'

export type ToastKind = 'success' | 'error' | 'info'

export function notify(message: string, kind: ToastKind = 'info'): void {
  if (kind === 'error') toast.error(message)
  else if (kind === 'success') toast.success(message)
  else toast(message)
}
