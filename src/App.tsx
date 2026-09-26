import { Moon, PanelLeftOpen, Settings, SquarePen, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDialog } from './components/ConfirmDialog'
import { Gallery } from './components/Gallery'
import type { CardActions } from './components/ImageCard'
import { Lightbox } from './components/Lightbox'
import { Onboarding } from './components/Onboarding'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar, type View } from './components/Sidebar'
import { Composer, type PendingAttachment } from './components/studio/Composer'
import { Feed } from './components/studio/Feed'
import type { ImageActions } from './components/studio/StudioImage'
import { VersionStrip } from './components/studio/VersionStrip'
import { iconButton } from './components/ui'
import { useMediaQuery } from './hooks/useMediaQuery'
import { createId, errorMessage, useStudioEngine } from './hooks/useStudioEngine'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { DEFAULT_CHAT_MODEL, DEFAULT_SYSTEM_PROMPT } from './lib/agent'
import { getLineage } from './lib/context'
import { getImageBlob } from './lib/db'
import { buildFileName, copyImageToClipboard, copyText, downloadBlob } from './lib/image'
import { DEFAULT_MODEL } from './lib/presets'
import { sessionImages } from './lib/sessions'
import { settings } from './lib/settings'
import type { ComposeMode, GenerationMeta, ImageSize, Session, StyleId, UserTurn } from './types'

interface LightboxState {
  ids: string[]
  index: number
  studio: boolean
}

type ConfirmState = { kind: 'clear' } | { kind: 'session'; session: Session } | null

export default function App() {
  const notify = useToast()
  const [theme, toggleTheme] = useTheme()
  const [view, setView] = useState<View>('studio')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [desktopSidebar, setDesktopSidebar] = useState(settings.getSidebarOpen)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const sidebarOpen = isDesktop ? desktopSidebar : mobileSidebar
  const [baseUrl, setBaseUrl] = useState(settings.getBaseUrl)
  const [apiKey, setApiKey] = useState(settings.getApiKey)
  const [model, setModel] = useState(() => settings.getModel() ?? DEFAULT_MODEL)
  const [chatModel, setChatModel] = useState(() => settings.getChatModel() ?? DEFAULT_CHAT_MODEL)
  const [systemPrompt, setSystemPrompt] = useState(() => settings.getSystemPrompt() ?? DEFAULT_SYSTEM_PROMPT)
  const [vision, setVision] = useState(settings.getVision)
  const [mode, setMode] = useState<ComposeMode>(settings.getMode)
  const [currentId, setCurrentId] = useState<string | null>(settings.getSessionId)
  const [text, setText] = useState(settings.getDraft)
  const [size, setSize] = useState<ImageSize>('1024x1024')
  const [count, setCount] = useState(1)
  const [styles, setStyles] = useState<StyleId[]>([])
  const [baseId, setBaseId] = useState<string | undefined>()
  const [includeOriginal, setIncludeOriginal] = useState(false)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentIdRef = useRef(currentId)

  const pin = useCallback((meta: GenerationMeta | undefined) => {
    setBaseId(meta?.id)
    setIncludeOriginal(false)
    if (meta) setSize(meta.size)
  }, [])

  const onCreated = useCallback(
    (sessionId: string, metas: GenerationMeta[]) => {
      if (sessionId === currentIdRef.current && metas.length === 1) pin(metas[0])
    },
    [pin],
  )

  const engine = useStudioEngine({
    config: { baseUrl, apiKey, model, chatModel, systemPrompt, vision },
    notify,
    onCreated,
  })
  const { sessions, history } = engine

  useEffect(() => {
    const timer = setTimeout(() => settings.setDraft(text), 300)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    settings.setSessionId(currentId)
    currentIdRef.current = currentId
  }, [currentId])

  useEffect(() => {
    settings.setMode(mode)
  }, [mode])

  useEffect(() => {
    if (!mobileSidebar || isDesktop) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setMobileSidebar(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileSidebar, isDesktop])

  const byId = useMemo(() => new Map(history.map((m) => [m.id, m])), [history])
  const currentSession = sessions.find((s) => s.id === currentId)
  const versions = useMemo(
    () =>
      currentSession
        ? sessionImages(currentSession, byId).sort((a, b) => (a.version ?? 0) - (b.version ?? 0))
        : [],
    [currentSession, byId],
  )
  const base = baseId ? byId.get(baseId) : undefined
  const lineage = useMemo(() => getLineage(base, byId), [base, byId])
  const original = lineage.length > 1 ? lineage[0] : undefined

  const gallery = useMemo(() => {
    const query = search.trim().toLowerCase()
    return history.filter(
      (m) =>
        m.kind !== 'upload' && (!favoritesOnly || m.favorite) && (!query || m.prompt.toLowerCase().includes(query)),
    )
  }, [history, search, favoritesOnly])
  const galleryTotal = useMemo(() => history.filter((m) => m.kind !== 'upload').length, [history])

  const busyIds = useMemo(
    () => new Set(sessions.filter((s) => s.turns.some((t) => t.role !== 'user' && t.status === 'pending')).map((s) => s.id)),
    [sessions],
  )

  const turnCount = currentSession?.turns.length ?? 0
  useEffect(() => {
    if (view !== 'studio' || turnCount === 0) return
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }))
  }, [view, turnCount, currentId])

  useEffect(() => {
    if (view !== 'studio' || !currentSession) return
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240
    if (nearBottom) requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight }))
  }, [view, currentSession])

  const send = engine.send

  const submit = useCallback(() => {
    if (!text.trim()) {
      notify(mode === 'agent' ? 'Напишите сообщение' : 'Напишите, что нужно сделать', 'info')
      textareaRef.current?.focus()
      return
    }
    const request = { text, styles, size, count, baseId, attachmentIds: [], includeOriginal }
    const files = attachments
    setText('')
    setAttachments([])
    void send(request, files.map((f) => f.blob), currentId, mode).then((sessionId) => {
      if (sessionId) {
        setCurrentId(sessionId)
        files.forEach((f) => URL.revokeObjectURL(f.url))
        return
      }
      setText((current) => current || request.text)
      setAttachments((current) => (current.length ? current : files))
    })
  }, [send, text, styles, size, count, baseId, includeOriginal, attachments, currentId, mode, notify])

  const retry = useCallback(
    (turn: UserTurn) => {
      void send(
        {
          text: turn.text,
          styles: turn.styles,
          size: turn.size,
          count: turn.count,
          baseId: turn.baseId,
          attachmentIds: turn.attachmentIds,
          includeOriginal: turn.includeOriginal,
        },
        [],
        currentId,
        turn.mode ?? 'direct',
      )
    },
    [send, currentId],
  )

  const showStudio = useCallback(() => {
    setView('studio')
    setMobileSidebar(false)
  }, [])

  const focusComposer = useCallback((value?: string) => {
    if (value !== undefined) setText(value)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }, [])

  const refine = useCallback(
    (meta: GenerationMeta) => {
      if (meta.sessionId && sessions.some((s) => s.id === meta.sessionId)) setCurrentId(meta.sessionId)
      pin(meta)
      showStudio()
      focusComposer()
    },
    [sessions, pin, focusComposer, showStudio],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter((f) => f.size <= 25 * 1024 * 1024)
      if (valid.length < files.length) notify('Файлы больше 25 МБ пропущены', 'info')
      setAttachments((items) => [
        ...items,
        ...valid.slice(0, Math.max(0, 8 - items.length)).map((blob) => ({ id: createId(), blob, url: URL.createObjectURL(blob) })),
      ])
    },
    [notify],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((items) => {
      const target = items.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return items.filter((i) => i.id !== id)
    })
  }, [])

  const newSession = useCallback(() => {
    setCurrentId(null)
    pin(undefined)
    showStudio()
    focusComposer()
  }, [pin, focusComposer, showStudio])

  const openSession = useCallback(
    (session: Session) => {
      setCurrentId(session.id)
      const images = sessionImages(session, byId)
      pin(images.at(-1))
      showStudio()
    },
    [byId, pin, showStudio],
  )

  const download = useCallback(
    async (meta: GenerationMeta) => {
      try {
        const blob = await getImageBlob(meta)
        if (!blob) throw new Error('Изображение не найдено')
        downloadBlob(blob, buildFileName(meta, blob.type || meta.mime))
        notify('Скачано')
      } catch {
        if (meta.remoteUrl) {
          window.open(meta.remoteUrl, '_blank', 'noopener')
          notify('Изображение открыто в новой вкладке', 'info')
        } else notify('Не удалось скачать изображение', 'error')
      }
    },
    [notify],
  )

  const copyImage = useCallback(
    async (meta: GenerationMeta) => {
      try {
        await copyImageToClipboard(() => getImageBlob(meta))
        notify('Скопировано')
      } catch (error) {
        notify(`Не удалось скопировать: ${errorMessage(error)}`, 'error')
      }
    },
    [notify],
  )

  const copyPrompt = useCallback(
    async (value: string) => {
      try {
        await copyText(value)
        notify('Скопировано')
      } catch {
        notify('Не удалось скопировать текст', 'error')
      }
    },
    [notify],
  )

  const toggleFavorite = engine.toggleFavorite

  const remove = useCallback(
    async (meta: GenerationMeta) => {
      if (!(await engine.removeImage(meta))) return
      setBaseId((id) => (id === meta.id ? undefined : id))
      notify('Удалено')
    },
    [engine, notify],
  )

  const studioActions = useMemo<ImageActions>(
    () => ({
      onOpen: (meta) => {
        const ids = versions.map((m) => m.id)
        setLightbox({ ids, index: Math.max(0, ids.indexOf(meta.id)), studio: true })
      },
      onRefine: (meta) => {
        pin(meta)
        focusComposer()
      },
      onDownload: download,
      onCopyImage: copyImage,
      onToggleFavorite: toggleFavorite,
      onDelete: remove,
    }),
    [versions, pin, focusComposer, download, copyImage, toggleFavorite, remove],
  )

  const galleryActions = useMemo<CardActions>(
    () => ({
      onOpen: (meta) => {
        const ids = gallery.map((m) => m.id)
        setLightbox({ ids, index: Math.max(0, ids.indexOf(meta.id)), studio: false })
      },
      onDownload: download,
      onCopyImage: copyImage,
      onCopyPrompt: (meta) => void copyPrompt(meta.prompt),
      onRepeat: (meta) => {
        const target = meta.sessionId && sessions.some((s) => s.id === meta.sessionId) ? meta.sessionId : currentId
        showStudio()
        if (target) setCurrentId(target)
        void send(
          {
            text: meta.prompt,
            styles: meta.styles,
            size: meta.size,
            count: 1,
            baseId: meta.parentId,
            attachmentIds: meta.inputIds ?? [],
            includeOriginal: !!meta.includeOriginal,
          },
          [],
          target,
          'direct',
        )
      },
      onRefine: refine,
      onToggleFavorite: toggleFavorite,
      onDelete: remove,
    }),
    [gallery, download, copyImage, copyPrompt, currentId, sessions, send, refine, toggleFavorite, remove, showStudio],
  )

  const scrollToVersion = useCallback((meta: GenerationMeta) => {
    document.getElementById(`img-${meta.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const lightboxItems = useMemo(
    () => (lightbox ? lightbox.ids.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m) : []),
    [lightbox, byId],
  )
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const getParent = useCallback((meta: GenerationMeta) => (meta.parentId ? byId.get(meta.parentId) : undefined), [byId])

  async function confirmAction(): Promise<void> {
    const current = confirm
    setConfirm(null)
    if (!current) return
    try {
      if (current.kind === 'clear') {
        await engine.clearAll()
        setCurrentId(null)
        pin(undefined)
        notify('История очищена')
      } else {
        await engine.removeSession(current.session)
        if (currentId === current.session.id) {
          setCurrentId(null)
          pin(undefined)
        }
        notify('Сессия удалена')
      }
    } catch {
      notify('Не удалось удалить', 'error')
    }
  }

  function saveConnection(values: { baseUrl: string; apiKey: string }): void {
    settings.setBaseUrl(values.baseUrl)
    settings.setApiKey(values.apiKey)
    setBaseUrl(values.baseUrl)
    setApiKey(values.apiKey)
  }

  if (!apiKey || !baseUrl) {
    return <Onboarding initialBaseUrl={baseUrl} initialApiKey={apiKey} onSave={saveConnection} />
  }

  function setSidebar(open: boolean): void {
    if (isDesktop) {
      setDesktopSidebar(open)
      settings.setSidebarOpen(open)
    } else setMobileSidebar(open)
  }

  const title = view === 'gallery' ? 'Галерея' : (currentSession?.title ?? 'Новая сессия')

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        currentId={currentId}
        view={view}
        galleryCount={galleryTotal}
        busyIds={busyIds}
        onClose={() => setSidebar(false)}
        onNew={newSession}
        onOpenGallery={() => {
          setView('gallery')
          setMobileSidebar(false)
        }}
        onOpenSession={openSession}
        onDeleteSession={(session) => setConfirm({ kind: 'session', session })}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-4">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebar(true)}
                className={iconButton}
                aria-label="Показать боковую панель с историей"
                aria-controls="sidebar"
                aria-expanded={false}
                title="История"
              >
                <PanelLeftOpen className="size-5" aria-hidden="true" />
              </button>
            )}
            {!sidebarOpen && (
              <button type="button" onClick={newSession} className={iconButton} aria-label="Новая сессия" title="Новая сессия">
                <SquarePen className="size-5" aria-hidden="true" />
              </button>
            )}
            <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold sm:text-base">{title}</h1>
            <span className="mr-1 hidden max-w-48 truncate rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 lg:inline dark:bg-zinc-900 dark:text-zinc-400">
              {model}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className={iconButton}
              aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className={iconButton} aria-label="Настройки" title="Настройки">
              <Settings className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {view === 'studio' ? (
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6" aria-label="Студия">
            {versions.length > 1 && (
              <div className="sticky top-16 z-20 -mx-4 border-b border-zinc-200/70 bg-zinc-50/90 px-4 backdrop-blur-lg sm:-mx-6 sm:px-6 dark:border-zinc-800/70 dark:bg-zinc-950/90">
                <VersionStrip versions={versions} byId={byId} pinnedId={baseId} onSelect={scrollToVersion} />
              </div>
            )}

            <Feed
              session={currentSession}
              byId={byId}
              pinnedId={baseId}
              actions={studioActions}
              onRetry={retry}
              onCopyText={(value) => void copyPrompt(value)}
              onExample={(value) => focusComposer(value)}
              onCancel={engine.cancel}
            />

            <Composer
              text={text}
              onTextChange={setText}
              size={size}
              onSizeChange={setSize}
              count={count}
              onCountChange={setCount}
              styles={styles}
              onToggleStyle={(id) => setStyles((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]))}
              base={base}
              onClearBase={() => pin(undefined)}
              original={original}
              includeOriginal={includeOriginal}
              onIncludeOriginalChange={setIncludeOriginal}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              mode={mode}
              onModeChange={setMode}
              onSend={submit}
              textareaRef={textareaRef}
            />
          </main>
        ) : (
          <main className="w-full px-4 py-6 sm:px-6" aria-label="Галерея">
            <Gallery
              total={galleryTotal}
              items={gallery}
              search={search}
              onSearchChange={setSearch}
              favoritesOnly={favoritesOnly}
              onFavoritesOnlyChange={setFavoritesOnly}
              onClear={() => setConfirm({ kind: 'clear' })}
              onExample={(value) => {
                showStudio()
                focusComposer(value)
              }}
              actions={galleryActions}
              busy={false}
            />
          </main>
        )}
      </div>

      {settingsOpen && (
        <SettingsDialog
          baseUrl={baseUrl}
          apiKey={apiKey}
          model={model}
          chatModel={chatModel}
          systemPrompt={systemPrompt}
          vision={vision}
          onClose={() => setSettingsOpen(false)}
          onSave={(values) => {
            settings.setBaseUrl(values.baseUrl)
            settings.setApiKey(values.apiKey)
            settings.setModel(values.model === DEFAULT_MODEL ? null : values.model)
            settings.setChatModel(values.chatModel === DEFAULT_CHAT_MODEL ? null : values.chatModel)
            settings.setSystemPrompt(values.systemPrompt === DEFAULT_SYSTEM_PROMPT ? null : values.systemPrompt)
            settings.setVision(values.vision)
            setBaseUrl(values.baseUrl)
            setApiKey(values.apiKey)
            setModel(values.model)
            setChatModel(values.chatModel)
            setSystemPrompt(values.systemPrompt)
            setVision(values.vision)
            setSettingsOpen(false)
            notify('Настройки сохранены')
          }}
          onForgetKey={() => {
            settings.setApiKey(null)
            setApiKey('')
            setSettingsOpen(false)
            notify('Ключ удалён из браузера', 'info')
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'clear' ? 'Очистить историю?' : 'Удалить сессию?'}
          message={
            confirm.kind === 'clear'
              ? 'Все сессии, изображения и промпты будут удалены из этого браузера без возможности восстановления.'
              : `Сессия «${confirm.session.title}» и все её изображения будут удалены без возможности восстановления.`
          }
          confirmLabel={confirm.kind === 'clear' ? 'Очистить' : 'Удалить'}
          onConfirm={() => void confirmAction()}
          onClose={() => setConfirm(null)}
        />
      )}

      {lightbox && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          index={Math.min(lightbox.index, lightboxItems.length - 1)}
          onIndexChange={(index) => setLightbox((s) => (s ? { ...s, index } : s))}
          onClose={closeLightbox}
          onDownload={(meta) => void download(meta)}
          getParent={getParent}
          onRefine={lightbox.studio ? studioActions.onRefine : refine}
        />
      )}
    </div>
  )
}
