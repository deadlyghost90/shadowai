import { useMemo, useState } from 'react'
import type { Attachment, ArtifactFile, Message } from '../lib/ai/types'
import { parseArtifacts } from '../lib/ai/artifacts'
import { Markdown } from './Markdown'
import { Icon } from './Icon'
import { Mark } from './Mark'
import { AgentTaskView } from './AgentTaskView'
import { FileArtifacts } from './FileArtifacts'
import { cx, copyText, formatBytes, formatTime } from '../lib/utils'

function AttachmentIcon({ a }: { a: Attachment }) {
  if (a.kind === 'image') return <Icon name="image" size={13} />
  if (a.kind === 'archive') return <Icon name="zip" size={13} />
  if (a.kind === 'sheet' || a.kind === 'json') return <Icon name="database" size={13} />
  if (a.kind === 'code') return <Icon name="fileCode" size={13} />
  if (a.kind === 'doc') return <Icon name="book" size={13} />
  if (a.kind === 'pdf') return <Icon name="book" size={13} />
  return <Icon name="file" size={13} />
}

export interface MessageActions {
  regenerate: (id: string) => void
  continueReply: (id: string) => void
  editPrompt: (id: string) => void
  toggleSave: (id: string) => void
  openModelSettings: () => void
  stop: () => void
}

export function MessageItem({
  message,
  streaming,
  onOpenFile,
  actions,
  showTimestamps,
  isMobile,
  modelLabel,
}: {
  message: Message
  streaming: boolean
  onOpenFile: (file: ArtifactFile) => void
  actions: MessageActions
  showTimestamps: boolean
  isMobile: boolean
  modelLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  const parsed = useMemo(() => {
    if (!message.content.includes('```file:')) return null
    return parseArtifacts(message.content)
  }, [message.content])

  const text = parsed ? parsed.text : message.content

  const artifacts = useMemo(() => {
    const fromText = parsed?.artifacts ?? []
    const map = new Map((message.artifacts ?? []).map((a) => [a.path, a]))
    for (const a of fromText) if (!map.has(a.path)) map.set(a.path, a)
    return [...map.values()]
  }, [parsed, message.artifacts])

  const isUser = message.role === 'user'
  const hasContent = text.trim().length > 0
  const attachments = message.attachments ?? []

  const doCopy = async () => {
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <article className={cx('msg', isUser ? 'msg--user' : 'msg--assistant')} data-role={message.role}>
      {!isUser ? (
        <header className="msg__head">
          <span className="msg__avatar">
            <Mark size={17} tile={false} spin={streaming} />
          </span>
          <span className="msg__author">ShadowAI</span>
          {message.model ? <span className="msg__model">{modelLabel || message.model}</span> : null}
        </header>
      ) : null}

      {message.run ? (
        <AgentTaskView
          run={message.run}
          onStop={streaming ? actions.stop : undefined}
          isMobile={isMobile}
        />
      ) : null}

      {attachments.length ? (
        <div className="attach-row">
          {attachments.map((a) => (
            <div key={a.id} className={cx('chip', a.kind === 'image' && 'chip--image')}>
              {a.kind === 'image' && a.dataUrl ? (
                <img className="chip__thumb" src={a.dataUrl} alt={a.name} />
              ) : (
                <span className="chip__icon">
                  <AttachmentIcon a={a} />
                </span>
              )}
              <span className="chip__text">
                <span className="chip__name" title={a.name}>
                  {a.name}
                </span>
                <span className="chip__meta">
                  {formatBytes(a.size)}
                  {a.text === '' ? ' · not parsed' : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {isUser && !editing ? <div className="msg__bubble">{message.content}</div> : null}

      {isUser && editing ? (
        <div className="composer is-focused" style={{ width: '100%' }}>
          <textarea
            className="composer__input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(message.content)
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                setEditing(false)
                actions.editPrompt(message.id)
              }
            }}
          />
          <div className="composer__bar">
            <span className="composer__spacer" />
            <button
              className="ghost-btn"
              onClick={() => {
                setEditing(false)
                setDraft(message.content)
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="solid-btn solid-btn--accent"
              onClick={() => {
                setEditing(false)
                actions.editPrompt(message.id)
              }}
              type="button"
            >
              Resend
            </button>
          </div>
        </div>
      ) : null}

      {!isUser && hasContent ? (
        <div className={cx('msg__body', streaming && 'is-streaming')}>
          <Markdown>{text}</Markdown>
        </div>
      ) : null}

      {!isUser && !hasContent && streaming ? (
        <div className="thinking-row">
          {message.run ? (
            <span style={{ color: 'var(--muted)' }}>
              {message.run.status === 'planning' ? 'Planning task…' : 'Working…'}
            </span>
          ) : (
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      ) : null}

      {parsed?.pendingPath ? (
        <div className="chip" style={{ alignSelf: 'flex-start' }}>
          <span className="chip__icon">
            <Icon name="file" size={13} />
          </span>
          <span className="chip__text">
            <span className="chip__name">{parsed.pendingPath}</span>
            <span className="chip__meta">writing…</span>
          </span>
        </div>
      ) : null}

      {artifacts.length ? (
        <FileArtifacts files={artifacts} onOpenFile={onOpenFile} />
      ) : null}

      {message.error ? (
        <div className="inline-error">
          <div className="inline-error__head">
            <Icon name="alert" size={15} style={{ flex: 'none', marginTop: 1 }} />
            <span>{message.error}</span>
          </div>
          {message.errorHint ? <div className="inline-error__hint">{message.errorHint}</div> : null}
          <div className="inline-error__actions">
            <button className="solid-btn" onClick={() => actions.regenerate(message.id)} type="button">
              <Icon name="refresh" size={13} />
              Retry
            </button>
            <button className="solid-btn" onClick={actions.openModelSettings} type="button">
              <Icon name="settings" size={13} />
              {message.errorKind === 'auth' || message.errorKind === 'model' ? 'Model settings' : 'Try another model'}
            </button>
          </div>
        </div>
      ) : null}

      {message.stopped && !message.error ? (
        <div className="inline-error" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-2)' }}>
          <div className="inline-error__head" style={{ color: 'var(--text-2)' }}>
            <Icon name="stop" size={14} style={{ flex: 'none', marginTop: 2 }} />
            <span>You stopped this response.</span>
          </div>
          <div className="inline-error__actions">
            <button className="solid-btn" onClick={() => actions.continueReply(message.id)} type="button">
              <Icon name="play" size={13} />
              Continue
            </button>
            <button className="solid-btn" onClick={() => actions.regenerate(message.id)} type="button">
              <Icon name="refresh" size={13} />
              Regenerate
            </button>
          </div>
        </div>
      ) : null}

      {isUser && !editing ? (
        <div className="msg__actions is-visible">
          <button
            className="act"
            onClick={() => {
              setDraft(message.content)
              setEditing(true)
            }}
            type="button"
          >
            <Icon name="edit" size={13} />
            Edit
          </button>
        </div>
      ) : null}

      {!isUser && !streaming && (hasContent || artifacts.length) ? (
        <div className="msg__actions">
          <button className="act" onClick={doCopy} type="button">
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="act" onClick={() => actions.regenerate(message.id)} type="button">
            <Icon name="refresh" size={13} />
            Regenerate
          </button>
          <button className="act" onClick={() => actions.continueReply(message.id)} type="button">
            <Icon name="play" size={13} />
            Continue
          </button>
          <button
            className={cx('act', message.saved && 'is-on')}
            onClick={() => actions.toggleSave(message.id)}
            type="button"
          >
            <Icon
              name={message.saved ? 'bookmarkFill' : 'bookmark'}
              size={13}
              fill={message.saved ? 'currentColor' : 'none'}
            />
            {message.saved ? 'Saved' : 'Save'}
          </button>
        </div>
      ) : null}

      {showTimestamps ? (
        <div className="msg__meta is-visible">
          <span>{formatTime(message.createdAt)}</span>
          {!isUser && message.mode === 'agent' ? <span className="badge badge--accent">Agent</span> : null}
          {message.stopped && !message.error ? <span className="badge">Stopped</span> : null}
        </div>
      ) : null}
    </article>
  )
}
