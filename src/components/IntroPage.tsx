import { Icon } from './Icon'
import { Mark } from './Mark'

export function IntroPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="intro-page official-shadow3d">
      <nav className="intro-nav">
        <div className="intro-brand"><Mark size={30} /><span>Shadow <b>AI</b></span></div>
        <div className="intro-nav__links"><a href="#capabilities">Capabilities</a><a href="#workflow">How It Works</a><a href="#agent">Coding Agent</a><a href="#media">Media Studio</a></div>
        <button className="intro-nav__login" onClick={onEnter} type="button">Open ShadowAI <Icon name="chevronRight" size={13} /></button>
      </nav>

      <main className="intro-hero">
        <div className="intro-hero__copy">
          <div className="intro-kicker"><span /> SHADOWAI BY SHADOWMOTION</div>
          <h1>Think clearly.<br />Build <em>for real.</em></h1>
          <p><strong>ShadowAI</strong> is an action-oriented AI workspace for conversations, coding, research, and creative production. Ask naturally, switch into the Coding Agent when work needs to be done, and watch real progress arrive from the connected ShadowAI system.</p>
          <div className="intro-hero__actions"><button className="intro-primary" onClick={onEnter} type="button"><Icon name="sparkle" size={14} /> Start with ShadowAI</button><a className="intro-secondary" href="#workflow"><Icon name="play" size={14} /> See how it works</a></div>
          <div className="intro-proof"><span>Chat <small>Natural conversations</small></span><span>Agent <small>Build and verify</small></span><span>Media <small>Image and video tools</small></span><span>Live <small>Progress workspace</small></span></div>
        </div>
        <div className="intro-hero__visual" id="agent"><div className="intro-window"><div className="intro-window__bar"><span /><span /><span /><small>shadowai / workspace</small></div><div className="intro-window__body"><aside><div className="intro-mini-logo"><Mark size={21} /></div><i /><i /><i /><i /><div className="intro-mini-bottom"><i /><i /></div></aside><section><div className="intro-window__crumb">SHADOWAI WORKSPACE <b>● ONLINE</b></div><h3>From a clear request<br /><strong>to useful work</strong></h3><div className="intro-model-stage"><div className="intro-orbit intro-orbit--one" /><div className="intro-orbit intro-orbit--two" /><div className="intro-model"><Icon name="sparkle" size={52} /></div><span className="intro-model-tag">AGENT · READY</span></div><div className="intro-stage-controls"><span><Icon name="chat" size={12} /> Chat</span><span><Icon name="code" size={12} /> Build</span><span><Icon name="terminal" size={12} /> Monitor</span></div></section></div></div><div className="intro-float intro-float--top"><Icon name="check" size={14} /><span>Real progress, not fake logs</span><b>●</b></div><div className="intro-float intro-float--bottom"><Icon name="terminal" size={14} /><span>Plan · execute · verify</span></div></div>
      </main>

      <section className="intro-capabilities" id="capabilities"><div className="intro-section-head"><span className="intro-kicker"><span /> ONE AI WORKSPACE</span><h2>Everything you need<br />to move forward</h2><p>A focused workspace for thinking, making, and shipping useful results.</p></div><div className="intro-capability-grid"><article><Icon name="chat" size={20} /><span>01</span><h3>Natural Chat</h3><p>Ask questions, explain ideas, analyze files, and keep context across a clean conversation workspace.</p></article><article><Icon name="code" size={20} /><span>02</span><h3>Coding Agent</h3><p>Give the agent a real implementation task. It plans, edits, explains, and verifies instead of only describing possibilities.</p></article><article id="media"><Icon name="image" size={20} /><span>03</span><h3>Image & Video Studio</h3><p>Create visual assets and short motion pieces, then keep the returned work in your project library.</p></article><article><Icon name="terminal" size={20} /><span>04</span><h3>Live Activity</h3><p>See trusted progress events as a request moves through analysis, generation, and completion.</p></article><article><Icon name="grid" size={20} /><span>05</span><h3>Plugins & Skills</h3><p>Use built-in workflows and create private capability drafts for the tasks your team repeats most often.</p></article><article><Icon name="folder" size={20} /><span>06</span><h3>Project Library</h3><p>Keep conversations, generated media, files, and reusable agent outputs together in one workspace.</p></article></div></section>

      <section className="intro-workflow" id="workflow"><div><span className="intro-kicker"><span /> SIMPLE BY DESIGN</span><h2>How ShadowAI<br /><em>works</em></h2></div><div className="intro-workflow__steps"><div><b>1</b><span>Choose the workspace</span><p>Start in Chat for everyday help, or open Coding Agent when the request needs implementation and verification.</p></div><div><b>2</b><span>Give it the real context</span><p>Attach files, describe the outcome, select a workflow, or write a media prompt with the result you want.</p></div><div><b>3</b><span>Review the result</span><p>Follow live status, inspect generated assets, and keep the useful output in your conversation or project library.</p></div></div></section>

      <section className="intro-developers" id="pricing"><div><span className="intro-kicker"><span /> READY TO GET TO WORK?</span><h2>Your ideas deserve<br />a useful next step.</h2><p>Open ShadowAI and move from conversation to concrete output with a workspace built for action.</p></div><button className="intro-primary" onClick={onEnter} type="button">Enter ShadowAI <Icon name="chevronRight" size={14} /></button></section>
      <footer className="intro-footer"><div className="intro-brand"><Mark size={25} /><span>Shadow <b>AI</b></span></div><span>Action-oriented AI workspace for chat, coding, media, and projects.</span><span>Built by ShadowMotion</span></footer>
    </div>
  )
}
