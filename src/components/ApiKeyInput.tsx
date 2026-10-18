import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/i18n'

interface ApiKeyInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function ApiKeyInput({ id, value, onChange, autoFocus }: ApiKeyInputProps) {
  const t = useT()
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="sk-..."
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        // API-ключ — не пароль от аккаунта: просим менеджеры паролей не предлагать его сохранить.
        data-bwignore
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        className="pr-10 font-mono"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0.5 my-auto"
        aria-label={visible ? t('field.apiKey.hide') : t('field.apiKey.show')}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  )
}
