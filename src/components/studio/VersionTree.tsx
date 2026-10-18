import { ImagePlus, LoaderCircle, MoreHorizontal, Plus, Star, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, type ChangeEvent } from 'react'

import { Thumb } from '@/components/Thumb'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { Version } from '@/types'

interface VersionTreeProps {
  versions: Version[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  onNew: () => void
  onUpload: (file: File) => void
  onBranch: (version: Version) => void
  onRerun: (version: Version, patch?: 'quality' | 'model') => void
  onToggleFavorite: (version: Version) => void
  onDelete: (version: Version) => void
  canRerunHigh: boolean
}

interface Row {
  version: Version
  depth: number
}

function flatten(versions: Version[]): Row[] {
  const ids = new Set(versions.map((v) => v.id))
  const children = new Map<string | undefined, Version[]>()
  for (const version of versions) {
    const key = version.parentId && ids.has(version.parentId) ? version.parentId : undefined
    children.set(key, [...(children.get(key) ?? []), version])
  }
  const rows: Row[] = []
  const visit = (parentId: string | undefined, depth: number) => {
    for (const version of (children.get(parentId) ?? []).sort((a, b) => a.number - b.number)) {
      rows.push({ version, depth })
      visit(version.id, depth + 1)
    }
  }
  visit(undefined, 0)
  return rows
}

export function VersionTree({
  versions,
  selectedId,
  onSelect,
  onNew,
  onUpload,
  onBranch,
  onRerun,
  onToggleFavorite,
  onDelete,
  canRerunHigh,
}: VersionTreeProps) {
  const t = useT()
  const upload = useRef<HTMLInputElement>(null)
  const rows = useMemo(() => flatten(versions), [versions])

  function onFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onUpload(file)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 p-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={onNew}>
          <Plus aria-hidden="true" />
          {t('prompt.mode.new')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => upload.current?.click()} aria-label={t('canvas.upload')} title={t('canvas.upload')}>
          <ImagePlus aria-hidden="true" />
        </Button>
        <input ref={upload} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('versions.empty')}</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {rows.map(({ version, depth }) => (
            <li key={version.id} style={{ paddingLeft: Math.min(depth, 6) * 12 }}>
              <div
                className={cn(
                  'group flex items-center gap-2 rounded-lg p-1.5 pr-1',
                  version.id === selectedId ? 'bg-accent' : 'hover:bg-muted',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(version.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-current={version.id === selectedId}
                >
                  <span className="relative shrink-0">
                    <Thumb imageId={version.imageId} remoteUrl={version.remoteUrl} className="size-10 rounded-md" />
                    {version.status === 'pending' && (
                      <LoaderCircle className="absolute inset-0 m-auto size-4 animate-spin" aria-hidden="true" />
                    )}
                    {version.status === 'error' && (
                      <TriangleAlert className="absolute inset-0 m-auto size-4 text-destructive" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {t('version.label', { n: version.number })}
                      {version.favorite && <Star className="size-3 fill-current" aria-hidden="true" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {version.kind === 'upload' ? t('version.upload') : version.recipe.prompt}
                    </span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={t('version.actions')} />}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {version.status === 'done' && (
                      <DropdownMenuItem onClick={() => onBranch(version)}>{t('version.branch')}</DropdownMenuItem>
                    )}
                    {version.kind !== 'upload' && (
                      <>
                        <DropdownMenuItem onClick={() => onRerun(version)}>{t('version.rerun')}</DropdownMenuItem>
                        {canRerunHigh && (
                          <DropdownMenuItem onClick={() => onRerun(version, 'quality')}>
                            {t('version.rerunQuality')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onRerun(version, 'model')}>
                          {t('version.rerunModel')}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => onToggleFavorite(version)}>
                      {version.favorite ? t('version.unfavorite') : t('version.favorite')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(version)}>
                      {t('version.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
