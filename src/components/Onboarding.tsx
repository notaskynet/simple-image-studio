import { KeyRound, Link, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { normalizeBaseUrl } from '../lib/api'
import { ApiKeyInput } from './ApiKeyInput'
import { BaseUrlInput } from './BaseUrlInput'
import { buttonPrimary } from './ui'

interface OnboardingProps {
  initialBaseUrl: string
  initialApiKey: string
  onSave: (values: { baseUrl: string; apiKey: string }) => void
}

export function Onboarding({ initialBaseUrl, initialApiKey, onSave }: OnboardingProps) {
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl)
  const [key, setKey] = useState(initialApiKey)
  const [touched, setTouched] = useState(false)
  const normalized = normalizeBaseUrl(baseUrl)
  const urlInvalid = touched && baseUrl.trim() !== '' && normalized === null

  function submit(event: FormEvent): void {
    event.preventDefault()
    setTouched(true)
    if (normalized && key.trim()) onSave({ baseUrl: normalized, apiKey: key.trim() })
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl dark:bg-violet-600/20"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md animate-pop-in rounded-3xl border border-zinc-200 bg-white/80 p-8 shadow-xl shadow-zinc-900/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/30">
        <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Добро пожаловать в Simple Image Studio</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Создавайте изображения по текстовому описанию через любой OpenAI-совместимый API. Укажите адрес API и
          ключ — и можно начинать.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <div className="space-y-2">
            <label htmlFor="onboarding-url" className="flex items-center gap-2 text-sm font-medium">
              <Link className="size-4 text-violet-500" aria-hidden="true" />
              URL API
            </label>
            <BaseUrlInput
              id="onboarding-url"
              value={baseUrl}
              onChange={setBaseUrl}
              invalid={urlInvalid}
              autoFocus={!initialBaseUrl}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="onboarding-key" className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-violet-500" aria-hidden="true" />
              API-ключ
            </label>
            <ApiKeyInput id="onboarding-key" value={key} onChange={setKey} autoFocus={!!initialBaseUrl} />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={!baseUrl.trim() || !key.trim()}>
            Начать
          </button>
        </form>

        <p className="mt-5 rounded-2xl bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          Адрес и ключ хранятся только в этом браузере (localStorage), запросы идут напрямую к указанному API.
          Никому не передавайте ключ и не публикуйте его.
        </p>
      </div>
    </main>
  )
}
