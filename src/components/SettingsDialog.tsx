import { useMemo, useState } from 'react'
import type { AppSettings, ProviderConfig, Transport } from '../lib/ai/config'
import type { ProviderHealth } from '../lib/ai/types'
import { Icon, type IconName } from './Icon'
import { Mark } from './Mark'
import { Modal } from './Overlay'
import { cx, formatBytes, uid } from '../lib/utils'

/**
 * Settings — deliberately secondary.
 *
 * Six small panels, no dashboard. The Model panel is the important one: it is
 * where the user points ShadowAI at their own AI model, whatever that is.
 */

export type SettingsTab =
  | 'appearance'
  | 'model'
  | 'account'
  | 'data'
  | 'shortcuts'
  | 'about'

const TABS: { id: SettingsTab; label: string; icon: IconName }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'sparkle' },
  { id: 'model', label: 'Model', icon: 'brain' },
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'data', label: 'Data', icon: 'database' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'terminal' },
  { id: 'about', label: 'About', icon: 'info' },
]

const ACCENTS = [
  { value: '#22C55E', name: 'ShadowMotion' },
  { value: '#4ade80', name: 'Lime' },
  { value: '#38bdf8', name: 'Sky' },
  { value: '#a78bfa', name: 'Iris' },
]

const PRESETS: { label: string; baseUrl: string; note: string; authHeader: string; authFormat: string }[] = [
  {
    label: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    note: 'Any gateway that speaks /chat/completions',
    authHeader: 'Authorization',
    authFormat: 'Bearer {key}',
  },
  {
    label: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    note: 'Inference router, OpenAI-compatible',
    authHeader: 'Authorization',
    authFormat: 'Bearer {key}',
  },
  {
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    note: 'Local runtime — usually no key needed',
    authHeader: 'Authorization',
    authFormat: 'Bearer {key}',
  },
  {
    label: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    note: 'Local OpenAI-compatible server',
    authHeader: 'Authorization',
    authFormat: 'Bearer {key}',
  },
  {
    label: 'vLLM (self-hosted)',
    baseUrl: 'http://localhost:8000/v1',
    note: 'Your own serving stack',
    authHeader: 'Authorization',
    authFormat: 'Bearer {key}',
  },
]

function Row({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="row-between">
      <div className="row-between__text">
        <div className="row-between__title">{title}</div>
        {desc ? <div className="row-between__desc">{desc}</div> : null}
      </div>
      {children}
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className="switch"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      type="button"
    />
  )
}

export function SettingsDialog({
  open,
  tab,
  settings,
  onTab,
  onClose,
  onChange,
  onTest,
  health,
  testing,
  stats,
  onExport,
  onImport,
  onClear,
  account,
  onSignOut,
}: {
  open: boolean
  tab: SettingsTab
  settings: AppSettings
  onTab: (t: SettingsTab) => void
  onClose: () => void
  onChange: (next: AppSettings) => void
  onTest: () => void
  health: ProviderHealth | null
  testing: boolean
  stats: { conversations: number; messages: number; bytes: number; saved: number }
  onExport: () => void
  onImport: (file: File) => void
  onClear: () => void
  account: { displayName: string; email: string; photoURL: string; role: string }
  onSignOut: () => Promise<void>
}) {
  const [showKey, setShowKey] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const p = settings.provider
  const setProvider = (patch: Partial<ProviderConfig>) =>
    onChange({ ...settings, provider: { ...p, ...patch } })
  const setAppearance = (patch: Partial<AppSettings['appearance']>) =>
    onChange({ ...settings, appearance: { ...settings.appearance, ...patch } })
  const setAccount = (patch: Partial<AppSettings['account']>) =>
    onChange({ ...settings, account: { ...settings.account, ...patch } })

  const models = p.models
  const addModel = () =>
    setProvider({
      models: [...models, { id: '', label: '', source: transportSource(p.transport) }],
    })
  const patchModel = (i: number, patch: Partial<AppSettings['provider']['models'][number]>) => {
    const next = models.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    let selected = p.selectedModel
    if (patch.id && models[i].id === p.selectedModel) selected = patch.id
    setProvider({ models: next, selectedModel: selected })
  }
  const removeModel = (i: number) => {
    const next = models.filter((_, idx) => idx !== i)
    setProvider({
      models: next,
      selectedModel: p.selectedModel === models[i].id ? next[0]?.id ?? '' : p.selectedModel,
    })
  }

  const keyless = p.transport === 'server' || !p.apiKey
  const activeId = tab

  const shortcuts = useMemo(
    () => [
      { keys: ['⌘', 'K'], label: 'Focus the composer' },
      { keys: ['⌘', '⇧', 'O'], label: 'New conversation' },
      { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
      { keys: ['⌘', ','], label: 'Open settings' },
      { keys: ['/',], label: 'Search conversations' },
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['⇧', 'Enter'], label: 'New line' },
      { keys: ['Esc'], label: 'Stop generating / close' },
    ],
    [],
  )

  return (
    <Modal open={open} onClose={onClose} labelledBy="settings-title">
      <header className="modal__head">
        <Mark size={22} />
        <span className="modal__title" id="settings-title">
          Settings
        </span>
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Close settings">
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="modal__body">
        <nav className="modal__nav" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={cx('modal__nav-item', activeId === t.id && 'is-active')}
              onClick={() => onTab(t.id)}
              type="button"
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="modal__panel">
          {/* ---------------------------------------------------- appearance */}
          {tab === 'appearance' ? (
            <>
              <div className="settings-group">
                <h3 className="settings-group__title">Accent</h3>
                <p className="settings-group__desc">
                  Green marks active controls and the send button. Everything else stays neutral.
                </p>
                <div className="appearance-grid">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      className={cx('swatch-card', settings.appearance.accent === a.value && 'is-active')}
                      onClick={() => setAppearance({ accent: a.value })}
                      type="button"
                    >
                      <span className="swatch-card__preview" style={{ background: 'var(--bg-deep)' }}>
                        <i style={{ ['--c' as string]: a.value }} />
                        <i style={{ ['--c' as string]: a.value }} />
                        <i style={{ ['--c' as string]: a.value }} />
                      </span>
                      <span className="swatch-card__name">{a.name}</span>
                      <span className="swatch-card__hex">{a.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Reading</h3>
                <p className="settings-group__desc">Type scale and the details shown under a response.</p>
                <div className="field">
                  <span className="field__label">Text size — {Math.round(settings.appearance.fontScale * 100)}%</span>
                  <input
                    className="range"
                    type="range"
                    min={0.9}
                    max={1.15}
                    step={0.01}
                    value={settings.appearance.fontScale}
                    onChange={(e) => setAppearance({ fontScale: Number(e.target.value) })}
                  />
                </div>
                <Row title="Show timestamps" desc="Display the time under each message.">
                  <Switch
                    on={settings.appearance.showTimestamps}
                    onChange={(v) => setAppearance({ showTimestamps: v })}
                    label="Show timestamps"
                  />
                </Row>
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Motion</h3>
                <p className="settings-group__desc">
                  ShadowAI follows your system preference for reduced motion automatically.
                </p>
                <Row title="Reduce motion" desc="Remove streaming and entrance animations.">
                  <Switch
                    on={settings.appearance.reduceMotion}
                    onChange={(v) => setAppearance({ reduceMotion: v })}
                    label="Reduce motion"
                  />
                </Row>
              </div>
            </>
          ) : null}

          {/* --------------------------------------------------------- model */}
          {tab === 'model' ? (
            <>
              <div className="settings-group">
                <h3 className="settings-group__title">Your AI model</h3>
                <p className="settings-group__desc">
                  ShadowAI ships with no model of its own. Connect any endpoint that speaks a
                  common chat-completions format — a hosted gateway, a local runtime, or a server
                  you control. Your key stays in this browser unless you choose the backend transport.
                </p>

                <div className="field">
                  <span className="field__label">Model source</span>
                  <div className="field__row" style={{ flexWrap: 'wrap' }}>
                    <button
                      className={cx('solid-btn', p.transport === 'space' && 'solid-btn--accent')}
                      onClick={() => setProvider({ transport: 'space' as Transport })}
                      type="button"
                    >
                      <Icon name="sparkle" size={14} />
                      ShadowAI Space
                    </button>
                    <button
                      className={cx('solid-btn', p.transport === 'direct' && 'solid-btn--accent')}
                      onClick={() => setProvider({ transport: 'direct' as Transport })}
                      type="button"
                    >
                      Custom endpoint
                    </button>
                    <button
                      className={cx('solid-btn', p.transport === 'server' && 'solid-btn--accent')}
                      onClick={() => setProvider({ transport: 'server' as Transport })}
                      type="button"
                    >
                      ShadowAI backend
                    </button>
                  </div>
                  <span className="field__hint">
                    {p.transport === 'space'
                      ? 'Shadow v1.1 running on your Hugging Face Space. It streams newline-delimited JSON with its own stage updates.'
                      : p.transport === 'server'
                        ? 'Requests go through the bundled Node backend, which holds the credential. Start it with `npm run server`.'
                        : 'Requests go straight from this browser to your endpoint. The provider must allow browser (CORS) requests.'}
                  </span>
                </div>

                {p.transport === 'space' ? (
                  <>
                    <div className="field">
                      <label className="field__label" htmlFor="cfg-space-url">
                        Space URL
                      </label>
                      <input
                        id="cfg-space-url"
                        className="input"
                        value={p.baseUrl}
                        placeholder="https://your-space.hf.space"
                        spellCheck={false}
                        onChange={(e) => setProvider({ baseUrl: e.target.value })}
                      />
                      <span className="field__hint">
                        ShadowAI calls <code>/health</code> to check the model and <code>/api/chat</code> to
                        talk to it.
                      </span>
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="cfg-space-key">
                        Space token
                      </label>
                      <div className="field__row">
                        <input
                          id="cfg-space-key"
                          className="input"
                          type={showKey ? 'text' : 'password'}
                          value={p.apiKey}
                          placeholder="hf_…"
                          spellCheck={false}
                          autoComplete="off"
                          onChange={(e) => setProvider({ apiKey: e.target.value })}
                        />
                        <button
                          className="icon-btn"
                          onClick={() => setShowKey((v) => !v)}
                          type="button"
                          aria-label={showKey ? 'Hide token' : 'Show token'}
                        >
                          <Icon name={showKey ? 'eyeOff' : 'eye'} size={15} />
                        </button>
                      </div>
                      <span className="field__hint">
                        Sent as <code>Authorization: Bearer …</code>. Stored in this browser only.
                      </span>
                    </div>
                  </>
                ) : null}

                {p.transport === 'direct' ? (
                  <>
                    <div className="field">
                      <span className="field__label">Common endpoints</span>
                      <div className="field__row" style={{ flexWrap: 'wrap' }}>
                        {PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            className="ghost-btn"
                            style={{ height: 30, fontSize: 12.5 }}
                            title={preset.note}
                            onClick={() =>
                              setProvider({
                                baseUrl: preset.baseUrl,
                                authHeader: preset.authHeader,
                                authFormat: preset.authFormat,
                              })
                            }
                            type="button"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="cfg-base">
                        Base URL
                      </label>
                      <input
                        id="cfg-base"
                        className="input"
                        value={p.baseUrl}
                        placeholder="https://your-endpoint/v1"
                        spellCheck={false}
                        onChange={(e) => setProvider({ baseUrl: e.target.value })}
                      />
                      <span className="field__hint">
                        ShadowAI appends <code>/chat/completions</code>. Include the version segment
                        if your endpoint expects it.
                      </span>
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="cfg-key">
                        API key
                      </label>
                      <div className="field__row">
                        <input
                          id="cfg-key"
                          className="input"
                          type={showKey ? 'text' : 'password'}
                          value={p.apiKey}
                          placeholder={keyless ? 'Not required for this endpoint' : 'sk-…'}
                          spellCheck={false}
                          autoComplete="off"
                          onChange={(e) => setProvider({ apiKey: e.target.value })}
                        />
                        <button
                          className="icon-btn"
                          onClick={() => setShowKey((v) => !v)}
                          type="button"
                          aria-label={showKey ? 'Hide key' : 'Show key'}
                        >
                          <Icon name={showKey ? 'eyeOff' : 'eye'} size={15} />
                        </button>
                      </div>
                    </div>

                    <details style={{ marginBottom: 16 }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontSize: 12.5,
                          color: 'var(--muted)',
                          padding: '4px 0',
                        }}
                      >
                        Advanced auth
                      </summary>
                      <div style={{ paddingTop: 10 }}>
                        <div className="field">
                          <label className="field__label" htmlFor="cfg-hdr">
                            Auth header
                          </label>
                          <input
                            id="cfg-hdr"
                            className="input"
                            value={p.authHeader}
                            placeholder="Authorization"
                            spellCheck={false}
                            onChange={(e) => setProvider({ authHeader: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor="cfg-fmt">
                            Value format
                          </label>
                          <input
                            id="cfg-fmt"
                            className="input"
                            value={p.authFormat}
                            placeholder="Bearer {key}"
                            spellCheck={false}
                            onChange={(e) => setProvider({ authFormat: e.target.value })}
                          />
                          <span className="field__hint">
                            <code>{'{key}'}</code> is replaced with your key.
                          </span>
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor="cfg-headers">
                            Extra headers (JSON)
                          </label>
                          <textarea
                            id="cfg-headers"
                            className="textarea textarea--mono"
                            value={p.headersJson}
                            spellCheck={false}
                            onChange={(e) => setProvider({ headersJson: e.target.value })}
                          />
                        </div>
                      </div>
                    </details>
                  </>
                ) : null}
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Models</h3>
                <p className="settings-group__desc">
                  Only the models listed here appear in the composer selector.
                </p>
                <div className="model-list">
                  {models.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--muted-2)', margin: '4px 0 12px' }}>
                      No models yet — add the model id your endpoint expects.
                    </p>
                  ) : null}
                  {models.map((m, i) => (
                    <div key={m.id || uid('m') + i} className={cx('model-row', m.id === p.selectedModel && 'is-selected')}>
                      <input
                        className="model-row__name"
                        value={m.id}
                        placeholder="model-id"
                        spellCheck={false}
                        aria-label="Model id"
                        onChange={(e) => patchModel(i, { id: e.target.value })}
                      />
                      <input
                        className="model-row__label"
                        value={m.label}
                        placeholder="Display name"
                        aria-label="Display name"
                        onChange={(e) => patchModel(i, { label: e.target.value })}
                      />
                      <button
                        className={cx('solid-btn', m.id === p.selectedModel && 'solid-btn--accent')}
                        style={{ height: 30, fontSize: 12.5 }}
                        onClick={() => setProvider({ selectedModel: m.id })}
                        type="button"
                      >
                        {m.id === p.selectedModel ? 'Default' : 'Use'}
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => removeModel(i)}
                        type="button"
                        aria-label="Remove model"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="field__row">
                  <button className="solid-btn" onClick={addModel} type="button">
                    <Icon name="plus" size={14} />
                    Add model
                  </button>
                  <button className="solid-btn" onClick={onTest} disabled={testing} type="button">
                    <Icon name="refresh" size={14} />
                    {testing ? 'Testing…' : 'Test connection'}
                  </button>
                </div>
                {health ? (
                  <div
                    className="inline-error"
                    style={{
                      marginTop: 12,
                      background: health.ok ? 'var(--accent-softer)' : 'var(--danger-soft)',
                      borderColor: health.ok ? 'var(--accent-line)' : 'rgba(248,113,113,0.28)',
                    }}
                  >
                    <div
                      className="inline-error__head"
                      style={{ color: health.ok ? 'var(--accent-bright)' : '#fecaca' }}
                    >
                      <Icon name={health.ok ? 'check' : 'alert'} size={15} style={{ flex: 'none', marginTop: 1 }} />
                      <span>{health.message || (health.ok ? 'Connected.' : 'Could not connect.')}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Generation</h3>
                <p className="settings-group__desc">Defaults applied to every request.</p>
                <div className="field">
                  <span className="field__label">Temperature — {p.temperature.toFixed(2)}</span>
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={p.temperature}
                    onChange={(e) => setProvider({ temperature: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="cfg-max">
                    Max output tokens
                  </label>
                  <input
                    id="cfg-max"
                    className="input"
                    type="number"
                    min={128}
                    max={131072}
                    step={128}
                    value={p.maxTokens}
                    onChange={(e) => setProvider({ maxTokens: Number(e.target.value) || 2048 })}
                  />
                </div>
                <Row title="Stream responses" desc="Turn off only if your endpoint cannot stream.">
                  <Switch on={p.stream} onChange={(v) => setProvider({ stream: v })} label="Stream responses" />
                </Row>
                <div className="field" style={{ marginTop: 16 }}>
                  <label className="field__label" htmlFor="cfg-sys">
                    System prompt
                  </label>
                  <textarea
                    id="cfg-sys"
                    className="textarea"
                    value={p.systemPrompt}
                    spellCheck={false}
                    onChange={(e) => setProvider({ systemPrompt: e.target.value })}
                  />
                  <span className="field__hint">
                    Defines ShadowAI's behaviour. Agent mode appends its own task-execution rules on top.
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {/* ------------------------------------------------------- account */}
          {tab === 'account' ? (
            <>
              <div className="settings-group">
                <h3 className="settings-group__title">Your account</h3>
                <p className="settings-group__desc">
                  Signed in with Firebase. Your conversations sync to this account and are readable only
                  by you.
                </p>

                <div className="profile-head">
                  <span className="profile-avatar">
                    {account.photoURL ? (
                      <img src={account.photoURL} alt="" />
                    ) : (
                      (account.displayName || 'S').slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="profile-name">{account.displayName || 'ShadowMotion user'}</div>
                    <div className="profile-email">{account.email || '—'}</div>
                    <div className="profile-facts">
                      <span className="fact">
                        <Icon name="shield" size={12} />
                        Authenticated
                      </span>
                      {account.role ? (
                        <span className="fact">
                          <Icon name="user" size={12} />
                          {account.role}
                        </span>
                      ) : null}
                      <span className="fact">
                        <Icon name="database" size={12} />
                        {stats.conversations} conversation{stats.conversations === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="field" style={{ marginTop: 18 }}>
                  <label className="field__label" htmlFor="acc-name">
                    Display name
                  </label>
                  <input
                    id="acc-name"
                    className="input"
                    value={settings.account.displayName}
                    placeholder="Your name"
                    onChange={(e) => setAccount({ displayName: e.target.value })}
                  />
                  <span className="field__hint">
                    Used for the greeting in the sidebar. Your Firebase profile is unchanged.
                  </span>
                </div>

                <div className="field">
                  <span className="field__label">Sign-in method</span>
                  <div className="field__row">
                    <span className="badge badge--accent">
                      <Icon name={account.email.includes('@') ? 'mail' : 'user'} size={12} />
                      {account.email || 'Google'}
                    </span>
                    <span className="badge">Firebase Auth</span>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Session</h3>
                <p className="settings-group__desc">Sign out on this device.</p>
                <button className="solid-btn solid-btn--danger" onClick={() => void onSignOut()} type="button">
                  <Icon name="logout" size={14} />
                  Sign out
                </button>
              </div>
            </>
          ) : null}

          {/* ---------------------------------------------------------- data */}
          {tab === 'data' ? (
            <>
              <div className="settings-group">
                <h3 className="settings-group__title">Local data</h3>
                <p className="settings-group__desc">
                  Conversations live in this browser's local storage.
                </p>
                <Row title="Conversations" desc="Saved on this device.">
                  <span className="badge">{stats.conversations}</span>
                </Row>
                <Row title="Messages" desc="Across all conversations.">
                  <span className="badge">{stats.messages}</span>
                </Row>
                <Row title="Saved responses" desc="Responses you bookmarked.">
                  <span className="badge">{stats.saved}</span>
                </Row>
                <Row title="Storage used" desc="Approximate, including attachments.">
                  <span className="badge">{formatBytes(stats.bytes)}</span>
                </Row>
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Export & import</h3>
                <p className="settings-group__desc">
                  A single JSON file containing every conversation, message, and generated file.
                </p>
                <div className="field__row" style={{ flexWrap: 'wrap' }}>
                  <button className="solid-btn" onClick={onExport} type="button">
                    <Icon name="download" size={14} />
                    Export all
                  </button>
                  <label className="solid-btn" style={{ cursor: 'pointer' }}>
                    <Icon name="upload" size={14} />
                    Import
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onImport(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group__title">Danger zone</h3>
                <p className="settings-group__desc">Removes every conversation from this device.</p>
                {confirmClear ? (
                  <div className="field__row">
                    <button
                      className="solid-btn solid-btn--danger"
                      onClick={() => {
                        onClear()
                        setConfirmClear(false)
                      }}
                      type="button"
                    >
                      Yes, delete everything
                    </button>
                    <button className="ghost-btn" onClick={() => setConfirmClear(false)} type="button">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="solid-btn solid-btn--danger" onClick={() => setConfirmClear(true)} type="button">
                    <Icon name="trash" size={14} />
                    Delete all conversations
                  </button>
                )}
              </div>
            </>
          ) : null}

          {/* ----------------------------------------------------- shortcuts */}
          {tab === 'shortcuts' ? (
            <div className="settings-group">
              <h3 className="settings-group__title">Keyboard</h3>
              <p className="settings-group__desc">ShadowAI is built to be driven from the keyboard.</p>
              <div className="shortcut-table">
                {shortcuts.map((s) => (
                  <div key={s.label} className="shortcut-row">
                    <span className="row-between__title">{s.label}</span>
                    <span className="shortcut-row__keys">
                      {s.keys.map((k) => (
                        <kbd key={k} className="key">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20 }}>
                <Row title="Enter sends the message" desc="Hold Shift for a new line.">
                  <Switch
                    on={settings.appearance.sendOnEnter}
                    onChange={(v) => setAppearance({ sendOnEnter: v })}
                    label="Enter sends"
                  />
                </Row>
              </div>
            </div>
          ) : null}

          {/* --------------------------------------------------------- about */}
          {tab === 'about' ? (
            <div className="about">
              <Mark size={72} />
              <div>
                <div className="about__name">ShadowAI</div>
                <div className="about__by">by ShadowMotion</div>
              </div>
              <p className="about__desc">
                A conversation-first AI workspace. Chat when you need an answer, switch to Agent when
                the work takes several steps, and keep everything — files included — in one thread.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="badge">v1.0.0</span>
                <span className="badge">Bring your own model</span>
                <span className="badge">Runs locally</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

function transportSource(transport: Transport): string {
  return transport === 'server' ? 'ShadowAI backend' : 'custom'
}
