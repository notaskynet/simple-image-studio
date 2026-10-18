import { ImagePlus, X } from 'lucide-react'
import { useRef, type ChangeEvent, type DragEvent } from 'react'

import { Thumb } from '@/components/Thumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useT, type Key } from '@/i18n'
import { modelSuggestions, type ModelProfile } from '@/lib/models'
import type { RefRole } from '@/types'
import type { Draft } from './draft'

interface ParamsPanelProps {
  model: string
  onModelChange: (model: string) => void
  draft: Draft
  onDraftChange: (patch: Partial<Draft>) => void
  profile: ModelProfile
  onAddRefs: (files: File[]) => void
}

const ROLES: RefRole[] = ['style', 'subject', 'character', 'other']
const COUNTS = [1, 2, 3, 4]

export function ParamsPanel({ model, onModelChange, draft, onDraftChange, profile, onAddRefs }: ParamsPanelProps) {
  const t = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const refsFull = draft.refs.length >= profile.maxRefs

  function sizeLabel(size: string): string {
    return size === 'auto' ? t('params.size.auto') : size.replace('x', ' × ')
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>): void {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length > 0) onAddRefs(files)
  }

  function onDrop(event: DragEvent): void {
    const files = [...event.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    event.preventDefault()
    onAddRefs(files)
  }

  function setRole(imageId: string, role: RefRole): void {
    onDraftChange({ refs: draft.refs.map((r) => (r.imageId === imageId ? { ...r, role } : r)) })
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <Label htmlFor="params-model">{t('params.model')}</Label>
        <Input
          id="params-model"
          list="params-model-list"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
        />
        <datalist id="params-model-list">
          {modelSuggestions().map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label>{t('params.size')}</Label>
        <Select value={draft.size} onValueChange={(size) => size && onDraftChange({ size })}>
          <SelectTrigger className="w-full">
            <SelectValue>{(value: string) => sizeLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {profile.sizes.map((size) => (
              <SelectItem key={size} value={size}>
                {sizeLabel(size)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {profile.quality.length > 0 && (
        <div className="space-y-2">
          <Label>{t('params.quality')}</Label>
          <Select value={draft.quality} onValueChange={(quality) => quality && onDraftChange({ quality })}>
            <SelectTrigger className="w-full">
              <SelectValue>{(value: string) => t(`quality.${value}` as Key)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {profile.quality.map((quality) => (
                <SelectItem key={quality} value={quality}>
                  {t(`quality.${quality}` as Key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('params.count')}</Label>
        <ToggleGroup
          variant="outline"
          value={[String(draft.n)]}
          onValueChange={(value) => value[0] && onDraftChange({ n: Number(value[0]) })}
        >
          {COUNTS.map((count) => (
            <ToggleGroupItem key={count} value={String(count)} className="w-10">
              {count}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {profile.background && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="params-background">{t('params.background')}</Label>
          <Switch
            id="params-background"
            checked={draft.background}
            onCheckedChange={(background) => onDraftChange({ background })}
          />
        </div>
      )}

      {profile.negative && (
        <div className="space-y-2">
          <Label htmlFor="params-negative">{t('params.negative')}</Label>
          <Textarea
            id="params-negative"
            value={draft.negative}
            onChange={(e) => onDraftChange({ negative: e.target.value })}
            placeholder={t('params.negative.placeholder')}
            rows={2}
          />
        </div>
      )}

      <div className="space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <Label>{t('params.refs')}</Label>
        {draft.refs.length > 0 && (
          <ul className="space-y-2">
            {draft.refs.map((ref) => (
              <li key={ref.imageId} className="flex items-center gap-2">
                <Thumb imageId={ref.imageId} className="size-10 shrink-0 rounded-md" />
                <Select value={ref.role} onValueChange={(role) => role && setRole(ref.imageId, role as RefRole)}>
                  <SelectTrigger size="sm" className="min-w-0 flex-1">
                    <SelectValue>{(value: RefRole) => t(`role.${value}` as Key)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`role.${role}` as Key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('params.refs.remove')}
                  onClick={() => onDraftChange({ refs: draft.refs.filter((r) => r.imageId !== ref.imageId) })}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" className="w-full" disabled={refsFull} onClick={() => fileInput.current?.click()}>
          <ImagePlus aria-hidden="true" />
          {t('params.refs.add')}
        </Button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        <p className="text-xs text-muted-foreground">
          {refsFull ? t('params.refs.max', { n: profile.maxRefs }) : t('params.refs.hint')}
        </p>
      </div>
    </div>
  )
}
