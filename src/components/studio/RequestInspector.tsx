import { Copy, ImagePlus } from 'lucide-react'

import { Thumb } from '@/components/Thumb'
import { Button } from '@/components/ui/button'
import { useT, type Key } from '@/i18n'
import { copyText } from '@/lib/image'
import { notify } from '@/lib/notify'
import type { Ref, SentRequest, Version } from '@/types'

interface RequestInspectorProps {
  version: Version | undefined
  onUseRefs: (refs: Ref[]) => void
}

const heading = 'mb-1 text-xs font-medium text-muted-foreground uppercase'

export function RequestInspector({ version, onUseRefs }: RequestInspectorProps) {
  const t = useT()

  if (!version) return <p className="p-4 text-sm text-muted-foreground">{t('inspector.empty')}</p>
  if (version.kind === 'upload') return <p className="p-4 text-sm text-muted-foreground">{t('inspector.none')}</p>
  const { sent } = version
  const refs = version.recipe.refs
  if (!sent && refs.length === 0) return <p className="p-4 text-sm text-muted-foreground">{t('inspector.empty')}</p>

  return (
    <div className="space-y-4 overflow-y-auto p-4 text-sm">
      {refs.length > 0 && (
        <section>
          <h4 className={heading}>{t('inspector.refs')}</h4>
          <ul className="mt-2 space-y-2">
            {refs.map((ref) => (
              <li key={ref.imageId} className="flex items-center gap-2">
                <Thumb imageId={ref.imageId} className="size-10 shrink-0 rounded-md" />
                <span className="min-w-0 text-xs">
                  <span className="font-medium">{t(`role.${ref.role}` as Key)}</span>
                  {ref.note && <span className="block truncate text-muted-foreground">{ref.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => onUseRefs(refs)}>
            <ImagePlus aria-hidden="true" />
            {t('inspector.useRefs')}
          </Button>
        </section>
      )}
      {sent && <SentDetails sent={sent} />}
      {version.status === 'done' && <ResponseDetails response={version.response} />}
    </div>
  )
}

function SentDetails({ sent }: { sent: SentRequest }) {
  const t = useT()
  const { prompt, ...fields } = sent.fields

  async function copy(): Promise<void> {
    await copyText(
      JSON.stringify(
        { endpoint: `/images/${sent.endpoint}`, ...sent.fields, images: sent.imageCount, mask: sent.maskKind },
        null,
        2,
      ),
    )
    notify(t('canvas.copied'), 'success')
  }

  return (
    <>
      <section>
        <h4 className={heading}>{t('inspector.endpoint')}</h4>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /images/{sent.endpoint}</code>
      </section>
      <section>
        <h4 className={heading}>{t('inspector.prompt')}</h4>
        <pre className="rounded-lg bg-muted p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">{prompt}</pre>
      </section>
      <section>
        <h4 className={heading}>{t('inspector.fields')}</h4>
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
          <h4 className={heading}>{t('inspector.omitted')}</h4>
          <p className="font-mono text-xs">{sent.omitted.join(', ')}</p>
        </section>
      )}
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        <Copy aria-hidden="true" />
        {t('inspector.copy')}
      </Button>
    </>
  )
}

const COST_KEY = /cost|price|spent|charge|credit/i

interface UsageSummary {
  tokens: number | null
  costs: { key: string; value: number }[]
}

/** Достаёт из ответов токены и всё, что похоже на стоимость; единицы стоимости определяет провайдер. */
function summarize(responses: Record<string, unknown>[]): UsageSummary {
  let tokens: number | null = null
  const costs: { key: string; value: number }[] = []

  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
      const full = path ? `${path}.${key}` : key
      if (typeof item === 'number' && COST_KEY.test(key)) costs.push({ key: full, value: item })
      else if (typeof item === 'object') visit(item, full)
    }
  }

  for (const response of responses) {
    const usage = response.usage as { total_tokens?: unknown } | undefined
    if (typeof usage?.total_tokens === 'number') tokens = (tokens ?? 0) + usage.total_tokens
    visit(response, '')
  }
  return { tokens, costs }
}

function ResponseDetails({ response }: { response: Record<string, unknown>[] | undefined }) {
  const t = useT()
  const summary = response ? summarize(response) : { tokens: null, costs: [] }
  const found = summary.tokens !== null || summary.costs.length > 0

  return (
    <section>
      <h4 className={heading}>{t('inspector.response')}</h4>
      {!found && <p className="text-xs text-muted-foreground">{t('inspector.noUsage')}</p>}
      {found && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {summary.tokens !== null && (
            <>
              <dt className="text-muted-foreground">{t('inspector.tokens')}</dt>
              <dd className="font-mono">{summary.tokens}</dd>
            </>
          )}
          {summary.costs.map((cost) => (
            <div key={cost.key} className="contents">
              <dt className="font-mono text-muted-foreground">{cost.key}</dt>
              <dd className="font-mono">{cost.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {response && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">JSON</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed break-words whitespace-pre-wrap select-text">
            {JSON.stringify(response.length === 1 ? response[0] : response, null, 2)}
          </pre>
        </details>
      )}
    </section>
  )
}
