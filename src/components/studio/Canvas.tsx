import {
  Brush,
  Columns2,
  Copy,
  Download,
  Eraser,
  Hand,
  ImagePlus,
  Maximize,
  Redo2,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useElapsed } from '@/hooks/useElapsed'
import { useImageUrl } from '@/hooks/useImageUrl'
import { useT, describeCode } from '@/i18n'
import { sizeLabelParts, type ModelProfile } from '@/lib/models'
import { cn } from '@/lib/utils'
import type { Version } from '@/types'
import { MaskLayer, type MaskHandle, type MaskState, type MaskTool } from './MaskLayer'

interface CanvasProps {
  version: Version | undefined
  parent: Version | undefined
  profile: ModelProfile
  /** Выбранную версию можно править: показываем кисть маски. */
  editable: boolean
  maskRef: RefObject<MaskHandle | null>
  onUpload: (file: File) => void
  onCancel: (batchId: string) => void
  onRetry: (version: Version) => void
  onDownload: (version: Version) => void
  onCopyImage: (version: Version) => void
  onCopyPrompt: (version: Version) => void
}

interface Natural {
  width: number
  height: number
}

function frameStyle(ratio: number): React.CSSProperties {
  return { width: `min(100cqw, calc(100cqh * ${ratio}))`, aspectRatio: String(ratio) }
}

const MAX_ZOOM = 8

interface View {
  scale: number
  x: number
  y: number
}

const FIT: View = { scale: 1, x: 0, y: 0 }

type Tool = MaskTool | 'hand'

function ratioOf(version: Version, natural: Natural | null): number {
  if (natural) return natural.width / natural.height
  const parts = sizeLabelParts(version.recipe.size)
  return parts ? parts.width / parts.height : 1
}

export function Canvas(props: CanvasProps) {
  const t = useT()
  const upload = useRef<HTMLInputElement>(null)

  function onFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) props.onUpload(file)
  }

  const { version } = props

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <input ref={upload} type="file" accept="image/*" hidden onChange={onFile} />
      {!version ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <div>
            <h2 className="text-lg font-semibold">{t('canvas.empty.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('canvas.empty.text')}</p>
          </div>
          <Button variant="outline" onClick={() => upload.current?.click()}>
            <ImagePlus aria-hidden="true" />
            {t('canvas.upload')}
          </Button>
        </div>
      ) : (
        <VersionView key={version.id} {...props} version={version} />
      )}
    </div>
  )
}

function VersionView({ version, parent, profile, editable, maskRef, onCancel, onRetry, onDownload, onCopyImage, onCopyPrompt }: CanvasProps & { version: Version }) {
  const t = useT()
  const url = useImageUrl(version.imageId, version.remoteUrl)
  const parentUrl = useImageUrl(parent?.imageId, parent?.remoteUrl)
  const elapsed = useElapsed(version.status === 'pending' ? version.createdAt : null)
  const [natural, setNatural] = useState<Natural | null>(null)
  const [compare, setCompare] = useState(false)
  const [position, setPosition] = useState(50)
  const [tool, setTool] = useState<Tool>('brush')
  const [view, setView] = useState<View>(FIT)
  const [grabbing, setGrabbing] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [brushSize, setBrushSize] = useState(30)
  const [maskState, setMaskState] = useState<MaskState>({ canUndo: false, canRedo: false, hasPaint: false })

  /** Масштабирует относительно точки (координаты от центра области просмотра), не давая уйти за край. */
  function zoomBy(factor: number, point = { x: 0, y: 0 }): void {
    const el = viewport.current
    setView((v) => {
      const scale = Math.min(MAX_ZOOM, Math.max(1, v.scale * factor))
      if (scale === 1) return FIT
      const k = scale / v.scale
      const maxX = ((el?.clientWidth ?? 0) * scale) / 2
      const maxY = ((el?.clientHeight ?? 0) * scale) / 2
      return {
        scale,
        x: Math.max(-maxX, Math.min(maxX, point.x - (point.x - v.x) * k)),
        y: Math.max(-maxY, Math.min(maxY, point.y - (point.y - v.y) * k)),
      }
    })
  }

  const zoomRef = useRef(zoomBy)
  useEffect(() => {
    zoomRef.current = zoomBy
  })

  useEffect(() => {
    const el = viewport.current
    if (!el) return
    function onWheel(event: WheelEvent): void {
      if (!el) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const point = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }
      zoomRef.current(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)), point)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [version.status])

  const ratio = ratioOf(version, natural)
  const canMask = editable && version.status === 'done' && profile.mask !== 'none' && !compare
  const panning = tool === 'hand' || !canMask
  const canPan = view.scale > 1 && !compare
  const canCompare = !!parent && parentUrl !== null && version.status === 'done'

  if (version.status === 'pending') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" style={{ containerType: 'size' }}>
        <div className="relative overflow-hidden rounded-lg" style={frameStyle(ratio)}>
          <div className="shimmer absolute inset-0" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="rounded-full bg-background/80 px-3 py-1 text-sm tabular-nums">
              {t('canvas.loading')} {elapsed}s
            </span>
            {version.batchId && (
              <Button variant="outline" size="sm" onClick={() => onCancel(version.batchId as string)}>
                <X aria-hidden="true" />
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (version.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{t('canvas.failed')}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {version.error ? describeCode(t, version.error.code, version.error.detail) : t('error.unknown')}
          </p>
        </div>
        <Button variant="outline" onClick={() => onRetry(version)}>
          <RotateCcw aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[tool]}
          onValueChange={(value) => value[0] && setTool(value[0] as Tool)}
          aria-label={t('canvas.maskHint')}
        >
          <ToggleGroupItem value="brush" disabled={!canMask} aria-label={t('canvas.brush')} title={t('canvas.brush')}>
            <Brush aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem value="eraser" disabled={!canMask} aria-label={t('canvas.eraser')} title={t('canvas.eraser')}>
            <Eraser aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem value="hand" aria-label={t('canvas.hand')} title={t('canvas.hand')}>
            <Hand aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="w-24">
          <Slider
            value={[brushSize]}
            min={2}
            max={100}
            disabled={!canMask}
            onValueChange={(value) => setBrushSize(Array.isArray(value) ? value[0] : value)}
            aria-label={t('canvas.brushSize')}
          />
        </div>
        <Button variant="ghost" size="icon-sm" disabled={!canMask || !maskState.canUndo} onClick={() => maskRef.current?.undo()} aria-label={t('canvas.undo')} title={t('canvas.undo')}>
          <Undo2 aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canMask || !maskState.canRedo} onClick={() => maskRef.current?.redo()} aria-label={t('canvas.redo')} title={t('canvas.redo')}>
          <Redo2 aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canMask || !maskState.hasPaint} onClick={() => maskRef.current?.clear()} aria-label={t('canvas.clearMask')} title={t('canvas.clearMask')}>
          <Trash2 aria-hidden="true" />
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" disabled={view.scale <= 1} onClick={() => zoomBy(1 / 1.5)} aria-label={t('canvas.zoomOut')} title={t('canvas.zoomOut')}>
            <ZoomOut aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="xs" disabled={view.scale === 1} onClick={() => setView(FIT)} aria-label={t('canvas.zoomFit')} title={t('canvas.zoomFit')} className="w-12 tabular-nums">
            {view.scale === 1 ? <Maximize aria-hidden="true" /> : `${Math.round(view.scale * 100)}%`}
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={view.scale >= MAX_ZOOM} onClick={() => zoomBy(1.5)} aria-label={t('canvas.zoomIn')} title={t('canvas.zoomIn')}>
            <ZoomIn aria-hidden="true" />
          </Button>
          {canCompare && (
            <Button variant={compare ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setCompare((v) => !v)} aria-pressed={compare} aria-label={compare ? t('canvas.compareOff') : t('canvas.compare')} title={compare ? t('canvas.compareOff') : t('canvas.compare')}>
              <Columns2 aria-hidden="true" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => onDownload(version)} aria-label={t('canvas.downloadImage')} title={t('canvas.downloadImage')}>
            <Download aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onCopyImage(version)} aria-label={t('canvas.copyImage')} title={t('canvas.copyImage')}>
            <Copy aria-hidden="true" />
          </Button>
          {version.recipe.prompt && (
            <Button variant="ghost" size="xs" onClick={() => onCopyPrompt(version)}>
              {t('canvas.copyPrompt')}
            </Button>
          )}
        </div>
      </div>

      {version.remoteUrl && !version.imageId && (
        <p className="border-b bg-muted px-3 py-1.5 text-xs text-muted-foreground">{t('canvas.temporary')}</p>
      )}

      <div
        ref={viewport}
        className={cn(
          'relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden p-3',
          panning && canPan && 'cursor-grab',
          grabbing && 'cursor-grabbing',
        )}
        style={{ containerType: 'size' }}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          const middle = event.button === 1
          if (!middle && !(panning && canPan && event.button === 0)) return
          if (view.scale <= 1) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          pan.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }
          setGrabbing(true)
        }}
        onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
          const start = pan.current
          if (!start) return
          const el = event.currentTarget
          const maxX = (el.clientWidth * view.scale) / 2
          const maxY = (el.clientHeight * view.scale) / 2
          setView((v) => ({
            ...v,
            x: Math.max(-maxX, Math.min(maxX, start.vx + event.clientX - start.x)),
            y: Math.max(-maxY, Math.min(maxY, start.vy + event.clientY - start.y)),
          }))
        }}
        onPointerUp={() => {
          pan.current = null
          setGrabbing(false)
        }}
        onPointerCancel={() => {
          pan.current = null
          setGrabbing(false)
        }}
      >
        {url ? (
          <div
            className="relative overflow-hidden rounded-lg select-none"
            style={{
              ...frameStyle(ratio),
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: 'center',
            }}
          >
            <img
              src={url}
              alt={version.recipe.prompt}
              draggable={false}
              onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              className="absolute inset-0 size-full object-contain"
            />
            {compare && parentUrl && (
              <>
                <img
                  src={parentUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 size-full object-contain"
                  style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                />
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" style={{ left: `${position}%` }} />
                <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
                  {t('canvas.before')} · v{parent?.number}
                </span>
                <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
                  {t('canvas.after')} · v{version.number}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value))}
                  className="absolute inset-0 size-full cursor-ew-resize opacity-0"
                  aria-label={t('canvas.compare')}
                />
              </>
            )}
            {natural && canMask && (
              <MaskLayer
                width={natural.width}
                height={natural.height}
                tool={tool === 'eraser' ? 'eraser' : 'brush'}
                brushSize={brushSize}
                onState={setMaskState}
                handleRef={maskRef}
                className={cn('absolute inset-0 size-full', tool === 'hand' && 'pointer-events-none')}
              />
            )}
          </div>
        ) : (
          <div className={cn('shimmer rounded-lg')} style={frameStyle(ratio)} />
        )}
      </div>

      {canMask && (
        <p className="px-3 pb-2 text-center text-xs text-muted-foreground">
          {maskState.hasPaint
            ? profile.mask === 'native'
              ? t('canvas.maskNative')
              : t('canvas.maskVisual')
            : t('canvas.maskHint')}
        </p>
      )}
      {editable && version.status === 'done' && profile.mask === 'none' && (
        <p className="px-3 pb-2 text-center text-xs text-muted-foreground">{t('canvas.maskNone')}</p>
      )}
    </>
  )
}
