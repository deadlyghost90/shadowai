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

const FREE_VIDEO_SPACE = 'https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space'

function parseNdjson(text: string): MediaEvent[] {
  return text.split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line) as MediaEvent } catch { return null }
  }).filter((event): event is MediaEvent => Boolean(event))
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((response) => response.blob())
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return `data:${blob.type || 'video/mp4'};base64,${btoa(binary)}`
}

async function generateFreeVideo(args: {
  baseUrl: string
  token: string
  prompt: string
  onProgress?: (event: ProviderProgress) => void
  signal?: AbortSignal
}): Promise<ArtifactFile> {
  const { baseUrl, token, prompt, onProgress, signal } = args
  onProgress?.({ stage: 'preparing', message: 'Preparing a visual frame for the video…' })

  const frameResponse = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/generate/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: `${prompt}. Create a strong cinematic still frame for a short motion sequence.` }),
    signal,
  })
  if (!frameResponse.ok) throw new Error(`Could not prepare the video frame (${frameResponse.status}).`)
  const frameEvents = parseNdjson(await frameResponse.text())
  const frameError = frameEvents.find((event) => event.type === 'error')
  if (frameError) throw new Error(frameError.message || 'Could not prepare the video frame.')
  const frame = frameEvents.find((event) => event.type === 'complete')?.data_url
  if (!frame) throw new Error('The video frame generator returned no image.')

  onProgress?.({ stage: 'uploading', message: 'Sending the frame to the free video worker…' })
  const frameBlob = await dataUrlToBlob(frame)
  const form = new FormData()
  form.append('files', frameBlob, 'shadowai-video-frame.png')
  const uploadResponse = await fetch(`${FREE_VIDEO_SPACE}/gradio_api/upload`, { method: 'POST', body: form, signal })
  if (!uploadResponse.ok) throw new Error(`The free video worker upload failed (${uploadResponse.status}).`)
  const uploadPaths = await uploadResponse.json() as string[]
  const uploadPath = uploadPaths[0]
  if (!uploadPath) throw new Error('The free video worker did not accept the frame.')

  onProgress?.({ stage: 'generating', message: 'Rendering your video…' })
  const submitResponse = await fetch(`${FREE_VIDEO_SPACE}/gradio_api/call/generate_video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        { path: uploadPath, meta: { _type: 'gradio.FileData' } },
        prompt,
        4,
        '',
        0.5,
        1,
        1,
        Math.floor(Math.random() * 2147483647),
        true,
      ],
    }),
    signal,
  })
  if (!submitResponse.ok) throw new Error(`The free video worker rejected the request (${submitResponse.status}).`)
  const { event_id: eventId } = await submitResponse.json() as { event_id?: string }
  if (!eventId) throw new Error('The free video worker returned no job id.')

  const resultResponse = await fetch(`${FREE_VIDEO_SPACE}/gradio_api/call/generate_video/${eventId}`, { signal })
  if (!resultResponse.ok) throw new Error(`The free video worker returned ${resultResponse.status}.`)
  const resultText = await resultResponse.text()
  const completeLine = resultText.split('\n').find((line) => line.startsWith('data:') && line !== 'data: null')
  if (!completeLine) throw new Error('The free video worker returned no video.')
  let result: Array<{ url?: string; size?: number }>
  try { result = JSON.parse(completeLine.slice(5).trim()) as Array<{ url?: string; size?: number }> } catch { throw new Error('The free video worker returned an invalid video response.') }
  const videoUrl = result[0]?.url
  if (!videoUrl) throw new Error('The free video worker returned no video URL.')

  const videoResponse = await fetch(videoUrl, { signal })
  if (!videoResponse.ok) throw new Error(`The generated video could not be downloaded (${videoResponse.status}).`)
  const videoBlob = await videoResponse.blob()
  const dataUrl = await blobToDataUrl(videoBlob)
  return { path: `generated/shadow-video-${Date.now()}.mp4`, language: 'video', content: dataUrl, size: videoBlob.size }
}

export async function generateMedia(args: {
  baseUrl: string
  token: string
  kind: MediaKind
  prompt: string
  onProgress?: (event: ProviderProgress) => void
  signal?: AbortSignal
}): Promise<ArtifactFile> {
  const { baseUrl, token, kind, prompt, onProgress, signal } = args
  if (kind === 'video') return generateFreeVideo({ baseUrl, token, prompt, onProgress, signal })

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/generate/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt }),
    signal,
  })
  if (!response.ok) throw new Error(`Hugging Face image endpoint returned ${response.status}.`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The image stream did not open.')

  const decoder = new TextDecoder()
  let buffer = ''
  let complete: MediaEvent | null = null
  const handle = (line: string) => {
    if (!line.trim()) return
    let event: MediaEvent
    try { event = JSON.parse(line) as MediaEvent } catch { return }
    if (event.type === 'progress') onProgress?.({ stage: event.stage || 'generating', message: event.message || event.stage || 'Generating…' })
    if (event.type === 'error') throw new Error(event.error || 'Image generation failed.')
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
  const imageResult = complete as MediaEvent | null
  if (!imageResult?.data_url) throw new Error('The image generator returned no asset.')
  return { path: `generated/shadow-image-${Date.now()}.png`, language: 'image', content: imageResult.data_url, size: imageResult.size || imageResult.data_url.length }
}
