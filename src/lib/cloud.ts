/**
 * Cloud layer — the typed bridge between ShadowAI and Firebase.
 *
 * Schema
 *   /users/{uid}                        profile + onboarding answers
 *   /users/{uid}/conversations/{convId}  title, model, mode, timestamps, archived
 *   /users/{uid}/conversations/{convId}/messages/{msgId}  one message
 *
 * Every rule here is owner-scoped: a user can only ever read and write their
 * own subtree. The same rules are shipped in `database.rules.json`.
 *
 * Writes are debounced and fire-and-forget so a fast stream never blocks the
 * UI on a network round-trip. localStorage stays the source of truth for an
 * offline session; the cloud is the sync target.
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

/* -------------------------------------------------------------- profile */

export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const data = await get_(ref(getFirebaseDB(), userPath(uid)))
  return (data as UserProfile) ?? null
}

export async function saveProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await update(ref(getFirebaseDB(), userPath(uid)), { ...patch, lastSeenAt: Date.now() })
}

export async function completeOnboarding(uid: string, answers: OnboardingAnswers): Promise<void> {
  await set(ref(getFirebaseDB(), userPath(uid)), {
    displayName: answers.displayName || 'ShadowMotion user',
    onboarding: answers,
    onboarded: true,
    onboardedAt: Date.now(),
    lastSeenAt: Date.now(),
  })
}

/* --------------------------------------------------------- conversations */

export function watchConversations(
  uid: string,
  cb: (list: Conversation[]) => void,
): () => void {
  const r = ref(getFirebaseDB(), convPath(uid))
  const handler = onValue(
    r,
    (snap) => {
      const raw = snap.val() as Record<string, Record<string, unknown>> | null
      if (!raw) {
        cb([])
        return
      }
      const list: Conversation[] = []
      for (const [id, c] of Object.entries(raw)) {
        const messagesObj = (c.messages || {}) as Record<string, Omit<Message, 'id'>>
        const messages: Message[] = Object.entries(messagesObj)
          .map(([mid, m]) => ({ ...(m as Message), id: mid }))
          .sort((a, b) => a.createdAt - b.createdAt)
        list.push({
          id,
          title: (c.title as string) || 'New conversation',
          createdAt: (c.createdAt as number) || Date.now(),
          updatedAt: (c.updatedAt as number) || Date.now(),
          model: c.model as string | undefined,
          archived: Boolean(c.archived),
          pinned: Boolean(c.pinned),
          messages,
        })
      }
      list.sort((a, b) => b.updatedAt - a.updatedAt)
      cb(list)
    },
    () => cb([]),
  )
  return () => off(r, 'value', handler)
}

export async function pushConversation(uid: string, conv: Conversation): Promise<void> {
  const { messages, ...meta } = conv
  const msgObj: Record<string, Omit<Message, 'id'>> = {}
  for (const m of messages) {
    const { id, ...rest } = m
    // attachments carry base64 payloads; keep the chip metadata, drop the bytes
    if (rest.attachments) {
      rest.attachments = rest.attachments.map((a) => ({ ...a, dataUrl: undefined, text: undefined }))
    }
    msgObj[id] = rest
  }
  await set(ref(getFirebaseDB(), `${convPath(uid)}/${conv.id}`), { ...meta, messages: msgObj })
}

export async function removeConversation(uid: string, convId: string): Promise<void> {
  await remove(ref(getFirebaseDB(), `${convPath(uid)}/${convId}`))
}

export async function toggleConversationArchived(uid: string, convId: string, archived: boolean) {
  await update(ref(getFirebaseDB(), `${convPath(uid)}/${convId}`), { archived, updatedAt: Date.now() })
}

/* ------------------------------------------------------------- debounce */

export function createSyncer(uid: string | null, delay = 1400) {
  let timer: number | undefined
  let queued: Conversation[] = []
  let running = false

  const flush = async () => {
    if (running || !uid || !queued.length) return
    running = true
    const batch = queued
    queued = []
    try {
      for (const c of batch) await pushConversation(uid, c)
    } catch {
      // Cloud sync is best-effort; the local session is unaffected.
    } finally {
      running = false
      if (queued.length) {
        timer = window.setTimeout(flush, 400)
      }
    }
  }

  return {
    queue(conv: Conversation) {
      if (!firebaseEnabled()) return
      const i = queued.findIndex((c) => c.id === conv.id)
      if (i >= 0) queued[i] = conv
      else queued.push(conv)
      window.clearTimeout(timer)
      timer = window.setTimeout(flush, delay)
    },
    remove(convId: string) {
      queued = queued.filter((c) => c.id !== convId)
      if (uid) void removeConversation(uid, convId).catch(() => undefined)
    },
    dispose() {
      window.clearTimeout(timer)
      queued = []
    },
  }
}

/* small local helper so the profile read does not need the raw firebase get */
async function get_(r: ReturnType<typeof ref>) {
  const { get } = await import('./firebase')
  const snap = await get(r)
  return snap.val()
}
