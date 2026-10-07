import { useEffect, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Modal } from './Overlay'
import { cx } from '../lib/utils'
import type { ArtifactFile } from '../lib/ai/types'
import type { MediaKind } from '../lib/ai/media'

export type WorkspaceTab = 'plugins' | 'skills' | 'libraries' | 'media' | 'portal'
type WorkspaceItem = { name: string; description: string; icon: IconName; prompt: string; badge: string }

const ITEMS: Record<Exclude<WorkspaceTab, 'portal'>, WorkspaceItem[]> = {
  plugins: [
    { name: 'Repository Builder', description: 'Plan and generate a complete project with files.', icon: 'folder', badge: 'Built-in', prompt: 'Act as my repository builder. Create the project structure, implement every required file, and verify the result.' },
    { name: 'Code Reviewer', description: 'Find bugs, risks, and concrete fixes in attached code.', icon: 'code', badge: 'Built-in', prompt: 'Act as a senior code reviewer. Inspect the provided code, identify the highest-impact issues, then implement the fixes and explain the validation.' },
    { name: 'Web App Builder', description: 'Turn a product brief into a working responsive app.', icon: 'globe', badge: 'Built-in', prompt: 'Act as my web app builder. Make the requested UI feel polished and production-ready, create all needed files, and test the important flows.' },
    { name: 'API Architect', description: 'Design and implement typed REST or GraphQL endpoints with validation.', icon: 'layers', badge: 'Built-in', prompt: 'Act as my API architect. Design the endpoint contract, request and response schemas, authentication boundaries, validation, error format, tests, and documentation. Then implement the API end to end.' },
    { name: 'Database Migration', description: 'Create safe schema changes, indexes, seeds, and rollback notes.', icon: 'database', badge: 'Built-in', prompt: 'Act as my database migration engineer. Inspect the existing schema, design a safe forward migration with indexes and constraints, add seed or backfill logic when needed, and include a rollback and verification query.' },
    { name: 'Test Builder', description: 'Generate focused unit, integration, and end-to-end tests.', icon: 'check', badge: 'Built-in', prompt: 'Act as my test builder. Identify the highest-risk behavior, create focused unit and integration tests plus an end-to-end smoke path where appropriate, run them, and fix failures instead of only listing tests.' },
    { name: 'Security Auditor', description: 'Audit auth, secrets, input handling, dependencies, and permissions.', icon: 'shield', badge: 'Built-in', prompt: 'Act as my application security auditor. Inspect authentication, authorization, secrets, input validation, uploads, dependency risk, CORS, logging, and data exposure. Patch concrete issues and produce a prioritized remediation report.' },
    { name: 'Performance Doctor', description: 'Find slow paths and apply measurable frontend or backend optimizations.', icon: 'chart', badge: 'Built-in', prompt: 'Act as my performance doctor. Find the largest sources of latency, bundle weight, rendering work, database cost, and unnecessary network activity. Implement measurable optimizations and record before-and-after checks.' },
    { name: 'Accessibility Auditor', description: 'Make interfaces keyboard-friendly, readable, and screen-reader ready.', icon: 'eye', badge: 'Built-in', prompt: 'Act as my accessibility auditor. Inspect the interface for semantic structure, keyboard navigation, focus states, labels, contrast, reduced motion, responsive behavior, and screen-reader output. Implement the fixes and verify them.' },
    { name: 'Release Engineer', description: 'Prepare changelog, version notes, environment checks, and deployment steps.', icon: 'rocket', badge: 'Built-in', prompt: 'Act as my release engineer. Review the completed work, update changelog and release notes, check environment variables and build scripts, add a smoke-test checklist, and prepare a safe deployment plan.' },
  ],
  skills: [
    { name: 'Debug in place', description: 'Reproduce the issue, patch the cause, and verify it.', icon: 'terminal', badge: 'Agent skill', prompt: 'Use the debug-in-place skill: reproduce the problem, trace the root cause, make the smallest robust fix, and verify it with a focused test.' },
    { name: 'Ship a feature', description: 'Break a feature into steps and deliver the implementation.', icon: 'rocket', badge: 'Agent skill', prompt: 'Use the ship-a-feature skill: clarify the acceptance criteria from the request, implement the feature end to end, and validate the finished behavior.' },
    { name: 'Self-healing delivery', description: 'Automatically recover once from a failed step before stopping.', icon: 'refresh', badge: 'ShadowAI native', prompt: 'Use ShadowAI’s self-healing delivery loop. Define the desired outcome, execute the task, inspect any failed step, apply one focused repair pass, and finish only after the output is verified or the failure is clearly reported.' },
    { name: 'Research then build', description: 'Gather relevant facts before making implementation decisions.', icon: 'compass', badge: 'Agent skill', prompt: 'Use the research-then-build skill: identify the key constraints, choose a practical approach, then implement the result rather than only describing it.' },
  ],
  libraries: [
    { name: 'Frontend patterns', description: 'Accessible React, CSS, and responsive UI patterns.', icon: 'layers', badge: 'Library', prompt: 'Use the frontend patterns library: prioritize accessible React structure, resilient state handling, responsive layout, and clean visual hierarchy.' },
    { name: 'Agent patterns', description: 'Planning, tool use, verification, and recovery loops.', icon: 'sparkle', badge: 'Library', prompt: 'Use the agent patterns library: plan briefly, take concrete actions, show only useful progress, verify outputs, and recover from failures.' },
    { name: 'Production checklist', description: 'Security, performance, testing, and release readiness.', icon: 'check', badge: 'Library', prompt: 'Use the production checklist library: review security, correctness, performance, accessibility, tests, and release notes before you finish.' },
  ],
  media: [
    { name: 'Shadow Image Lab', description: 'Prompt-ready image generation workflow for concepts, UI visuals, and assets.', icon: 'image', badge: 'ShadowAI generator', prompt: 'Use the Shadow Image Lab workflow. Create a production-ready image brief, specify aspect ratio and style, then generate or prepare the image asset and show it in the media library.' },
    { name: 'Shadow Motion Lab', description: 'Plan shots, camera movement, timing, and delivery for generated video.', icon: 'play', badge: 'ShadowAI generator', prompt: 'Use the Shadow Motion Lab workflow. Turn my idea into a complete video brief with shots, action, camera, duration, aspect ratio, sound, and an execution-ready generation prompt.' },
    { name: 'Motion Graphics Director', description: 'Turn a design brief into an editable animation plan, scene graph, and render-ready code.', icon: 'sparkle', badge: 'Coding Agent', prompt: 'Act as ShadowAI Motion Graphics Director. Translate my brief into a professional motion-graphics system: define the visual language, scene graph, timing, easing, typography, transitions, camera moves, compositing layers, and render settings. Then implement the result as maintainable SVG, Canvas, Remotion, or FFmpeg code and verify the output.' },
    { name: 'Asset Director', description: 'Keep generated images, video clips, and project files organized.', icon: 'folder', badge: 'Media library', prompt: 'Act as my asset director. Organize the generated media for this project, name files consistently, add useful metadata, and prepare the final library view.' },
  ],
}

const TABS: { id: WorkspaceTab; label: string; icon: IconName }[] = [
  { id: 'plugins', label: 'Plugins', icon: 'grid' },
  { id: 'skills', label: 'Skills', icon: 'graduation' },
  { id: 'libraries', label: 'Libraries', icon: 'book' },
  { id: 'media', label: 'Media lab', icon: 'image' },
  { id: 'portal', label: 'Developer portal', icon: 'code' },
]

export function WorkspacePanel({ open, onClose, onUse, mediaFiles, onOpenMedia, onGenerateMedia, initialTab = 'plugins' }: { open: boolean; onClose: () => void; onUse: (prompt: string) => void; mediaFiles?: ArtifactFile[]; onOpenMedia?: (file: ArtifactFile) => void; onGenerateMedia?: (kind: MediaKind, prompt: string) => Promise<ArtifactFile>; initialTab?: WorkspaceTab }) {
  const [tab, setTab] = useState<WorkspaceTab>('plugins')
  const [custom, setCustom] = useState<WorkspaceItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('shadowai-capability-drafts') || '[]') as WorkspaceItem[]
    } catch {
      return []
    }
  })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instruction, setInstruction] = useState('')
  const [mediaPrompt, setMediaPrompt] = useState('')
  const [mediaKind, setMediaKind] = useState<MediaKind>('image')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [motionBrief, setMotionBrief] = useState('')
  const items = tab === 'portal' ? custom : ITEMS[tab]

  useEffect(() => {
    localStorage.setItem('shadowai-capability-drafts', JSON.stringify(custom))
  }, [custom])

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [initialTab, open])

  const publish = () => {
    if (!name.trim() || !instruction.trim()) return
    setCustom((current) => [...current, { name: name.trim(), description: description.trim() || 'A private developer capability for this workspace.', icon: 'code', badge: 'Your draft', prompt: instruction.trim() }])
    setName(''); setDescription(''); setInstruction(''); setTab('portal')
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="workspace-title">
      <header className="modal__head">
        <div className="workspace-head__mark"><Icon name="grid" size={17} /></div>
        <div className="workspace-head__copy"><span className="modal__title" id="workspace-title">Capability studio</span><span className="workspace-head__sub">Tools, workflows, media, and reusable knowledge</span></div>
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Close capability studio"><Icon name="x" size={16} /></button>
      </header>
      <div className="workspace-tabs" role="tablist" aria-label="Capability studio sections">
        {TABS.map((item) => <button key={item.id} className={cx('workspace-tab', tab === item.id && 'is-active')} onClick={() => setTab(item.id)} type="button" role="tab" aria-selected={tab === item.id}><Icon name={item.icon} size={14} />{item.label}</button>)}
      </div>
      {tab === 'portal' ? (
        <div className="portal-layout">
          <div className="portal-intro"><span className="workspace-head__mark"><Icon name="code" size={18} /></span><div><h3>Publish a capability</h3><p>Create a reusable plugin, skill, or library entry. It is saved as a private draft in this workspace and becomes available immediately.</p></div></div>
          <div className="portal-form"><label>Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Accessibility auditor" /></label><label>Description<input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does it help the agent do?" /></label><label>Agent instruction<textarea className="input portal-form__textarea" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Tell the agent exactly how to use this capability…" /></label><button className="solid-btn solid-btn--accent" onClick={publish} disabled={!name.trim() || !instruction.trim()} type="button"><Icon name="upload" size={14} /> Add private draft</button></div>
          {custom.length ? <div className="portal-drafts"><span className="live-rail__section-title">Your private drafts</span>{custom.map((item) => <button key={item.name} onClick={() => { onUse(item.prompt); onClose() }} type="button"><Icon name="code" size={14} /><span><b>{item.name}</b><small>{item.description}</small></span><Icon name="chevronRight" size={13} /></button>)}</div> : null}
        </div>
      ) : (
        <div className="workspace-list">
          {tab === 'media' ? <><section className="media-studio-card"><div className="media-studio-card__head"><div><span className="workspace-head__mark"><Icon name={mediaKind === 'image' ? 'image' : 'play'} size={17} /></span><h3>Generate with ShadowAI</h3></div><span className="badge">Connected</span></div><p>Create image and video assets with ShadowAI. Results are saved into this project library.</p><div className="media-studio-card__modes"><button className={cx(mediaKind === 'image' && 'is-active')} onClick={() => setMediaKind('image')} type="button"><Icon name="image" size={14} /> Image</button><button className={cx(mediaKind === 'video' && 'is-active')} onClick={() => setMediaKind('video')} type="button"><Icon name="play" size={14} /> Video</button></div><textarea className="input media-studio-card__prompt" value={mediaPrompt} onChange={(e) => setMediaPrompt(e.target.value)} placeholder={mediaKind === 'image' ? 'Describe the image you want to create…' : 'Describe the video scene, motion, and camera…'} /><button className="solid-btn solid-btn--accent" disabled={!mediaPrompt.trim() || mediaBusy || !onGenerateMedia} onClick={async () => { if (!onGenerateMedia || !mediaPrompt.trim()) return; setMediaBusy(true); setMediaError(''); try { const file = await onGenerateMedia(mediaKind, mediaPrompt.trim()); setMediaPrompt(''); onOpenMedia?.(file) } catch (error) { setMediaError(error instanceof Error ? error.message : 'Media generation failed.') } finally { setMediaBusy(false) } }} type="button"><Icon name={mediaBusy ? 'refresh' : 'sparkle'} size={14} />{mediaBusy ? 'Generating…' : `Generate ${mediaKind}`}</button>{mediaError ? <p className="media-studio-card__error">{mediaError}</p> : null}</section><section className="motion-graphics-card"><div className="motion-graphics-card__head"><div><span className="workspace-head__mark"><Icon name="sparkle" size={17} /></span><div><h3>Motion Graphics Studio</h3><small>Design system → scene graph → render-ready code</small></div></div><span className="badge">Coding Agent</span></div><p>Use the Coding Agent to build kinetic typography, logo reveals, data animations, and composited scenes. The video engine then turns the approved brief into motion.</p><textarea className="input media-studio-card__prompt" value={motionBrief} onChange={(e) => setMotionBrief(e.target.value)} placeholder="Describe the motion graphic: message, brand, colors, rhythm, format, and approximate duration…" /><div className="motion-graphics-card__actions"><button className="solid-btn solid-btn--accent" disabled={!motionBrief.trim()} onClick={() => { onUse(`Act as ShadowAI Motion Graphics Director and use the Coding Agent to build this production brief. Create an editable scene graph and render-ready implementation, then provide the final generation prompt for the Motion Studio. Brief: ${motionBrief.trim()}`); onClose() }} type="button"><Icon name="code" size={14} /> Build with Coding Agent</button><button className="ghost-btn" disabled={!motionBrief.trim() || mediaBusy || !onGenerateMedia} onClick={async () => { if (!onGenerateMedia || !motionBrief.trim()) return; setMediaBusy(true); setMediaError(''); try { const file = await onGenerateMedia('video', `Professional motion graphics sequence. ${motionBrief.trim()}. Use kinetic typography, deliberate easing, clean compositing, and a polished studio finish.`); setMotionBrief(''); onOpenMedia?.(file) } catch (error) { setMediaError(error instanceof Error ? error.message : 'Motion graphics generation failed.') } finally { setMediaBusy(false) } }} type="button"><Icon name="play" size={14} /> Render motion</button></div></section></> : null}
          {tab === 'libraries' && mediaFiles?.length ? <section className="media-library"><div className="media-library__head"><span><Icon name="image" size={14} /> Generated media</span><small>{mediaFiles.length} asset{mediaFiles.length === 1 ? '' : 's'}</small></div><div className="media-library__grid">{mediaFiles.map((file) => <button key={file.path} onClick={() => onOpenMedia?.(file)} type="button"><span className="media-library__thumb">{/\.(mp4|webm|mov)$/i.test(file.path) ? <Icon name="play" size={22} /> : /^data:image\//.test(file.content) ? <img src={file.content} alt="" /> : <Icon name="image" size={22} />}</span><b>{file.path}</b></button>)}</div></section> : null}
          {items.map((item) => <article className="workspace-card" key={item.name}><div className="workspace-card__icon"><Icon name={item.icon} size={17} /></div><div className="workspace-card__body"><div className="workspace-card__title"><strong>{item.name}</strong><span className="badge">{item.badge}</span></div><p>{item.description}</p><button className="solid-btn solid-btn--accent workspace-card__use" onClick={() => { onUse(item.prompt); onClose() }} type="button">Use workflow</button></div></article>)}
        </div>
      )}
    </Modal>
  )
}
