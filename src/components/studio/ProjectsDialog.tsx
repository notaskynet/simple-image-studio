import { Check, ImageIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Thumb } from '@/components/Thumb'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { Project, Version } from '@/types'

interface ProjectsDialogProps {
  projects: Project[]
  versions: Version[]
  currentId: string | undefined
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

interface Summary {
  count: number
  cover: Version | undefined
}

export function ProjectsDialog({ projects, versions, currentId, onSelect, onCreate, onRename, onDelete, onClose }: ProjectsDialogProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<Project | null>(null)

  const summaries = useMemo(() => {
    const map = new Map<string, Summary>()
    for (const v of versions) {
      const current = map.get(v.projectId) ?? { count: 0, cover: undefined }
      current.count += 1
      const hasImage = v.status === 'done' && (v.imageId || v.remoteUrl)
      if (hasImage && (!current.cover || v.createdAt > current.cover.createdAt)) current.cover = v
      map.set(v.projectId, current)
    }
    return map
  }, [versions])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return projects
    const matching = new Set(
      versions.filter((v) => v.recipe.prompt.toLowerCase().includes(needle)).map((v) => v.projectId),
    )
    return projects.filter((p) => p.title.toLowerCase().includes(needle) || matching.has(p.id))
  }, [projects, versions, query])

  function commitRename(): void {
    if (editingId) onRename(editingId, title)
    setEditingId(null)
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('project.menu')}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('project.search')}
              aria-label={t('project.search')}
              className="pl-8"
            />
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <li>
              <button
                type="button"
                onClick={onCreate}
                className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus className="size-6" aria-hidden="true" />
                {t('project.new')}
              </button>
            </li>
            {filtered.map((project) => {
              const summary = summaries.get(project.id)
              const editing = editingId === project.id
              return (
                <li key={project.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className="block w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      className={cn(
                        'relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted',
                        project.id === currentId && 'ring-2 ring-primary',
                      )}
                    >
                      {summary?.cover ? (
                        <Thumb imageId={summary.cover.imageId} remoteUrl={summary.cover.remoteUrl} className="size-full" />
                      ) : (
                        <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                          <ImageIcon className="size-6" aria-hidden="true" />
                          {t('project.cover')}
                        </span>
                      )}
                    </span>
                    {!editing && (
                      <span className="mt-1.5 block px-0.5">
                        <span className="block truncate text-sm font-medium">{project.title || t('project.untitled')}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t('project.versions', { n: summary?.count ?? 0 })} · {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </button>
                  {editing && (
                    <div className="mt-1.5 flex gap-1">
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                        autoFocus
                        className="flex-1"
                      />
                      <Button variant="secondary" size="icon" onClick={commitRename} aria-label={t('common.save')}>
                        <Check aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                  {!editing && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => {
                          setEditingId(project.id)
                          setTitle(project.title)
                        }}
                        aria-label={t('project.rename')}
                        title={t('project.rename')}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button variant="secondary" size="icon-sm" onClick={() => setDeleting(project)} aria-label={t('project.delete')} title={t('project.delete')}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {filtered.length === 0 && projects.length > 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">{t('project.empty')}</p>
          )}
        </DialogContent>
      </Dialog>
      {deleting && (
        <ConfirmDialog
          title={t('project.deleteTitle')}
          text={t('project.deleteText')}
          confirmLabel={t('common.delete')}
          onConfirm={() => onDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
