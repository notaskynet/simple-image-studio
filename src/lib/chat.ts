import { ApiError, extractMessage, resolveApiUrl, toUserMessage, type ApiResponse } from './api'

export type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export interface ChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ChatContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface ChatTool {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ChatParams {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  tools: ChatTool[]
  signal: AbortSignal
  onText: (text: string) => void
}

export interface ChatResult {
  text: string
  toolCalls: ChatToolCall[]
}

interface StreamDelta {
  content?: string | null
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[]
}

interface StreamChunk {
  choices?: { delta?: StreamDelta; message?: { content?: string | null; tool_calls?: ChatToolCall[] } }[]
  error?: { message?: string }
}

function collect(state: ChatResult, delta: StreamDelta): void {
  if (delta.content) state.text += delta.content
  for (const call of delta.tool_calls ?? []) {
    const target = (state.toolCalls[call.index] ??= { id: '', type: 'function', function: { name: '', arguments: '' } })
    if (call.id) target.id = call.id
    if (call.function?.name) target.function.name += call.function.name
    if (call.function?.arguments) target.function.arguments += call.function.arguments
  }
}

export async function streamChat(params: ChatParams): Promise<ChatResult> {
  let response: Response
  try {
    response = await fetch(resolveApiUrl(params.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        tool_choice: 'auto',
        stream: true,
      }),
      signal: params.signal,
    })
  } catch (error) {
    if (params.signal.aborted) throw error
    throw new ApiError('Нет соединения с API — проверьте URL и подключение к сети')
  }

  if (!response.ok) {
    let body: ApiResponse | null = null
    try {
      body = (await response.json()) as ApiResponse
    } catch (error) {
      if (params.signal.aborted) throw error
    }
    throw new ApiError(toUserMessage(response.status, extractMessage(body), params.model), response.status)
  }

  const state: ChatResult = { text: '', toolCalls: [] }
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('text/event-stream') || !response.body) {
    const body = (await response.json()) as StreamChunk
    if (body.error?.message) throw new ApiError(body.error.message)
    const message = body.choices?.[0]?.message
    state.text = message?.content ?? ''
    state.toolCalls = message?.tool_calls ?? []
    if (state.text) params.onText(state.text)
    return state
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    let changed = false
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      let chunk: StreamChunk
      try {
        chunk = JSON.parse(data) as StreamChunk
      } catch {
        continue
      }
      if (chunk.error?.message) throw new ApiError(chunk.error.message)
      const delta = chunk.choices?.[0]?.delta
      if (delta) {
        const before = state.text.length
        collect(state, delta)
        changed ||= state.text.length !== before
      }
    }
    if (changed) params.onText(state.text)
  }
  state.toolCalls = state.toolCalls.filter((call) => call && call.function.name)
  state.toolCalls.forEach((call, i) => {
    if (!call.id) call.id = `call_${i}_${Date.now().toString(36)}`
  })
  return state
}
