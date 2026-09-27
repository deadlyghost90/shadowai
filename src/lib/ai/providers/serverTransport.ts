/**
 * Server transport.
 *
 * Talks to the bundled ShadowAI backend (`server/index.js`) instead of hitting a
 * vendor directly from the browser. The backend holds the credential, so the key
 * never lands in the client. The wire format is identical, so switching between
 * `direct` and `server` is a settings toggle — the app behaves the same.
 */

import type {
  AIProvider,
  ProviderHealth,
  ProviderModel,
  ProviderRequest,
} from '../types'
import { ProviderError } from '../types'
import type { ProviderConfig } from '../config'

export function createServerProvider(cfg: ProviderConfig, apiBase = ''): AIProvider {
  const base = apiBase.replace(/\/+$/, '') || ''

  return {
    id: 'shadowai-server',
    label: 'ShadowAI backend',

    models(): ProviderModel[] {
      return cfg.models.map((m) => ({ id: m.id, label: m.label, source: m.source }))
    },

    async health({ model, signal }): Promise<ProviderHealth> {
      try {
        const res = await fetch(`${base}/api/health?model=${encodeURIComponent(model)}`, { signal })
        if (!res.ok) return { ok: false, message: 'Backend is not responding.', kind: 'connection' }
        const data = (await res.json()) as ProviderHealth
        return data
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return { ok: true, message: 'Check cancelled.' }
        return {
          ok: false,
          message: 'ShadowAI backend is not reachable.',
          kind: 'connection',
        }
      }
    },

    async chat(req: ProviderRequest): Promise<void> {
      let res: Response
      try {
        res = await fetch(`${base}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            temperature: cfg.temperature,
            maxTokens: cfg.maxTokens,
            stream: cfg.stream,
          }),
          signal: req.signal,
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        throw new ProviderError('ShadowAI could not reach its backend.', 'network',
          'Start it with `npm run server` or switch transport to Direct in Settings → Model.')
      }

      if (!res.ok) {
        let detail = ''
        try {
          detail = (await res.json())?.error || ''
        } catch {
          /* not json */
        }
        if (res.status === 401 || res.status === 403) {
          throw new ProviderError('ShadowAI could not authenticate with your model.', 'auth', detail)
        }
        if (res.status === 400) {
          throw new ProviderError('The backend rejected the request.', 'model', detail)
        }
        throw new ProviderError('ShadowAI could not connect to the model.', 'connection', detail)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        const json = (await res.json()) as { content?: string }
        const text = json.content || ''
        if (text) req.onDelta(text)
        req.onDone?.(text)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) throw new ProviderError('The model stream could not be opened.', 'network')
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''

      const handle = (line: string) => {
        if (!line.startsWith('data:')) return
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') return
        try {
          const parsed = JSON.parse(data) as { delta?: string; error?: string }
          if (parsed.error) throw new ProviderError(parsed.error, 'model')
          if (typeof parsed.delta === 'string' && parsed.delta) {
            full += parsed.delta
            req.onDelta(parsed.delta)
          }
        } catch (e) {
          if (e instanceof ProviderError) throw e
        }
      }

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const idx = buffer.lastIndexOf('\n')
          if (idx !== -1) {
            for (const line of buffer.slice(0, idx).split('\n')) handle(line)
            buffer = buffer.slice(idx + 1)
          }
        }
        buffer += decoder.decode()
        if (buffer.trim()) for (const line of buffer.split('\n')) handle(line)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        if (e instanceof ProviderError) throw e
        throw new ProviderError('The model stream ended unexpectedly.', 'network')
      }

      req.onDone?.(full)
    },
  }
}
