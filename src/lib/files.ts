import { copyText, downloadBlob, downloadText, formatBytes, uid } from './utils'
import type { ArtifactFile } from './ai/types'

export { copyText, downloadBlob, downloadText, formatBytes, uid }

/** Last path segment, safe to hand to the download attribute. */
export function safeName(path: string): string {
  const name = path.split('/').pop() || 'file'
  return name.replace(/[^\w.\-]+/g, '_')
}

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  md: 'text/markdown',
  csv: 'text/csv',
  yml: 'text/yaml',
  yaml: 'text/yaml',
  py: 'text/x-python',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  sh: 'text/x-sh',
  xml: 'text/xml',
}

/** Shared assets (style.css referenced by index.html) are collected on the fly. */
function collectLocalRefs(content: string): string[] {
  const out: string[] = []
  const re = /(?:src|href)\s*=\s*["']([^"'>]+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    const v = m[1].trim()
    if (!v || v.startsWith('#') || /^(https?:)?\/\//i.test(v) || v.startsWith('data:')) continue
    out.push(v.replace(/^\.?\//, ''))
  }
  return out
}

export async function zipArtifacts(files: ArtifactFile[], name = 'shadowai-files.zip'): Promise<void> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const seen = new Set<string>()

  for (const f of files) {
    if (seen.has(f.path)) continue
    seen.add(f.path)
    zip.file(f.path, f.content)
  }

  // If the bundle contains an entry document, pull in the siblings it needs so
  // the ZIP opens and runs rather than 404ing on a missing stylesheet.
  const entry = files.find((f) => /(^|\/)(index|main)\.html?$/i.test(f.path))
  if (entry) {
    const refs = collectLocalRefs(entry.content)
    for (const ref of refs) {
      if (seen.has(ref)) continue
      const match = files.find((f) => f.path === ref || f.path.endsWith(`/${ref}`))
      if (match) {
        seen.add(ref)
        zip.file(ref, match.content)
      }
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, name)
}

export function guessMime(path: string): string {
  const ext = (path.split('.').pop() || '').toLowerCase()
  return MIME[ext] || 'text/plain'
}
