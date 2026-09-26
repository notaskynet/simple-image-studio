export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export type StyleId = 'photo' | 'anime' | 'watercolor' | '3d' | 'pixel' | 'minimal'

export type Theme = 'light' | 'dark'

export type ImageKind = 'generated' | 'upload'

export interface GenerationMeta {
  id: string
  prompt: string
  styles: StyleId[]
  model: string
  size: ImageSize
  createdAt: number
  favorite: boolean
  mime: string
  remoteUrl?: string
  kind?: ImageKind
  sessionId?: string
  parentId?: string
  inputIds?: string[]
  includeOriginal?: boolean
  version?: number
  label?: string
}

export type ComposeMode = 'agent' | 'direct'

export type TurnStatus = 'pending' | 'done' | 'error'

export interface UserTurn {
  id: string
  role: 'user'
  text: string
  styles: StyleId[]
  size: ImageSize
  count: number
  baseId?: string
  attachmentIds: string[]
  includeOriginal: boolean
  mode?: ComposeMode
  createdAt: number
}

export interface AssistantTurn {
  id: string
  role: 'assistant'
  requestId: string
  imageIds: string[]
  error?: string
  status?: TurnStatus
  size?: ImageSize
  count?: number
  edit?: boolean
  createdAt: number
}

export interface ToolCallRecord {
  id: string
  name: string
  args: string
  prompt?: string
  size?: ImageSize
  count?: number
  sourceIds?: string[]
  status: 'running' | 'done' | 'error'
  imageIds: string[]
  result?: string
  error?: string
  startedAt: number
}

export interface AgentStep {
  text: string
  toolCalls: ToolCallRecord[]
}

export interface AgentTurn {
  id: string
  role: 'agent'
  requestId: string
  steps: AgentStep[]
  status: TurnStatus
  error?: string
  createdAt: number
}

export type Turn = UserTurn | AssistantTurn | AgentTurn

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  turns: Turn[]
}

export interface StudioRequest {
  text: string
  styles: StyleId[]
  size: ImageSize
  count: number
  baseId?: string
  attachmentIds: string[]
  includeOriginal: boolean
}
