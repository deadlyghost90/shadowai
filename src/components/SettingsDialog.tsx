import { useMemo, useState } from 'react'
import type { AppSettings } from '../lib/ai/config'
import { Icon, type IconName } from './Icon'
import { Mark } from './Mark'
import { Modal } from './Overlay'
import { cx, formatBytes } from '../lib/utils'

/**
 * Settings — deliberately secondary.
 *
 * Six small panels, no dashboard. The Connection panel keeps the app focused on one thing: getting your Shadow Space ready for work.
 */

export type SettingsTab =
  | 'appearance'
  | 'account'
  | 'data'
  | 'shortcuts'
  | 'about'

const TABS: { id: SettingsTab; label: string; icon: IconName }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'sparkle' },
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
  stats: { conversations: number; messages: number; bytes: number; saved: number }
  onExport: () => void
  onImport: (file: File) => void
  onClear: () => void
  account: { displayName: string; email: string; photoURL: string; role: string }
  onSignOut: () => Promise<void>
}) {
  const [confirmClear, setConfirmClear] = useState(false)

  const setAppearance = (patch: Partial<AppSettings['appearance']>) =>
    onChange({ ...settings, appearance: { ...settings.appearance, ...patch } })
  const setAccount = (patch: Partial<AppSettings['account']>) =>
    onChange({ ...settings, account: { ...settings.account, ...patch } })

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
                <span className="badge">Connected Space agent</span>
                <span className="badge">Runs locally</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
