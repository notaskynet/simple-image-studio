import type { Theme } from '../types'

const KEYS = {
  apiKey: 'aitunnel.apiKey',
  model: 'aitunnel.model',
  theme: 'aitunnel.theme',
  draft: 'aitunnel.draft',
} as const

type SettingKey = keyof typeof KEYS

function read(key: SettingKey): string | null {
  try {
    return localStorage.getItem(KEYS[key])
  } catch {
    return null
  }
}

function write(key: SettingKey, value: string | null): void {
  try {
    if (value === null || value === '') localStorage.removeItem(KEYS[key])
    else localStorage.setItem(KEYS[key], value)
  } catch {
    return
  }
}

export const settings = {
  getApiKey: (): string => read('apiKey') ?? '',
  setApiKey: (value: string | null): void => write('apiKey', value),
  getModel: (): string | null => read('model'),
  setModel: (value: string | null): void => write('model', value),
  getTheme: (): Theme | null => {
    const value = read('theme')
    return value === 'light' || value === 'dark' ? value : null
  },
  setTheme: (value: Theme): void => write('theme', value),
  getDraft: (): string => read('draft') ?? '',
  setDraft: (value: string): void => write('draft', value),
}
