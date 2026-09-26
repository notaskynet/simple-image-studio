import { Modal } from './Modal'
import { buttonDanger, buttonSecondary } from './ui'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={buttonSecondary} data-autofocus>
          Отмена
        </button>
        <button type="button" onClick={onConfirm} className={buttonDanger}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
