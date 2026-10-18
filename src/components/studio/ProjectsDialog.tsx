import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
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

export function ProjectsDialog({ projects, versions, currentId, onSelect, onCreate, onRename, onDelete, onClose }: ProjectsDialogProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<Project | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of versions) map.set(v.projectId, (map.get(v.projectId) ?? 0) + 1)
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
        <DialogContent className="max-h-[85dvh] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('project.menu')}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('project.search')}
                aria-label={t('project.search')}
                className="pl-8"
              />
            </div>
            <Button onClick={onCreate}>
              <Plus aria-hidden="true" />
              {t('project.new')}
            </Button>
          </div>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('project.empty')}</p>
          ) : (
            <ul className="-mx-1 max-h-[50dvh] space-y-0.5 overflow-y-auto px-1">
              {filtered.map((project) => (
                <li
                  key={project.id}
                  className={cn('flex items-center gap-1 rounded-lg p-1', project.id === currentId ? 'bg-accent' : 'hover:bg-muted')}
                >
                  {editingId === project.id ? (
                    <>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                        autoFocus
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon-sm" onClick={commitRename} aria-label={t('common.save')}>
                        <Check aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelect(project.id)}
                        className="min-w-0 flex-1 rounded-md p-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="block truncate text-sm font-medium">{project.title || t('project.untitled')}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t('project.versions', { n: counts.get(project.id) ?? 0 })} · {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(project)} aria-label={t('project.delete')} title={t('project.delete')}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
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
