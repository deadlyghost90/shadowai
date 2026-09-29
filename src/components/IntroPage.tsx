import { Icon } from './Icon'
import { Mark } from './Mark'

export function IntroPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="intro-page official-shadow3d">
      <nav className="intro-nav">
        <div className="intro-brand"><Mark size={30} /><span>Shadow <b>3D</b> Studio</span></div>
        <div className="intro-nav__links"><a href="#capabilities">Features</a><a href="#workflow">How It Works</a><a href="#pricing">Pricing</a><a href="#demo">Demo</a></div>
        <button className="intro-nav__login" onClick={onEnter} type="button">Get Started <Icon name="chevronRight" size={13} /></button>
      </nav>

      <main className="intro-hero">
        <div className="intro-hero__copy">
          <div className="intro-kicker"><span /> SHADOWMOTION PRESENTS</div>
          <h1>Create 3D Worlds<br />with the Power of <em>AI</em></h1>
          <p><strong>Shadow3D Studio</strong> is the ultimate AI-powered 3D creation suite. Generate 3D models from text, animate them with natural language prompts, apply AI textures, and export to your favorite engine — no experience needed.</p>
          <div className="intro-hero__actions"><button className="intro-primary" onClick={onEnter} type="button"><Icon name="sparkle" size={14} /> Start Creating Free</button><a className="intro-secondary" href="#demo"><Icon name="play" size={14} /> Watch Demo</a></div>
          <div className="intro-proof"><span>150+ <small>Registered Users</small></span><span>500+ <small>Models & Animations</small></span><span>3 <small>Export Formats</small></span><span>Free <small>Forever Tier</small></span></div>
        </div>
        <div className="intro-hero__visual" id="demo"><div className="intro-window"><div className="intro-window__bar"><span /><span /><span /><small>shadow3d / studio</small></div><div className="intro-window__body"><aside><div className="intro-mini-logo"><Mark size={21} /></div><i /><i /><i /><i /><div className="intro-mini-bottom"><i /><i /></div></aside><section><div className="intro-window__crumb">REAL-TIME 3D PREVIEW <b>● READY</b></div><h3>Bring your ideas<br /><strong>to life in 3D</strong></h3><div className="intro-model-stage"><div className="intro-orbit intro-orbit--one" /><div className="intro-orbit intro-orbit--two" /><div className="intro-model"><Icon name="cube" size={52} /></div><span className="intro-model-tag">GLB · READY</span></div><div className="intro-stage-controls"><span><Icon name="refresh" size={12} /> Rotate</span><span><Icon name="play" size={12} /> Animate</span><span><Icon name="download" size={12} /> Export</span></div></section></div></div><div className="intro-float intro-float--top"><Icon name="sparkle" size={14} /><span>AI model ready</span><b>●</b></div><div className="intro-float intro-float--bottom"><Icon name="play" size={14} /><span>Natural language animation</span></div></div>
      </main>

      <section className="intro-capabilities" id="capabilities"><div className="intro-section-head"><span className="intro-kicker"><span /> THE COMPLETE TOOLKIT</span><h2>Everything You Need in<br />One Studio</h2><p>Model generation, animation, and texturing — all powered by AI.</p></div><div className="intro-capability-grid"><article><Icon name="cube" size={20} /><span>01</span><h3>AI 3D Model Generator</h3><p>Describe a character, object, or creature — AI generates a ready-to-use <b>GLB model</b> in seconds.</p></article><article><Icon name="play" size={20} /><span>02</span><h3>Text-to-Animation</h3><p>Type <b>“run then stop and look around”</b> and watch your character come to life with realistic motion.</p></article><article><Icon name="wand" size={20} /><span>03</span><h3>AI Texturing</h3><p>Apply stunning textures to your models just by describing them. <b>“Medieval knight armor”</b> — done.</p></article><article><Icon name="download" size={20} /><span>04</span><h3>Multi-Format Export</h3><p>Export as <b>GLB, FBX, BVH</b> — ready for Unity, Unreal, Blender, and more.</p></article><article><Icon name="eye" size={20} /><span>05</span><h3>Real-time 3D Preview</h3><p>Inspect every frame in our <b>WebGL viewer</b>. Rotate, zoom, and play animations instantly.</p></article><article><Icon name="code" size={20} /><span>06</span><h3>Developer API</h3><p>Integrate Shadow3D Studio into your pipeline with a REST API and full documentation.</p></article></div></section>

      <section className="intro-workflow" id="workflow"><div><span className="intro-kicker"><span /> SIMPLE BY DESIGN</span><h2>How It<br /><em>Works</em></h2></div><div className="intro-workflow__steps"><div><b>1</b><span>Describe or Upload</span><p>Describe the 3D model you want, or upload your own GLB, FBX, or OBJ file. AI auto-detects the skeleton.</p></div><div><b>2</b><span>Animate & Texture</span><p>Type a motion prompt — AI animates. Describe a texture — AI paints it. Full control, zero keyframes.</p></div><div><b>3</b><span>Export & Use</span><p>Preview in 3D, then export as GLB, FBX, or BVH for your game, film, or metaverse project.</p></div></div></section>

      <section className="intro-developers" id="pricing"><div><span className="intro-kicker"><span /> READY TO BUILD THE FUTURE?</span><h2>Bring your imagination<br />to life.</h2><p>Join hundreds of creators using Shadow3D Studio to generate, animate, and texture 3D assets — all for free.</p></div><button className="intro-primary" onClick={onEnter} type="button">Start Free <Icon name="chevronRight" size={14} /></button></section>
      <footer className="intro-footer"><div className="intro-brand"><Mark size={25} /><span>Shadow <b>3D</b> Studio</span></div><span>AI-powered 3D creation suite — generate models, animate, and texture.</span><span>Built by DeadlyGhost in Pakistan</span></footer>
    </div>
  )
}
