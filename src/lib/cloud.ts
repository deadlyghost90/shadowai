/**
 * Cloud layer — the typed bridge between ShadowAI and Firebase Realtime Database.
 *
 * Schema (everything is owner-scoped; see `database.rules.json`)
 *   /users/{uid}                                  profile + onboarding answers
 *   /users/{uid}/conversations/{convId}           title, mode, timestamps, archived
 *   /users/{uid}/conversations/{convId}/messages/{msgId}   one message
 *
 * How saving works (deliberately simple):
 *   1. `createSyncer` keeps an in-memory outbox of conversations that changed.
 *   2. A conversation is written as ONE atomic node (`set`), so a chat and its
 *      messages can never end up half-saved.
 *   3. The outbox retries with backoff, flushes when the browser comes back
 *      online, and drains again after any failure — nothing is silently dropped.
 *   4. `watchConversations` streams the owner's chats back down live.
 *
 * localStorage remains the instant, offline copy; the cloud is the durable copy.
 */

import type { Conversation, Message } from './ai/types'
import {
  firebaseEnabled,
  getFirebaseDB,
  off,
  onValue,
  ref,
  remove,
  set,
  update,
} from './firebase'

/* ------------------------------------------------------------- profile */

export interface OnboardingAnswers {
  displayName: string
  role: string
  heardFrom: string
  goals: string[]
  experience: string
  interests: string[]
  teamSize: string
  answerStyle: string
  anythingElse: string
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string
  onboarded: boolean
  onboarding?: Partial<OnboardingAnswers>
  createdAt: number
  lastSeenAt: number
}

const userPath = (uid: string) => `users/${uid}`
const convPath = (uid: string) => `users/${uid}/conversations`

export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const data = await get_(ref(getFirebaseDB(), userPath(uid)))
  return (data as UserProfile) ?? null
}

export async function saveProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await update(ref(getFirebaseDB(), userPath(uid)), { ...patch, lastSeenAt: Date.now() })
}

export async function completeOnboarding(uid: string, answers: OnboardingAnswers): Promise<void> {
  await update(ref(getFirebaseDB(), userPath(uid)), {
    displayName: answers.displayName || 'ShadowMotion user',
    onboarding: answers,
    onboarded: true,
    onboardedAt: Date.now(),
    lastSeenAt: Date.now(),
  })
}

/* --------------------------------------------------------- conversations */

/** Turn one stored node back into a Conversation. Tolerates partial/legacy data. */
function toConversation(id: string, c: Record<string, unknown>): Conversation {
  const messagesObj = (c.messages || {}) as Record<string, Omit<Message, 'id'>>
  const messages: Message[] = Object.entries(messagesObj)
    .map(([mid, m], i) => ({
      ...(m as Message),
      id: mid || `m_${i}`,
      createdAt: Number((m as Message)?.createdAt) || Number(c.createdAt) || Date.now() + i,
    }))
    .sort((a, b) => a.createdAt - b.createdAt)

  return {
    id,
    title: (c.title as string) || 'New conversation',
    createdAt: (c.createdAt as number) || Date.now(),
    updatedAt: (c.updatedAt as number) || Date.now(),
    model: c.model as string | undefined,
    archived: Boolean(c.archived),
    pinned: Boolean(c.pinned),
    messages,
  }
}

export function watchConversations(
  uid: string,
  cb: (list: Conversation[]) => void,
  onError?: (message: string) => void,
): () => void {
  if (!firebaseEnabled()) {
    onError?.('Cloud sync is not configured.')
    return () => undefined
  }
  const r = ref(getFirebaseDB(), convPath(uid))
  const handler = onValue(
    r,
    (snap) => {
      const raw = snap.val() as Record<string, Record<string, unknown>> | null
      if (!raw) {
        cb([])
        return
      }
      const list = Object.entries(raw).map(([id, c]) => toConversation(id, c || {}))
      list.sort((a, b) => b.updatedAt - a.updatedAt)
      cb(list)
    },
    (err) => {
      // almost always "permission_denied" — the rules were never published
      onError?.(describeDbError(err))
      cb([])
    },
  )
  return () => off(r, 'value', handler)
}

/** What is actually going to the server for one conversation. */
export function serializeConversation(conv: Conversation) {
  const msgObj: Record<string, unknown> = {}
  for (const m of conv.messages) {
    const { id, ...rest } = m
    if (!id) continue
    // attachments carry base64 bytes — keep the chip metadata, drop the payload
    if (rest.attachments?.length) {
      rest.attachments = rest.attachments.map((a) => ({ ...a, dataUrl: undefined, text: undefined }))
    }
    msgObj[id] = rest
  }
  const { messages: _omit, ...meta } = conv
  return { ...meta, id: undefined, messages: msgObj }
}

export async function pushConversation(uid: string, conv: Conversation): Promise<void> {
  await set(ref(getFirebaseDB(), `${convPath(uid)}/${conv.id}`), serializeConversation(conv))
}

export async function removeConversation(uid: string, convId: string): Promise<void> {
  await remove(ref(getFirebaseDB(), `${convPath(uid)}/${convId}`))
}

export async function toggleConversationArchived(
  uid: string,
  convId: string,
  archived: boolean,
): Promise<void> {
  await update(ref(getFirebaseDB(), `${convPath(uid)}/${convId}`), {
    archived,
    updatedAt: Date.now(),
  })
}

/* ------------------------------------------------------------- syncer */

export interface SyncStatus {
  pending: number
  error: string | null
}

/**
 * Debounced, retrying write queue for one signed-in user.
 *
 * Call `queue(conv)` on every local change; it coalesces per conversation id,
 * writes atomically, and keeps retrying until it succeeds. `subscribe()` lets
 * the UI show "Saving… / Saved / Offline" instead of failing quietly.
 */
export function createSyncer(uid: string | null, delay = 800) {
  let timer: number | undefined
  let onlineTimer: number | undefined
  let attempts = 0
  const queued = new Map<string, Conversation>()
  const listeners = new Set<(s: SyncStatus) => void>()
  let lastError: string | null = null
  let disposed = false

  const notify = () => {
    const s: SyncStatus = { pending: queued.size, error: lastError }
    for (const l of listeners) l(s)
  }

  const schedule = (ms = delay) => {
    if (disposed || !uid || !queued.size) return
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(flush, ms)
  }

  async function flush() {
    timer = undefined
    if (disposed || !uid || !firebaseEnabled()) return
    if (!navigator.onLine) {
      // wait to come back online rather than burning retries
      lastError = 'You are offline. Chats will sync when you reconnect.'
      notify()
      return
    }

    // snapshot the batch, keep anything re-queued during the write
    const batch = [...queued.values()]
    for (const c of batch) queued.delete(c.id)
    notify()

    try {
      for (const c of batch) await pushConversation(uid, c)
      attempts = 0
      lastError = null
    } catch (e) {
      const message = describeDbError(e)
      // put the failed conversations back so nothing is lost
      for (const c of batch) if (!queued.has(c.id)) queued.set(c.id, c)
      attempts += 1
      lastError = message
      console.warn('[ShadowAI] cloud sync failed:', message, e)
      schedule(Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)))
    } finally {
      notify()
      if (queued.size) schedule(attempts ? Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)) : delay)
    }
  }

  const goOnline = () => {
    attempts = 0
    lastError = null
    schedule(200)
  }
  window.addEventListener('online', goOnline)
  // safety net: periodic drain catches anything a tab-switch swallowed
  onlineTimer = window.setInterval(() => {
    if (queued.size && !timer) schedule(0)
  }, 15_000)

  notify()

  return {
    /** Queue a conversation for upload (coalesced per id, debounced). */
    queue(conv: Conversation) {
      if (!uid || !firebaseEnabled()) return
      queued.set(conv.id, conv)
      notify()
      schedule()
    },
    /** Write one conversation immediately — used when generation finishes. */
    async flushNow(conv?: Conversation) {
      if (conv) queued.set(conv.id, conv)
      if (timer) {
        window.clearTimeout(timer)
        timer = undefined
      }
      await flush()
    },
    remove(convId: string) {
      queued.delete(convId)
      if (uid && firebaseEnabled()) {
        void removeConversation(uid, convId).catch((e) => {
          lastError = describeDbError(e)
          notify()
        })
      }
      notify()
    },
    subscribe(cb: (s: SyncStatus) => void): () => void {
      listeners.add(cb)
      cb({ pending: queued.size, error: lastError })
      return () => listeners.delete(cb)
    },
    get pending() {
      return queued.size
    },
    dispose() {
      disposed = true
      if (timer) window.clearTimeout(timer)
      if (onlineTimer) window.clearInterval(onlineTimer)
      window.removeEventListener('online', goOnline)
      // best effort: give queued work a final chance before the tab dies
      void flush()
      queued.clear()
      listeners.clear()
    },
  }
}

/* ------------------------------------------------------------- helpers */

/** Turn a Firebase error code into something a person can act on. */
export function describeDbError(e: unknown): string {
  const code = String((e as { code?: string })?.code || '')
  if (code.includes('permission-denied'))
    return 'Firebase refused the write. Publish database.rules.json (node tools/deploy-rules.mjs) and make sure sign-in is enabled.'
  if (code.includes('network') || code.includes('unavailable'))
    return 'Cannot reach Firebase right now. Chat is saved on this device and will sync automatically.'
  if (code.includes('invalid-json') || code.includes('disconnected'))
    return 'The connection to the database dropped. Retrying…'
  return code || 'Could not reach the database. Your chat is still saved on this device.'
}

export function cloudAvailable(): boolean {
  return firebaseEnabled()
}

/* small local helper so the profile read does not need the raw firebase get */
async function get_(r: ReturnType<typeof ref>) {
  const { get } = await import('./firebase')
  const snap = await get(r)
  return snap.val()
}
