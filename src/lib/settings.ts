import type { Theme } from '../types'

const KEYS = {
  baseUrl: 'lumo.baseUrl',
  apiKey: 'lumo.apiKey',
  model: 'lumo.model',
  theme: 'lumo.theme',
  draft: 'lumo.draft',
  session: 'lumo.session',
  sidebar: 'lumo.sidebar',
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
  getBaseUrl: (): string => read('baseUrl') ?? '',
  setBaseUrl: (value: string | null): void => write('baseUrl', value),
  getApiKey: (): string => read('apiKey') ?? '',
  setApiKey: (value: string | null): void => write('apiKey', value),
  getModel: (): string | null => read('model'),
  setModel: (value: string | null): void => write('model', value),
  getTheme: (): Theme | null => {
    const value = read('theme')
    return value === 'light' || value === 'dark' ? value : null
  },
  setTheme: (value: Theme): void => write('theme', value),
  getSessionId: (): string | null => read('session'),
  setSessionId: (value: string | null): void => write('session', value),
  getSidebarOpen: (): boolean => read('sidebar') !== 'closed',
  setSidebarOpen: (value: boolean): void => write('sidebar', value ? null : 'closed'),
  getDraft: (): string => read('draft') ?? '',
  setDraft: (value: string): void => write('draft', value),
}
