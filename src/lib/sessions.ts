import type { GenerationMeta, Session } from '../types'

export function sessionImages(session: Session, byId: Map<string, GenerationMeta>): GenerationMeta[] {
  return session.turns
    .flatMap((t) => (t.role === 'assistant' ? t.imageIds : []))
    .map((id) => byId.get(id))
    .filter((m): m is GenerationMeta => !!m)
}

export function nextVersion(session: Session, byId: Map<string, GenerationMeta>): number {
  return sessionImages(session, byId).reduce((max, m) => Math.max(max, m.version ?? 0), 0) + 1
}

export function sessionTitle(text: string): string {
  const line = text.trim().split('\n')[0]
  return line.length > 80 ? `${line.slice(0, 77)}…` : line
}
