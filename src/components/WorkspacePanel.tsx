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
  ],
  skills: [
    { name: 'Debug in place', description: 'Reproduce the issue, patch the cause, and verify it.', icon: 'terminal', badge: 'Agent skill', prompt: 'Use the debug-in-place skill: reproduce the problem, trace the root cause, make the smallest robust fix, and verify it with a focused test.' },
    { name: 'Ship a feature', description: 'Break a feature into steps and deliver the implementation.', icon: 'rocket', badge: 'Agent skill', prompt: 'Use the ship-a-feature skill: clarify the acceptance criteria from the request, implement the feature end to end, and validate the finished behavior.' },
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
          {tab === 'media' ? <section className="media-studio-card"><div className="media-studio-card__head"><div><span className="workspace-head__mark"><Icon name={mediaKind === 'image' ? 'image' : 'play'} size={17} /></span><h3>Generate with ShadowAI</h3></div><span className="badge">Connected</span></div><p>Create image and video assets with ShadowAI. Results are saved into this project library.</p><div className="media-studio-card__modes"><button className={cx(mediaKind === 'image' && 'is-active')} onClick={() => setMediaKind('image')} type="button"><Icon name="image" size={14} /> Image</button><button className={cx(mediaKind === 'video' && 'is-active')} onClick={() => setMediaKind('video')} type="button"><Icon name="play" size={14} /> Video</button></div><textarea className="input media-studio-card__prompt" value={mediaPrompt} onChange={(e) => setMediaPrompt(e.target.value)} placeholder={mediaKind === 'image' ? 'Describe the image you want to create…' : 'Describe the video scene, motion, and camera…'} /><button className="solid-btn solid-btn--accent" disabled={!mediaPrompt.trim() || mediaBusy || !onGenerateMedia} onClick={async () => { if (!onGenerateMedia || !mediaPrompt.trim()) return; setMediaBusy(true); setMediaError(''); try { const file = await onGenerateMedia(mediaKind, mediaPrompt.trim()); setMediaPrompt(''); onOpenMedia?.(file) } catch (error) { setMediaError(error instanceof Error ? error.message : 'Media generation failed.') } finally { setMediaBusy(false) } }} type="button"><Icon name={mediaBusy ? 'refresh' : 'sparkle'} size={14} />{mediaBusy ? 'Generating…' : `Generate ${mediaKind}`}</button>{mediaError ? <p className="media-studio-card__error">{mediaError}</p> : null}</section> : null}
          {tab === 'libraries' && mediaFiles?.length ? <section className="media-library"><div className="media-library__head"><span><Icon name="image" size={14} /> Generated media</span><small>{mediaFiles.length} asset{mediaFiles.length === 1 ? '' : 's'}</small></div><div className="media-library__grid">{mediaFiles.map((file) => <button key={file.path} onClick={() => onOpenMedia?.(file)} type="button"><span className="media-library__thumb">{/\.(mp4|webm|mov)$/i.test(file.path) ? <Icon name="play" size={22} /> : /^data:image\//.test(file.content) ? <img src={file.content} alt="" /> : <Icon name="image" size={22} />}</span><b>{file.path}</b></button>)}</div></section> : null}
          {items.map((item) => <article className="workspace-card" key={item.name}><div className="workspace-card__icon"><Icon name={item.icon} size={17} /></div><div className="workspace-card__body"><div className="workspace-card__title"><strong>{item.name}</strong><span className="badge">{item.badge}</span></div><p>{item.description}</p><button className="solid-btn solid-btn--accent workspace-card__use" onClick={() => { onUse(item.prompt); onClose() }} type="button">Use workflow</button></div></article>)}
        </div>
      )}
    </Modal>
  )
}
