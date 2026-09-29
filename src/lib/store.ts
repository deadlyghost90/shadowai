/**
 * Local persistence.
 *
 * Conversations and settings live in localStorage — no account required, no
 * server round-trip, works offline. Storage is quota-aware: if a write fails
 * (usually because attachments are large) ShadowAI drops attachment payloads
 * from the oldest conversations and retries rather than losing the session.
 */

import type { Conversation, Message } from './ai/types'
import { DEFAULT_SETTINGS, SHADOW_SPACE_TOKEN, SHADOW_SPACE_URL, type AppSettings } from './ai/config'

const CONV_KEY = 'shadowai.conversations.v1'
const SETTINGS_KEY = 'shadowai.settings.v1'
const MAX_CONVERSATIONS = 300
const ATTACH_BUDGET = 3_500_000

/* ------------------------------------------------------------------ settings */

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return structuredCloneish(DEFAULT_SETTINGS)
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const provider = { ...DEFAULT_SETTINGS.provider, ...(parsed.provider || {}) }
    // ShadowAI now has one connection path: the configured Hugging Face Space.
    // Migrate older direct/backend settings instead of leaving the provider
    // pointed at an endpoint the UI no longer exposes.
    if (provider.transport !== 'space') {
      provider.transport = 'space'
      provider.baseUrl = SHADOW_SPACE_URL
    }
    if (!provider.baseUrl) provider.baseUrl = SHADOW_SPACE_URL
    if (!provider.apiKey && SHADOW_SPACE_TOKEN) provider.apiKey = SHADOW_SPACE_TOKEN
    const legacyGreenDefault = parsed.appearance?.theme === 'dark' && parsed.appearance?.accent === '#22C55E'
    return {
      ...structuredCloneish(DEFAULT_SETTINGS),
      ...parsed,
      provider,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...(parsed.appearance || {}),
        ...(legacyGreenDefault ? { theme: 'graphite', accent: '#d0d0d0' } : {}),
      },
      account: { ...DEFAULT_SETTINGS.account, ...(parsed.account || {}) },
      profile: { ...DEFAULT_SETTINGS.profile, ...(parsed.profile || {}) },
    }
  } catch {
    return structuredCloneish(DEFAULT_SETTINGS)
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* private mode / quota — settings simply won't persist */
  }
}

function structuredCloneish<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/* ------------------------------------------------------------- conversations */

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Conversation[]) : []
  } catch {
    return []
  }
}

export function saveConversations(list: Conversation[]): void {
  const trimmed = list.slice(0, MAX_CONVERSATIONS)
  const attempt = (payload: Conversation[]) => {
    localStorage.setItem(CONV_KEY, JSON.stringify(payload))
  }

  try {
    attempt(trimmed)
    return
  } catch {
    /* fall through to shrink */
  }

  // strip attachment payloads newest-last until it fits
  const shrunk = trimmed.map((c) => ({ ...c, messages: c.messages.map(stripAttachmentData) }))
  try {
    attempt(shrunk)
    return
  } catch {
    /* fall through again */
  }

  // last resort: keep only the 40 most recent conversations
  try {
    attempt(shrunk.slice(0, 40).map((c) => ({ ...c, messages: c.messages.map(stripMessageToEssentials) })))
  } catch {
    /* give up quietly — the session still works in memory */
  }
}

function stripAttachmentData(m: Message): Message {
  if (!m.attachments?.length) return m
  return {
    ...m,
    attachments: m.attachments.map((a) => ({ ...a, dataUrl: undefined, text: a.kind === 'text' ? a.text : undefined })),
  }
}

function stripMessageToEssentials(m: Message): Message {
  const base = stripAttachmentData(m)
  return {
    ...base,
    artifacts: base.artifacts?.map((a) => ({ ...a, content: a.content.slice(0, 4000) })),
  }
}

/* -------------------------------------------------------------------- export */

export function exportConversations(list: Conversation[]): string {
  return JSON.stringify(
    { app: 'ShadowAI', by: 'ShadowMotion', version: 1, exportedAt: new Date().toISOString(), conversations: list },
    null,
    2,
  )
}

export function estimateBytes(list: Conversation[]): number {
  try {
    return new Blob([JSON.stringify(list)]).size
  } catch {
    return ATTACH_BUDGET
  }
}
