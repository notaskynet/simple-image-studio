import { ExternalLink, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { DEFAULT_MODEL } from '../lib/presets'
import { ApiKeyInput } from './ApiKeyInput'
import { Modal } from './Modal'
import { buttonPrimary, buttonSecondary, inputBase } from './ui'

interface SettingsDialogProps {
  apiKey: string
  model: string
  onSave: (values: { apiKey: string; model: string }) => void
  onForgetKey: () => void
  onClose: () => void
}

export function SettingsDialog({ apiKey, model, onSave, onForgetKey, onClose }: SettingsDialogProps) {
  const [keyValue, setKeyValue] = useState(apiKey)
  const [modelValue, setModelValue] = useState(model)

  function submit(event: FormEvent): void {
    event.preventDefault()
    onSave({ apiKey: keyValue.trim(), model: modelValue.trim() || DEFAULT_MODEL })
  }

  return (
    <Modal title="Настройки" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="settings-key" className="text-sm font-medium">
            API-ключ
          </label>
          <ApiKeyInput id="settings-key" value={keyValue} onChange={setKeyValue} />
          <a
            href="https://aitunnel.ru/panel/keys"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded text-xs text-violet-600 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-400"
          >
            Получить ключ
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-model" className="text-sm font-medium">
            Модель
          </label>
          <input
            id="settings-model"
            value={modelValue}
            onChange={(e) => setModelValue(e.target.value)}
            placeholder={DEFAULT_MODEL}
            spellCheck={false}
            autoComplete="off"
            className={`${inputBase} font-mono`}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            По умолчанию {DEFAULT_MODEL}. Можно указать любую модель генерации изображений AITUNNEL.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={onForgetKey} className={`${buttonSecondary} text-rose-600 dark:text-rose-400`}>
            <LogOut className="size-4" aria-hidden="true" />
            Забыть ключ
          </button>
          <button type="submit" className={buttonPrimary} disabled={!keyValue.trim()}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
