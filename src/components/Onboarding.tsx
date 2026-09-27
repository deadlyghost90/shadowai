import { useMemo, useState } from 'react'
import { Mark } from './Mark'
import { Icon, type IconName } from './Icon'
import { cx } from '../lib/utils'
import type { OnboardingAnswers } from '../lib/cloud'

/**
 * Onboarding — nine questions, one per screen.
 *
 * Short enough to finish in under a minute, specific enough to be worth asking.
 * Every answer is written to the user's Firebase profile and is editable later.
 */

type QKind = 'text' | 'single' | 'multi'

interface Option {
  value: string
  label: string
  icon?: IconName
  hint?: string
}

interface Question {
  id: keyof OnboardingAnswers
  kind: QKind
  question: string
  hint?: string
  placeholder?: string
  required?: boolean
  options?: Option[]
}

const QUESTIONS: Question[] = [
  {
    id: 'displayName',
    kind: 'text',
    question: 'What should ShadowAI call you?',
    hint: 'This is how your workspace greets you.',
    placeholder: 'Your name',
    required: true,
  },
  {
    id: 'heardFrom',
    kind: 'single',
    question: 'Where did you hear about us?',
    options: [
      { value: 'Social media', label: 'Social media' },
      { value: 'Friend or colleague', label: 'Friend or colleague' },
      { value: 'YouTube or video', label: 'YouTube or video' },
      { value: 'Search engine', label: 'Search engine' },
      { value: 'GitHub', label: 'GitHub' },
      { value: 'Newsletter', label: 'Newsletter' },
      { value: 'School or work', label: 'School or work' },
      { value: 'Somewhere else', label: 'Somewhere else' },
    ],
  },
  {
    id: 'role',
    kind: 'single',
    question: 'What best describes your role?',
    options: [
      { value: 'Developer', label: 'Developer', icon: 'code' },
      { value: 'Designer', label: 'Designer', icon: 'sparkle' },
      { value: 'Founder', label: 'Founder', icon: 'rocket' },
      { value: 'Product manager', label: 'Product manager', icon: 'layers' },
      { value: 'Researcher', label: 'Researcher', icon: 'book' },
      { value: 'Student', label: 'Student', icon: 'book' },
      { value: 'Marketer', label: 'Marketer', icon: 'megaphone' },
      { value: 'Something else', label: 'Something else' },
    ],
  },
  {
    id: 'goals',
    kind: 'multi',
    question: 'What will you mainly use ShadowAI for?',
    hint: 'Pick as many as apply.',
    options: [
      { value: 'Writing code', label: 'Writing code', icon: 'code' },
      { value: 'Research', label: 'Research', icon: 'globe' },
      { value: 'Writing and editing', label: 'Writing and editing', icon: 'book' },
      { value: 'Design', label: 'Design', icon: 'sparkle' },
      { value: 'Analysis', label: 'Analysis', icon: 'chart' },
      { value: 'Learning', label: 'Learning', icon: 'graduation' },
      { value: 'Data work', label: 'Data work', icon: 'database' },
      { value: 'Automating tasks', label: 'Automating tasks', icon: 'refresh' },
    ],
  },
  {
    id: 'experience',
    kind: 'single',
    question: 'How much do you use AI tools already?',
    options: [
      { value: 'Brand new', label: 'Brand new to this' },
      { value: 'Occasionally', label: 'Now and then' },
      { value: 'Every day', label: 'Every day' },
      { value: 'I build them', label: 'I build them' },
    ],
  },
  {
    id: 'interests',
    kind: 'multi',
    question: 'What are you into right now?',
    hint: 'Pick as many as apply.',
    options: [
      { value: 'AI and ML', label: 'AI and ML', icon: 'brain' },
      { value: 'Web development', label: 'Web dev', icon: 'code' },
      { value: 'Product and design', label: 'Product & design', icon: 'layers' },
      { value: 'Startups', label: 'Startups', icon: 'rocket' },
      { value: 'Science', label: 'Science', icon: 'globe' },
      { value: 'Career growth', label: 'Career growth', icon: 'chart' },
      { value: 'Content and media', label: 'Content & media', icon: 'megaphone' },
      { value: 'Freelancing', label: 'Freelancing', icon: 'compass' },
    ],
  },
  {
    id: 'teamSize',
    kind: 'single',
    question: 'Who is this workspace for?',
    options: [
      { value: 'Just me', label: 'Just me' },
      { value: 'A small team', label: 'A small team' },
      { value: 'A whole company', label: 'A whole company' },
    ],
  },
  {
    id: 'answerStyle',
    kind: 'single',
    question: 'How should ShadowAI answer you?',
    hint: 'You can change this any time in Settings.',
    options: [
      { value: 'Concise', label: 'Concise', hint: 'Shortest useful answer' },
      { value: 'Balanced', label: 'Balanced', hint: 'A short explanation too' },
      { value: 'Detailed', label: 'Detailed', hint: 'Show the full reasoning' },
    ],
  },
  {
    id: 'anythingElse',
    kind: 'text',
    question: 'Anything else we should know?',
    hint: 'Optional. Projects you are building, things you want it to be good at.',
    placeholder: 'Tell us in your own words…',
  },
]

const EMPTY: OnboardingAnswers = {
  displayName: '',
  role: '',
  heardFrom: '',
  goals: [],
  experience: '',
  interests: [],
  teamSize: '',
  answerStyle: 'Balanced',
  anythingElse: '',
}

export function Onboarding({
  initial,
  displayNameFallback,
  onDone,
  onSkip,
}: {
  initial?: Partial<OnboardingAnswers>
  displayNameFallback?: string
  onDone: (answers: OnboardingAnswers) => Promise<void>
  onSkip: () => Promise<void>
}) {
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    ...EMPTY,
    ...initial,
    displayName: initial?.displayName || displayNameFallback || '',
  })
  const [busy, setBusy] = useState(false)

  const q = QUESTIONS[i]
  const last = i === QUESTIONS.length - 1

  const listValue = (id: keyof OnboardingAnswers) => (answers[id] as string[]) ?? []
  const textValue = (id: keyof OnboardingAnswers) => (answers[id] as string) ?? ''

  const toggle = (value: string) => {
    const list = listValue(q.id)
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    setAnswers((a) => ({ ...a, [q.id]: next }))
  }

  const canContinue = useMemo(() => {
    if (q.kind === 'text') return q.required ? textValue(q.id).trim().length > 0 : true
    if (q.kind === 'multi') return true
    return textValue(q.id).length > 0
  }, [q, answers])

  const next = async () => {
    if (!canContinue) return
    if (!last) {
      setI((v) => v + 1)
      return
    }
    setBusy(true)
    try {
      await onDone(answers)
    } finally {
      setBusy(false)
    }
  }

  const back = () => setI((v) => Math.max(0, v - 1))

  return (
    <div className="gate">
      <div className="onb">
        <div className="onb__top">
          <Mark size={30} />
          <span className="onb__step">
            {i + 1} / {QUESTIONS.length}
          </span>
          <button className="onb__skip" onClick={() => void onSkip()} disabled={busy} type="button">
            Skip for now
          </button>
        </div>

        <div className="onb__bar" role="progressbar" aria-valuenow={i + 1} aria-valuemin={1} aria-valuemax={QUESTIONS.length}>
          {QUESTIONS.map((_, idx) => (
            <i key={idx} className={cx(idx <= i && 'is-done')} />
          ))}
        </div>

        <div className="onb__card" key={q.id}>
          <h2 className="onb__q">{q.question}</h2>
          {q.hint ? <p className="onb__hint">{q.hint}</p> : null}

          {q.kind === 'text' ? (
            <input
              className="input"
              autoFocus
              value={textValue(q.id)}
              placeholder={q.placeholder}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && canContinue && next()}
              style={{ fontSize: 15, padding: '13px 14px' }}
            />
          ) : (
            <div className={cx('onb__options', q.options!.length > 5 && 'onb__grid')}>
              {q.options!.map((o) => {
                const on =
                  q.kind === 'multi' ? listValue(q.id).includes(o.value) : textValue(q.id) === o.value
                return (
                  <button
                    key={o.value}
                    className={cx('opt', on && 'is-on')}
                    onClick={() => (q.kind === 'multi' ? toggle(o.value) : setAnswers((a) => ({ ...a, [q.id]: o.value })))}
                    type="button"
                    aria-pressed={on}
                  >
                    {o.icon ? (
                      <span className="opt__icon">
                        <Icon name={o.icon} size={15} />
                      </span>
                    ) : null}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block' }}>{o.label}</span>
                      {o.hint ? (
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted-2)', fontWeight: 400 }}>
                          {o.hint}
                        </span>
                      ) : null}
                    </span>
                    {on ? (
                      <span className="opt__check">
                        <Icon name="check" size={14} strokeWidth={2.4} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}

          <div className="onb__nav">
            {i > 0 ? (
              <button className="ghost-btn" onClick={back} type="button">
                <Icon name="chevronLeft" size={14} />
                Back
              </button>
            ) : null}
            <span className="onb__nav-spacer" />
            {q.kind === 'multi' ? (
              <span className="onb__counter">{listValue(q.id).length} selected</span>
            ) : null}
            <button
              className="solid-btn solid-btn--accent"
              style={{ height: 38 }}
              onClick={next}
              disabled={!canContinue || busy}
              type="button"
            >
              {busy ? <span className="spinner spinner--light" /> : null}
              {last ? 'Finish' : 'Continue'}
              {!busy ? <Icon name="chevronRight" size={14} /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
