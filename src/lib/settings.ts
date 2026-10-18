import type { Lang, Theme } from '../types'

const KEYS = {
  baseUrl: 'lumo.baseUrl',
  apiKey: 'lumo.apiKey',
  model: 'lumo.model',
  theme: 'lumo.theme',
  lang: 'lumo.lang',
  project: 'lumo.project',
  models: 'lumo.models',
  profiles: 'lumo.profiles',
  disabled: 'lumo.disabled',
  migrated: 'lumo.migrated',
  modelList: 'lumo.modelList',
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

function readJson<T>(key: SettingKey, fallback: T): T {
  const raw = read(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
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
  getLang: (): Lang | null => {
    const value = read('lang')
    return value === 'ru' || value === 'en' ? value : null
  },
  setLang: (value: Lang): void => write('lang', value),
  getProjectId: (): string | null => read('project'),
  setProjectId: (value: string | null): void => write('project', value),
  getModelHistory: (): string[] => readJson<string[]>('models', []),
  setModelHistory: (value: string[]): void => write('models', JSON.stringify(value)),
  getProfileOverrides: <T>(): Record<string, T> => readJson<Record<string, T>>('profiles', {}),
  setProfileOverrides: (value: Record<string, unknown>): void => write('profiles', JSON.stringify(value)),
  getDisabledParams: (): Record<string, string[]> => readJson<Record<string, string[]>>('disabled', {}),
  setDisabledParams: (value: Record<string, string[]>): void => write('disabled', JSON.stringify(value)),
  getModelList: (): { at: number; source: string; models: string[] } | null => readJson<{ at: number; source: string; models: string[] } | null>('modelList', null),
  setModelList: (value: { at: number; source: string; models: string[] } | null): void =>
    write('modelList', value ? JSON.stringify(value) : null),
  isMigrated: (): boolean => read('migrated') === '1',
  setMigrated: (): void => write('migrated', '1'),
}
