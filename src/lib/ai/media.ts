import type { ArtifactFile, ProviderProgress } from './types'

interface MediaEvent {
  type?: string
  stage?: string
  message?: string
  mime?: string
  data_url?: string
  model?: string
  size?: number
  error?: string
}

export type MediaKind = 'image' | 'video'

export async function generateMedia(args: {
  baseUrl: string
  token: string
  kind: MediaKind
  prompt: string
  onProgress?: (event: ProviderProgress) => void
  signal?: AbortSignal
}): Promise<ArtifactFile> {
  const { baseUrl, token, kind, prompt, onProgress, signal } = args
  const endpoint = kind === 'image' ? '/api/generate/image' : '/api/generate/video'
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt }),
    signal,
  })
  if (!response.ok) throw new Error(`Hugging Face ${kind} endpoint returned ${response.status}.`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The Hugging Face media stream did not open.')

  const decoder = new TextDecoder()
  let buffer = ''
  let complete: MediaEvent | null = null
  const handle = (line: string) => {
    if (!line.trim()) return
    let event: MediaEvent
    try { event = JSON.parse(line) as MediaEvent } catch { return }
    if (event.type === 'progress') onProgress?.({ stage: event.stage || 'generating', message: event.message || event.stage || 'Generating…' })
    if (event.type === 'error') throw new Error(event.error || `Hugging Face ${kind} generation failed.`)
    if (event.type === 'complete') complete = event
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    lines.forEach(handle)
  }
  buffer += decoder.decode()
  buffer.split('\n').forEach(handle)
  const result = complete as MediaEvent | null
  if (!result?.data_url) throw new Error(`Hugging Face returned no ${kind} asset.`)

  const extension = kind === 'image' ? 'png' : 'mp4'
  return {
    path: `generated/shadow-${kind}-${Date.now()}.${extension}`,
    language: kind,
    content: result.data_url,
    size: result.size || result.data_url.length,
  }
}
