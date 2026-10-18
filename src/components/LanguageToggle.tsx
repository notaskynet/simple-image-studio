import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useI18n } from '@/i18n'

export function LanguageToggle() {
  const { t, lang, setLang } = useI18n()
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[lang]}
      onValueChange={(value) => {
        const next = value[0]
        if (next === 'ru' || next === 'en') setLang(next)
      }}
      aria-label={t('common.language')}
    >
      <ToggleGroupItem value="ru">RU</ToggleGroupItem>
      <ToggleGroupItem value="en">EN</ToggleGroupItem>
    </ToggleGroup>
  )
}
