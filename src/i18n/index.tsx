import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { AppError } from '../lib/errors'
import { settings } from '../lib/settings'
import type { Lang } from '../types'
import { en } from './en'
import { ru, type Dict, type Key } from './ru'

export type { Key }

export type TFunction = (key: Key, params?: Record<string, string | number>) => string

const DICTIONARIES: Record<Lang, Dict> = { ru, en }

function translate(lang: Lang, key: Key, params?: Record<string, string | number>): string {
  const text = DICTIONARIES[lang][key]
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

export function detectLang(): Lang {
  const stored = settings.getLang()
  if (stored) return stored
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFunction
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((next: Lang) => {
    settings.setLang(next)
    document.documentElement.lang = next
    setLangState(next)
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('I18nProvider is missing')
  return value
}

export function useT(): TFunction {
  return useI18n().t
}

const DETAILED: Partial<Record<string, Key>> = {
  model_unavailable: 'error.model_unavailable.detail',
  http: 'error.http.detail',
  unknown: 'error.unknown.detail',
}

export function describeCode(t: TFunction, code: string, detail?: string | null): string {
  const base = `error.${code}` as Key
  const detailed = DETAILED[code]
  if (detail && detailed) return t(detailed, { detail })
  return base in ru ? t(base) : t('error.unknown')
}

export function describeError(t: TFunction, error: unknown): string {
  if (error instanceof AppError) return describeCode(t, error.code, error.detail)
  if (error instanceof Error && error.message) return t('error.unknown.detail', { detail: error.message })
  return t('error.unknown')
}
