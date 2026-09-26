import { Moon, Settings, Sparkles, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDialog } from './components/ConfirmDialog'
import { Gallery } from './components/Gallery'
import type { CardActions } from './components/ImageCard'
import { Lightbox } from './components/Lightbox'
import { Onboarding } from './components/Onboarding'
import { GenerateBar, PromptPanel } from './components/PromptPanel'
import { Results, type PendingJob } from './components/Results'
import { SettingsDialog } from './components/SettingsDialog'
import { useToast } from './hooks/useToast'
import { iconButton } from './components/ui'
import { useElapsed } from './hooks/useElapsed'
import { useTheme } from './hooks/useTheme'
import { ApiError, generateImages } from './lib/api'
import { clearHistory, deleteGeneration, getImageBlob, loadHistory, saveGeneration, updateMeta } from './lib/db'
import { buildFileName, copyImageToClipboard, copyText, downloadBlob } from './lib/image'
import { buildFullPrompt, DEFAULT_MODEL } from './lib/presets'
import { settings } from './lib/settings'
import type { GenerationMeta, GenerationRequest, ImageSize, StyleId } from './types'

interface LightboxState {
  source: 'results' | 'gallery'
  index: number
}

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Что-то пошло не так'
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function App() {
  const notify = useToast()
  const [theme, toggleTheme] = useTheme()
  const [baseUrl, setBaseUrl] = useState(settings.getBaseUrl)
  const [apiKey, setApiKey] = useState(settings.getApiKey)
  const [model, setModel] = useState(() => settings.getModel() ?? DEFAULT_MODEL)
  const [prompt, setPrompt] = useState(settings.getDraft)
  const [size, setSize] = useState<ImageSize>('1024x1024')
  const [count, setCount] = useState(1)
  const [styles, setStyles] = useState<StyleId[]>([])
  const [history, setHistory] = useState<GenerationMeta[]>([])
  const [latestIds, setLatestIds] = useState<string[]>([])
  const [job, setJob] = useState<PendingJob | null>(null)
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const elapsed = useElapsed(job?.startedAt ?? null)

  useEffect(() => {
    loadHistory()
      .then(setHistory)
      .catch(() => notify('Не удалось загрузить историю', 'error'))
  }, [notify])

  useEffect(() => {
    const timer = setTimeout(() => settings.setDraft(prompt), 300)
    return () => clearTimeout(timer)
  }, [prompt])

  const latest = useMemo(
    () => latestIds.map((id) => history.find((m) => m.id === id)).filter((m): m is GenerationMeta => !!m),
    [latestIds, history],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return history.filter(
      (m) => (!favoritesOnly || m.favorite) && (!query || m.prompt.toLowerCase().includes(query)),
    )
  }, [history, search, favoritesOnly])

  const run = useCallback(
    async (request: GenerationRequest) => {
      if (controllerRef.current) return
      if (!request.prompt.trim()) {
        notify('Введите описание изображения', 'info')
        textareaRef.current?.focus()
        return
      }
      const controller = new AbortController()
      controllerRef.current = controller
      setJob({ size: request.size, count: request.count, startedAt: Date.now() })
      setLatestIds([])

      try {
        const images = await generateImages({
          baseUrl,
          apiKey,
          model,
          prompt: buildFullPrompt(request.prompt, request.styles),
          size: request.size,
          count: request.count,
          signal: controller.signal,
        })
        const createdAt = Date.now()
        const metas = await Promise.all(
          images.map(async (image, i) => {
            const meta: GenerationMeta = {
              id: createId(),
              prompt: request.prompt.trim(),
              styles: request.styles,
              model,
              size: request.size,
              createdAt: createdAt + i,
              favorite: false,
              mime: image.blob?.type ?? 'image/png',
              remoteUrl: image.blob ? undefined : image.url,
            }
            await saveGeneration(meta, image.blob)
            return meta
          }),
        )
        setHistory((items) => [...[...metas].reverse(), ...items])
        setLatestIds(metas.map((m) => m.id))
        if (metas.length < request.count) {
          notify(`Получено изображений: ${metas.length} из ${request.count}`, 'info')
        }
      } catch (error) {
        if (isAbort(error) || controller.signal.aborted) notify('Генерация отменена', 'info')
        else notify(errorMessage(error), 'error')
      } finally {
        controllerRef.current = null
        setJob(null)
      }
    },
    [baseUrl, apiKey, model, notify],
  )

  const cancel = useCallback(() => controllerRef.current?.abort(), [])

  const generate = useCallback(() => {
    void run({ prompt, styles, size, count })
  }, [run, prompt, styles, size, count])

  const toggleStyle = useCallback((id: StyleId) => {
    setStyles((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]))
  }, [])

  const applyPrompt = useCallback((value: string) => {
    setPrompt(value)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(value.length, value.length)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const actions = useMemo<CardActions>(
    () => ({
      onOpen: (meta) => {
        setLightbox({ source: 'gallery', index: Math.max(0, filtered.findIndex((m) => m.id === meta.id)) })
      },
      onDownload: async (meta) => {
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
      onCopyImage: async (meta) => {
        try {
          await copyImageToClipboard(() => getImageBlob(meta))
          notify('Скопировано')
        } catch (error) {
          notify(`Не удалось скопировать: ${errorMessage(error)}`, 'error')
        }
      },
      onCopyPrompt: async (meta) => {
        try {
          await copyText(meta.prompt)
          notify('Скопировано')
        } catch {
          notify('Не удалось скопировать промпт', 'error')
        }
      },
      onRepeat: (meta) => {
        void run({ prompt: meta.prompt, styles: meta.styles, size: meta.size, count: 1 })
      },
      onVary: (meta) => {
        setStyles(meta.styles)
        setSize(meta.size)
        applyPrompt(meta.prompt)
      },
      onToggleFavorite: async (meta) => {
        const updated = { ...meta, favorite: !meta.favorite }
        setHistory((items) => items.map((m) => (m.id === meta.id ? updated : m)))
        try {
          await updateMeta(updated)
        } catch {
          setHistory((items) => items.map((m) => (m.id === meta.id ? meta : m)))
          notify('Не удалось сохранить', 'error')
        }
      },
      onDelete: async (meta) => {
        try {
          await deleteGeneration(meta.id)
          setHistory((items) => items.filter((m) => m.id !== meta.id))
          setLatestIds((ids) => ids.filter((id) => id !== meta.id))
          notify('Удалено')
        } catch {
          notify('Не удалось удалить', 'error')
        }
      },
    }),
    [filtered, notify, run, applyPrompt],
  )

  const resultActions = useMemo<CardActions>(
    () => ({
      ...actions,
      onOpen: (meta) => {
        setLightbox({ source: 'results', index: Math.max(0, latest.findIndex((m) => m.id === meta.id)) })
      },
    }),
    [actions, latest],
  )

  const lightboxItems = lightbox?.source === 'results' ? latest : filtered
  const closeLightbox = useCallback(() => setLightbox(null), [])

  async function clearAll(): Promise<void> {
    setConfirmClear(false)
    try {
      await clearHistory()
      setHistory([])
      setLatestIds([])
      notify('История очищена')
    } catch {
      notify('Не удалось очистить историю', 'error')
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

  const generateBar = (
    <GenerateBar
      busy={job !== null}
      disabled={!prompt.trim()}
      elapsed={elapsed}
      count={count}
      onGenerate={generate}
      onCancel={cancel}
    />
  )

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-base font-semibold tracking-tight">Simple Image Studio</h1>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden max-w-48 truncate rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 sm:inline dark:bg-zinc-900 dark:text-zinc-400">
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
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={iconButton}
              aria-label="Настройки"
              title="Настройки"
            >
              <Settings className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 pt-6 pb-32 sm:px-6 md:grid-cols-[minmax(320px,380px)_1fr] md:pb-12 lg:gap-10">
        <aside className="md:sticky md:top-22 md:max-h-[calc(100dvh-6.5rem)] md:self-start md:overflow-y-auto md:pr-1">
          <PromptPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            size={size}
            onSizeChange={setSize}
            count={count}
            onCountChange={setCount}
            styles={styles}
            onToggleStyle={toggleStyle}
            onGenerate={generate}
            textareaRef={textareaRef}
            generateBar={generateBar}
          />
        </aside>

        <main className="min-w-0 space-y-10">
          <Results job={job} elapsed={elapsed} items={latest} actions={resultActions} onCancel={cancel} />
          <Gallery
            total={history.length}
            items={filtered}
            search={search}
            onSearchChange={setSearch}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            onClear={() => setConfirmClear(true)}
            onExample={applyPrompt}
            actions={actions}
            busy={job !== null}
          />
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/70 bg-zinc-50/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg md:hidden dark:border-zinc-800/70 dark:bg-zinc-950/90">
        {generateBar}
      </div>

      {settingsOpen && (
        <SettingsDialog
          baseUrl={baseUrl}
          apiKey={apiKey}
          model={model}
          onClose={() => setSettingsOpen(false)}
          onSave={(values) => {
            settings.setBaseUrl(values.baseUrl)
            settings.setApiKey(values.apiKey)
            settings.setModel(values.model === DEFAULT_MODEL ? null : values.model)
            setBaseUrl(values.baseUrl)
            setApiKey(values.apiKey)
            setModel(values.model)
            setSettingsOpen(false)
            notify('Настройки сохранены')
          }}
          onForgetKey={() => {
            cancel()
            settings.setApiKey(null)
            setApiKey('')
            setSettingsOpen(false)
            notify('Ключ удалён из браузера', 'info')
          }}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Очистить историю?"
          message="Все сохранённые изображения и промпты будут удалены из этого браузера без возможности восстановления."
          confirmLabel="Очистить"
          onConfirm={() => void clearAll()}
          onClose={() => setConfirmClear(false)}
        />
      )}

      {lightbox && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          index={Math.min(lightbox.index, lightboxItems.length - 1)}
          onIndexChange={(index) => setLightbox((s) => (s ? { ...s, index } : s))}
          onClose={closeLightbox}
          onDownload={(meta) => void actions.onDownload(meta)}
        />
      )}
    </div>
  )
}
