import { ArrowUp, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n'
import type { Version } from '@/types'

interface PromptBarProps {
  value: string
  onChange: (value: string) => void
  base: Version | undefined
  onResetBase: () => void
  onSubmit: () => void
  onPasteImages: (files: File[]) => void
}

export function PromptBar({ value, onChange, base, onResetBase, onSubmit, onPasteImages }: PromptBarProps) {
  const t = useT()
  const canSend = value.trim().length > 0

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <div className="border-t p-3">
      <div className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
            {base ? t('prompt.mode.edit', { n: base.number }) : t('prompt.mode.new')}
          </span>
          {base && (
            <Button variant="ghost" size="xs" onClick={onResetBase}>
              <X aria-hidden="true" />
              {t('prompt.mode.reset')}
            </Button>
          )}
          <span className="ml-auto hidden sm:inline">{t('prompt.hint')}</span>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
              if (files.length > 0) {
                e.preventDefault()
                onPasteImages(files)
              }
            }}
            placeholder={base ? t('prompt.placeholder.edit') : t('prompt.placeholder.new')}
            rows={2}
            className="max-h-40 min-h-16 flex-1 resize-none"
          />
          <Button
            size="icon-lg"
            disabled={!canSend}
            onClick={onSubmit}
            aria-label={base ? t('prompt.sendEdit') : t('prompt.send')}
            title={base ? t('prompt.sendEdit') : t('prompt.send')}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
