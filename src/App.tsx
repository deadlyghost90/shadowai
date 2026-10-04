import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mark } from './components/Mark'
import { Icon } from './components/Icon'
import { Sidebar } from './components/Sidebar'
import { Composer } from './components/Composer'
import { MessageItem, type MessageActions } from './components/MessageItem'
import { FilePreview } from './components/FileArtifacts'
import { SettingsDialog, type SettingsTab } from './components/SettingsDialog'
import { WorkspacePanel, type WorkspaceTab } from './components/WorkspacePanel'
import { ReferenceWelcome } from './components/ReferenceWelcome'
import { LiveActivityRail } from './components/LiveActivityRail'
import { IntroPage } from './components/IntroPage'
import { AuthGate } from './components/AuthGate'
import { Onboarding } from './components/Onboarding'
import type {
  ArtifactFile,
  Attachment,
  Conversation,
  Message,
  Mode,
  ProviderProgress,
} from './lib/ai/types'
import type { User } from 'firebase/auth'
import { endpointFor, providerForService, SHADOW_CODER_MODEL, SHADOW_MODEL, type AppSettings, type ShadowService } from './lib/ai/config'
import { createProvider, isConfigured, transportLabel } from './lib/ai'
import { buildProviderMessages } from './lib/ai/messages'
import { runAgent } from './lib/ai/agent'
import { describeError } from './lib/ai/providers/openaiCompatible'
import { parseArtifacts } from './lib/ai/artifacts'
import { generateMedia, type MediaKind } from './lib/ai/media'
import { readAttachment } from './lib/attachments'
import {
  exportConversations,
  loadConversations,
  loadSettings,
  saveConversations,
  saveSettings,
} from './lib/store'
import { signOut, watchAuth } from './lib/firebase'
import {
  completeOnboarding,
  createSyncer,
  loadProfile,
  watchConversations,
  type OnboardingAnswers,
  type UserProfile,
} from './lib/cloud'
import { cx, downloadText, titleFromMessage, uid } from './lib/utils'

/* ------------------------------------------------------------------ data */

function detectMediaIntent(text: string): MediaKind | null {
  const value = text.toLowerCase()
  const video = /\b(video|clip|animation|animate|motion)\b/.test(value) && /\b(generate|create|make|render|produce|show|need|want)\b/.test(value)
  if (video) return 'video'
  const image = /\b(image|picture|photo|illustration|poster|logo|artwork|thumbnail|banner)\b/.test(value) && /\b(generate|create|make|draw|render|produce|show|need|want)\b/.test(value)
  return image ? 'image' : null
}

function detectCodingIntent(text: string): boolean {
  return /\b(write|build|create|make|fix|debug|implement|refactor|code|coding|function|component|api|script|website|app|bug|error|repository|repo|file)\b/i.test(text)
}

function isShortChat(text: string): boolean {
  return text.trim().length <= 240 && !detectCodingIntent(text) && !detectMediaIntent(text)
}

function emptyConversation(): Conversation {
  const now = Date.now()
  return { id: uid('c'), title: 'New conversation', createdAt: now, updatedAt: now, messages: [] }
}

function isMobileWidth() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches
}

function bytesOf(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return 0
  }
}

/* ------------------------------------------------------------------- app */

export default function App() {
  /* ------------------------------------------------------------ state */
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string>('')
  const [mode, setMode] = useState<Mode>('chat')
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance')
  const [preview, setPreview] = useState<ArtifactFile | null>(null)
  const [toasts, setToasts] = useState<{ id: string; text: string; kind: 'ok' | 'err' }[]>([])
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('plugins')
  const [isMobile, setIsMobile] = useState(() => isMobileWidth())
  const [scrolled, setScrolled] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [introDismissed, setIntroDismissed] = useState(false)

  /* ---------------------------------------------------------- account */
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [stage, setStage] = useState<string>('')
  const [activityEvents, setActivityEvents] = useState<ProviderProgress[]>([])
  const cloudHydrated = useRef(false)
  const syncer = useRef<ReturnType<typeof createSyncer> | null>(null)

  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* live stream buffer — mutated during streaming, flushed on animation frame */
  const stream = useRef({ id: '', text: '', artifacts: [] as ArtifactFile[], raf: 0, active: false })
  const stopFlag = useRef(false)
  const convIdRef = useRef('')

  /* -------------------------------------------------------- derived */
  const activeService: ShadowService = mode === 'agent' ? 'coder' : 'chat'
  const activeProviderConfig = useMemo(() => providerForService(settings.provider, activeService), [settings.provider, activeService])
  const provider = useMemo(() => createProvider(activeProviderConfig), [activeProviderConfig])
  const models = useMemo(
    () =>
      activeProviderConfig.models
        .filter((m) => m.id.trim())
        .map((m) => ({ id: m.id, label: m.label || m.id, source: m.source })),
    [activeProviderConfig.models],
  )
  const ready = isConfigured(activeProviderConfig)
  const model = mode === 'agent' ? SHADOW_CODER_MODEL.id : SHADOW_MODEL.id
  const activeModelLabel = models.find((m) => m.id === model)?.label || model
  const conversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )
  const messages = conversation?.messages ?? []
  const isEmpty = messages.length === 0
  const streamingId = busy ? stream.current.id : ''
  const streamingMessage = useMemo(
    () => (streamingId ? messages.find((m) => m.id === streamingId) : undefined),
    [streamingId, messages],
  )
  const liveMessage = streamingMessage || [...messages].reverse().find((m) => m.role === 'assistant' && (m.run || m.artifacts?.length))
  const liveRun = liveMessage?.run
  const liveArtifacts = liveMessage?.artifacts || []
  const showLiveRail = Boolean(liveRun || liveArtifacts.length || busy)

  /** cheap signature that changes on every streamed token — drives auto-scroll */
  const streamSig = useMemo(
    () => messages.map((m) => m.content.length).join('.') + (streamingMessage?.run?.steps.length ?? 0),
    [messages, streamingMessage],
  )

  const stats = useMemo(
    () => ({
      conversations: conversations.length,
      messages: conversations.reduce((a, c) => a + c.messages.length, 0),
      saved: conversations.reduce((a, c) => a + c.messages.filter((m) => m.saved).length, 0),
      bytes: bytesOf(conversations),
    }),
    [conversations],
  )
  const mediaLibraryFiles = useMemo(() => {
    const map = new Map<string, ArtifactFile>()
    conversations.flatMap((c) => c.messages).flatMap((m) => m.artifacts || []).forEach((file) => {
      if (/\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)$/i.test(file.path) || /^data:(image|video)\//.test(file.content)) map.set(file.path, file)
    })
    return [...map.values()]
  }, [conversations])

  /* ------------------------------------------------------- persistence */
  useEffect(() => saveConversations(conversations), [conversations])
  useEffect(() => saveSettings(settings), [settings])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.appearance.theme
    root.dataset.accent = settings.appearance.accent
    root.dataset.motion = settings.appearance.reduceMotion ? 'reduced' : 'full'
    root.style.setProperty('--fs-scale', String(settings.appearance.fontScale))
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const themeColor = {
        dark: '#0B0F0D',
        midnight: '#080B10',
        graphite: '#101114',
        forest: '#0B120F',
        violet: '#100D18',
      }[settings.appearance.theme]
      meta.setAttribute('content', themeColor)
    }
  }, [settings.appearance])

  /* ----------------------------------------------------- environment */
  useEffect(() => {
    const off = watchAuth((u) => {
      setUser(u)
      setAuthReady(true)
    })
    return off
  }, [])

  /* load the profile once we know who we are */
  useEffect(() => {
    let alive = true
    if (!user) {
      setProfile(null)
      setProfileReady(false)
      cloudHydrated.current = false
      return
    }
    setProfileReady(false)
    void loadProfile(user.uid)
      .then((p) => {
        if (!alive) return
        setProfile(p)
        // keep the local mirror of the name in step with the account
        if (p?.displayName) {
          setSettings((s) =>
            s.account.displayName === p.displayName
              ? s
              : { ...s, account: { ...s.account, displayName: p.displayName, email: p.email || s.account.email } },
          )
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setProfileReady(true)
      })
    return () => {
      alive = false
    }
  }, [user])

  /* ------------------------------------------------------------- cloud */
  useEffect(() => {
    if (!user) {
      syncer.current?.dispose()
      syncer.current = null
      return
    }

    syncer.current = createSyncer(user.uid)
    cloudHydrated.current = false

    const off = watchConversations(user.uid, (remote) => {
      if (!cloudHydrated.current) {
        cloudHydrated.current = true
        // first load: prefer the cloud copy, but keep anything this device has
        // that has not made it up yet
        setConversations((local) => {
          const byId = new Map(remote.map((c) => [c.id, c]))
          for (const c of local) if (!byId.has(c.id)) byId.set(c.id, c)
          const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
          for (const c of merged) syncer.current?.queue(c)
          return merged
        })
        return
      }
      setConversations((local) => {
        // never clobber a message that is mid-stream on this device
        const liveId = stream.current.id
        const isLive = local.some((c) => c.messages.some((m) => m.id === liveId))
        if (isLive && stream.current.active) return local
        return remote
      })
    })

    return () => {
      off()
      syncer.current?.dispose()
      syncer.current = null
    }
  }, [user])

  /* push local edits to the cloud, debounced */
  useEffect(() => {
    if (!user || !cloudHydrated.current) return
    for (const c of conversations) syncer.current?.queue(c)
  }, [conversations, user])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(isMobileWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    document.title =
      conversation && conversation.messages.length
        ? `${conversation.title} — ShadowAI`
        : 'ShadowAI — by ShadowMotion'
  }, [conversation])

  /* ------------------------------------------------------------ toast */
  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = uid('t')
    setToasts((prev) => [...prev.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  /* ------------------------------------------------- conversation CRUD */
  const updateConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)))
    },
    [],
  )

  const createMedia = useCallback(async (kind: MediaKind, prompt: string): Promise<ArtifactFile> => {
    const file = await generateMedia({
      baseUrl: endpointFor(kind).baseUrl,
      token: endpointFor(kind).token,
      kind,
      prompt,
      onProgress: (event) => {
        setStage(event.message)
        setActivityEvents((current) => [...current.slice(-39), event])
      },
    })
    if (activeId) {
      updateConversation(activeId, (conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        messages: [...conversation.messages, {
          id: uid('msg'), role: 'assistant', content: `Generated ${kind} asset from the Media Studio.`, createdAt: Date.now(), model, mode: 'chat', artifacts: [file],
        }],
      }))
    }
    return file
  }, [activeId, model, updateConversation])

  const patchMessage = useCallback(
    (convId: string, msgId: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) => {
      updateConversation(convId, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: c.messages.map((m) => {
          if (m.id !== msgId) return m
          const p = typeof patch === 'function' ? patch(m) : patch
          return { ...m, ...p }
        }),
      }))
    },
    [updateConversation],
  )

  const newChat = useCallback(() => {
    stopFlag.current = true
    abortRef.current?.abort()
    setBusy(false)
    setInput('')
    setPending([])
    setMode('chat')
    setSearch('')
    setPreview(null)
    const fresh = emptyConversation()
    setConversations((prev) => (prev.some((c) => c.id === fresh.id) ? prev : [fresh, ...prev]))
    setActiveId(fresh.id)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const selectConversation = useCallback(
    (id: string) => {
      if (!id) {
        newChat()
        return
      }
      abortRef.current?.abort()
      setBusy(false)
      setPreview(null)
      setActiveId(id)
    },
    [newChat],
  )

  const deleteConversation = useCallback(
    (id: string) => {
      syncer.current?.remove(id)
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id)
        if (activeId === id) {
          const fresh = emptyConversation()
          setActiveId(next[0]?.id ?? fresh.id)
          return next[0] ? next : [fresh, ...next]
        }
        return next
      })
      toast('Conversation deleted')
    },
    [activeId, toast],
  )
  const renameConversation = useCallback(
    (id: string, title: string) => updateConversation(id, (c) => ({ ...c, title })),
    [updateConversation],
  )

  const archiveConversation = useCallback(
    (id: string) => {
      updateConversation(id, (c) => ({ ...c, archived: true }))
      if (activeId === id) {
        const next = conversations.find((c) => c.id !== id && !c.archived)
        if (next) setActiveId(next.id)
        else newChat()
      }
      toast('Conversation archived')
    },
    [activeId, conversations, newChat, toast, updateConversation],
  )

  const unarchiveConversation = useCallback(
    (id: string) => {
      updateConversation(id, (c) => ({ ...c, archived: false, updatedAt: Date.now() }))
      setActiveId(id)
      toast('Conversation restored')
    },
    [toast, updateConversation],
  )

  /* ---------------------------------------------------------- streaming */
  const flush = useCallback(() => {
    stream.current.raf = 0
    const s = stream.current
    if (!s.active || !s.id) return
    const id = s.id
    const text = s.text
    const artifacts = s.artifacts
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convIdRef.current) return c
        return {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === id ? { ...m, content: text, artifacts: artifacts.length ? artifacts : m.artifacts } : m,
          ),
        }
      }),
    )
  }, [])

  const pushDelta = useCallback(
    (delta: string) => {
      const s = stream.current
      s.text += delta
      if (s.text.includes('```file:')) {
        const parsed = parseArtifacts(s.text)
        if (parsed.artifacts.length) {
          const map = new Map(s.artifacts.map((a) => [a.path, a]))
          for (const a of parsed.artifacts) map.set(a.path, a)
          s.artifacts = [...map.values()]
        }
      }
      if (!s.raf) s.raf = requestAnimationFrame(flush)
    },
    [flush],
  )

  useEffect(
    () => () => {
      if (stream.current.raf) cancelAnimationFrame(stream.current.raf)
    },
    [],
  )

  /* -------------------------------------------------------- send / run */
  const beginStream = useCallback(
    (convId: string, msgId: string) => {
      convIdRef.current = convId
      const s = stream.current
      s.id = msgId
      s.text = ''
      s.artifacts = []
      s.active = true
      stopFlag.current = false
      abortRef.current = new AbortController()
      setBusy(true)
      setStage('')
      setActivityEvents([])
      patchMessage(convId, msgId, { error: undefined, errorHint: undefined, errorKind: undefined, stopped: false })
    },
    [patchMessage],
  )

  const endStream = useCallback(
    (convId: string, msgId: string) => {
      const s = stream.current
      if (s.raf) {
        cancelAnimationFrame(s.raf)
        s.raf = 0
      }
      s.active = false
      setBusy(false)
      setStage('')
      patchMessage(convId, msgId, {
        content: s.text,
        artifacts: s.artifacts.length ? s.artifacts : undefined,
      })
    },
    [patchMessage],
  )

  const failStream = useCallback(
    (convId: string, msgId: string, err: unknown) => {
      const s = stream.current
      if (s.raf) {
        cancelAnimationFrame(s.raf)
        s.raf = 0
      }
      s.active = false
      setBusy(false)
      setStage('')
      const stopped = stopFlag.current || (err as Error)?.name === 'AbortError'
      if (stopped) {
        patchMessage(convId, msgId, {
          content: s.text,
          artifacts: s.artifacts.length ? s.artifacts : undefined,
          stopped: true,
          error: undefined,
        })
        return
      }
      const pe = describeError(err)
      patchMessage(convId, msgId, {
        content: s.text,
        artifacts: s.artifacts.length ? s.artifacts : undefined,
        error: pe.message,
        errorHint: pe.hint,
        errorKind: pe.kind,
      })
      toast(pe.message, 'err')
    },
    [patchMessage, toast],
  )

  /** Runs one turn against the connected model and streams it into `msgId`. */
  const execute = useCallback(
    async (convId: string, msgId: string, history: Message[], runMode: Mode) => {
      const systemPrompt = activeProviderConfig.systemPrompt
      const signal = abortRef.current?.signal

      if (runMode === 'agent') {
        const request = [...history].reverse().find((m) => m.role === 'user')?.content ?? ''
        await runAgent({
          provider,
          model,
          request,
          history,
          systemPrompt,
          signal: signal as AbortSignal,
          events: {
            onRun: (run) => patchMessage(convId, msgId, { run }),
            onProgress: (p) => {
              setStage(p.message || p.stage)
              setActivityEvents((current) => [...current.slice(-39), p])
            },
            onContent: pushDelta,
            onArtifacts: (files) => {
              stream.current.artifacts = files
              if (!stream.current.raf) stream.current.raf = requestAnimationFrame(flush)
            },
            onSettled: () => {
              stream.current.active = false
            },
          },
        })
        return
      }

      await provider.chat({
        model,
        messages: buildProviderMessages({ history, systemPrompt, mode: 'chat' }),
        maxTokens: isShortChat([...history].reverse().find((m) => m.role === 'user')?.content || '') ? 128 : undefined,
        temperature: isShortChat([...history].reverse().find((m) => m.role === 'user')?.content || '') ? 0.25 : undefined,
        signal,
        onDelta: pushDelta,
        onProgress: (p) => {
          setStage(p.message || p.stage)
          setActivityEvents((current) => [...current.slice(-39), p])
        },
      })
    },
    [activeProviderConfig.systemPrompt, provider, model, patchMessage, pushDelta, flush],
  )

  const send = useCallback(
    async (text: string, attachments: Attachment[], runMode: Mode) => {
      if (!ready) {
        toast('The coding agent is unavailable right now.', 'err')
        return
      }
      const body = text.trim()
      if (!body && !attachments.length) return

      // resolve (or create) the target conversation without waiting a render
      let conv = conversations.find((c) => c.id === activeId)
      if (!conv || conv.archived) {
        conv = emptyConversation()
        setConversations((prev) => (prev.some((c) => c.id === conv!.id) ? prev : [conv as Conversation, ...prev]))
        setActiveId(conv.id)
      }
      const convId = conv.id
      const isFirst = conv.messages.length === 0
      const effectiveMode: Mode = runMode === 'chat' && detectCodingIntent(body) ? 'agent' : runMode

      const userMsg: Message = {
        id: uid('m'),
        role: 'user',
        content: body,
        createdAt: Date.now(),
        attachments: attachments.length ? attachments : undefined,
      }
      const botMsg: Message = {
        id: uid('m'),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        model,
        mode: effectiveMode,
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: isFirst
                  ? titleFromMessage(body || attachments[0]?.name || 'New conversation')
                  : c.title,
                updatedAt: Date.now(),
                messages: [...c.messages, userMsg, botMsg],
              }
            : c,
        ),
      )

      setInput('')
      setPending([])
      beginStream(convId, botMsg.id)

      try {
        const mediaKind = !attachments.length ? detectMediaIntent(body) : null
        if (mediaKind) {
          const file = await generateMedia({
            baseUrl: endpointFor(mediaKind).baseUrl,
            token: endpointFor(mediaKind).token,
            kind: mediaKind,
            prompt: body,
            signal: abortRef.current?.signal,
            onProgress: (event) => {
              setStage(event.message)
              setActivityEvents((current) => [...current.slice(-39), event])
            },
          })
          stream.current.text = `Generated ${mediaKind} asset from your request.`
          stream.current.artifacts = [file]
          endStream(convId, botMsg.id)
          return
        }
        const deadline = effectiveMode === 'chat' && isShortChat(body)
          ? window.setTimeout(() => abortRef.current?.abort(), 10000)
          : undefined
        try {
          await execute(convId, botMsg.id, [...conv.messages, userMsg], effectiveMode)
        } finally {
          if (deadline) window.clearTimeout(deadline)
        }
        endStream(convId, botMsg.id)
      } catch (e) {
        failStream(convId, botMsg.id, e)
      }
    },
    [ready, conversations, activeId, model, toast, beginStream, execute, endStream, failStream],
  )

  const stop = useCallback(() => {
    stopFlag.current = true
    abortRef.current?.abort()
  }, [])

  /* ----------------------------------------------------- message actions */
  const regenerate = useCallback(
    async (msgId: string) => {
      if (busy || !conversation) return
      const idx = conversation.messages.findIndex((m) => m.id === msgId)
      if (idx <= 0) return
      const convId = conversation.id
      const history = conversation.messages.slice(0, idx)
      const runMode: Mode = conversation.messages[idx].mode === 'agent' ? 'agent' : 'chat'
      if (!history.some((m) => m.role === 'user')) return

      const botMsg: Message = {
        id: uid('m'),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        model,
        mode: runMode,
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, updatedAt: Date.now(), messages: [...history, botMsg] } : c)),
      )

      beginStream(convId, botMsg.id)
      try {
        await execute(convId, botMsg.id, history, runMode)
        endStream(convId, botMsg.id)
      } catch (e) {
        failStream(convId, botMsg.id, e)
      }
    },
    [busy, conversation, model, beginStream, execute, endStream, failStream],
  )

  const continueReply = useCallback(
    async (msgId: string) => {
      if (busy || !conversation) return
      const idx = conversation.messages.findIndex((m) => m.id === msgId)
      if (idx === -1) return
      const convId = conversation.id
      const history = conversation.messages.slice(0, idx)
      const target = conversation.messages[idx]

      beginStream(convId, msgId)
      stream.current.text = target.content
      try {
        const messagesForProvider = buildProviderMessages({
          history,
          systemPrompt: activeProviderConfig.systemPrompt,
          mode: 'chat',
        })
        messagesForProvider.push({
          role: 'user',
          content:
            'Continue your previous response from exactly where it stopped. Do not repeat any text you already wrote and do not add a preamble.',
        })
        await provider.chat({
          model,
          messages: messagesForProvider,
          signal: abortRef.current?.signal,
          onDelta: pushDelta,
        })
        endStream(convId, msgId)
      } catch (e) {
        failStream(convId, msgId, e)
      }
    },
    [
      busy,
      conversation,
      activeProviderConfig.systemPrompt,
      model,
      provider,
      beginStream,
      endStream,
      failStream,
      pushDelta,
    ],
  )

  const editPrompt = useCallback(
    (msgId: string) => {
      if (!conversation) return
      const idx = conversation.messages.findIndex((m) => m.id === msgId)
      if (idx === -1) return
      const msg = conversation.messages[idx]
      updateConversation(conversation.id, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: c.messages.slice(0, idx),
      }))
      setInput(msg.content)
      setActiveId(conversation.id)
      requestAnimationFrame(() => inputRef.current?.focus())
    },
    [conversation, updateConversation],
  )

  const toggleSave = useCallback(
    (msgId: string) => {
      if (!conversation) return
      patchMessage(conversation.id, msgId, (m) => ({ saved: !m.saved }))
    },
    [conversation, patchMessage],
  )

  const messageActions: MessageActions = useMemo(
    () => ({
      regenerate: (id) => void regenerate(id),
      continueReply: (id) => void continueReply(id),
      editPrompt,
      toggleSave,
      openWorkspaceSettings: () => {
      },
      stop,
    }),
    [regenerate, continueReply, editPrompt, toggleSave, stop],
  )

  /* -------------------------------------------------------- attachments */
  const onFiles = useCallback(
    async (files: File[]) => {
      const added: Attachment[] = []
      for (const file of files) {
        const { attachment, warning } = await readAttachment(file)
        added.push(attachment)
        if (warning) toast(warning, 'err')
      }
      if (added.length) {
        setPending((prev) => [...prev, ...added].slice(0, 12))
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [toast],
  )

  const removeAttachment = useCallback((id: string) => {
    setPending((prev) => prev.filter((a) => a.id !== id))
  }, [])

  /* ------------------------------------------------------------ scroll */
  const scrollToBottom = useCallback((smooth = true) => {
    const el = threadRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (!isEmpty && atBottom) scrollToBottom(!busy)
    // streamSig re-triggers this as tokens land, which is what keeps the view
    // pinned to the bottom for the whole response rather than only at the start
  }, [isEmpty, atBottom, busy, streamSig, scrollToBottom])

  const onScroll = () => {
    const el = threadRef.current
    if (!el) return
    setScrolled(el.scrollTop > 8)
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }

  const jumpToLatest = () => {
    setAtBottom(true)
    scrollToBottom()
  }

  /* -------------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const inField =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement

      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        newChat()
        return
      }
      if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        if (isMobile) setDrawer((v) => !v)
        else setCollapsed((v) => !v)
        return
      }
      if (meta && e.key === ',') {
        e.preventDefault()
        setSettingsTab('appearance')
        setSettingsOpen(true)
        return
      }
      if (e.key === '/' && !inField) {
        e.preventDefault()
        if (isMobile) setDrawer(true)
        setTimeout(() => searchRef.current?.focus(), 80)
        return
      }
      if (e.key === 'Escape') {
        if (busy) {
          stop()
          return
        }
        if (preview) {
          setPreview(null)
          return
        }
        if (drawer) setDrawer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, isMobile, drawer, preview, newChat, stop])

  /* --------------------------------------------------------- settings */
  const exportAll = useCallback(() => {
    downloadText(
      exportConversations(conversations),
      `shadowai-conversations-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    )
    toast('Exported')
  }, [conversations, toast])

  const importAll = useCallback(
    async (file: File) => {
      try {
        const parsed = JSON.parse(await file.text()) as { conversations?: Conversation[] }
        const incoming = parsed.conversations
        if (!Array.isArray(incoming)) throw new Error('not a shadowai export')
        setConversations((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]))
          for (const c of incoming) if (c?.id) map.set(c.id, c)
          return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt)
        })
        toast(`Imported ${incoming.length} conversation${incoming.length === 1 ? '' : 's'}`)
      } catch {
        toast('That file is not a ShadowAI export', 'err')
      }
    },
    [toast],
  )

  const clearAll = useCallback(() => {
    const fresh = emptyConversation()
    setConversations([fresh])
    setActiveId(fresh.id)
    toast('All conversations deleted')
  }, [toast])

  const openSettings = useCallback(
    (tab?: string) => {
      if (tab) setSettingsTab(tab as SettingsTab)
      setSettingsOpen(true)
      if (isMobile) setDrawer(false)
    },
    [isMobile],
  )

  /* ----------------------------------------------------------- account */
  const doSignOut = useCallback(async () => {
    stopFlag.current = true
    abortRef.current?.abort()
    setBusy(false)
    setSettingsOpen(false)
    await signOut().catch(() => undefined)
    toast('Signed out')
  }, [toast])

  const finishOnboarding = useCallback(
    async (answers: OnboardingAnswers) => {
      if (!user) return
      await completeOnboarding(user.uid, answers)
      setProfile({
        uid: user.uid,
        email: user.email || '',
        displayName: answers.displayName || user.displayName || '',
        photoURL: user.photoURL || '',
        onboarded: true,
        onboarding: answers,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      })
      setSettings((s) => ({
        ...s,
        account: { displayName: answers.displayName, email: s.account.email },
      }))
      toast('You are all set')
    },
    [user, toast],
  )

  const skipOnboarding = useCallback(async () => {
    if (!user) return
    await completeOnboarding(user.uid, {
      displayName: user.displayName || '',
      role: '',
      heardFrom: '',
      goals: [],
      experience: '',
      interests: [],
      teamSize: '',
      answerStyle: 'Balanced',
      anythingElse: '',
    }).catch(() => undefined)
    setProfile({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      onboarded: true,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    })
  }, [user])

  const displayName = profile?.displayName || settings.account.displayName || ''
  const displayEmail = profile?.email || user?.email || settings.account.email || ''

  /* ------------------------------------------------------------ render */

  if (!authReady) {
    return (
      <div className="gate">
        <div className="gate__card">
          <div className="gate__head">
            <Mark size={56} spin />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return introDismissed ? <AuthGate /> : <IntroPage onEnter={() => setIntroDismissed(true)} />

  if (!profileReady) {
    return (
      <div className="gate">
        <div className="gate__card">
          <div className="gate__head">
            <Mark size={56} spin />
          </div>
        </div>
      </div>
    )
  }

  if (!profile?.onboarded) {
    return (
      <Onboarding
        initial={profile?.onboarding}
        displayNameFallback={user.displayName || undefined}
        onDone={finishOnboarding}
        onSkip={skipOnboarding}
      />
    )
  }

  const run = streamingMessage?.run
  const statusText = !ready
    ? 'Coding agent unavailable — retry in a moment'
    : mode === 'agent'
      ? 'Agent ready · plans, executes, and checks your work'
    : `Chat mode · ${transportLabel(activeProviderConfig)}`

  const busyText = busy
    ? stage
      ? stage
      : run
        ? run.status === 'planning'
          ? 'ShadowAI is planning…'
          : `ShadowAI is working · step ${(run.currentStep ?? 0) + 1} of ${run.steps.length || '…'}`
        : 'ShadowAI is thinking…'
    : statusText

  return (
    <div className="app" data-collapsed={collapsed && !isMobile}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNewChat={newChat}
        onDelete={deleteConversation}
        onRename={renameConversation}
        onArchive={archiveConversation}
        onUnarchive={unarchiveConversation}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((v) => !v)}
        query={search}
        onQuery={setSearch}
        onOpenWorkspace={(tab) => {
          setWorkspaceTab((tab as WorkspaceTab) || 'plugins')
          setWorkspaceOpen(true)
        }}
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode)
          if (isMobile) setDrawer(false)
        }}
        onOpenSettings={openSettings}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        isMobile={isMobile}
        isOpen={drawer}
        onClose={() => setDrawer(false)}
        displayName={displayName}
        email={displayEmail}
        photoURL={profile?.photoURL || ''}
        accent={settings.appearance.accent}
        savedCount={stats.saved}
        searchRef={searchRef}
      />

      <main className={cx('main', showLiveRail && 'has-live-rail')}>
        <header className={cx('topbar', scrolled && 'is-scrolled')}>
          {isMobile ? (
            <button className="icon-btn" onClick={() => setDrawer(true)} type="button" aria-label="Open sidebar">
              <Icon name="menu" size={17} />
            </button>
          ) : null}

          <div className="topbar__title">
            <span className="topbar__name">{messages.length ? conversation?.title : 'ShadowAI'}</span>
            <span className="topbar__meta">
              {busy ? (
                <>
                  <span className="status-dot status-dot--busy" />
                  {busyText}
                </>
              ) : (
                <>
                  <span className={cx('status-dot', !ready && 'status-dot--off')} />
                  {ready ? (
                    <>
                      <span>{activeModelLabel}</span>
                      <span className="topbar__sep" />
                      <span>{mode === 'agent' ? 'Agent' : 'Chat'}</span>
                    </>
                  ) : (
                    <span>Agent unavailable</span>
                  )}
                </>
              )}
            </span>
          </div>

          {!isMobile ? (
            <button
              className="icon-btn"
              onClick={() => setCollapsed((v) => !v)}
              type="button"
              title="Toggle sidebar (⌘B)"
              aria-label="Toggle sidebar"
            >
              <Icon name="panelLeft" size={16} />
            </button>
          ) : null}

          <button className="icon-btn" onClick={newChat} type="button" title="New chat (⌘⇧O)" aria-label="New chat">
            <Icon name="plus" size={17} />
          </button>
        </header>

        {showLiveRail ? (
          <LiveActivityRail
            run={liveRun}
            artifacts={liveArtifacts}
            stage={stage}
            activityEvents={activityEvents}
            busy={busy}
            onStop={busy ? stop : undefined}
            onOpenFile={setPreview}
          />
        ) : null}

        {isEmpty ? (
          <ReferenceWelcome
            displayName={displayName}
            onPrompt={(prompt) => {
              setMode('chat')
              setInput(prompt)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            onMedia={(kind) => {
              setMode('chat')
              setInput(kind === 'image' ? 'Generate an image: ' : 'Generate a video: ')
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          />
        ) : (
          <div className="thread-wrap">
            <div className="thread scroll" ref={threadRef} onScroll={onScroll}>
              <div className="thread__inner">
                {messages.map((m) => (
                  <MessageItem
                    key={m.id}
                    message={m}
                    streaming={busy && m.id === streamingId}
                    isMobile={isMobile}
                    modelLabel={models.find((x) => x.id === m.model)?.label || 'ShadowAI'}
                    showTimestamps={settings.appearance.showTimestamps}
                    onOpenFile={(f) => setPreview(f)}
                    actions={messageActions}
                  />
                ))}
                <div className="thread__bottom-spacer" />
              </div>
            </div>

            {!atBottom ? (
              <button className="jump-btn" onClick={jumpToLatest} type="button">
                <Icon name="arrowDown" size={13} />
                Jump to latest
              </button>
            ) : null}
          </div>
        )}

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => void send(input, pending, mode)}
          onStop={stop}
          busy={busy}
          mode={mode}
          onModeChange={setMode}
          onMediaAction={(kind) => {
            setMode('chat')
            setInput(kind === 'image' ? 'Generate an image: ' : 'Generate a video: ')
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          attachments={pending}
          onFiles={(f) => void onFiles(f)}
          onRemoveAttachment={removeAttachment}
          sendOnEnter={settings.appearance.sendOnEnter}
          ready={ready}
          statusText={statusText}
          busyText={busyText}
          textareaRef={inputRef}
        />
      </main>

      <FilePreview
        file={preview}
        onClose={() => setPreview(null)}
        onDownloadZip={(files) => {
          void import('./lib/zip').then((m) => m.zipArtifacts(files, 'shadowai-files.zip'))
        }}
      />

      <WorkspacePanel
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        initialTab={workspaceTab}
        mediaFiles={mediaLibraryFiles}
        onOpenMedia={setPreview}
        onGenerateMedia={createMedia}
        onUse={(prompt) => {
          setMode('agent')
          setInput(prompt)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        tab={settingsTab}
        settings={settings}
        onTab={setSettingsTab}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
        stats={stats}
        onExport={exportAll}
        onImport={(f) => void importAll(f)}
        onClear={clearAll}
        account={{ displayName, email: displayEmail, photoURL: profile?.photoURL || '', role: profile?.onboarding?.role || '' }}
        onSignOut={doSignOut}
      />

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={cx('toast', t.kind === 'ok' ? 'toast--ok' : 'toast--err')}>
            <Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={13} />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
