import { useCallback, useState } from 'react'

import { Onboarding } from '@/components/Onboarding'
import { SettingsDialog } from '@/components/SettingsDialog'
import { StudioView } from '@/components/studio/StudioView'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { useI18n } from '@/i18n'
import { DEFAULT_MODEL } from '@/lib/models'
import { settings } from '@/lib/settings'
import { useEffect } from 'react'

export default function App() {
  const { t } = useI18n()
  const [theme, toggleTheme] = useTheme()
  const [baseUrl, setBaseUrl] = useState(settings.getBaseUrl)
  const [apiKey, setApiKey] = useState(settings.getApiKey)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileTick, setProfileTick] = useState(0)

  useEffect(() => {
    document.title = t('app.title')
  }, [t])

  const save = useCallback((values: { baseUrl: string; apiKey: string }) => {
    settings.setBaseUrl(values.baseUrl)
    settings.setApiKey(values.apiKey)
    setBaseUrl(values.baseUrl)
    setApiKey(values.apiKey)
  }, [])

  const forgetKey = useCallback(() => {
    settings.setApiKey(null)
    setApiKey('')
    setSettingsOpen(false)
  }, [])

  const configured = !!baseUrl && !!apiKey

  return (
    <TooltipProvider>
      {configured ? (
        <StudioView
          baseUrl={baseUrl}
          apiKey={apiKey}
          theme={theme}
          profileTick={profileTick}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <Onboarding initialBaseUrl={baseUrl} initialApiKey={apiKey} onSave={save} />
      )}
      {configured && settingsOpen && (
        <SettingsDialog
          baseUrl={baseUrl}
          apiKey={apiKey}
          model={settings.getModel() ?? DEFAULT_MODEL}
          onSave={(values) => {
            save(values)
            setSettingsOpen(false)
          }}
          onForgetKey={forgetKey}
          onProfileChange={() => setProfileTick((v) => v + 1)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <Toaster theme={theme} />
    </TooltipProvider>
  )
}
