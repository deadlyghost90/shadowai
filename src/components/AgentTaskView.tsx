import { useState } from 'react'
import type { AgentRun } from '../lib/ai/types'
import { Icon } from './Icon'
import { cx } from '../lib/utils'

/**
 * The agent progress panel.
 *
 * Lives inside the conversation — never a separate screen. Collapsed it is one
 * row; expanded it is the step list. On narrow screens the step list opens as a
 * bottom sheet so it never squeezes the transcript.
 */

function statusLine(run: AgentRun): string {
  const total = run.steps.length
  if (!total) return run.status === 'planning' ? 'Planning task…' : 'Preparing…'
  switch (run.status) {
    case 'planning':
      return 'Planning task…'
    case 'running':
      return `Working on step ${Math.min(run.currentStep + 1, total)} of ${total}`
    case 'done':
      return `${total} step${total === 1 ? '' : 's'} completed`
    case 'stopped':
      return `Stopped at step ${Math.min(run.currentStep + 1, total)} of ${total}`
    case 'failed':
      return 'Task failed'
    default:
      return ''
  }
}

function StepList({ run }: { run: AgentRun }) {
  return (
    <ol className="agent__steps">
      {run.steps.map((s) => (
        <li key={s.id} className={cx('agent__step', `is-${s.status}`)}>
          <span className="agent__mark">
            {s.status === 'done' ? (
              <Icon name="check" size={10} strokeWidth={2.4} />
            ) : s.status === 'failed' ? (
              <Icon name="x" size={9} strokeWidth={2.4} />
            ) : null}
          </span>
          <span className="agent__step-title">
            {s.title}
            {s.status === 'running' && s.note ? <span className="agent__step-note">{s.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function AgentTaskView({
  run,
  onStop,
  isMobile,
}: {
  run: AgentRun
  onStop?: () => void
  isMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(false)

  const total = run.steps.length
  const done = run.steps.filter((s) => s.status === 'done').length
  const progress = total ? Math.round((done / total) * 100) : run.status === 'planning' ? 8 : 0
  const running = run.status === 'running' || run.status === 'planning'

  const body = (
    <>
      <StepList run={run} />
      <div className="agent__foot">
        <span className="agent__foot-meta">
          {total ? `${done}/${total} steps` : 'Planning'}
          {run.steps.some((s) => s.finishedAt && s.startedAt)
            ? ` · ${run.steps.reduce((acc, s) => acc + ((s.finishedAt || 0) - (s.startedAt || 0)), 0)}ms`
            : ''}
        </span>
        {running && onStop ? (
          <button className="ghost-btn" style={{ height: 28, fontSize: 12.5 }} onClick={onStop} type="button">
            <Icon name="stop" size={12} />
            Stop
          </button>
        ) : null}
      </div>
    </>
  )

  return (
    <>
      <div className={cx('agent', running && 'is-running', open && 'is-open')}>
        <button
          className="agent__head"
          onClick={() => {
            if (isMobile) setSheet(true)
            else setOpen((v) => !v)
          }}
          type="button"
          aria-expanded={isMobile ? sheet : open}
        >
          <span className="agent__pulse">
            <Icon name={run.status === 'done' ? 'check' : run.status === 'failed' ? 'x' : 'refresh'} size={12.5} strokeWidth={2} />
          </span>
          <span className="agent__title">
            <span className="agent__label">Agent task</span>
            <span className="agent__task">{run.title}</span>
          </span>
          <span className="agent__status">{statusLine(run)}</span>
          <Icon name="chevronRight" size={13} className="agent__chev" />
        </button>

        <div className="agent__progress">
          <i style={{ width: `${progress}%` }} />
        </div>

        {!isMobile && open ? <div className="agent__body">{body}</div> : null}

        {!isMobile && !open ? (
          <div style={{ padding: '7px 12px 9px' }}>
            <button
              className="ghost-btn"
              style={{ height: 26, fontSize: 12, padding: '0 8px' }}
              onClick={() => setOpen(true)}
              type="button"
            >
              <Icon name="layers" size={12} />
              View details
            </button>
          </div>
        ) : null}
      </div>

      {isMobile && sheet ? (
        <>
          <div className="agent-sheet-scrim" onClick={() => setSheet(false)} />
          <div className="agent-sheet" role="dialog" aria-label="Agent task details">
            <div className="agent-sheet__grip" />
            <div className="agent__head" style={{ padding: '0 0 12px' }}>
              <span className="agent__pulse">
                <Icon name="refresh" size={12.5} />
              </span>
              <span className="agent__title">
                <span className="agent__label">Agent task</span>
                <span className="agent__task">{run.title}</span>
              </span>
              <button className="icon-btn" onClick={() => setSheet(false)} type="button" aria-label="Close details">
                <Icon name="x" size={15} />
              </button>
            </div>
            {body}
          </div>
        </>
      ) : null}
    </>
  )
}
