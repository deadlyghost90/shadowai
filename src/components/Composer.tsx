import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Attachment, Mode, ProviderModel } from '../lib/ai/types'
import { Icon } from './Icon'
import { Popover, useAnchored } from './Overlay'
import { cx, formatBytes } from '../lib/utils'
import { ACCEPTED, MAX_FILES } from '../lib/attachments'

/**
 * The prompt composer.
 *
 * Everything that matters for a turn lives in one floating surface: the text
 * field, attachments, mode, model, and the send/stop control. It stays docked
 * to the bottom and grows with the message instead of scrolling away.
 */

function kindIcon(a: Attachment) {
  if (a.kind === 'image') return 'image' as const
  if (a.kind === 'archive') return 'zip' as const
  if (a.kind === 'sheet' || a.kind === 'json') return 'database' as const
  if (a.kind === 'code') return 'fileCode' as const
  if (a.kind === 'doc') return 'book' as const
  return 'file' as const
}

const MAX_HEIGHT = 320

export interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onStop: () => void
  busy: boolean
  mode: Mode
  onModeChange: (m: Mode) => void
  models: ProviderModel[]
  model: string
  modelLabel: string
  onModelChange: (id: string) => void
  onConfigureModel: () => void
  attachments: Attachment[]
  onFiles: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  sendOnEnter: boolean
  ready: boolean
  statusText: string
  busyText?: string
  textareaRef?: RefObject<HTMLTextAreaElement>
}

export function Composer(props: ComposerProps) {
  const {
    value,
    onChange,
    onSubmit,
    onStop,
    busy,
    mode,
    onModeChange,
    models,
    model,
    modelLabel,
    onModelChange,
    onConfigureModel,
    attachments,
    onFiles,
    onRemoveAttachment,
    sendOnEnter,
    ready,
    statusText,
  } = props

  const ta = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const modeAnchor = useAnchored()
  const modelAnchor = useAnchored()

  const resize = useCallback(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [])

  useEffect(resize, [value, resize])

  useEffect(() => {
    if (!busy) ta.current?.focus()
  }, [busy])

  // closing one menu closes the other
  useEffect(() => {
    if (modeAnchor.open) modelAnchor.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeAnchor.open])
  useEffect(() => {
    if (modelAnchor.open) modeAnchor.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelAnchor.open])

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || !list.length) return
      const room = MAX_FILES - attachments.length
      if (room <= 0) return
      onFiles(Array.from(list).slice(0, room))
    },
    [attachments.length, onFiles],
  )

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || [])
    if (files.length) {
      e.preventDefault()
      handleFiles(files as unknown as FileList)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const shouldSend = sendOnEnter ? !e.altKey : e.metaKey || e.ctrlKey
    if (shouldSend) {
      e.preventDefault()
      onSubmit()
    }
  }

  const canSend = (value.trim().length > 0 || attachments.length > 0) && ready && !busy
  const modelCount = models.length
  const modelListHeight = Math.min(200, 46 + modelCount * 44)

  return (
    <div className="composer-dock">
      <div
        className={cx('composer', focused && 'is-focused', dragging && 'is-dragging')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        {dragging ? <div className="composer__drop">Drop files to attach</div> : null}

        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {attachments.length ? (
          <div className="composer__attachments">
            {attachments.map((a) => (
              <div key={a.id} className={cx('chip', a.kind === 'image' && 'chip--image')}>
                {a.kind === 'image' && a.dataUrl ? (
                  <img className="chip__thumb" src={a.dataUrl} alt="" />
                ) : (
                  <span className="chip__icon">
                    <Icon name={kindIcon(a)} size={13} />
                  </span>
                )}
                <span className="chip__text">
                  <span className="chip__name" title={a.name}>
                    {a.name}
                  </span>
                  <span className="chip__meta">{formatBytes(a.size)}</span>
                </span>
                <button
                  className="chip__remove"
                  onClick={() => onRemoveAttachment(a.id)}
                  type="button"
                  aria-label={`Remove ${a.name}`}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          ref={props.textareaRef ?? ta}
          id="shadowai-composer"
          className="composer__input"
          value={value}
          rows={1}
          placeholder="Ask ShadowAI anything..."
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Message ShadowAI"
        />

        <div className="composer__bar">
          <button
            className="icon-btn"
            onClick={() => fileInput.current?.click()}
            type="button"
            title="Attach files"
            aria-label="Attach files"
          >
            <Icon name="paperclip" size={16} />
          </button>

          <button
            ref={modeAnchor.ref}
            className={cx('pill', 'pill--mode', 'pill--agent')}
            data-mode={mode}
            onClick={modeAnchor.toggle}
            type="button"
            aria-expanded={modeAnchor.open}
            aria-haspopup="menu"
          >
            <Icon name={mode === 'agent' ? 'sparkle' : 'chat'} size={13} />
            <span className="pill__label">{mode === 'agent' ? 'Agent' : 'Chat'}</span>
            <Icon name="chevronDown" size={11} className="pill__chev" />
          </button>

          <button
            ref={modelAnchor.ref}
            className="pill"
            onClick={modelAnchor.toggle}
            type="button"
            aria-expanded={modelAnchor.open}
            aria-haspopup="menu"
            title={modelCount ? modelLabel : 'Connect a model in Settings → Model'}
          >
            <span
              className="pill__dot"
              style={{ color: modelCount ? 'var(--accent)' : 'var(--muted-2)' }}
            />
            <span className="pill__label">{modelCount ? modelLabel || model : 'No model'}</span>
            <Icon name="chevronDown" size={11} className="pill__chev" />
          </button>

          <span className="composer__spacer" />

          <button
            className={cx('composer__send', canSend && 'is-ready', busy && 'is-stop')}
            onClick={busy ? onStop : onSubmit}
            type="button"
            disabled={!busy && !canSend}
            title={busy ? 'Stop generating' : 'Send'}
            aria-label={busy ? 'Stop generating' : 'Send message'}
          >
            {busy ? <Icon name="stop" size={14} fill="currentColor" /> : <Icon name="send" size={15} />}
          </button>
        </div>
      </div>

      <div className="composer__hint">
        <span className="composer__hint-left">
          <span className="composer__hint-text">{busy && props.busyText ? props.busyText : statusText}</span>
        </span>
        <span className="composer__hint-right">
          <kbd>{sendOnEnter ? 'Enter' : '⌘↵'}</kbd> to send
        </span>
      </div>

      <Popover
        open={modeAnchor.open}
        anchor={modeAnchor.anchor}
        onClose={modeAnchor.close}
        width={264}
        ariaLabel="Mode"
      >
        <div className="popover__head">Mode</div>
        <button
          className={cx('menu-item', mode === 'chat' && 'is-selected')}
          onClick={() => {
            onModeChange('chat')
            modeAnchor.close()
          }}
          type="button"
        >
          <Icon name="chat" size={15} style={{ color: 'var(--muted)' }} />
          <span className="menu-item__body">
            <span className="menu-item__title">Chat</span>
            <span className="menu-item__sub">Direct conversation, streamed</span>
          </span>
          {mode === 'chat' ? <Icon name="check" size={14} className="menu-item__check" /> : null}
        </button>
        <button
          className={cx('menu-item', mode === 'agent' && 'is-selected')}
          onClick={() => {
            onModeChange('agent')
            modeAnchor.close()
          }}
          type="button"
        >
          <Icon name="sparkle" size={15} style={{ color: 'var(--accent)' }} />
          <span className="menu-item__body">
            <span className="menu-item__title">Agent</span>
            <span className="menu-item__sub">Multi-step tasks with visible progress</span>
          </span>
          {mode === 'agent' ? <Icon name="check" size={14} className="menu-item__check" /> : null}
        </button>
      </Popover>

      <Popover
        open={modelAnchor.open}
        anchor={modelAnchor.anchor}
        onClose={modelAnchor.close}
        width={292}
        ariaLabel="Model"
      >
        <div className="popover__head">Model</div>
        {modelCount === 0 ? (
          <div className="popover__empty">
            No models configured yet.
            <br />
            Connect your AI model to start.
          </div>
        ) : (
          models.map((m) => (
            <button
              key={m.id}
              className={cx('menu-item', m.id === model && 'is-selected')}
              onClick={() => {
                onModelChange(m.id)
                modelAnchor.close()
              }}
              type="button"
            >
              <span className="menu-item__body">
                <span className="menu-item__title">{m.label || m.id}</span>
                {m.source ? <span className="menu-item__sub">{m.source}</span> : null}
              </span>
              {m.id === model ? <Icon name="check" size={14} className="menu-item__check" /> : null}
            </button>
          ))
        )}
        <div className="menu-sep" />
        <button
          className="menu-item"
          onClick={() => {
            modelAnchor.close()
            onConfigureModel()
          }}
          type="button"
        >
          <Icon name="settings" size={14} style={{ color: 'var(--muted)' }} />
          <span className="menu-item__body">
            <span className="menu-item__title">Manage models</span>
          </span>
        </button>
      </Popover>

      {/* keeps the popover height hint honest if the model list is long */}
      <span hidden data-hint={modelListHeight} />
    </div>
  )
}
