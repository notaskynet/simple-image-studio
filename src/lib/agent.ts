import type { ChatContentPart, ChatMessage, ChatTool } from './chat'
import type { AgentTurn, GenerationMeta, ImageSize, Session, UserTurn } from '../types'

export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini'

export const DEFAULT_SYSTEM_PROMPT = `Ты — креативный ассистент по созданию изображений в приложении Simple Image Studio. Помогаешь пользователю придумать, создать и доработать изображение.

Правила:
- Если запрос понятен — сразу вызывай generate_image. Пиши подробный промпт на английском: объект, сцена, композиция, ракурс, свет, цвет, стиль, настроение.
- Если запрос слишком расплывчатый — задай 1–2 коротких уточняющих вопроса или предложи 2–3 варианта идеи.
- Чтобы изменить существующее изображение, вызывай edit_image с его id (v1, v2, … — созданные, a1, a2, … — фото пользователя). В промпте опиши, что изменить и что оставить без изменений.
- Если пользователь выбрал изображение для правки, по умолчанию меняй именно его.
- Чтобы показать разные варианты, вызывай несколько инструментов параллельно в одном ответе.
- Выбирай формат по смыслу: 1024x1024 — квадрат, 1536x1024 — горизонталь, 1024x1536 — вертикаль.
- Отвечай кратко, на языке пользователя. После генерации в 1–2 предложениях опиши результат и предложи, что можно доработать.`

const SIZES: ImageSize[] = ['1024x1024', '1536x1024', '1024x1536']

export const AGENT_TOOLS: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Создать новое изображение с нуля по текстовому промпту.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Подробный промпт на английском языке.' },
          size: { type: 'string', enum: SIZES, description: 'Размер изображения.' },
          count: { type: 'integer', minimum: 1, maximum: 4, description: 'Сколько вариантов создать (по умолчанию 1).' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_image',
      description:
        'Изменить существующее изображение. Первое изображение в image_ids — основное, остальные используются как референсы.',
      parameters: {
        type: 'object',
        properties: {
          image_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Id изображений, например ["v2"] или ["v3", "a1"].',
          },
          prompt: { type: 'string', description: 'Что изменить и что сохранить, на английском языке.' },
          size: { type: 'string', enum: SIZES, description: 'Размер результата (по умолчанию как у основного).' },
          count: { type: 'integer', minimum: 1, maximum: 4, description: 'Сколько вариантов создать (по умолчанию 1).' },
        },
        required: ['image_ids', 'prompt'],
      },
    },
  },
]

export interface ParsedToolArgs {
  prompt: string
  size?: ImageSize
  count: number
  imageIds: string[]
}

export function parseToolArgs(raw: string): ParsedToolArgs {
  let value: Record<string, unknown> = {}
  try {
    value = JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    throw new Error('Модель передала некорректные аргументы инструмента')
  }
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : ''
  if (!prompt) throw new Error('Модель не указала промпт')
  const size = SIZES.find((s) => s === value.size)
  const count = Math.min(4, Math.max(1, Math.round(Number(value.count) || 1)))
  const imageIds = Array.isArray(value.image_ids) ? value.image_ids.map(String) : []
  return { prompt, size, count, imageIds }
}

export function imageLabel(meta: GenerationMeta): string {
  return meta.label ?? `v${meta.version ?? 1}`
}

function describeImages(images: GenerationMeta[]): string {
  if (images.length === 0) return 'В сессии пока нет изображений.'
  const lines = images.map((meta) => {
    const kind = meta.kind === 'upload' ? 'фото пользователя' : `${meta.size}, промпт: ${meta.prompt.slice(0, 300)}`
    return `- ${imageLabel(meta)}: ${kind}`
  })
  return `Изображения в сессии:\n${lines.join('\n')}`
}

function userText(turn: UserTurn, byId: Map<string, GenerationMeta>): string {
  const notes: string[] = []
  const base = turn.baseId ? byId.get(turn.baseId) : undefined
  if (base) notes.push(`пользователь выбрал для правки ${imageLabel(base)}`)
  const attachments = turn.attachmentIds.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m)
  if (attachments.length) notes.push(`прикреплены фото: ${attachments.map(imageLabel).join(', ')}`)
  return notes.length ? `${turn.text}\n\n[${notes.join('; ')}]` : turn.text
}

function agentMessages(turn: AgentTurn): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const step of turn.steps) {
    const calls = step.toolCalls.filter((c) => c.status !== 'running')
    if (!step.text && calls.length === 0) continue
    messages.push({
      role: 'assistant',
      content: step.text || null,
      tool_calls: calls.length
        ? calls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.args } }))
        : undefined,
    })
    for (const call of calls) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: call.result ?? call.error ?? 'Нет результата' })
    }
  }
  return messages
}

const MAX_HISTORY_TURNS = 30

interface BuildParams {
  systemPrompt: string
  session: Session
  byId: Map<string, GenerationMeta>
  request: UserTurn
  visionUrls: string[]
}

export function buildAgentMessages({ systemPrompt, session, byId, request, visionUrls }: BuildParams): ChatMessage[] {
  const images = [...byId.values()]
    .filter((m) => m.sessionId === session.id)
    .sort((a, b) => a.createdAt - b.createdAt)
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: describeImages(images) },
  ]
  const history = session.turns.filter((t) => t.id !== request.id).slice(-MAX_HISTORY_TURNS)
  for (const turn of history) {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: userText(turn, byId) })
    } else if (turn.role === 'agent') {
      if (turn.status !== 'pending') messages.push(...agentMessages(turn))
    } else if (turn.status !== 'pending') {
      const created = turn.imageIds.map((id) => byId.get(id)).filter((m): m is GenerationMeta => !!m)
      messages.push({
        role: 'assistant',
        content: turn.error
          ? `Ошибка: ${turn.error}`
          : `Созданы изображения: ${created.map(imageLabel).join(', ') || 'нет'}.`,
      })
    }
  }
  const text = userText(request, byId)
  if (visionUrls.length > 0) {
    const parts: ChatContentPart[] = [
      { type: 'text', text },
      ...visionUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
    ]
    messages.push({ role: 'user', content: parts })
  } else {
    messages.push({ role: 'user', content: text })
  }
  return messages
}

export function toolResult(created: GenerationMeta[]): string {
  return JSON.stringify({
    ok: true,
    images: created.map((m) => ({ id: imageLabel(m), size: m.size })),
    note: 'Изображения показаны пользователю.',
  })
}
