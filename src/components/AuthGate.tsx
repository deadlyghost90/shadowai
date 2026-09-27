import { useState } from 'react'
import { Mark } from './Mark'
import { Icon } from './Icon'
import {
  authErrorMessage,
  sendReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/firebase'

/**
 * Sign in / sign up.
 *
 * Two paths, both short: Google in one click, or email and password. Nothing
 * here is a dashboard — it is a door, so it stays out of the way and gets out
 * of the way.
 */

type View = 'signin' | 'signup' | 'reset'

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

export function AuthGate({ notice }: { notice?: string | null }) {
  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const canSubmit =
    email.trim().length > 3 && password.length >= 6 && (view !== 'signup' || name.trim().length > 0)

  const reset = () => {
    setError(null)
    setSent(false)
  }

  const withGoogle = async () => {
    setBusy(true)
    reset()
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(authErrorMessage(e))
      setBusy(false)
    }
  }

  const withEmail = async () => {
    if (!canSubmit) return
    setBusy(true)
    reset()
    try {
      if (view === 'signup') await signUpWithEmail(email.trim(), password, name)
      else await signInWithEmail(email.trim(), password)
    } catch (e) {
      setError(authErrorMessage(e))
      setBusy(false)
    }
  }

  const withReset = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then tap send again.')
      return
    }
    setBusy(true)
    reset()
    try {
      await sendReset(email.trim())
      setSent(true)
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate__card">
        <header className="gate__head">
          <Mark size={56} />
          <h1 className="gate__title">ShadowAI</h1>
          <p className="gate__sub">
            {view === 'signup'
              ? 'Create your workspace — your conversations sync to your account.'
              : view === 'reset'
                ? 'We will email you a link to set a new password.'
                : 'Your AI. Your workspace. Sign in to pick up your conversations.'}
          </p>
        </header>

        {notice ? (
          <div className="gate__error" style={{ background: 'var(--accent-softer)', borderColor: 'var(--accent-line)', color: 'var(--accent-bright)' }}>
            <Icon name="info" size={14} style={{ flex: 'none', marginTop: 1 }} />
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="gate__panel">
          {view !== 'reset' ? (
            <>
              <button className="google-btn" onClick={withGoogle} disabled={busy} type="button">
                {busy ? <span className="spinner" /> : <GoogleGlyph />}
                Continue with Google
              </button>
              <div className="divider-or">or</div>
            </>
          ) : null}

          {error ? (
            <div className="gate__error">
              <Icon name="alert" size={14} style={{ flex: 'none', marginTop: 1 }} />
              <span>{error}</span>
            </div>
          ) : null}

          {view === 'reset' ? (
            <>
              {sent ? (
                <div
                  className="gate__error"
                  style={{
                    background: 'var(--accent-softer)',
                    borderColor: 'var(--accent-line)',
                    color: 'var(--accent-bright)',
                  }}
                >
                  <Icon name="check" size={14} style={{ flex: 'none', marginTop: 1 }} />
                  <span>Reset link sent to {email}. Check your inbox.</span>
                </div>
              ) : null}
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="solid-btn solid-btn--accent" style={{ height: 42 }} onClick={withReset} disabled={busy} type="button">
                {busy ? <span className="spinner spinner--light" /> : <Icon name="key" size={15} />}
                Send reset link
              </button>
              <button
                className="gate__link"
                onClick={() => {
                  reset()
                  setView('signin')
                }}
                type="button"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              {view === 'signup' ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field__label" htmlFor="auth-name">
                    Your name
                  </label>
                  <input
                    id="auth-name"
                    className="input"
                    autoComplete="name"
                    value={name}
                    placeholder="What should ShadowAI call you?"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && withEmail()}
                />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field__label" htmlFor="auth-pass">
                    Password
                  </label>
                  {view === 'signin' ? (
                    <button
                      className="gate__link"
                      onClick={() => {
                        reset()
                        setView('reset')
                      }}
                      type="button"
                      style={{ fontSize: 12 }}
                    >
                      Forgot?
                    </button>
                  ) : null}
                </div>
                <input
                  id="auth-pass"
                  className="input"
                  type="password"
                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  placeholder={view === 'signup' ? 'At least 6 characters' : '••••••••'}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && withEmail()}
                />
              </div>

              <button
                className="solid-btn solid-btn--accent"
                style={{ height: 42 }}
                onClick={withEmail}
                disabled={!canSubmit || busy}
                type="button"
              >
                {busy ? <span className="spinner spinner--light" /> : <Icon name="arrowDown" size={15} style={{ transform: 'rotate(-90deg)' }} />}
                {view === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </>
          )}
        </div>

        <p className="gate__foot">
          {view === 'signin' ? (
            <>
              New here?{' '}
              <button
                className="gate__link"
                onClick={() => {
                  reset()
                  setView('signup')
                }}
                type="button"
              >
                Create an account
              </button>
            </>
          ) : view === 'signup' ? (
            <>
              Already have one?{' '}
              <button
                className="gate__link"
                onClick={() => {
                  reset()
                  setView('signin')
                }}
                type="button"
              >
                Sign in
              </button>
            </>
          ) : (
            'ShadowAI by ShadowMotion'
          )}
        </p>

        <p className="gate__note" style={{ justifyContent: 'center' }}>
          <Icon name="lock" size={13} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            Conversations are private to your account and readable only by you.
          </span>
        </p>
      </div>
    </div>
  )
}
