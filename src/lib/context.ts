import { STYLES } from './presets'
import type { GenerationMeta, StyleId } from '../types'

const MAX_EDITS = 10

export function getLineage(base: GenerationMeta | undefined, byId: Map<string, GenerationMeta>): GenerationMeta[] {
  const chain: GenerationMeta[] = []
  const seen = new Set<string>()
  let current = base
  while (current && !seen.has(current.id)) {
    chain.unshift(current)
    seen.add(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return chain
}

function styleSuffix(styles: StyleId[]): string {
  const descriptions = STYLES.filter((s) => styles.includes(s.id)).map((s) => s.description)
  return descriptions.length ? `\n\nStyle: ${descriptions.join('; ')}.` : ''
}

interface PromptInput {
  text: string
  styles: StyleId[]
  lineage: GenerationMeta[]
  attachmentCount: number
  includeOriginal: boolean
}

export function buildPrompt({ text, styles, lineage, attachmentCount, includeOriginal }: PromptInput): string {
  const request = text.trim()
  if (lineage.length === 0) {
    const refs =
      attachmentCount > 0
        ? `\n\nUse the attached image${attachmentCount > 1 ? 's' : ''} as reference.`
        : ''
    return `${request}${refs}${styleSuffix(styles)}`
  }

  const [root, ...edits] = lineage
  const recent = edits.slice(-MAX_EDITS)
  const lines = [
    'Edit the first attached image according to the new instruction.',
    `Original request: ${root.prompt}`,
  ]
  if (recent.length > 0) {
    lines.push('Edits already applied to this image:')
    recent.forEach((meta, i) => lines.push(`${i + 1}) ${meta.prompt}`))
  }
  lines.push(`New instruction: ${request}`)
  if (includeOriginal && lineage.length > 1) {
    lines.push('The second attached image is the original version; keep the result consistent with it.')
  }
  if (attachmentCount > 0) {
    lines.push('Other attached images are additional references from the user.')
  }
  lines.push('Keep everything that the new instruction does not mention unchanged.')
  return `${lines.join('\n')}${styleSuffix(styles)}`
}
