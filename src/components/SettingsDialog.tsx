import { LogOut, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { DEFAULT_CHAT_MODEL, DEFAULT_SYSTEM_PROMPT } from '../lib/agent'
import { normalizeBaseUrl } from '../lib/api'
import { DEFAULT_MODEL } from '../lib/presets'
import { ApiKeyInput } from './ApiKeyInput'
import { BaseUrlInput } from './BaseUrlInput'
import { Modal } from './Modal'
import { buttonPrimary, buttonSecondary, inputBase } from './ui'

export interface SettingsValues {
  baseUrl: string
  apiKey: string
  model: string
  chatModel: string
  systemPrompt: string
  vision: boolean
}

interface SettingsDialogProps extends SettingsValues {
  onSave: (values: SettingsValues) => void
  onForgetKey: () => void
  onClose: () => void
}

export function SettingsDialog({ baseUrl, apiKey, model, chatModel, systemPrompt, vision, onSave, onForgetKey, onClose }: SettingsDialogProps) {
  const [chatModelValue, setChatModelValue] = useState(chatModel)
  const [promptValue, setPromptValue] = useState(systemPrompt)
  const [visionValue, setVisionValue] = useState(vision)
  const [urlValue, setUrlValue] = useState(baseUrl)
  const [keyValue, setKeyValue] = useState(apiKey)
  const [modelValue, setModelValue] = useState(model)

  const normalizedUrl = normalizeBaseUrl(urlValue)

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (!normalizedUrl || !keyValue.trim()) return
    onSave({
      baseUrl: normalizedUrl,
      apiKey: keyValue.trim(),
      model: modelValue.trim() || DEFAULT_MODEL,
      chatModel: chatModelValue.trim() || DEFAULT_CHAT_MODEL,
      systemPrompt: promptValue.trim() || DEFAULT_SYSTEM_PROMPT,
      vision: visionValue,
    })
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
            Модель изображений
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

        <div className="space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Агент</h3>
          <div className="space-y-2">
            <label htmlFor="settings-chat-model" className="text-sm font-medium">
              Чат-модель
            </label>
            <input
              id="settings-chat-model"
              value={chatModelValue}
              onChange={(e) => setChatModelValue(e.target.value)}
              placeholder={DEFAULT_CHAT_MODEL}
              spellCheck={false}
              autoComplete="off"
              className={`${inputBase} font-mono`}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Модель для диалога через /chat/completions. Должна поддерживать вызов инструментов (function calling).
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="settings-system-prompt" className="text-sm font-medium">
                Системный промпт
              </label>
              <button
                type="button"
                onClick={() => setPromptValue(DEFAULT_SYSTEM_PROMPT)}
                disabled={promptValue === DEFAULT_SYSTEM_PROMPT}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Сбросить
              </button>
            </div>
            <textarea
              id="settings-system-prompt"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              rows={9}
              className={`${inputBase} resize-y text-xs leading-relaxed`}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={visionValue}
              onChange={(e) => setVisionValue(e.target.checked)}
              className="mt-0.5 size-4 accent-violet-600"
            />
            <span>
              Показывать модели прикреплённые фото
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Только для моделей с поддержкой изображений (vision).
              </span>
            </span>
          </label>
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
