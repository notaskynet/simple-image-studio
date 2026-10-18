import { FolderOpen, Layers, Moon, Settings, SlidersHorizontal, Sun } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProject } from '@/hooks/useProject'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { describeError, useT } from '@/i18n'
import { getImageBlob } from '@/lib/db'
import { buildFileName, copyImageToClipboard, copyText, downloadBlob, prepareUpload } from '@/lib/image'
import { DEFAULT_MODEL, getProfile } from '@/lib/models'
import { notify } from '@/lib/notify'
import { settings } from '@/lib/settings'
import type { Project, Recipe, Theme, Version } from '@/types'
import { Canvas } from './Canvas'
import { DEFAULT_DRAFT, type Draft } from './draft'
import type { MaskHandle } from './MaskLayer'
import { ParamsPanel } from './ParamsPanel'
import { ProjectsDialog } from './ProjectsDialog'
import { PromptBar } from './PromptBar'
import { RequestInspector } from './RequestInspector'
import { VersionTree } from './VersionTree'

interface StudioViewProps {
  baseUrl: string
  apiKey: string
  theme: Theme
  profileTick: number
  onToggleTheme: () => void
  onOpenSettings: () => void
}

function projectTitle(prompt: string): string {
  const text = prompt.trim().replace(/\s+/g, ' ')
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

export function StudioView({ baseUrl, apiKey, theme, profileTick, onToggleTheme, onOpenSettings }: StudioViewProps) {
  const t = useT()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const maskRef = useRef<MaskHandle | null>(null)

  const [model, setModelState] = useState(() => settings.getModel() ?? DEFAULT_MODEL)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [projectId, setProjectId] = useState<string | null>(settings.getProjectId)
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [editing, setEditing] = useState(true)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [deleting, setDeleting] = useState<Version | null>(null)
  const [rightTab, setRightTab] = useState('versions')

  const importTitle = t('project.import')
  const store = useProject(
    { baseUrl, apiKey },
    {
      onError: (error) => notify(describeError(t, error), 'error'),
      onPartial: (got, total) => notify(t('toast.partial', { got, total })),
      onParamDisabled: (param, name) => notify(t('toast.paramDisabled', { param, model: name })),
      onMigrated: () => notify(t('toast.migrated')),
      onLoadFailed: () => notify(t('toast.loadFail'), 'error'),
      onSaveFailed: () => notify(t('toast.saveFail'), 'error'),
    },
    importTitle,
  )
  const { projects, versions } = store

  const project: Project | undefined = projects.find((p) => p.id === projectId) ?? projects[0]
  const projectVersions = useMemo(
    () => versions.filter((v) => v.projectId === project?.id),
    [versions, project?.id],
  )
  const selected = projectVersions.find((v) => v.id === selectedId)
  const parent = selected?.parentId ? projectVersions.find((v) => v.id === selected.parentId) : undefined
  const base = editing && selected?.status === 'done' ? selected : undefined

  // eslint-disable-next-line react-hooks/exhaustive-deps -- profileTick заставляет перечитать настройки модели из localStorage
  const profile = useMemo(() => getProfile(model), [model, profileTick])
  const view: Draft = {
    ...draft,
    size: profile.sizes.includes(draft.size) ? draft.size : (profile.sizes[0] ?? draft.size),
    quality: profile.quality.includes(draft.quality)
      ? draft.quality
      : profile.quality.includes('medium')
        ? 'medium'
        : (profile.quality[0] ?? draft.quality),
  }

  const patchDraft = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), [])

  function setModel(next: string): void {
    setModelState(next)
    settings.setModel(next)
  }

  function openProject(id: string): void {
    setProjectId(id)
    settings.setProjectId(id)
    setSelectedId(undefined)
    setEditing(true)
    setProjectsOpen(false)
  }

  function ensureProject(title: string): string {
    if (project) return project.id
    const created = store.createProject(title)
    setProjectId(created.id)
    settings.setProjectId(created.id)
    return created.id
  }

  function selectVersion(id: string): void {
    const version = projectVersions.find((v) => v.id === id)
    setSelectedId(id)
    setEditing(true)
    if (version && version.kind !== 'upload' && version.recipe.size) patchDraft({ size: version.recipe.size })
    setVersionsOpen(false)
  }

  async function addRefs(files: File[]): Promise<void> {
    try {
      const room = Math.max(0, profile.maxRefs - draft.refs.length)
      const added = await Promise.all(
        files.slice(0, room).map(async (file) => ({
          imageId: await store.saveAsset(await prepareUpload(file)),
          role: 'other' as const,
        })),
      )
      if (added.length > 0) setDraft((d) => ({ ...d, refs: [...d.refs, ...added] }))
      if (files.length > room) notify(t('params.refs.max', { n: profile.maxRefs }))
    } catch (error) {
      notify(describeError(t, error), 'error')
    }
  }

  async function uploadPhoto(file: File): Promise<void> {
    try {
      const blob = await prepareUpload(file)
      const id = ensureProject(file.name.replace(/\.[^.]+$/, '') || t('project.untitled'))
      const version = await store.addUpload(id, blob, model, view.size)
      setSelectedId(version.id)
      setEditing(true)
      setVersionsOpen(false)
    } catch (error) {
      notify(describeError(t, error), 'error')
    }
  }

  async function submit(): Promise<void> {
    const prompt = draft.prompt.trim()
    if (!prompt) return
    try {
      const id = ensureProject(projectTitle(prompt))
      if (project && projectVersions.length === 0 && project.title === t('project.untitled')) {
        store.renameProject(project.id, projectTitle(prompt))
      }
      let maskId: string | undefined
      if (base) {
        const mask = await maskRef.current?.exportMask()
        if (mask) maskId = await store.saveAsset(mask)
      }
      const negative = view.negative.trim()
      const recipe: Recipe = {
        model,
        prompt,
        negative: profile.negative && negative ? negative : undefined,
        size: view.size,
        quality: profile.quality.length > 0 ? view.quality : undefined,
        n: view.n,
        background: profile.background && view.background ? 'transparent' : undefined,
        maskId,
        refs: draft.refs,
      }
      maskRef.current?.clear()
      setDraft((d) => ({ ...d, prompt: '', refs: [] }))
      void store.run({
        projectId: id,
        recipe,
        baseId: base?.id,
        onCreated: (created) => {
          setSelectedId(created[0]?.id)
          setEditing(true)
        },
      })
    } catch (error) {
      notify(describeError(t, error), 'error')
    }
  }

  function rerun(version: Version, patch?: 'quality' | 'model'): void {
    const recipe: Recipe = { ...version.recipe, maskId: version.recipe.maskId }
    if (patch === 'quality') recipe.quality = 'high'
    if (patch === 'model') {
      recipe.model = model
      const next = getProfile(model)
      recipe.quality = next.quality.length > 0 ? (recipe.quality ?? 'medium') : undefined
    }
    const parentVersion = version.parentId ? projectVersions.find((v) => v.id === version.parentId) : undefined
    void store.run({
      projectId: version.projectId,
      recipe,
      baseId: parentVersion?.status === 'done' ? parentVersion.id : undefined,
      onCreated: (created) => {
        setSelectedId(created[0]?.id)
        setEditing(true)
      },
    })
  }

  async function download(version: Version): Promise<void> {
    try {
      const blob = await getImageBlob(version.imageId, version.remoteUrl)
      if (!blob) throw new Error('missing')
      downloadBlob(blob, buildFileName(version, blob.type))
    } catch {
      if (version.remoteUrl) window.open(version.remoteUrl, '_blank', 'noopener')
      else notify(t('error.image_missing'), 'error')
    }
  }

  async function copyImage(version: Version): Promise<void> {
    try {
      await copyImageToClipboard(() => getImageBlob(version.imageId, version.remoteUrl))
      notify(t('canvas.copied'), 'success')
    } catch (error) {
      notify(describeError(t, error), 'error')
    }
  }

  async function copyPrompt(version: Version): Promise<void> {
    try {
      await copyText(version.recipe.prompt)
      notify(t('canvas.copied'), 'success')
    } catch {
      notify(t('error.clipboard'), 'error')
    }
  }

  async function confirmDelete(version: Version): Promise<void> {
    try {
      await store.removeVersion(version.id)
      if (selectedId === version.id) setSelectedId(version.parentId)
    } catch {
      notify(t('toast.saveFail'), 'error')
    }
  }

  function onDropOnCanvas(event: DragEvent): void {
    const file = [...event.dataTransfer.files].find((f) => f.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    void uploadPhoto(file)
  }

  const paramsPanel = (
    <ParamsPanel
      model={model}
      onModelChange={setModel}
      draft={view}
      onDraftChange={patchDraft}
      profile={profile}
      onAddRefs={(files) => void addRefs(files)}
    />
  )

  const versionsPanel = (
    <Tabs value={rightTab} onValueChange={setRightTab} className="min-h-0 flex-1 gap-0">
      <div className="border-b p-2">
        <TabsList className="w-full">
          <TabsTrigger value="versions">{t('versions.title')}</TabsTrigger>
          <TabsTrigger value="request">{t('versions.request')}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="versions" className="flex min-h-0 flex-1 flex-col">
        <VersionTree
          versions={projectVersions}
          selectedId={selectedId}
          onSelect={selectVersion}
          onNew={() => setEditing(false)}
          onUpload={(file) => void uploadPhoto(file)}
          onBranch={(v) => selectVersion(v.id)}
          onRerun={rerun}
          onToggleFavorite={(v) => store.toggleFavorite(v.id)}
          onDelete={setDeleting}
          canRerunHigh={getProfile(model).quality.includes('high')}
        />
      </TabsContent>
      <TabsContent value="request" className="min-h-0 flex-1 overflow-y-auto">
        <RequestInspector version={selected} />
      </TabsContent>
    </Tabs>
  )

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" onClick={() => setProjectsOpen(true)} className="max-w-[60vw] min-w-0">
          <FolderOpen aria-hidden="true" />
          <span className="truncate">{project?.title || t('project.untitled')}</span>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {!desktop && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setParamsOpen(true)} aria-label={t('params.title')} title={t('params.title')}>
                <SlidersHorizontal aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setVersionsOpen(true)} aria-label={t('versions.title')} title={t('versions.title')}>
                <Layers aria-hidden="true" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={t('common.theme')} title={t('common.theme')}>
            {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label={t('common.settings')} title={t('common.settings')}>
            <Settings aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {desktop && <aside className="w-72 shrink-0 overflow-y-auto border-r">{paramsPanel}</aside>}

        <main className="flex min-w-0 flex-1 flex-col" onDragOver={(e) => e.preventDefault()} onDrop={onDropOnCanvas}>
          <Canvas
            version={selected}
            parent={parent}
            profile={profile}
            editable={!!base}
            maskRef={maskRef}
            onUpload={(file) => void uploadPhoto(file)}
            onCancel={store.cancelBatch}
            onRetry={(v) => rerun(v)}
            onDownload={(v) => void download(v)}
            onCopyImage={(v) => void copyImage(v)}
            onCopyPrompt={(v) => void copyPrompt(v)}
          />
          <PromptBar
            value={draft.prompt}
            onChange={(prompt) => patchDraft({ prompt })}
            base={base}
            onResetBase={() => setEditing(false)}
            onSubmit={() => void submit()}
            onPasteImages={(files) => void addRefs(files)}
          />
        </main>

        {desktop && <aside className="flex w-80 shrink-0 flex-col border-l">{versionsPanel}</aside>}
      </div>

      {!desktop && (
        <>
          <Sheet open={paramsOpen} onOpenChange={setParamsOpen}>
            <SheetContent side="left" className="w-80 max-w-[90vw] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{t('params.title')}</SheetTitle>
              </SheetHeader>
              {paramsPanel}
            </SheetContent>
          </Sheet>
          <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
            <SheetContent side="right" className="flex w-80 max-w-[90vw] flex-col">
              <SheetHeader>
                <SheetTitle>{t('versions.title')}</SheetTitle>
              </SheetHeader>
              {versionsPanel}
            </SheetContent>
          </Sheet>
        </>
      )}

      {projectsOpen && (
        <ProjectsDialog
          projects={projects}
          versions={versions}
          currentId={project?.id}
          onSelect={openProject}
          onCreate={() => {
            const created = store.createProject(t('project.untitled'))
            openProject(created.id)
          }}
          onRename={store.renameProject}
          onDelete={(id) => {
            void store.removeProject(id)
            if (project?.id === id) {
              setSelectedId(undefined)
              setProjectId(null)
              settings.setProjectId(null)
            }
          }}
          onClose={() => setProjectsOpen(false)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t('version.deleteTitle')}
          text={t('version.deleteText')}
          confirmLabel={t('common.delete')}
          onConfirm={() => void confirmDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
