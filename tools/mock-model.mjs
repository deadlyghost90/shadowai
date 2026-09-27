#!/usr/bin/env node
/**
 * ShadowAI mock model — a development aid, not part of the app.
 *
 * Speaks BOTH wire formats ShadowAI supports, so you can exercise the whole
 * product before connecting a real model:
 *
 *   OpenAI-compatible   http://localhost:8899/v1/chat/completions   (SSE)
 *   Space-compatible    http://localhost:8899/api/chat              (NDJSON)
 *
 *   node tools/mock-model.mjs
 *
 * Then in ShadowAI → Settings → Model pick either source, point it at
 * http://localhost:8899 and use model id `shadow-large`.
 *
 * It answers three request shapes: a planner request gets a JSON step list,
 * an agent step gets output containing file blocks, anything else gets
 * markdown with a table and a code block.
 */

import http from 'node:http'

const PORT = Number(process.env.MOCK_PORT || 8899)

/** Fences are built at runtime so this file contains no nested backticks. */
const F = '`'.repeat(3)

const CHAT_REPLY = [
  '## The short version',
  '',
  "A landing page for ShadowMotion should do **one** job: get a developer to start a",
  'conversation. Everything else is optional.',
  '',
  '| Section | Purpose | Height |',
  '| --- | --- | --- |',
  '| Hero | State the promise | 100vh |',
  '| Proof | Three logos | auto |',
  '| CTA | One button | 60vh |',
  '',
  F + 'javascript',
  'export function debounce(fn, wait = 200) {',
  '  let timer',
  '  return (...args) => {',
  '    clearTimeout(timer)',
  '    timer = setTimeout(() => fn(...args), wait)',
  '  }',
  '}',
  F,
  '',
  '> Ship the narrow version first.',
  '',
  '- [x] Hero copy',
  '- [ ] Proof section',
  '- [ ] CTA',
].join('\n')

const AGENT_REPLY = [
  'Here is the page.',
  '',
  F + 'file:index.html',
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="utf-8" />',
  '    <link rel="stylesheet" href="style.css" />',
  '  </head>',
  '  <body>',
  '    <main>',
  '      <h1>ShadowMotion</h1>',
  '      <p>Build in the dark.</p>',
  '      <a href="#start">Start a conversation</a>',
  '    </main>',
  '    <script src="script.js"></script>',
  '  </body>',
  '</html>',
  F,
  '',
  F + 'file:style.css',
  ':root { --bg: #0b0f0d; --fg: #ffffff; --accent: #22c55e; }',
  'body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; }',
  'a { color: var(--accent); }',
  F,
  '',
  F + 'file:script.js',
  "document.querySelector('a')?.addEventListener('click', (e) => {",
  "  e.preventDefault()",
  "  console.log('Start a conversation')",
  '})',
  F,
  '',
  'Open `index.html` to preview it, or download the bundle.',
].join('\n')

const PLAN = '["Planning structure", "Creating files", "Wiring interactions", "Testing the build"]'

const HEALTH = {
  model_loaded: true,
  loading: false,
  progress: 'Model loaded successfully',
  error: null,
}

const STAGES = [
  ['analyzing', 'Analyzing your request...'],
  ['detected', 'Task detected: general_chat'],
  ['thinking', 'Thinking about the best response...'],
  ['generating', 'Generating response...'],
]

/** Exactly the NDJSON envelope the ShadowAI Space emits. */
function streamSpaceFormat(res, text, delay = 22) {
  const write = (obj) => res.write(JSON.stringify(obj) + '\n')
  for (const [stage, message] of STAGES) {
    write({ type: 'progress', stage, message, timestamp: new Date().toISOString() })
  }
  const words = text.match(/\S+\s*/g) || []
  let i = 0
  const timer = setInterval(() => {
    if (i >= words.length) {
      clearInterval(timer)
      write({
        type: 'complete',
        response: text,
        tokens: words.length,
        task_type: 'general_chat',
        timestamp: new Date().toISOString(),
      })
      res.end()
      return
    }
    write({ type: 'token', text: words[i++], token_num: i })
  }, delay)
  res.on('close', () => clearInterval(timer))
}

function pickReply(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const probe = typeof last === 'string' ? last : JSON.stringify(last)
  if (probe.includes('JSON array of strings')) return PLAN
  if (probe.includes('Execute')) return AGENT_REPLY
  return CHAT_REPLY
}

const server = http.createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  const path = (req.url || '/').split('?')[0]

  if (path === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(HEALTH))
  }

  if (path === '/v1/models') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'shadow-large' }, { id: 'shadow-fast' }] }))
  }

  if (req.method !== 'POST') {
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: { message: 'Not found' } }))
  }

  let raw = ''
  for await (const chunk of req) raw += chunk

  let payload = {}
  try {
    payload = JSON.parse(raw || '{}')
  } catch {
    res.writeHead(400, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }))
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : []
  const text = pickReply(messages)

  if (path === '/api/chat') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' })
    return streamSpaceFormat(res, text)
  }

  if (!path.startsWith('/v1/chat/completions')) {
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: { message: 'Not found' } }))
  }

  if (payload.stream === false) {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    return res.end(
      JSON.stringify({
        id: 'mock',
        model: payload.model,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      }),
    )
  }

  res.writeHead(200, {
    ...cors,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  const words = text.match(/\S+\s*/g) || []
  let i = 0
  const timer = setInterval(() => {
    if (i >= words.length) {
      clearInterval(timer)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    res.write(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: words[i++] }, finish_reason: null }] })}\n\n`,
    )
  }, 22)
  res.on('close', () => clearInterval(timer))
})

server.listen(PORT, () => {
  console.log(`\n  ShadowAI mock model listening on http://localhost:${PORT}`)
  console.log(`  Space format        http://localhost:${PORT}          (/health, /api/chat)`)
  console.log(`  OpenAI-compatible   http://localhost:${PORT}/v1       (/v1/chat/completions)\n`)
})
