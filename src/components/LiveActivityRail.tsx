import type { ArtifactFile, AgentRun, ProviderProgress } from '../lib/ai/types'
import { Icon } from './Icon'
import { cx } from '../lib/utils'

function statusLabel(run?: AgentRun, stage?: string, busy?: boolean) {
  if (stage) return stage
  if (!run) return busy ? 'Working…' : 'Ready'
  if (run.status === 'planning') return 'Planning'
  if (run.status === 'running') return run.steps[run.currentStep]?.note || 'Executing'
  if (run.status === 'done') return 'Complete'
  if (run.status === 'failed') return 'Needs attention'
  return 'Stopped'
}

function eventIcon(event: ProviderProgress) {
  if (event.kind === 'command') return 'terminal' as const
  if (event.kind === 'computer') return 'globe' as const
  return event.status === 'completed' ? 'check' as const : 'refresh' as const
}

export function LiveActivityRail({ run, artifacts, stage, activityEvents, busy, onStop, onOpenFile }: { run?: AgentRun; artifacts: ArtifactFile[]; stage?: string; activityEvents: ProviderProgress[]; busy: boolean; onStop?: () => void; onOpenFile: (file: ArtifactFile) => void }) {
  const preview = artifacts.find((f) => /\.(html?|svg)$/i.test(f.path))
  const done = run?.steps.filter((s) => s.status === 'done').length || 0
  const total = run?.steps.length || 0
  const progress = total ? Math.round((done / total) * 100) : busy ? 10 : 100
  const hasComputerEvents = activityEvents.some((event) => event.kind === 'command' || event.kind === 'computer')

  return (
    <aside className="live-rail" aria-label="Live agent workspace">
      <div className="live-rail__head"><div><div className="live-rail__eyebrow"><span className={cx('live-rail__dot', busy && 'is-live')} /> LIVE WORKSPACE</div><h2>Agent activity</h2></div>{busy && onStop ? <button className="live-rail__stop" onClick={onStop} type="button"><Icon name="stop" size={12} /> Stop</button> : null}</div>
      <div className="live-rail__status"><div className="live-rail__status-icon"><Icon name={busy ? 'refresh' : run?.status === 'done' ? 'check' : 'bot'} size={16} /></div><div className="live-rail__status-copy"><strong>{statusLabel(run, stage, busy)}</strong><span>{run?.title || 'Your coding agent is standing by'}</span></div></div>
      <div className="live-rail__progress"><i style={{ width: `${progress}%` }} /></div>

      <section className="live-rail__section live-rail__connection"><div className="live-rail__section-title"><span><Icon name="globe" size={13} /> ShadowAI backend</span><span className="is-connected">Connected</span></div><div className="live-rail__connection-row"><span className="live-rail__dot is-live" /><span>ShadowAI stream</span><small>LIVE</small></div></section>

      {run?.steps.length ? <section className="live-rail__section"><div className="live-rail__section-title"><span>Execution plan</span><span>{done}/{total}</span></div><ol className="live-rail__steps">{run.steps.map((step) => <li key={step.id} className={cx(`is-${step.status}`)}><span className="live-rail__step-mark">{step.status === 'done' ? <Icon name="check" size={10} /> : step.status === 'failed' ? <Icon name="x" size={10} /> : step.status === 'running' ? <Icon name="refresh" size={10} /> : null}</span><span><b>{step.title}</b>{step.status === 'running' && step.note ? <small>{step.note}</small> : null}</span></li>)}</ol></section> : null}

      <section className="live-rail__section live-rail__console"><div className="live-rail__section-title"><span><Icon name="terminal" size={13} /> Live event console</span><span>{activityEvents.length ? `${activityEvents.length} events` : 'Waiting'}</span></div>{activityEvents.length ? <div className="live-console">{activityEvents.slice(-8).map((event, index) => <div className="live-console__event" key={`${event.stage}-${index}`}><Icon name={eventIcon(event)} size={12} /><div><b>{event.command || event.message}</b>{event.output ? <code>{event.output}</code> : null}</div><small>{event.status || event.stage}</small></div>)}</div> : <div className="live-console__empty"><Icon name="terminal" size={16} /><span>Waiting for live telemetry.</span><small>Only trusted backend events appear here.</small></div>}</section>

      <section className="live-rail__section live-rail__computer"><div className="live-rail__section-title"><span><Icon name="monitor" size={13} /> Computer workspace</span><span>{hasComputerEvents ? 'Active' : 'Not linked'}</span></div><div className={cx('computer-bridge', hasComputerEvents && 'is-active')}><Icon name="monitor" size={17} /><div><b>{hasComputerEvents ? 'Remote activity received' : 'No computer bridge'}</b><small>{hasComputerEvents ? 'Showing backend-reported computer events.' : 'The current Space reports model stages only — it does not execute commands on your personal computer.'}</small></div></div></section>

      <section className="live-rail__section live-rail__preview"><div className="live-rail__section-title"><span><Icon name="eye" size={13} /> Live preview</span><span>{preview ? 'Updated' : 'Waiting'}</span></div>{preview ? <button className="live-preview" onClick={() => onOpenFile(preview)} type="button" title={`Open ${preview.path}`}><iframe title={`Live preview ${preview.path}`} srcDoc={preview.content} sandbox="allow-scripts allow-forms" /><span className="live-preview__bar"><Icon name="globe" size={12} /> {preview.path}<Icon name="expand" size={12} /></span></button> : <div className="live-preview__empty"><Icon name="layers" size={18} /><span>Generated HTML or SVG appears here as the agent streams it.</span></div>}</section>
      {artifacts.length ? <section className="live-rail__section"><div className="live-rail__section-title"><span><Icon name="folder" size={13} /> Workspace files</span><span>{artifacts.length}</span></div><div className="live-rail__files">{artifacts.slice(0, 5).map((file) => <button key={file.path} onClick={() => onOpenFile(file)} type="button"><Icon name="fileCode" size={13} /><span>{file.path}</span></button>)}</div></section> : null}
    </aside>
  )
}
