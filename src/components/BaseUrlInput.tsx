import { inputBase } from './ui'

interface BaseUrlInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  autoFocus?: boolean
}

export function BaseUrlInput({ id, value, onChange, invalid, autoFocus }: BaseUrlInputProps) {
  const hintId = `${id}-hint`

  return (
    <>
      <input
        id={id}
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://api.example.com/v1"
        autoComplete="url"
        spellCheck={false}
        data-autofocus={autoFocus ? true : undefined}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        aria-describedby={hintId}
        className={`${inputBase} font-mono ${invalid ? 'border-rose-500! focus:ring-rose-500/15!' : ''}`}
      />
      <p id={hintId} className={`text-xs ${invalid ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
        {invalid
          ? 'Введите корректный адрес, начинающийся с https:// или http://'
          : 'Базовый адрес OpenAI-совместимого API. К нему добавится /images/generations.'}
      </p>
    </>
  )
}
