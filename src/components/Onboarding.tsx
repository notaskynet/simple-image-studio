import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useT } from '@/i18n'
import { normalizeBaseUrl } from '@/lib/api'
import { ApiKeyInput } from './ApiKeyInput'
import { BaseUrlInput } from './BaseUrlInput'
import { LanguageToggle } from './LanguageToggle'

interface OnboardingProps {
  initialBaseUrl: string
  initialApiKey: string
  onSave: (values: { baseUrl: string; apiKey: string }) => void
}

export function Onboarding({ initialBaseUrl, initialApiKey, onSave }: OnboardingProps) {
  const t = useT()
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
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute top-3 right-3">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-card-foreground">
        <h1 className="text-xl font-semibold tracking-tight">{t('onboarding.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('onboarding.text')}</p>

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="onboarding-url">{t('field.baseUrl')}</Label>
            <BaseUrlInput
              id="onboarding-url"
              value={baseUrl}
              onChange={setBaseUrl}
              invalid={urlInvalid}
              autoFocus={!initialBaseUrl}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-key">{t('field.apiKey')}</Label>
            <ApiKeyInput id="onboarding-key" value={key} onChange={setKey} autoFocus={!!initialBaseUrl} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!baseUrl.trim() || !key.trim()}>
            {t('onboarding.start')}
          </Button>
        </form>

        <p className="mt-5 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          {t('onboarding.privacy')}
        </p>
      </div>
    </main>
  )
}
