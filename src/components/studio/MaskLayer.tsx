import { useCallback, useEffect, useImperativeHandle, useRef, type PointerEvent, type Ref } from 'react'

import { canvasToBlob } from '@/lib/image'
import { cn } from '@/lib/utils'

export interface MaskHandle {
  undo: () => void
  redo: () => void
  clear: () => void
  /** PNG, где закрашенное непрозрачно; null, если ничего не закрашено. */
  exportMask: () => Promise<Blob | null>
}

export interface MaskState {
  canUndo: boolean
  canRedo: boolean
  hasPaint: boolean
}

export type MaskTool = 'brush' | 'eraser'

interface MaskLayerProps {
  width: number
  height: number
  tool: MaskTool
  /** 1–100: толщина кисти в долях ширины изображения. */
  brushSize: number
  onState: (state: MaskState) => void
  handleRef: Ref<MaskHandle>
  className?: string
}

const HISTORY_LIMIT = 15

function hasPixels(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = context.getImageData(0, 0, width, height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true
  }
  return false
}

export function MaskLayer({ width, height, tool, brushSize, onState, handleRef, className }: MaskLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])
  const painted = useRef(false)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const onStateRef = useRef(onState)

  useEffect(() => {
    onStateRef.current = onState
  })

  const context = useCallback(() => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null, [])

  const report = useCallback(() => {
    onStateRef.current({
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
      hasPaint: painted.current,
    })
  }, [])

  const refreshPainted = useCallback(() => {
    const ctx = context()
    painted.current = ctx ? hasPixels(ctx, width, height) : false
    report()
  }, [context, height, report, width])

  const restore = useCallback(
    (from: ImageData[], to: ImageData[]) => {
      const ctx = context()
      const snapshot = from.pop()
      if (!ctx || !snapshot) return
      to.push(ctx.getImageData(0, 0, width, height))
      ctx.putImageData(snapshot, 0, 0)
      refreshPainted()
    },
    [context, height, refreshPainted, width],
  )

  useImperativeHandle(
    handleRef,
    () => ({
      undo: () => restore(undoStack.current, redoStack.current),
      redo: () => restore(redoStack.current, undoStack.current),
      clear: () => {
        const ctx = context()
        if (!ctx) return
        undoStack.current = []
        redoStack.current = []
        ctx.clearRect(0, 0, width, height)
        painted.current = false
        report()
      },
      exportMask: async () => {
        const canvas = canvasRef.current
        const ctx = context()
        if (!canvas || !ctx || !hasPixels(ctx, width, height)) return null
        return canvasToBlob(canvas)
      },
    }),
    [context, height, report, restore, width],
  )

  function point(event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const ctx = context()
    if (!ctx) return
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = '#ff0000'
    ctx.fillStyle = '#ff0000'
    ctx.lineWidth = Math.max(2, (width * brushSize) / 500)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.button !== 0) return
    const ctx = context()
    if (!ctx) return
    event.currentTarget.setPointerCapture(event.pointerId)
    undoStack.current.push(ctx.getImageData(0, 0, width, height))
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
    redoStack.current = []
    const start = point(event)
    drawing.current = start
    stroke(start, start)
    report()
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>): void {
    if (!drawing.current) return
    const next = point(event)
    stroke(drawing.current, next)
    drawing.current = next
  }

  function onPointerUp(): void {
    if (!drawing.current) return
    drawing.current = null
    refreshPainted()
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn('cursor-crosshair touch-none opacity-60', className)}
    />
  )
}
