/**
 * Artifact extraction.
 *
 * A model that produces files does it with ordinary fenced blocks tagged
 * `file:<path>`. That keeps the protocol inside normal markdown, so the same
 * text still renders sensibly if it is copied out of ShadowAI.
 *
 * While a block is still streaming it is withheld from the markdown renderer
 * and reported as `pending`, which is what powers the "writing index.html"
 * affordance instead of a half-drawn code block.
 */

import type { ArtifactFile } from './types'

export interface ParseResult {
  /** text with file blocks removed, safe to feed to the markdown renderer */
  text: string
  artifacts: ArtifactFile[]
  /** path currently being streamed, if any */
  pendingPath?: string
}

const OPEN = /```file:([^\s`]+)[^\n]*\n?/g

function guessLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    html: 'html',
    htm: 'html',
    css: 'css',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    svg: 'xml',
    xml: 'xml',
    txt: 'text',
    csv: 'text',
    env: 'bash',
    dockerfile: 'dockerfile',
  }
  return map[ext] || 'text'
}

function normalisePath(p: string): string {
  const cleaned = p.trim().replace(/^\.?\//, '').replace(/[\\]+/g, '/')
  return cleaned || 'untitled.txt'
}

export function parseArtifacts(content: string): ParseResult {
  const artifacts: ArtifactFile[] = []
  let pendingPath: string | undefined
  let out = ''
  let cursor = 0
  OPEN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = OPEN.exec(content))) {
    out += content.slice(cursor, match.index)
    const path = normalisePath(match[1])
    const bodyStart = match.index + match[0].length
    const closeIdx = content.indexOf('```', bodyStart)

    if (closeIdx === -1) {
      // still streaming — keep it out of the visible markdown
      pendingPath = path
      cursor = content.length
      OPEN.lastIndex = content.length
      break
    }

    const body = content.slice(bodyStart, closeIdx)
    artifacts.push({
      path,
      language: guessLanguage(path),
      content: body.replace(/\s+$/, '\n'),
      size: new Blob([body]).size,
    })
    cursor = closeIdx + 3
    OPEN.lastIndex = cursor
  }

  out += content.slice(cursor)
  return { text: out.replace(/\n{3,}/g, '\n\n').trimEnd(), artifacts, pendingPath }
}

/** Merge newly-parsed artifacts into an existing list without duplicates. */
export function mergeArtifacts(existing: ArtifactFile[], incoming: ArtifactFile[]): ArtifactFile[] {
  const map = new Map(existing.map((a) => [a.path, a]))
  for (const a of incoming) {
    const prev = map.get(a.path)
    map.set(a.path, prev && prev.content.length >= a.content.length ? prev : a)
  }
  return [...map.values()]
}

export function safeFileName(path: string): string {
  return normalisePath(path).split('/').pop() || 'file'
}
