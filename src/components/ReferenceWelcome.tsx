import { Icon } from './Icon'

export interface ReferenceWelcomeProps {
  displayName?: string
  onPrompt: (prompt: string) => void
  onMedia: (kind: 'image' | 'video') => void
}

/**
 * React/TypeScript translation of the supplied AI Chat reference screen.
 * It keeps the visual hierarchy of the reference while routing every action
 * into ShadowAI's real composer instead of using static demo buttons.
 */
export function ReferenceWelcome({ displayName, onPrompt, onMedia }: ReferenceWelcomeProps) {
  const firstName = displayName?.trim().split(/\s+/)[0] || ''
  const actions = [
    { label: 'Tools', icon: 'grid' as const, prompt: 'Show me the tools available in my ShadowAI workspace.' },
    { label: 'Deep Search', icon: 'search' as const, prompt: 'Research this topic thoroughly and cite the most relevant sources: ' },
    { label: 'Create Images', icon: 'image' as const, media: 'image' as const },
    { label: 'Latest News', icon: 'globe' as const, prompt: 'Find the latest news about: ' },
    { label: 'Generate Video', icon: 'play' as const, media: 'video' as const },
  ]

  return (
    <section className="reference-welcome" aria-labelledby="welcome-title">
      <div className="reference-welcome__mark"><Icon name="sparkle" size={22} /></div>
      <p className="reference-welcome__eyebrow">SHADOWAI WORKSPACE</p>
      <h1 id="welcome-title">{firstName ? `Hey ${firstName},` : 'Hey,'}<br /><span>how can I assist?</span></h1>
      <p className="reference-welcome__copy">
        ShadowAI is your fastest workspace for answers, research, code, images, and motion — connected to your real projects.
      </p>
      <div className="reference-welcome__actions" aria-label="ShadowAI actions">
        {actions.map((action) => (
          <button
            key={action.label}
            className="reference-welcome__action"
            type="button"
            onClick={() => {
              if (action.media) onMedia(action.media)
              else onPrompt(action.prompt || '')
            }}
          >
            <Icon name={action.icon} size={15} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
