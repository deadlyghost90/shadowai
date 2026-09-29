/**
 * Agent runtime.
 *
 * Agent mode is not a fake progress bar. It is a real loop:
 *
 *   1. PLAN   — one call to the model asking for 3–6 user-facing step titles.
 *   2. EXECUTE — one real model call per step, streamed into the conversation.
 *   3. FINISH — the final step produces the summary and any remaining files.
 *
 * Every step actually calls the connected model and does real work. If the model
 * is not connected, the run fails honestly instead of faking progress.
 *
 * Private reasoning is never requested, streamed, or displayed.
 */

import type { AIProvider, AgentRun, AgentStep, ArtifactFile, Message, ProviderProgress, RunStatus, StepStatus } from './types'
import { buildProviderMessages, systemPromptFor } from './messages'
import { parseArtifacts } from './artifacts'
import { uid } from '../utils'

export interface AgentEvents {
  onRun: (run: AgentRun) => void
  onContent: (text: string) => void
  onArtifacts: (files: ArtifactFile[]) => void
  onProgress?: (progress: ProviderProgress) => void
  onSettled: (run: AgentRun, fullText: string, stopped: boolean) => void
}

const FALLBACK_PLAN = [
  'Analyzing request',
  'Working on the task',
  'Checking the result',
  'Finalizing',
]

const PLANNER_INSTRUCTION = `Break the following request into 3 to 6 steps for a progress panel the user will watch.

Rules:
- Each title is 2–5 words, in the present tense, describing the OUTCOME ("Creating components").
- Never mention reasoning, thinking, planning internals, or "the user wants".
- Cover the whole request end to end, in order.
- The last step is a summary of what was produced.

Return ONLY a JSON array of strings. No prose, no markdown fence.

REQUEST:
`

function parsePlan(raw: string): string[] {
  const cleaned = raw
    .replace(/```json?/gi, '')
    .replace(/```/g, '')
    .trim()

  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown
      if (Array.isArray(parsed)) {
        const titles = parsed
          .map((v) => (typeof v === 'string' ? v : typeof v === 'object' && v ? String((v as { title?: string }).title ?? '') : ''))
          .map((s) => s.trim().replace(/^["'\s]+|["'\s.]+$/g, ''))
          .filter((s) => s.length > 0 && s.length < 80)
        if (titles.length >= 2) return dedupe(titles).slice(0, 6)
      }
    } catch {
      /* fall through to the line-based parser */
    }
  }

  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["']|["',]$/g, '').trim())
    .filter((l) => l.length > 2 && l.length < 80)
  if (lines.length >= 2) return dedupe(lines).slice(0, 6)

  return FALLBACK_PLAN
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const k = item.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

export interface AgentArgs {
  provider: AIProvider
  model: string
  request: string
  history: Message[]
  systemPrompt: string
  signal: AbortSignal
  events: AgentEvents
}

export async function runAgent(args: AgentArgs): Promise<AgentRun> {
  const { provider, model, request, history, systemPrompt, signal, events } = args

  const run: AgentRun = {
    title: titleOf(request),
    status: 'planning',
    steps: [],
    currentStep: 0,
  }

  const emit = () => events.onRun({ ...run, steps: run.steps.map((s) => ({ ...s })) })

  try {
    // ---------- 1. PLAN ------------------------------------------------------
    let planRaw = ''
    await provider.chat({
      model,
      messages: [
        { role: 'system', content: 'You are a task planner. You output strict JSON and nothing else.' },
        { role: 'user', content: PLANNER_INSTRUCTION + request },
      ],
      temperature: 0.2,
      maxTokens: 300,
      signal,
      onDelta: (d) => {
        planRaw += d
      },
      onProgress: events.onProgress,
    })

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const titles = parsePlan(planRaw)
    run.steps = titles.map<AgentStep>((title) => ({
      id: uid('step'),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      status: 'pending' as StepStatus,
    }))
    run.status = 'running'
    run.currentStep = 0
    emit()

    // ---------- 2. EXECUTE ---------------------------------------------------
    let full = ''
    let artifacts: ArtifactFile[] = []
    const seen = new Set<string>()

    const pushArtifacts = () => {
      const parsed = parseArtifacts(full)
      for (const f of parsed.artifacts) {
        if (!seen.has(f.path)) {
          seen.add(f.path)
          artifacts.push(f)
        }
      }
      if (parsed.artifacts.length) events.onArtifacts(artifacts.map((a) => ({ ...a })))
    }

    for (let i = 0; i < run.steps.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const step = run.steps[i]
      step.status = 'running'
      step.startedAt = Date.now()
      run.currentStep = i
      emit()

      if (i > 0) {
        full += '\n\n---\n\n'
        events.onContent('\n\n---\n\n')
      }

      const isLast = i === run.steps.length - 1
      const stepBrief = buildProviderMessages({
        history,
        systemPrompt,
        mode: 'agent',
        window: 20,
      })

      const messages = [
        ...stepBrief,
        {
          role: 'user' as const,
          content: isLast
            ? `Execute the final step of the task now.

REQUEST:
${request}

STEP ${i + 1} of ${run.steps.length} — ${step.title}

Produce the actual result of this step: the finished output the user receives, plus any complete files they should get (each as a \`\`\`file:path\`\`\` block). Then close with 1–2 sentences on what was produced and how to use it.`
            : `Execute this step of the task now.

REQUEST:
${request}

STEP ${i + 1} of ${run.steps.length} — ${step.title}

Produce the work output for this step directly — code, copy, structure, or findings the user can use right now. Do not restate the request and do not describe what you are about to do.`,
        },
      ]

      let stepFailed: unknown = null
      try {
        await provider.chat({
          model,
          messages,
          temperature: undefined,
          signal,
          onDelta: (d) => {
            full += d
            events.onContent(d)
            pushArtifacts()
          },
          onProgress: events.onProgress,
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e
        stepFailed = e
      }

      if (stepFailed) {
        step.status = 'failed'
        step.finishedAt = Date.now()
        run.status = 'failed'
        emit()
        events.onSettled({ ...run, steps: run.steps.map((s) => ({ ...s })) }, full, false)
        throw stepFailed
      }

      step.status = 'done'
      step.finishedAt = Date.now()
      emit()
    }

    pushArtifacts()
    run.status = 'done'
    run.currentStep = run.steps.length - 1
    emit()
    events.onSettled({ ...run, steps: run.steps.map((s) => ({ ...s })) }, full, false)
    return run
  } catch (e) {
    const stopped = (e as Error)?.name === 'AbortError'
    run.status = stopped ? 'stopped' : 'failed'
    for (const s of run.steps) {
      if (s.status === 'running') s.status = stopped ? 'done' : 'failed'
      if (!s.finishedAt) s.finishedAt = Date.now()
    }
    if (!run.steps.length && stopped) run.status = 'stopped'
    const snapshot = { ...run, steps: run.steps.map((s) => ({ ...s })) }
    events.onSettled(snapshot, '', stopped)
    throw e
  }
}

function titleOf(request: string): string {
  const t = request.trim().split('\n')[0]
  return t.length > 60 ? `${t.slice(0, 60).trimEnd()}…` : t || 'Agent task'
}

export const AGENT_SYSTEM_NOTE = systemPromptFor
export type { RunStatus }
