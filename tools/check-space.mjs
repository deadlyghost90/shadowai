#!/usr/bin/env node
/**
 * ShadowAI — model space doctor.
 *
 * Checks the configured Space end to end and tells you exactly which link in the
 * chain is broken, so you are not guessing from a UI error.
 *
 *   node tools/check-space.mjs
 *   SPACE_TOKEN=hf_… node tools/check-space.mjs
 *   SPACE_URL=https://your-space.hf.space node tools/check-space.mjs
 *
 * Reads `.env` by default so you can just run it after editing the file.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/** minimal .env reader — no dependency, no surprises */
function readEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = readEnv(join(root, '.env'))
const URL_BASE = process.env.SPACE_URL || env.VITE_SHADOW_SPACE_URL || ''
const TOKEN = process.env.SPACE_TOKEN || env.VITE_SHADOW_SPACE_TOKEN || ''

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`
const warn = (s) => `\x1b[33m!\x1b[0m ${s}`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

let failures = 0

function fail(s) {
  failures++
  console.log(bad(s))
}

/**
 * The runtime hostname is `{owner}-{name}.hf.space`, but the API wants
 * `owner/name`. Owners may contain dashes too, so splitting on the first one
 * is a guess — HF hands us the exact answer in a `link:` header on the space
 * root, and we only fall back to guessing if that is missing.
 */
async function resolveSlug(base) {
  try {
    const res = await fetch(`${base}/`, { method: 'GET', redirect: 'manual' })
    const link = res.headers.get('link') || ''
    const m = /https:\/\/huggingface\.co\/spaces\/([^>\s]+)/.exec(link)
    if (m) return m[1]
  } catch {
    /* fall through */
  }
  const host = (() => { try { return new URL(base).hostname } catch { return '' } })()
  const m = /^([^-]+)-(.+)\.hf\.space$/.exec(host)
  return m ? `${m[1]}/${m[2]}` : ''
}

async function main() {
  console.log('\n  ShadowAI — model space doctor\n')

  if (!URL_BASE) {
    fail('No space URL. Set VITE_SHADOW_SPACE_URL in .env or pass SPACE_URL=…')
    return
  }
  const base = URL_BASE.replace(/\/+$/, '')
  console.log(`  ${dim('space')}  ${base}`)
  console.log(`  ${dim('token')}  ${TOKEN ? `${TOKEN.slice(0, 9)}…${TOKEN.slice(-4)} (${TOKEN.length} chars)` : '— not set —'}\n`)

  /* 1. the space exists and is running ------------------------------------- */
  const slug = await resolveSlug(base)
  if (slug) {
    const meta = await fetch(`https://huggingface.co/api/spaces/${slug}`, { method: 'GET' }).catch(() => null)
    if (meta?.ok) {
      const j = await meta.json()
      const running = j?.runtime?.stage === 'RUNNING'
      console.log(`  ${dim('path ')}  ${slug}`)
      if (j?.private) fail('The space is PRIVATE. Anyone without access gets a 404. Make it public, or send a token that has been granted access.')
      else console.log(ok(`space is public · ${j?.sdk} · ${j?.runtime?.hardware?.current ?? 'cpu'}`))
      if (running) console.log(ok(`runtime is ${j.runtime.stage} (domain ${j.runtime.domains?.[0]?.stage ?? '?'})`))
      else console.log(warn(`runtime stage is "${j?.runtime?.stage}" — a cold Space wakes on first request, give it a minute`))
    } else {
      console.log(warn(`could not read metadata for ${slug} (offline, or the space was renamed)`))
    }
  }

  /* 2. the health endpoint -------------------------------------------------- */
  let health = null
  try {
    const res = await fetch(`${base}/health`, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} })
    const body = await res.text()
    if (res.ok) {
      health = JSON.parse(body)
      if (health.model_loaded) console.log(ok(`model loaded — ${health.progress ?? 'ready'}`))
      else if (health.loading) console.log(warn('model is still loading'))
      else fail(`health ok but the model is not loaded: ${body.slice(0, 120)}`)
    } else {
      fail(`GET /health → ${res.status} ${body.slice(0, 100).replace(/\n/g, ' ')}`)
    }
  } catch (e) {
    fail(`GET /health could not connect — ${e.message}`)
  }

  /* 3. can we actually talk to it ------------------------------------------- */
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  let res
  try {
    res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Reply with the single word: ready' }),
    })
  } catch (e) {
    fail(`POST /api/chat could not connect — ${e.message}`)
    return
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let detail = body
    try {
      detail = JSON.parse(body)?.detail ?? body
    } catch { /* plain text */ }
    if (res.status === 401) {
      fail(`401 "${detail}" — the space requires a token and none was accepted. Set VITE_SHADOW_SPACE_TOKEN.`)
    } else if (res.status === 403) {
      fail(`403 "${detail}" — the space rejected the token. It must match the value configured in the Space's own environment/settings.`)
    } else {
      fail(`POST /api/chat → ${res.status} ${String(detail).slice(0, 120)}`)
    }
    console.log(dim('\n  Hugging Face also validates the token itself:'))
    const who = await fetch('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${TOKEN}` } })
    console.log(dim(`  GET /api/whoami-v2 → ${who.status} ${who.status === 200 ? '(token is a valid HF token)' : '(HF does not recognise this token)'}`))
    console.log(`\n  \x1b[31m${failures} problem(s) above.\x1b[0m Fix them and run this again.\n`)
    process.exit(1)
  }

  /* 4. does the stream look like we expect? --------------------------------- */
  const text = await res.text()
  const events = text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const kinds = [...new Set(events.map((e) => e.type))].join(', ')
  const complete = events.find((e) => e.type === 'complete')
  const tokens = events.filter((e) => e.type === 'token').length
  const stages = [...new Set(events.filter((e) => e.type === 'progress').map((e) => e.stage))].join(' → ')

  console.log(ok(`POST /api/chat → 200 · events: ${kinds}`))
  if (stages) console.log(`    ${dim('stages')}  ${stages}`)
  if (complete) {
    console.log(ok(`complete — ${complete.tokens} tokens, task "${complete.task_type}"`))
    console.log(`    ${dim('reply')}` + dim(`  ${String(complete.response).slice(0, 140).replace(/\n/g, ' ')}`))
  }
  if (!tokens) console.log(warn('no token events — the space may answer in one shot instead of streaming'))

  console.log(
    failures === 0
      ? `\n  \x1b[32mSpace is healthy.\x1b[0m ShadowAI will stream from it as-is.\n`
      : `\n  \x1b[31m${failures} problem(s) above.\x1b[0m Fix them and run this again.\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(bad(`doctor crashed: ${e.message}`))
  process.exit(1)
})
