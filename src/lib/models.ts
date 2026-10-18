import { settings } from './settings'

export type MaskSupport = 'native' | 'visual' | 'none'

export interface ModelProfile {
  sizes: string[]
  quality: string[]
  /** Модель принимает n > 1 в одном запросе. Иначе варианты создаются параллельными запросами. */
  n: boolean
  background: boolean
  negative: boolean
  mask: MaskSupport
  inputFidelity: boolean
  maxRefs: number
}

export const DEFAULT_MODEL = 'gpt-image-2'

const SQUARE_SIZES = ['1024x1024', '1536x1024', '1024x1536']

const MINIMAL: ModelProfile = {
  sizes: SQUARE_SIZES,
  quality: [],
  n: false,
  background: false,
  negative: false,
  mask: 'visual',
  inputFidelity: false,
  maxRefs: 4,
}

interface BuiltinProfile {
  pattern: RegExp
  profile: ModelProfile
}

/** Порядок важен: берётся первое совпадение по имени модели. */
const BUILTIN: BuiltinProfile[] = [
  {
    pattern: /gpt-image-1/i,
    profile: {
      sizes: ['auto', ...SQUARE_SIZES],
      quality: ['low', 'medium', 'high'],
      n: true,
      background: true,
      negative: false,
      mask: 'native',
      inputFidelity: true,
      maxRefs: 16,
    },
  },
  {
    pattern: /gpt-image/i,
    profile: {
      sizes: ['auto', ...SQUARE_SIZES],
      quality: ['low', 'medium', 'high'],
      n: true,
      background: false,
      negative: false,
      mask: 'native',
      inputFidelity: false,
      maxRefs: 16,
    },
  },
  {
    pattern: /gemini|nano[-\s]?banana/i,
    profile: { ...MINIMAL, mask: 'visual', maxRefs: 8 },
  },
  {
    pattern: /flux/i,
    profile: { ...MINIMAL, mask: 'visual', maxRefs: 4 },
  },
  {
    pattern: /sdxl|stable-diffusion|(^|[/-])sd\d?/i,
    profile: {
      ...MINIMAL,
      sizes: ['512x512', '768x768', ...SQUARE_SIZES],
      n: true,
      negative: true,
      mask: 'native',
      maxRefs: 2,
    },
  },
]

export function builtinProfile(model: string): ModelProfile {
  const found = BUILTIN.find((entry) => entry.pattern.test(model))
  return { ...(found?.profile ?? MINIMAL) }
}

function key(model: string): string {
  return model.trim().toLowerCase()
}

export function getOverrides(model: string): Partial<ModelProfile> {
  return settings.getProfileOverrides<Partial<ModelProfile>>()[key(model)] ?? {}
}

export function setOverrides(model: string, overrides: Partial<ModelProfile> | null): void {
  const all = settings.getProfileOverrides<Partial<ModelProfile>>()
  if (overrides && Object.keys(overrides).length > 0) all[key(model)] = overrides
  else delete all[key(model)]
  settings.setProfileOverrides(all)
}

export function getProfile(model: string): ModelProfile {
  return { ...builtinProfile(model), ...getOverrides(model) }
}

export function getDisabled(model: string): string[] {
  return settings.getDisabledParams()[key(model)] ?? []
}

export function disableParam(model: string, param: string): void {
  const all = settings.getDisabledParams()
  const current = all[key(model)] ?? []
  if (current.includes(param)) return
  all[key(model)] = [...current, param]
  settings.setDisabledParams(all)
}

export function enableParam(model: string, param: string): void {
  const all = settings.getDisabledParams()
  const next = (all[key(model)] ?? []).filter((p) => p !== param)
  if (next.length > 0) all[key(model)] = next
  else delete all[key(model)]
  settings.setDisabledParams(all)
}

export function rememberModel(model: string): void {
  const value = model.trim()
  if (!value) return
  const history = settings.getModelHistory().filter((m) => m !== value)
  settings.setModelHistory([value, ...history].slice(0, 12))
}

export function modelSuggestions(): string[] {
  const set = new Set<string>([DEFAULT_MODEL, ...settings.getModelHistory()])
  return [...set]
}

export function sizeLabelParts(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(size)
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}
