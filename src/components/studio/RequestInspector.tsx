import { Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { copyText } from '@/lib/image'
import { notify } from '@/lib/notify'
import type { Version } from '@/types'

export function RequestInspector({ version }: { version: Version | undefined }) {
  const t = useT()

  if (!version) return <p className="p-4 text-sm text-muted-foreground">{t('inspector.empty')}</p>
  if (version.kind === 'upload') return <p className="p-4 text-sm text-muted-foreground">{t('inspector.none')}</p>
  const sent = version.sent
  if (!sent) return <p className="p-4 text-sm text-muted-foreground">{t('inspector.empty')}</p>

  const { prompt, ...fields } = sent.fields

  async function copy(): Promise<void> {
    await copyText(JSON.stringify({ endpoint: `/images/${sent?.endpoint}`, ...sent?.fields, images: sent?.imageCount, mask: sent?.maskKind }, null, 2))
    notify(t('canvas.copied'), 'success')
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4 text-sm">
      <section>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">{t('inspector.endpoint')}</h4>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /images/{sent.endpoint}</code>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">{t('inspector.prompt')}</h4>
        <pre className="rounded-lg bg-muted p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">{prompt}</pre>
      </section>
      <section>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">{t('inspector.fields')}</h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {Object.entries(fields).map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="font-mono text-muted-foreground">{name}</dt>
              <dd className="font-mono break-words">{value}</dd>
            </div>
          ))}
          <dt className="font-mono text-muted-foreground">{t('inspector.images')}</dt>
          <dd className="font-mono">{sent.imageCount}</dd>
          {sent.maskKind && (
            <>
              <dt className="font-mono text-muted-foreground">{t('inspector.mask')}</dt>
              <dd className="font-mono">{sent.maskKind}</dd>
            </>
          )}
        </dl>
      </section>
      {sent.omitted.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">{t('inspector.omitted')}</h4>
          <p className="font-mono text-xs">{sent.omitted.join(', ')}</p>
        </section>
      )}
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        <Copy aria-hidden="true" />
        {t('inspector.copy')}
      </Button>
    </div>
  )
}
