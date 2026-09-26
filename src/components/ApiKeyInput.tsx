import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { focusRing, inputBase } from './ui'

interface ApiKeyInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function ApiKeyInput({ id, value, onChange, autoFocus }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="sk-aitunnel-..."
        autoComplete="off"
        spellCheck={false}
        data-autofocus={autoFocus ? true : undefined}
        autoFocus={autoFocus}
        className={`${inputBase} pr-12 font-mono`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={`absolute inset-y-0 right-1.5 my-auto inline-flex size-9 items-center justify-center rounded-xl text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200 ${focusRing}`}
        aria-label={visible ? 'Скрыть ключ' : 'Показать ключ'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
