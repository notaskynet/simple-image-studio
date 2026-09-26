import type { GenerationMeta } from '../../types'
import { Thumb } from '../Thumb'
import { focusRing } from '../ui'

interface VersionStripProps {
  versions: GenerationMeta[]
  byId: Map<string, GenerationMeta>
  pinnedId: string | undefined
  onSelect: (meta: GenerationMeta) => void
}

export function VersionStrip({ versions, byId, pinnedId, onSelect }: VersionStripProps) {
  if (versions.length === 0) return null
  return (
    <nav aria-label="Версии" className="flex gap-2 overflow-x-auto py-2 [scrollbar-width:thin]">
      {versions.map((meta) => {
        const parent = meta.parentId ? byId.get(meta.parentId) : undefined
        const pinned = meta.id === pinnedId
        return (
          <button
            key={meta.id}
            type="button"
            onClick={() => onSelect(meta)}
            className={`group flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${focusRing}`}
            aria-label={`Перейти к v${meta.version ?? 1}${parent ? `, доработка v${parent.version ?? 1}` : ''}`}
            aria-current={pinned ? 'true' : undefined}
          >
            <Thumb
              meta={meta}
              className={`size-11 rounded-lg ring-2 transition ${pinned ? 'ring-violet-500' : 'ring-transparent group-hover:ring-zinc-300 dark:group-hover:ring-zinc-700'}`}
            />
            <span className="text-[10px] leading-none text-zinc-500 tabular-nums dark:text-zinc-400">
              v{meta.version ?? 1}
              {parent && <span className="opacity-70"> ← v{parent.version ?? 1}</span>}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
