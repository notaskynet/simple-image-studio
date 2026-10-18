import { ChevronDown, ChevronRight, ImagePlus, LoaderCircle, MoreHorizontal, Plus, Star, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'

import { Thumb } from '@/components/Thumb'
import { Tip } from '@/components/Tip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT, type TFunction } from '@/i18n'
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

type Children = Map<string | undefined, Version[]>

function groupByParent(versions: Version[]): Children {
  const ids = new Set(versions.map((v) => v.id))
  const children: Children = new Map()
  for (const version of versions) {
    const key = version.parentId && ids.has(version.parentId) ? version.parentId : undefined
    children.set(key, [...(children.get(key) ?? []), version])
  }
  for (const list of children.values()) list.sort((a, b) => a.number - b.number)
  return children
}

export function VersionTree(props: VersionTreeProps) {
  const t = useT()
  const upload = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const children = useMemo(() => groupByParent(props.versions), [props.versions])
  const roots = children.get(undefined) ?? []

  function onFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) props.onUpload(file)
  }

  function toggle(id: string): void {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 p-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={props.onNew}>
          <Plus aria-hidden="true" />
          {t('prompt.mode.new')}
        </Button>
        <Tip label={t('canvas.upload')}>
          <Button variant="outline" size="sm" onClick={() => upload.current?.click()} aria-label={t('canvas.upload')}>
            <ImagePlus aria-hidden="true" />
          </Button>
        </Tip>
        <input ref={upload} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {roots.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('versions.empty')}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {roots.map((version) => (
            <Node key={version.id} version={version} childrenMap={children} collapsed={collapsed} onToggle={toggle} tree={props} t={t} root />
          ))}
        </ul>
      )}
    </div>
  )
}

interface NodeProps {
  version: Version
  childrenMap: Children
  collapsed: Set<string>
  onToggle: (id: string) => void
  tree: VersionTreeProps
  t: TFunction
  root?: boolean
}

function Node({ version, childrenMap, collapsed, onToggle, tree, t, root }: NodeProps) {
  const kids = childrenMap.get(version.id) ?? []
  const open = !collapsed.has(version.id)
  const selected = version.id === tree.selectedId

  return (
    <li
      className={cn(
        'relative',
        // Горизонтальная «ветка» от вертикальной линии родителя к узлу.
        !root && "before:absolute before:top-6 before:-left-3 before:h-px before:w-3 before:bg-border before:content-['']",
      )}
    >
      <div className={cn('group flex items-center gap-1 rounded-lg p-1 pr-1', selected ? 'bg-accent' : 'hover:bg-muted')}>
        {kids.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(version.id)}
            aria-label={`${version.number}: ${open ? '−' : '+'} ${kids.length}`}
            aria-expanded={open}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => tree.onSelect(version.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-current={selected}
        >
          <span className="relative shrink-0">
            <Thumb imageId={version.imageId} remoteUrl={version.remoteUrl} className="size-10 rounded-md" />
            {version.status === 'pending' && <LoaderCircle className="absolute inset-0 m-auto size-4 animate-spin" aria-hidden="true" />}
            {version.status === 'error' && <TriangleAlert className="absolute inset-0 m-auto size-4 text-destructive" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-medium">
              {t('version.label', { n: version.number })}
              {version.favorite && <Star className="size-3 fill-current" aria-hidden="true" />}
              {!open && kids.length > 0 && <span className="text-xs font-normal text-muted-foreground">+{kids.length}</span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {version.kind === 'upload' ? t('version.upload') : version.recipe.prompt}
            </span>
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('version.actions')} />}>
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {version.status === 'done' && (
              <DropdownMenuItem onClick={() => tree.onBranch(version)}>{t('version.branch')}</DropdownMenuItem>
            )}
            {version.kind !== 'upload' && (
              <>
                <DropdownMenuItem onClick={() => tree.onRerun(version)}>{t('version.rerun')}</DropdownMenuItem>
                {tree.canRerunHigh && (
                  <DropdownMenuItem onClick={() => tree.onRerun(version, 'quality')}>{t('version.rerunQuality')}</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => tree.onRerun(version, 'model')}>{t('version.rerunModel')}</DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => tree.onToggleFavorite(version)}>
              {version.favorite ? t('version.unfavorite') : t('version.favorite')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => tree.onDelete(version)}>
              {t('version.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {kids.length > 0 && open && (
        // Вертикальная линия под родителем; от неё к каждому ребёнку идёт горизонтальная ветка.
        <ul className="ml-[1.4rem] border-l pl-3">
          {kids.map((child) => (
            <Node key={child.id} version={child} childrenMap={childrenMap} collapsed={collapsed} onToggle={onToggle} tree={tree} t={t} />
          ))}
        </ul>
      )}
    </li>
  )
}
