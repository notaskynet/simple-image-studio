import { LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useI18n, type Key } from '@/i18n'
import { normalizeBaseUrl } from '@/lib/api'
import {
  enableParam,
  getDisabled,
  getOverrides,
  getProfile,
  setOverrides,
  type MaskSupport,
  type ModelProfile,
} from '@/lib/models'
import { ApiKeyInput } from './ApiKeyInput'
import { BaseUrlInput } from './BaseUrlInput'

interface SettingsDialogProps {
  baseUrl: string
  apiKey: string
  model: string
  onSave: (values: { baseUrl: string; apiKey: string }) => void
  onForgetKey: () => void
  onProfileChange: () => void
  onClose: () => void
}

const MASK_LABELS: Record<MaskSupport, Key> = {
  native: 'settings.cap.mask.native',
  visual: 'settings.cap.mask.visual',
  none: 'settings.cap.mask.none',
}

const DEFAULT_QUALITY = ['low', 'medium', 'high']

export function SettingsDialog({
  baseUrl,
  apiKey,
  model,
  onSave,
  onForgetKey,
  onProfileChange,
  onClose,
}: SettingsDialogProps) {
  const { t, lang, setLang } = useI18n()
  const [urlValue, setUrlValue] = useState(baseUrl)
  const [keyValue, setKeyValue] = useState(apiKey)
  const [profileModel, setProfileModel] = useState(model)
  const [, refresh] = useState(0)

  const normalizedUrl = normalizeBaseUrl(urlValue)
  const profile = getProfile(profileModel)
  const disabled = getDisabled(profileModel)
  const hasOverrides = Object.keys(getOverrides(profileModel)).length > 0

  function submit(event: FormEvent): void {
    event.preventDefault()
    if (!normalizedUrl || !keyValue.trim()) return
    onSave({ baseUrl: normalizedUrl, apiKey: keyValue.trim() })
  }

  function patchProfile(patch: Partial<ModelProfile>): void {
    setOverrides(profileModel, { ...getOverrides(profileModel), ...patch })
    refresh((v) => v + 1)
    onProfileChange()
  }

  function resetProfile(): void {
    setOverrides(profileModel, null)
    refresh((v) => v + 1)
    onProfileChange()
  }

  function reenable(param: string): void {
    enableParam(profileModel, param)
    refresh((v) => v + 1)
    onProfileChange()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="settings-url">{t('field.baseUrl')}</Label>
            <BaseUrlInput
              id="settings-url"
              value={urlValue}
              onChange={setUrlValue}
              invalid={urlValue.trim() !== '' && normalizedUrl === null}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-key">{t('field.apiKey')}</Label>
            <ApiKeyInput id="settings-key" value={keyValue} onChange={setKeyValue} />
          </div>

          <div className="space-y-2">
            <Label>{t('common.language')}</Label>
            <ToggleGroup
              variant="outline"
              value={[lang]}
              onValueChange={(value) => {
                const next = value[0]
                if (next === 'ru' || next === 'en') setLang(next)
              }}
            >
              <ToggleGroupItem value="ru">Русский</ToggleGroupItem>
              <ToggleGroupItem value="en">English</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!normalizedUrl || !keyValue.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </form>

        <section className="space-y-4 border-t pt-5">
          <div>
            <h3 className="text-sm font-semibold">{t('settings.models')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('settings.models.hint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-profile-model">{t('settings.models.model')}</Label>
            <Input
              id="settings-profile-model"
              value={profileModel}
              onChange={(e) => setProfileModel(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
          </div>

          <div className="space-y-3">
            <CapabilityRow label={t('settings.cap.n')}>
              <Switch checked={profile.n} onCheckedChange={(n) => patchProfile({ n })} />
            </CapabilityRow>
            <CapabilityRow label={t('settings.cap.quality')}>
              <Switch
                checked={profile.quality.length > 0}
                onCheckedChange={(on) => patchProfile({ quality: on ? DEFAULT_QUALITY : [] })}
              />
            </CapabilityRow>
            <CapabilityRow label={t('settings.cap.background')}>
              <Switch checked={profile.background} onCheckedChange={(background) => patchProfile({ background })} />
            </CapabilityRow>
            <CapabilityRow label={t('settings.cap.negative')}>
              <Switch checked={profile.negative} onCheckedChange={(negative) => patchProfile({ negative })} />
            </CapabilityRow>
            <CapabilityRow label={t('settings.cap.inputFidelity')}>
              <Switch
                checked={profile.inputFidelity}
                onCheckedChange={(inputFidelity) => patchProfile({ inputFidelity })}
              />
            </CapabilityRow>
            <CapabilityRow label={t('settings.cap.mask')}>
              <Select
                value={profile.mask}
                onValueChange={(value) => patchProfile({ mask: value as MaskSupport })}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue>{(value: MaskSupport) => t(MASK_LABELS[value])}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MASK_LABELS) as MaskSupport[]).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(MASK_LABELS[kind])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CapabilityRow>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('settings.disabled')}</h4>
            <p className="text-xs text-muted-foreground">{t('settings.disabled.hint')}</p>
            {disabled.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('settings.disabled.none')}</p>
            ) : (
              <ul className="space-y-1">
                {disabled.map((param) => (
                  <li key={param} className="flex items-center justify-between gap-2 text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{param}</code>
                    <Button type="button" variant="ghost" size="xs" onClick={() => reenable(param)}>
                      {t('settings.disabled.enable')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasOverrides && (
            <Button type="button" variant="outline" size="sm" onClick={resetProfile}>
              {t('settings.models.reset')}
            </Button>
          )}
        </section>

        <DialogFooter className="border-t pt-4 sm:justify-start">
          <Button type="button" variant="destructive" onClick={onForgetKey}>
            <LogOut aria-hidden="true" />
            {t('settings.forgetKey')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CapabilityRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      {children}
    </div>
  )
}
