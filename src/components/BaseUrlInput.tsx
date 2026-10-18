import { Input } from '@/components/ui/input'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

interface BaseUrlInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  autoFocus?: boolean
}

export function BaseUrlInput({ id, value, onChange, invalid, autoFocus }: BaseUrlInputProps) {
  const t = useT()
  const hintId = `${id}-hint`

  return (
    <>
      <Input
        id={id}
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://api.example.com/v1"
        autoComplete="url"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        aria-describedby={hintId}
        className="font-mono"
      />
      <p id={hintId} className={cn('text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>
        {invalid ? t('field.baseUrl.invalid') : t('field.baseUrl.hint')}
      </p>
    </>
  )
}
