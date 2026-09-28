import { useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Modal } from './Overlay'
import { cx } from '../lib/utils'

type WorkspaceTab = 'plugins' | 'skills' | 'libraries'

type WorkspaceItem = {
  name: string
  description: string
  icon: IconName
  prompt: string
  badge: string
}

const ITEMS: Record<WorkspaceTab, WorkspaceItem[]> = {
  plugins: [
    { name: 'Repository Builder', description: 'Plan and generate a complete project with files.', icon: 'folder', badge: 'Built-in', prompt: 'Act as my repository builder. Create the project structure, implement every required file, and verify the result.' },
    { name: 'Code Reviewer', description: 'Find bugs, risks, and concrete fixes in attached code.', icon: 'code', badge: 'Built-in', prompt: 'Act as a senior code reviewer. Inspect the provided code, identify the highest-impact issues, then implement the fixes and explain the validation.' },
    { name: 'Web App Builder', description: 'Turn a product brief into a working responsive app.', icon: 'globe', badge: 'Built-in', prompt: 'Act as my web app builder. Make the requested UI feel polished and production-ready, create all needed files, and test the important flows.' },
  ],
  skills: [
    { name: 'Debug in place', description: 'Reproduce the issue, patch the cause, and verify it.', icon: 'terminal', badge: 'Agent skill', prompt: 'Use the debug-in-place skill: reproduce the problem, trace the root cause, make the smallest robust fix, and verify it with a focused test.' },
    { name: 'Ship a feature', description: 'Break a feature into steps and deliver the implementation.', icon: 'rocket', badge: 'Agent skill', prompt: 'Use the ship-a-feature skill: clarify the acceptance criteria from the request, implement the feature end to end, and validate the finished behavior.' },
    { name: 'Research then build', description: 'Gather the relevant facts before making implementation decisions.', icon: 'compass', badge: 'Agent skill', prompt: 'Use the research-then-build skill: identify the key constraints, choose a practical approach, then implement the result rather than only describing it.' },
  ],
  libraries: [
    { name: 'Frontend patterns', description: 'Accessible React, CSS, and responsive UI patterns.', icon: 'layers', badge: 'Library', prompt: 'Use the frontend patterns library: prioritize accessible React structure, resilient state handling, responsive layout, and clean visual hierarchy.' },
    { name: 'Agent patterns', description: 'Planning, tool use, verification, and recovery loops.', icon: 'sparkle', badge: 'Library', prompt: 'Use the agent patterns library: plan briefly, take concrete actions, show only useful progress, verify outputs, and recover from failures.' },
    { name: 'Production checklist', description: 'Security, performance, testing, and release readiness.', icon: 'check', badge: 'Library', prompt: 'Use the production checklist library: review security, correctness, performance, accessibility, tests, and release notes before you finish.' },
  ],
}

export function WorkspacePanel({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (prompt: string) => void }) {
  const [tab, setTab] = useState<WorkspaceTab>('plugins')
  const items = ITEMS[tab]

  return (
    <Modal open={open} onClose={onClose} labelledBy="workspace-title">
      <header className="modal__head">
        <div className="workspace-head__mark"><Icon name="grid" size={17} /></div>
        <div className="workspace-head__copy">
          <span className="modal__title" id="workspace-title">Agent workspace</span>
          <span className="workspace-head__sub">Extend how ShadowAI works</span>
        </div>
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Close agent workspace">
          <Icon name="x" size={16} />
        </button>
      </header>
      <div className="workspace-tabs" role="tablist" aria-label="Agent workspace sections">
        {(['plugins', 'skills', 'libraries'] as WorkspaceTab[]).map((id) => (
          <button key={id} className={cx('workspace-tab', tab === id && 'is-active')} onClick={() => setTab(id)} type="button" role="tab" aria-selected={tab === id}>
            <Icon name={id === 'plugins' ? 'grid' : id === 'skills' ? 'graduation' : 'book'} size={14} />
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      <div className="workspace-list">
        {items.map((item) => (
          <article className="workspace-card" key={item.name}>
            <div className="workspace-card__icon"><Icon name={item.icon} size={17} /></div>
            <div className="workspace-card__body">
              <div className="workspace-card__title"><strong>{item.name}</strong><span className="badge">{item.badge}</span></div>
              <p>{item.description}</p>
            </div>
            <button className="solid-btn solid-btn--accent workspace-card__use" onClick={() => { onUse(item.prompt); onClose() }} type="button">
              Use
            </button>
          </article>
        ))}
      </div>
    </Modal>
  )
}
