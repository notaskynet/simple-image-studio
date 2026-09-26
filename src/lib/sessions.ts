import type { GenerationMeta, Session, Turn } from '../types'

function turnImageIds(turn: Turn): string[] {
  if (turn.role === 'assistant') return turn.imageIds
  if (turn.role === 'agent') return turn.steps.flatMap((s) => s.toolCalls.flatMap((c) => c.imageIds))
  return []
}

export function sessionImages(session: Session, byId: Map<string, GenerationMeta>): GenerationMeta[] {
  return session.turns
    .flatMap(turnImageIds)
    .map((id) => byId.get(id))
    .filter((m): m is GenerationMeta => !!m)
}

export function sessionTitle(text: string): string {
  const line = text.trim().split('\n')[0]
  return line.length > 80 ? `${line.slice(0, 77)}…` : line
}
