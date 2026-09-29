import { Icon } from './Icon'
import { Mark } from './Mark'

export function IntroPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="intro-page">
      <div className="intro-page__glow intro-page__glow--one" />
      <div className="intro-page__glow intro-page__glow--two" />
      <nav className="intro-nav">
        <div className="intro-brand"><Mark size={28} /><span>SHADOWMOTION <b>STUDIO</b></span></div>
        <div className="intro-nav__links"><a href="#capabilities">Capabilities</a><a href="#workflow">How it works</a><a href="#developers">Developers</a></div>
        <button className="intro-nav__login" onClick={onEnter} type="button">Open studio <Icon name="arrowDown" size={13} /></button>
      </nav>

      <main className="intro-hero">
        <div className="intro-hero__copy">
          <div className="intro-kicker"><span /> AI CREATIVE WORKSPACE · SHADOWMOTION</div>
          <h1>Make the idea.<br /><em>Ship the world.</em></h1>
          <p>One intelligent studio for code, images, motion, and the systems that bring them together. Describe the outcome. ShadowAI plans the work, builds the assets, and keeps everything in one focused workspace.</p>
          <div className="intro-hero__actions"><button className="intro-primary" onClick={onEnter} type="button">Start creating free <Icon name="arrowDown" size={14} /></button><a className="intro-secondary" href="#capabilities">Explore the studio <Icon name="chevronRight" size={14} /></a></div>
          <div className="intro-proof"><span><Icon name="check" size={12} /> Agent-first workflows</span><span><Icon name="check" size={12} /> Private workspace</span><span><Icon name="check" size={12} /> No credit card</span></div>
        </div>
        <div className="intro-hero__visual" aria-label="ShadowMotion studio preview">
          <div className="intro-window">
            <div className="intro-window__bar"><span /><span /><span /><small>shadowmotion / studio</small></div>
            <div className="intro-window__body">
              <aside><div className="intro-mini-logo"><Mark size={20} /></div><i /><i /><i /><i /><div className="intro-mini-bottom"><i /><i /></div></aside>
              <section><div className="intro-window__crumb">LIVE WORKSPACE <b>● CONNECTED</b></div><h3>Build a launch page for<br /><strong>ShadowMotion Studio</strong></h3><div className="intro-window__task"><span className="intro-check">✓</span><span><b>Agent activity</b><small>Planning interface and asset system</small></span><em>72%</em></div><div className="intro-window__preview"><div className="intro-spark" /><div className="intro-preview-line" /><div className="intro-preview-line short" /><div className="intro-preview-card"><Icon name="image" size={18} /></div></div></section>
            </div>
          </div>
          <div className="intro-float intro-float--top"><Icon name="sparkle" size={14} /><span>Agent ready</span><b>●</b></div>
          <div className="intro-float intro-float--bottom"><Icon name="play" size={14} /><span>Live preview</span><small>updates as it builds</small></div>
        </div>
      </main>

      <section className="intro-capabilities" id="capabilities">
        <div className="intro-section-head"><span className="intro-kicker"><span /> THE STUDIO</span><h2>From first thought<br />to finished output.</h2></div>
        <div className="intro-capability-grid"><article><Icon name="bot" size={19} /><span>01</span><h3>Build with an agent</h3><p>Plan, implement, debug, and verify in a single conversation that shows useful progress as it works.</p></article><article><Icon name="image" size={19} /><span>02</span><h3>Generate visual assets</h3><p>Bring image and video workflows into the same library as your code, prompts, and project files.</p></article><article><Icon name="grid" size={19} /><span>03</span><h3>Extend the system</h3><p>Developers can publish plugins, skills, and libraries through a clean portal built for reusable work.</p></article></div>
      </section>

      <section className="intro-workflow" id="workflow"><div><span className="intro-kicker"><span /> A BETTER LOOP</span><h2>Brief it.<br />Watch it work.</h2></div><div className="intro-workflow__steps"><div><b>01</b><span>Describe</span><p>Give ShadowAI the outcome, not a maze of instructions.</p></div><div><b>02</b><span>Direct</span><p>Choose a skill, plugin, or media workflow when you need one.</p></div><div><b>03</b><span>Ship</span><p>Preview outputs live, inspect files, and export the finished work.</p></div></div></section>

      <section className="intro-developers" id="developers"><div><span className="intro-kicker"><span /> FOR DEVELOPERS</span><h2>Build the tools<br />your team repeats.</h2><p>Package your best prompts, workflows, and implementation patterns into reusable capabilities inside the ShadowMotion developer portal.</p></div><button className="intro-outline" onClick={onEnter} type="button">Open developer portal <Icon name="chevronRight" size={14} /></button></section>
      <footer className="intro-footer"><div className="intro-brand"><Mark size={24} /><span>SHADOWMOTION <b>STUDIO</b></span></div><span>AI workspace for people who ship.</span><span>Built by ShadowMotion</span></footer>
    </div>
  )
}
