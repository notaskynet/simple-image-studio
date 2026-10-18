import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

interface Cell {
  x: number
  y: number
}

const COLS = 26
const TICK_MS = 110
const START_LENGTH = 4
const MAX_LENGTH = 22
const DOT_COUNT = 6

const DIRECTIONS: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

interface Game {
  cols: number
  rows: number
  snake: Cell[]
  dots: Cell[]
  dir: Cell
}

const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y
const wrap = (value: number, size: number): number => (value + size) % size

/** Расстояние на «торе»: поле замкнуто, змейка выходит за один край и появляется с другого. */
function distance(a: Cell, b: Cell, game: Game): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return Math.min(dx, game.cols - dx) + Math.min(dy, game.rows - dy)
}

function freeCell(game: Game): Cell {
  for (let attempt = 0; attempt < 60; attempt++) {
    const cell = { x: Math.floor(Math.random() * game.cols), y: Math.floor(Math.random() * game.rows) }
    if (!game.snake.some((s) => same(s, cell)) && !game.dots.some((d) => same(d, cell))) return cell
  }
  return { x: 0, y: 0 }
}

function createGame(cols: number, rows: number): Game {
  const y = Math.floor(rows / 2)
  const game: Game = {
    cols,
    rows,
    snake: Array.from({ length: START_LENGTH }, (_, i) => ({ x: Math.floor(cols / 3) - i, y })),
    dots: [],
    dir: { x: 1, y: 0 },
  }
  game.snake = game.snake.map((cell) => ({ x: wrap(cell.x, cols), y: cell.y }))
  while (game.dots.length < DOT_COUNT) game.dots.push(freeCell(game))
  return game
}

function step(game: Game): Game {
  const head = game.snake[0]
  const target = game.dots.reduce((best, dot) => (distance(head, dot, game) < distance(head, best, game) ? dot : best))
  const body = game.snake.slice(0, -1)

  const moves = DIRECTIONS.filter((d) => !(d.x === -game.dir.x && d.y === -game.dir.y))
    .map((d) => ({ dir: d, cell: { x: wrap(head.x + d.x, game.cols), y: wrap(head.y + d.y, game.rows) } }))
    .filter((m) => !body.some((s) => same(s, m.cell)))
  if (moves.length === 0) return createGame(game.cols, game.rows)

  const best = Math.min(...moves.map((m) => distance(m.cell, target, game)))
  const choices = moves.filter((m) => distance(m.cell, target, game) === best)
  // Предпочитаем ехать прямо, чтобы змейка не дёргалась на каждом шаге.
  const move = choices.find((m) => same(m.dir, game.dir)) ?? choices[Math.floor(Math.random() * choices.length)]

  const eaten = game.dots.findIndex((d) => same(d, move.cell))
  const snake = [move.cell, ...game.snake]
  if (eaten === -1) snake.pop()
  const next: Game = { ...game, snake, dir: move.dir, dots: game.dots.filter((_, i) => i !== eaten) }
  if (eaten !== -1) next.dots.push(freeCell(next))
  return next.snake.length > MAX_LENGTH ? createGame(game.cols, game.rows) : next
}

function draw(context: CanvasRenderingContext2D, game: Game, size: number, width: number, height: number): void {
  const style = getComputedStyle(context.canvas)
  const ink = style.getPropertyValue('--foreground').trim() || '#111'
  const dim = style.getPropertyValue('--muted-foreground').trim() || '#888'
  context.clearRect(0, 0, width, height)

  context.fillStyle = dim
  for (const dot of game.dots) {
    context.beginPath()
    context.arc((dot.x + 0.5) * size, (dot.y + 0.5) * size, size * 0.2, 0, Math.PI * 2)
    context.fill()
  }

  context.fillStyle = ink
  game.snake.forEach((cell, i) => {
    const t = 1 - i / (game.snake.length + 2)
    const inset = size * (i === 0 ? 0.04 : 0.12)
    context.globalAlpha = 0.35 + 0.65 * t
    context.beginPath()
    context.roundRect(cell.x * size + inset, cell.y * size + inset, size - inset * 2, size - inset * 2, size * 0.3)
    context.fill()
  })
  context.globalAlpha = 1

  const head = game.snake[0]
  context.fillStyle = style.getPropertyValue('--background').trim() || '#fff'
  context.beginPath()
  context.arc((head.x + 0.5 + game.dir.x * 0.18 - game.dir.y * 0.2) * size, (head.y + 0.5 + game.dir.y * 0.18 + game.dir.x * 0.2) * size, size * 0.08, 0, Math.PI * 2)
  context.arc((head.x + 0.5 + game.dir.x * 0.18 + game.dir.y * 0.2) * size, (head.y + 0.5 + game.dir.y * 0.18 - game.dir.x * 0.2) * size, size * 0.08, 0, Math.PI * 2)
  context.fill()
}

export function SnakeLoader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let game: Game | null = null
    let size = 0
    let width = 0
    let height = 0
    let timer: ReturnType<typeof setInterval> | undefined

    function resize(): void {
      if (!canvas || !context) return
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const ratio = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      size = width / COLS
      game = createGame(COLS, Math.max(8, Math.floor(height / size)))
      draw(context, game, size, width, height)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    if (!reduced) {
      timer = setInterval(() => {
        if (!game || !context) return
        game = step(game)
        draw(context, game, size, width, height)
      }, TICK_MS)
    }
    return () => {
      observer.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [])

  return <canvas ref={canvasRef} className={cn('bg-muted', className)} aria-hidden="true" />
}
