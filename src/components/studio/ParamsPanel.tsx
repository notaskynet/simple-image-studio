import { ImagePlus, RefreshCw, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

import { ImagePreviewDialog } from '@/components/ImagePreviewDialog'
import { Thumb } from '@/components/Thumb'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
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
  /** imageId → номера версий, в которых референс использовался. */
  refUsage: Record<string, number[]>
  remoteModels: string[]
  refreshingModels: boolean
  onRefreshModels: () => void
}

const ROLES: RefRole[] = ['style', 'subject', 'character', 'other', 'custom']
const COUNTS = [1, 2, 3, 4]

export function ParamsPanel({ model, onModelChange, draft, onDraftChange, profile, onAddRefs, refUsage, remoteModels, refreshingModels, onRefreshModels }: ParamsPanelProps) {
  const t = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const refsFull = draft.refs.length >= profile.maxRefs
  const [previewId, setPreviewId] = useState<string | null>(null)
  // Пока пользователь не печатал, показываем все модели, а не только совпадающие с текущим значением.
  const [typed, setTyped] = useState(false)
  const suggestions = modelSuggestions(remoteModels)

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

  function patchRef(imageId: string, patch: { role?: RefRole; note?: string }): void {
    onDraftChange({ refs: draft.refs.map((r) => (r.imageId === imageId ? { ...r, ...patch } : r)) })
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="params-model">{t('params.model')}</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRefreshModels}
            disabled={refreshingModels}
            aria-label={t('params.models.refresh')}
            title={t('params.models.refresh')}
          >
            <RefreshCw className={refreshingModels ? 'animate-spin' : undefined} aria-hidden="true" />
          </Button>
        </div>
        <Combobox
          items={suggestions}
          value={model}
          inputValue={model}
          filter={(item: string, query: string) => !typed || item.toLowerCase().includes(query.trim().toLowerCase())}
          onOpenChange={(open) => open && setTyped(false)}
          onInputValueChange={(value, details) => {
            if (details.reason === 'input-change') setTyped(true)
            onModelChange(value)
          }}
          onValueChange={(value) => value && onModelChange(value)}
        >
          <ComboboxInput id="params-model" spellCheck={false} autoComplete="off" className="font-mono" />
          <ComboboxContent>
            <ComboboxEmpty>{t('params.models.empty')}</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item} className="font-mono">
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {remoteModels.length > 0 && (
          <p className="text-xs text-muted-foreground">{t('params.models.count', { n: remoteModels.length })}</p>
        )}
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
              <li key={ref.imageId} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewId(ref.imageId)}
                    aria-label={t('params.refs.preview')}
                    title={t('params.refs.preview')}
                    className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Thumb imageId={ref.imageId} className="size-10 rounded-md transition-opacity hover:opacity-80" />
                  </button>
                  <Select value={ref.role} onValueChange={(role) => role && patchRef(ref.imageId, { role: role as RefRole })}>
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
                </div>
                {refUsage[ref.imageId] && (
                  <p className="pl-12 text-xs text-muted-foreground">
                    {t('params.refs.usedIn', { versions: refUsage[ref.imageId].map((n) => `v${n}`).join(', ') })}
                  </p>
                )}
                {ref.role === 'custom' && (
                  <Input
                    value={ref.note ?? ''}
                    onChange={(e) => patchRef(ref.imageId, { note: e.target.value })}
                    placeholder={t('params.refs.note')}
                    aria-label={t('params.refs.note')}
                  />
                )}
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
      {previewId && (
        <ImagePreviewDialog imageId={previewId} title={t('params.refs')} onClose={() => setPreviewId(null)} />
      )}
    </div>
  )
}
