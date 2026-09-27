/**
 * ShadowAI — core AI domain types.
 *
 * The entire UI talks to models through the `AIProvider` interface defined here.
 * Nothing in the interface layer knows which company, vendor, or local runtime
 * is serving the model. Swap the provider, keep the app.
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export type Mode = 'chat' | 'agent'

export type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'doc'
  | 'sheet'
  | 'json'
  | 'code'
  | 'archive'
  | 'other'

export interface Attachment {
  id: string
  name: string
  /** bytes */
  size: number
  mime: string
  kind: AttachmentKind
  /** data URL — used directly for images and small text previews */
  dataUrl?: string
  /** plain-text extraction, when we could produce one */
  text?: string
  /** true while the file is still being read */
  pending?: boolean
}

export interface ArtifactFile {
  path: string
  language: string
  content: string
  size: number
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface AgentStep {
  id: string
  title: string
  status: StepStatus
  /** short, user-facing progress label — never internal reasoning */
  note?: string
  startedAt?: number
  finishedAt?: number
}

export type RunStatus = 'planning' | 'running' | 'done' | 'failed' | 'stopped'

export interface AgentRun {
  title: string
  status: RunStatus
  steps: AgentStep[]
  currentStep: number
  error?: string
}

export interface Message {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  model?: string
  mode?: Mode
  attachments?: Attachment[]
  artifacts?: ArtifactFile[]
  run?: AgentRun
  /** non-fatal or fatal model error, rendered inline in the conversation */
  error?: string
  /** a short, user-safe suggestion — never a stack trace */
  errorHint?: string
  errorKind?: 'connection' | 'auth' | 'rate' | 'model' | 'network' | 'unknown'
  /** user stopped generation */
  stopped?: boolean
  saved?: boolean
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  model?: string
  archived?: boolean
  pinned?: boolean
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ProviderMessage {
  role: ChatRole
  content: string | ContentPart[]
}

export interface ProviderModel {
  id: string
  label: string
  /** short human hint, e.g. "self-hosted" */
  source?: string
  contextWindow?: number
}

export interface ProviderProgress {
  /** short machine-readable stage, e.g. "analyzing" */
  stage: string
  /** a user-facing line, safe to show verbatim */
  message: string
}

export interface ProviderRequest {
  messages: ProviderMessage[]
  model: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  /** called for every streamed text delta */
  onDelta: (delta: string) => void
  /** called once with the full text when the stream ends */
  onDone?: (full: string) => void
  /** optional — backends that report their own stages (not internal reasoning) */
  onProgress?: (p: ProviderProgress) => void
}

export interface ProviderHealth {
  ok: boolean
  /** short, user-facing status — safe to render in the UI */
  message?: string
  kind?: Message['errorKind']
}

/**
 * The single seam between ShadowAI and any AI backend.
 *
 * Implementations must:
 *  - stream via `onDelta`
 *  - honour `signal` for cancellation
 *  - throw a `ProviderError` with a user-safe message on failure
 */
export interface AIProvider {
  id: string
  label: string
  models(): ProviderModel[]
  chat(req: ProviderRequest): Promise<void>
  health?(req: { model: string; signal?: AbortSignal }): Promise<ProviderHealth>
}

export class ProviderError extends Error {
  kind: Message['errorKind']
  hint?: string
  constructor(message: string, kind: Message['errorKind'] = 'unknown', hint?: string) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.hint = hint
  }
}
