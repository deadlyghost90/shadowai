import { useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import sql from 'highlight.js/lib/languages/sql'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import ini from 'highlight.js/lib/languages/ini'
import { Icon } from './Icon'
import { copyText, downloadText, cx } from '../lib/utils'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('php', php)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('ini', ini)

const ALIAS: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  yml: 'yaml',
  html: 'xml',
  svg: 'xml',
  vue: 'xml',
  md: 'markdown',
  'c++': 'cpp',
  c: 'cpp',
  h: 'cpp',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  toml: 'ini',
  env: 'ini',
  patch: 'diff',
  dockerfile: 'dockerfile',
}

const EXT: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  json: 'json',
  bash: 'sh',
  css: 'css',
  xml: 'html',
  markdown: 'md',
  yaml: 'yml',
  sql: 'sql',
  java: 'java',
  cpp: 'cpp',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  diff: 'diff',
  dockerfile: 'Dockerfile',
  ini: 'ini',
}

const LINE_THRESHOLD = 14

export function highlight(code: string, lang?: string): { html: string; resolved: string } {
  const raw = (lang || '').toLowerCase().trim()
  const resolved = ALIAS[raw] || raw || 'plaintext'
  if (resolved === 'plaintext' || !hljs.getLanguage(resolved)) {
    return { html: escapeHtml(code), resolved: raw || 'text' }
  }
  try {
    return { html: hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value, resolved }
  } catch {
    return { html: escapeHtml(code), resolved: raw || 'text' }
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function CodeBlock({
  code,
  language,
  filename,
}: {
  code: string
  language?: string
  filename?: string
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { html, resolved } = useMemo(() => highlight(code, language), [code, language])
  const lines = useMemo(() => code.split('\n').length, [code])
  const clamp = !expanded && lines > LINE_THRESHOLD

  const onCopy = async () => {
    const ok = await copyText(code)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  const name = filename || `shadowai.${EXT[resolved] || 'txt'}`

  return (
    <div className={cx('code', expanded && 'is-expanded')}>
      <div className="code__bar">
        <span className="code__lang">{filename || resolved}</span>
        <div className="code__actions">
          <button
            className={cx('code__btn', copied && 'is-on')}
            onClick={onCopy}
            title="Copy code"
            type="button"
          >
            <Icon name={copied ? 'check' : 'copy'} size={12.5} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="code__btn code__btn--icon"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse' : 'Expand'}
            type="button"
            aria-pressed={expanded}
          >
            <Icon name={expanded ? 'minimize' : 'expand'} size={13} />
          </button>
          <button
            className="code__btn code__btn--icon"
            onClick={() => downloadText(code, name, mimeFor(resolved))}
            title="Download"
            type="button"
          >
            <Icon name="download" size={13} />
          </button>
        </div>
      </div>
      <div className="code__pre-wrap" style={{ position: 'relative' }}>
        <pre className={cx('code__pre', clamp && 'code__pre--clamped')}>
          <code className={`hljs language-${resolved}`} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
        {clamp && (
          <div className="code__more">
            <button onClick={() => setExpanded(true)} type="button">
              Show all {lines} lines
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function mimeFor(lang: string): string {
  if (lang === 'json') return 'application/json'
  if (lang === 'xml') return 'text/html'
  if (lang === 'markdown') return 'text/markdown'
  if (lang === 'bash') return 'text/x-sh'
  return 'text/plain'
}
