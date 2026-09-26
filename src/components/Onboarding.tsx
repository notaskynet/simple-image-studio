import { ExternalLink, KeyRound, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ApiKeyInput } from './ApiKeyInput'
import { buttonPrimary } from './ui'

interface OnboardingProps {
  onSave: (key: string) => void
}

export function Onboarding({ onSave }: OnboardingProps) {
  const [key, setKey] = useState('')

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (key.trim()) onSave(key.trim())
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
        <h1 className="text-2xl font-semibold tracking-tight">Добро пожаловать!</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Здесь можно создавать изображения по текстовому описанию с помощью AITUNNEL. Для начала работы нужен
          API-ключ.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="onboarding-key" className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-violet-500" aria-hidden="true" />
              API-ключ AITUNNEL
            </label>
            <ApiKeyInput id="onboarding-key" value={key} onChange={setKey} autoFocus />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`} disabled={!key.trim()}>
            Начать
          </button>
        </form>

        <a
          href="https://aitunnel.ru/panel/keys"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-violet-600 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-400"
        >
          Где взять ключ? aitunnel.ru/panel/keys
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>

        <p className="mt-5 rounded-2xl bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          Ключ хранится только в этом браузере (localStorage) и отправляется напрямую в API AITUNNEL. Никому не
          передавайте его и не публикуйте.
        </p>
      </div>
    </main>
  )
}
