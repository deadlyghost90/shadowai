/**
 * OpenAI-compatible streaming provider.
 *
 * One implementation covers the overwhelming majority of modern endpoints:
 *   • OpenAI-compatible gateways (OpenRouter, Together, Groq, Fireworks, DeepInfra, vLLM…)
 *   • Hugging Face Inference / TGI routers that expose /v1/chat/completions
 *   • Local runtimes — Ollama, LM Studio, llama.cpp server, LocalAI, text-generation-webui
 *   • Anything self-hosted that follows the same schema
 *
 * Nothing else in the app needs to change when a new backend is added — see
 * `createProvider` in ./index.ts.
 */

import type {
  AIProvider,
  ProviderHealth,
  ProviderModel,
  ProviderRequest,
} from '../types'
import { ProviderError } from '../types'
import type { ProviderConfig } from '../config'

interface StreamDelta {
  choices?: { delta?: { content?: string | null } }[]
}

interface NonStreamResponse {
  choices?: { message?: { content?: string | null } }[]
  model?: string
  error?: { message?: string; type?: string }
}

function buildHeaders(cfg: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey && cfg.authHeader) {
    const fmt = cfg.authFormat || 'Bearer {key}'
    const value = fmt.includes('{key}') ? fmt.replace('{key}', cfg.apiKey) : `${fmt}${cfg.apiKey}`
    if (value.trim()) headers[cfg.authHeader] = value.trim()
  }
  if (cfg.headersJson.trim()) {
    try {
      const extra = JSON.parse(cfg.headersJson) as Record<string, string>
      for (const [k, v] of Object.entries(extra)) if (k && v) headers[k] = v
    } catch {
      /* user is mid-typing — ignore malformed JSON rather than break the request */
    }
  }
  return headers
}

function normaliseBase(base: string): string {
  return base.replace(/\/+$/, '')
}

function classify(status: number, body?: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('ShadowAI could not authenticate with your model.', 'auth',
      'Check the API key and auth header in Settings → Connection.')
  }
  if (status === 404) {
    return new ProviderError('ShadowAI could not reach that model endpoint.', 'model',
      'Check the base URL and that the model id exists.')
  }
  if (status === 429) {
    return new ProviderError('Your model endpoint is rate limiting requests.', 'rate',
      'Wait a moment and try again.')
  }
  if (status >= 500) {
    return new ProviderError('The model backend returned an error.', 'connection',
      'This is usually temporary — retry in a moment.')
  }
  return new ProviderError('ShadowAI could not connect to the model.', 'connection', body?.slice(0, 200))
}

export function createOpenAICompatibleProvider(cfg: ProviderConfig): AIProvider {
  const base = normaliseBase(cfg.baseUrl)

  return {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',

    models(): ProviderModel[] {
      return cfg.models.map((m) => ({ id: m.id, label: m.label, source: m.source }))
    },

    async health({ model, signal }): Promise<ProviderHealth> {
      if (!base) {
        return { ok: false, message: 'No model endpoint configured.', kind: 'connection' }
      }
      try {
        const res = await fetch(`${base}/models`, {
          headers: buildHeaders(cfg),
          signal,
        })
        if (res.ok) return { ok: true, message: `Connected · ${model || 'no model selected'}` }
        const err = classify(res.status)
        return { ok: false, message: err.message, kind: err.kind }
      } catch (e) {
        const aborted = (e as Error)?.name === 'AbortError'
        return {
          ok: false,
          message: aborted
            ? 'Check cancelled.'
            : 'Could not reach the endpoint from this browser. CORS may be blocking it.',
          kind: aborted ? 'unknown' : 'network',
        }
      }
    },

    async chat(req: ProviderRequest): Promise<void> {
      if (!base) {
        throw new ProviderError('No model endpoint configured yet.', 'connection',
          'Open Settings → Connection to connect Shadow Space.')
      }

      const body: Record<string, unknown> = {
        model: req.model,
        messages: req.messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        stream: cfg.stream,
      }
      if (!cfg.stream) body.stream = false

      let res: Response
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: buildHeaders(cfg),
          body: JSON.stringify(body),
          signal: req.signal,
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        throw new ProviderError('ShadowAI could not connect to the model.', 'network',
          'The browser could not open a connection. Check the base URL, CORS, and network.')
      }

      if (!res.ok) {
        let text = ''
        try {
          text = await res.text()
        } catch {
          /* body already consumed or unreadable */
        }
        throw classify(res.status, text)
      }

      // ---- non-streaming fallback -------------------------------------------
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        let json: NonStreamResponse
        try {
          json = (await res.json()) as NonStreamResponse
        } catch {
          throw new ProviderError('The model returned a response ShadowAI could not read.', 'unknown')
        }
        if (json?.error?.message) {
          throw new ProviderError(json.error.message, 'model')
        }
        const text = json?.choices?.[0]?.message?.content ?? ''
        if (text) req.onDelta(text)
        req.onDone?.(text)
        return
      }

      // ---- SSE stream --------------------------------------------------------
      const reader = res.body?.getReader()
      if (!reader) throw new ProviderError('The model stream could not be opened.', 'network')

      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''

      const drain = (block: string) => {
        for (const rawLine of block.split('\n')) {
          const line = rawLine.trim()
          if (!line) continue
          if (line.startsWith(':')) continue
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as StreamDelta & { error?: { message?: string } }
            if (parsed?.error?.message) {
              throw new ProviderError(parsed.error.message, 'model')
            }
            const delta = parsed?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              full += delta
              req.onDelta(delta)
            }
          } catch (e) {
            if (e instanceof ProviderError) throw e
            /* partial frame — ignore, the next line completes it */
          }
        }
      }

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const idx = buffer.lastIndexOf('\n\n')
          if (idx !== -1) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            drain(block)
          }
        }
        buffer += decoder.decode()
        if (buffer.trim()) drain(buffer)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        if (e instanceof ProviderError) throw e
        throw new ProviderError('The model stream ended unexpectedly.', 'network')
      }

      req.onDone?.(full)
    },
  }
}

/** Extract a friendly one-line reason from a fetch/SSE failure. */
export function describeError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e
  if ((e as Error)?.name === 'AbortError') {
    return new ProviderError('Generation stopped.', 'unknown')
  }
  const msg = (e as Error)?.message || ''
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return new ProviderError('ShadowAI could not connect to the model.', 'network',
      'The browser could not open a connection — check the base URL and CORS.')
  }
  return new ProviderError('Something went wrong while talking to the model.', 'unknown')
}
