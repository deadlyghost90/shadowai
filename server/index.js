#!/usr/bin/env node
/**
 * ShadowAI backend (optional)
 * =============================================================================
 * The frontend works with or without this. It exists for one reason: when you
 * connect a model whose key must not sit in a browser, the key lives here
 * instead. The wire format is identical either way, so switching transport is a
 * settings toggle — nothing in the UI changes.
 *
 *   npm run server
 *
 * Configuration (environment):
 *   SHADOWAI_BASE_URL     https://your-endpoint/v1
 *   SHADOWAI_API_KEY      your key
 *   SHADOWAI_MODEL        default model id
 *   SHADOWAI_AUTH_HEADER  default: Authorization
 *   SHADOWAI_AUTH_FORMAT  default: Bearer {key}
 *   PORT                  default: 8787
 *
 * Or drop a `shadowai.config.json` next to this file and it will be read.
 */

import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const config = {}

/* ------------------------------------------------------------- config */

const configPath = join(here, 'shadowai.config.json')
if (existsSync(configPath)) {
  try {
    Object.assign(config, JSON.parse(readFileSync(configPath, 'utf8')))
  } catch (e) {
    console.error('[shadowai] could not read shadowai.config.json:', e.message)
  }
}

const BASE_URL = (process.env.SHADOWAI_BASE_URL || config.baseUrl || '').replace(/\/+$/, '')
const API_KEY = process.env.SHADOWAI_API_KEY || config.apiKey || ''
const DEFAULT_MODEL = process.env.SHADOWAI_MODEL || config.model || ''
const AUTH_HEADER = process.env.SHADOWAI_AUTH_HEADER || config.authHeader || 'Authorization'
const AUTH_FORMAT = process.env.SHADOWAI_AUTH_FORMAT || config.authFormat || 'Bearer {key}'
const PORT = Number(process.env.PORT || 8787)

/* -------------------------------------------------------------- utils */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function json(res, status, body) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 12 * 1024 * 1024) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function authValue() {
  if (!API_KEY) return null
  if (AUTH_FORMAT.includes('{key}')) return AUTH_FORMAT.replace('{key}', API_KEY).trim()
  return `${AUTH_FORMAT}${API_KEY}`
}

function upstreamHeaders() {
  const h = { 'Content-Type': 'application/json' }
  const a = authValue()
  if (a && AUTH_HEADER) h[AUTH_HEADER] = a
  return h
}

/* ------------------------------------------------------------- routes */

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res)
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/api/health') {
    const model = url.searchParams.get('model') || DEFAULT_MODEL
    if (!BASE_URL) {
      return json(res, 200, {
        ok: false,
        message: 'No base URL configured. Set SHADOWAI_BASE_URL and restart.',
      })
    }
    try {
      const r = await fetch(`${BASE_URL}/models`, { headers: upstreamHeaders() })
      return json(res, 200, {
        ok: r.ok,
        message: r.ok
          ? `Backend connected · ${model || 'no default model'}`
          : `Backend rejected the request (HTTP ${r.status}).`,
      })
    } catch (e) {
      return json(res, 200, { ok: false, message: `Could not reach ${BASE_URL}: ${e.message}` })
    }
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    if (!BASE_URL) {
      return json(res, 400, { error: 'No base URL configured on the ShadowAI backend.' })
    }

    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch (e) {
      return json(res, 400, { error: `Invalid request body: ${e.message}` })
    }

    const model = payload.model || DEFAULT_MODEL
    if (!model) return json(res, 400, { error: 'No model specified.' })

    const body = JSON.stringify({
      model,
      messages: payload.messages,
      temperature: payload.temperature,
      max_tokens: payload.maxTokens,
      stream: payload.stream !== false,
    })

    let upstream
    try {
      upstream = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: upstreamHeaders(),
        body,
      })
    } catch (e) {
      return json(res, 502, { error: `Could not reach the model: ${e.message}` })
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      return json(res, upstream.status, { error: detail || `Upstream HTTP ${upstream.status}` })
    }

    cors(res)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const abort = new AbortController()
    req.on('close', () => abort.abort())

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const idx = buffer.lastIndexOf('\n\n')
        if (idx === -1) continue
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        for (const line of block.split('\n')) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed?.error) {
              send({ error: parsed.error.message || String(parsed.error) })
              continue
            }
            const delta = parsed?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) send({ delta })
          } catch {
            /* partial frame */
          }
        }
      }
    } catch (e) {
      if (!abort.signal.aborted) send({ error: e.message })
    }

    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`\n  ShadowAI backend listening on http://localhost:${PORT}`)
  if (BASE_URL) {
    console.log(`  upstream   ${BASE_URL}`)
    console.log(`  model      ${DEFAULT_MODEL || '(chosen per request)'}`)
    console.log(`  key        ${API_KEY ? 'loaded from environment' : 'not set'}`)
  } else {
    console.log('  upstream   not configured — set SHADOWAI_BASE_URL to enable chat')
  }
  console.log('  set transport to "ShadowAI backend" in Settings → Model\n')
})
