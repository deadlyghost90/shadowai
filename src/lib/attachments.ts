/**
 * Attachment intake.
 *
 * Reads a File into the compact shape the conversation uses, and — where it is
 * genuinely possible — extracts text so the model can actually read it:
 *
 *   images  → data URL (vision-capable models read them directly)
 *   text-ish → read as UTF-8
 *   .docx   → unzipped and stripped to text via JSZip
 *   .pdf    → text layer extracted lazily with pdf.js
 *   .zip    → index of entries only (contents are not unpacked)
 *
 * When text cannot be extracted we say so rather than pretending.
 */

import type { Attachment, AttachmentKind } from './ai/types'
import { uid, formatBytes } from './utils'

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_FILES = 12

const EXT_MAP: Record<string, AttachmentKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  pdf: 'pdf',
  txt: 'text',
  md: 'text',
  markdown: 'text',
  log: 'text',
  csv: 'sheet',
  tsv: 'sheet',
  json: 'json',
  jsonl: 'json',
  yaml: 'json',
  yml: 'json',
  docx: 'doc',
  doc: 'doc',
  pptx: 'doc',
  zip: 'archive',
}

const CODE_EXT = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h',
  'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'sql', 'html', 'htm', 'css', 'scss',
  'vue', 'svelte', 'toml', 'ini', 'env', 'gitignore', 'dockerfile', 'makefile', 'gradle',
])

export function classify(name: string, mime: string): AttachmentKind {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('zip') || mime.includes('compressed')) return 'archive'
  if (mime.startsWith('text/') || mime === 'application/json') {
    if (ext === 'csv' || ext === 'tsv') return 'sheet'
    if (ext === 'json' || ext === 'yaml' || ext === 'yml') return 'json'
    return 'text'
  }
  if (CODE_EXT.has(ext)) return 'code'
  const mapped = EXT_MAP[ext]
  return mapped || 'other'
}

export function extOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : ''
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsText(file)
  })
}

async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsArrayBuffer(file)
  })
}

async function docxToText(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await readArrayBuffer(file))
  const entry = zip.file('word/document.xml')
  if (!entry) return ''
  const xml = await entry.async('string')
  return xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const data = await readArrayBuffer(file)
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise
  const pages: string[] = []
  const max = Math.min(doc.numPages, 40)
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    let lastY: number | null = null
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue
      const y = item.transform?.[5] ?? null
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        pages.push(line)
        line = ''
      }
      line += item.str
      if ('hasEOL' in item && item.hasEOL) {
        pages.push(line)
        line = ''
      }
      lastY = y
    }
    if (line) pages.push(line)
    page.cleanup()
  }
  const text = pages.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text.length
    ? text + (doc.numPages > max ? `\n\n[extracted first ${max} of ${doc.numPages} pages]` : '')
    : ''
}

async function zipIndex(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await readArrayBuffer(file))
  const names = Object.keys(zip.files).slice(0, 200)
  const total = Object.keys(zip.files).length
  return `${names.join('\n')}${total > 200 ? `\n… and ${total - 200} more` : ''}`
}

export interface ReadResult {
  attachment: Attachment
  warning?: string
}

export async function readAttachment(file: File): Promise<ReadResult> {
  const kind = classify(file.name, file.type)
  const base: Attachment = {
    id: uid('att'),
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    kind,
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      attachment: { ...base, text: '' },
      warning: `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_FILE_BYTES)}.`,
    }
  }

  try {
    if (kind === 'image') {
      const dataUrl = await readAsDataURL(file)
      return { attachment: { ...base, dataUrl } }
    }

    if (kind === 'pdf') {
      const text = await pdfToText(file)
      if (!text) {
        return {
          attachment: { ...base, text: '' },
          warning: `${file.name} has no extractable text layer — it looks like a scan.`,
        }
      }
      return { attachment: { ...base, text } }
    }

    if (kind === 'archive') {
      const index = await zipIndex(file)
      return { attachment: { ...base, text: `Archive contents:\n${index}` } }
    }

    if (kind === 'doc' && extOf(file.name) === 'docx') {
      const text = await docxToText(file)
      if (!text) {
        return {
          attachment: { ...base, text: '' },
          warning: `${file.name} could not be parsed.`,
        }
      }
      return { attachment: { ...base, text } }
    }

    if (['text', 'code', 'json', 'sheet', 'other'].includes(kind)) {
      const text = await readAsText(file)
      return { attachment: { ...base, text } }
    }

    return { attachment: { ...base, text: '' } }
  } catch (e) {
    return {
      attachment: { ...base, text: '' },
      warning: `ShadowAI attached ${file.name} but could not read it (${(e as Error)?.message ?? 'unknown error'}).`,
    }
  }
}

export const ACCEPTED =
  'images,pdf,txt,md,csv,tsv,json,yaml,yml,docx,zip,js,jsx,ts,tsx,py,rb,go,rs,java,c,cc,cpp,h,hpp,cs,php,sh,sql,html,css,scss,vue,svelte,toml,ini'
