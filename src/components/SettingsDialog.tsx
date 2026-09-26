import { LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { normalizeBaseUrl } from '../lib/api'
import { DEFAULT_MODEL } from '../lib/presets'
import { ApiKeyInput } from './ApiKeyInput'
import { BaseUrlInput } from './BaseUrlInput'
import { Modal } from './Modal'
import { buttonPrimary, buttonSecondary, inputBase } from './ui'

interface SettingsValues {
  baseUrl: string
  apiKey: string
  model: string
}

interface SettingsDialogProps {
  baseUrl: string
  apiKey: string
  model: string
  onSave: (values: SettingsValues) => void
  onForgetKey: () => void
  onClose: () => void
}

export function SettingsDialog({ baseUrl, apiKey, model, onSave, onForgetKey, onClose }: SettingsDialogProps) {
  const [urlValue, setUrlValue] = useState(baseUrl)
  const [keyValue, setKeyValue] = useState(apiKey)
  const [modelValue, setModelValue] = useState(model)

  const normalizedUrl = normalizeBaseUrl(urlValue)

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (!normalizedUrl || !keyValue.trim()) return
    onSave({ baseUrl: normalizedUrl, apiKey: keyValue.trim(), model: modelValue.trim() || DEFAULT_MODEL })
  }

  return (
    <Modal title="Настройки" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <label htmlFor="settings-url" className="text-sm font-medium">
            URL API
          </label>
          <BaseUrlInput
            id="settings-url"
            value={urlValue}
            onChange={setUrlValue}
            invalid={urlValue.trim() !== '' && normalizedUrl === null}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-key" className="text-sm font-medium">
            API-ключ
          </label>
          <ApiKeyInput id="settings-key" value={keyValue} onChange={setKeyValue} />
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
            По умолчанию {DEFAULT_MODEL}. Можно указать любую модель генерации изображений, которую поддерживает ваш API.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={onForgetKey} className={`${buttonSecondary} text-rose-600 dark:text-rose-400`}>
            <LogOut className="size-4" aria-hidden="true" />
            Забыть ключ
          </button>
          <button type="submit" className={buttonPrimary} disabled={!normalizedUrl || !keyValue.trim()}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
