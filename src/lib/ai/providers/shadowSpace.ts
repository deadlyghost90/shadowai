/**
 * ShadowAI Space provider.
 *
 * Talks to a self-hosted FastAPI backend on Hugging Face Spaces that streams
 * newline-delimited JSON rather than SSE:
 *
 *   {"type":"progress","stage":"analyzing","message":"Analyzing your request…"}
 *   {"type":"token","text":"Hello ","token_num":2}
 *   {"type":"complete","response":"Hello there!","tokens":13,"task_type":"general_chat"}
 *
 * The `progress` events are user-facing stage labels the backend chooses to
 * publish — not internal reasoning — so they can be shown as-is.
 *
 * Request shape is deliberately permissive: the prompt is sent BOTH as
 * `message` (flattened) and as `messages` (structured), so this works whether
 * the backend implements one shape, the other, or both.
 */

import type {
  AIProvider,
  ProviderHealth,
  ProviderMessage,
  ProviderModel,
  ProviderRequest,
  ContentPart,
} from '../types'
import { ProviderError } from '../types'
import type { ProviderConfig } from '../config'

interface SpaceEvent {
  type?: string
  stage?: string
  message?: string
  text?: string
  response?: string
  error?: string | { message?: string }
  task_type?: string
  tokens?: number
  command?: string
  output?: string
  status?: 'started' | 'running' | 'completed' | 'failed'
  kind?: 'stage' | 'command' | 'computer'
}

/** Flattens a structured message list into one prompt string. */
function flatten(messages: ProviderMessage[]): string {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (typeof m.content === 'string') return `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`
      const parts = m.content as ContentPart[]
      const text = parts
        .map((p) => (p.type === 'text' ? p.text : '[image]'))
        .join('\n')
      return `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${text}`
    })
    .join('\n\n')
}

function systemOf(messages: ProviderMessage[]): string | undefined {
  const s = messages.find((m) => m.role === 'system')
  if (!s) return undefined
  return typeof s.content === 'string' ? s.content : s.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n')
}

/**
 * FastAPI surfaces its reason in `{"detail": "..."}`. Surfacing the space's own
 * words is more useful than a generic failure, and it is the backend's message,
 * not a stack trace.
 */
function detailOf(body?: string): string | undefined {
  if (!body) return undefined
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; error?: { message?: string } }
    const d = parsed?.detail ?? parsed?.error?.message
    if (typeof d === 'string' && d.length < 160) return d
  } catch {
    /* not JSON */
  }
  const trimmed = body.trim()
  return trimmed.length < 160 && trimmed ? trimmed : undefined
}

function classify(status: number, body?: string): ProviderError {
  const detail = detailOf(body)

  if (status === 401 || status === 403) {
    const missing = /missing/i.test(detail || '')
    return new ProviderError(
      missing
        ? 'The model space needs a token.'
        : 'The model space rejected this token.',
      'auth',
      missing
        ? 'The internal agent credential was rejected. Contact the deployment owner.'
        : 'The internal agent credential does not match the deployed Space.',
    )
  }
  if (status === 404) {
    return new ProviderError('The model space is not reachable.', 'connection',
      'Check that the deployed coding agent is running, then retry.')
  }
  if (status === 429) {
    return new ProviderError('The model space is rate limiting requests.', 'rate', 'Wait a moment and retry.')
  }
  if (status >= 500) {
    return new ProviderError('The model space returned an error.', 'connection',
      detail ? `The space said: ${detail}` : 'Usually temporary — retry in a moment.')
  }
  return new ProviderError('ShadowAI could not connect to the model.', 'connection', detail)
}

export function createShadowSpaceProvider(cfg: ProviderConfig): AIProvider {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const auth = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (cfg.apiKey) {
      const fmt = cfg.authFormat || 'Bearer {key}'
      h[cfg.authHeader || 'Authorization'] = fmt.includes('{key}')
        ? fmt.replace('{key}', cfg.apiKey).trim()
        : `${fmt}${cfg.apiKey}`
    }
    return h
  }

  return {
    id: 'shadow-space',
    label: 'ShadowAI Space',

    models(): ProviderModel[] {
      return cfg.models.map((m) => ({ id: m.id, label: m.label, source: m.source }))
    },

    async health({ model, signal }): Promise<ProviderHealth> {
      if (!base) return { ok: false, message: 'Internal coding agent endpoint unavailable.', kind: 'connection' }
      try {
        const res = await fetch(`${base}/health`, { headers: auth(), signal })
        if (!res.ok) {
          const err = classify(res.status)
          return { ok: false, message: err.message, kind: err.kind }
        }
        const data = (await res.json()) as { model_loaded?: boolean; loading?: boolean; progress?: string; error?: string }
        if (data.error) return { ok: false, message: data.error, kind: 'model' }
        if (data.loading) return { ok: false, message: 'The model space is still loading…', kind: 'connection' }
        if (data.model_loaded === false) {
          return { ok: false, message: 'The model space is reachable but the model is not loaded.', kind: 'model' }
        }
        return { ok: true, message: `${model || 'Shadow Model'} · ${data.progress || 'ready'}` }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return { ok: true, message: 'Check cancelled.' }
        return { ok: false, message: 'Could not reach the space from this browser.', kind: 'network' }
      }
    },

    async chat(req: ProviderRequest): Promise<void> {
      if (!base) {
        throw new ProviderError('Internal coding agent endpoint unavailable.', 'connection',
          'The internal coding agent endpoint is unavailable.')
      }

      const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')
      const body: Record<string, unknown> = {
        message: flatten(req.messages),
        messages: req.messages,
        model: req.model,
        temperature: req.temperature ?? cfg.temperature,
        max_tokens: req.maxTokens ?? cfg.maxTokens,
      }
      const sys = systemOf(req.messages)
      if (sys) body.system_prompt = sys
      if (lastUser) {
        const c = lastUser.content
        body.prompt = typeof c === 'string' ? c : c.map((p) => (p.type === 'text' ? p.text : '')).join('\n')
      }

      let res: Response
      try {
        res = await fetch(`${base}/api/chat`, {
          method: 'POST',
          headers: auth(),
          body: JSON.stringify(body),
          signal: req.signal,
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        throw new ProviderError('ShadowAI could not reach the model space.', 'network',
          'The browser could not open a connection. Check the URL and your network.')
      }

      if (!res.ok) {
        let text = ''
        try {
          text = await res.text()
        } catch {
          /* unreadable body */
        }
        throw classify(res.status, text)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        // no stream: treat the whole body as one JSON document
        const data = (await res.json()) as SpaceEvent
        const text = data.response || ''
        if (text) req.onDelta(text)
        req.onDone?.(text)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''
      let gotTokens = false

      const handle = (line: string) => {
        const t = line.trim()
        if (!t || (!t.startsWith('{') && !t.startsWith('['))) return
        let ev: SpaceEvent
        try {
          ev = JSON.parse(t) as SpaceEvent
        } catch {
          return
        }
        switch (ev.type) {
          case 'progress':
            if (req.onProgress && ev.stage) {
              req.onProgress({ stage: ev.stage, message: ev.message || ev.stage, kind: ev.kind || 'stage', command: ev.command, output: ev.output, status: ev.status })
            }
            break
          case 'command':
          case 'computer':
            req.onProgress?.({ stage: ev.stage || ev.type, message: ev.message || ev.command || ev.type, kind: ev.kind || ev.type, command: ev.command, output: ev.output, status: ev.status || 'running' })
            break
          case 'token':
            if (typeof ev.text === 'string' && ev.text) {
              gotTokens = true
              full += ev.text
              req.onDelta(ev.text)
            }
            break
          case 'complete':
            // if the stream somehow carried no tokens, use the summary
            if (!gotTokens && typeof ev.response === 'string' && ev.response) {
              full += ev.response
              req.onDelta(ev.response)
            }
            break
          case 'error':
            throw new ProviderError(
              typeof ev.error === 'string' ? ev.error : ev.error?.message || 'The model returned an error.',
              'model',
            )
          default:
            break
        }
      }

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const nl = buffer.lastIndexOf('\n')
          if (nl !== -1) {
            for (const line of buffer.slice(0, nl).split('\n')) handle(line)
            buffer = buffer.slice(nl + 1)
          }
        }
        buffer += decoder.decode()
        for (const line of buffer.split('\n')) handle(line)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        if (e instanceof ProviderError) throw e
        throw new ProviderError('The model stream ended unexpectedly.', 'network')
      }

      req.onDone?.(full)
    },
  }
}
