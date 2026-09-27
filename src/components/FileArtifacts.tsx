import { useMemo, useState } from 'react'
import type { ArtifactFile } from '../lib/ai/types'
import { Icon } from './Icon'
import { useFocusTrap } from './Overlay'
import { copyText, downloadText, formatBytes, safeName } from '../lib/files'

/**
 * Generated files, rendered as part of the AI response.
 *
 * Open renders the file in place (HTML in a sandboxed frame, images inline,
 * code as text). Preview reveals the full source. Everything can be downloaded
 * individually or as one ZIP.
 */

function iconFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  if (['html', 'htm', 'vue', 'svelte'].includes(ext)) return 'globe' as const
  if (['css', 'scss'].includes(ext)) return 'chart' as const
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'php', 'sh'].includes(ext)) return 'fileCode' as const
  if (['json', 'yml', 'yaml', 'toml'].includes(ext)) return 'database' as const
  if (['md', 'txt'].includes(ext)) return 'book' as const
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image' as const
  if (['zip', 'tar', 'gz'].includes(ext)) return 'zip' as const
  return 'file' as const
}

const OPENABLE = new Set(['html', 'htm'])

export function FileArtifacts({ files, onOpenFile }: { files: ArtifactFile[]; onOpenFile: (f: ArtifactFile) => void }) {
  const [zipping, setZipping] = useState(false)
  const total = useMemo(() => files.reduce((a, f) => a + f.size, 0), [files])

  if (!files.length) return null

  const downloadZip = async () => {
    setZipping(true)
    try {
      const { zipArtifacts } = await import('../lib/zip')
      await zipArtifacts(files, 'shadowai-files.zip')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="files">
      <div className="files__head">
        <Icon name="folder" size={15} style={{ color: 'var(--accent)' }} />
        <span className="files__count">
          {files.length === 1 ? 'Created 1 file' : `Created ${files.length} files`}
          <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}> · {formatBytes(total)}</span>
        </span>
        <button className="files__zip" onClick={downloadZip} disabled={zipping} type="button">
          <Icon name="zip" size={12.5} />
          {zipping ? 'Zipping…' : 'Download ZIP'}
        </button>
      </div>
      <ul className="files__list">
        {files.map((f) => {
          const canOpen = OPENABLE.has((f.path.split('.').pop() || '').toLowerCase()) || f.path.endsWith('.svg')
          return (
            <li key={f.path} className="file-row">
              <span className="file-row__icon">
                <Icon name={iconFor(f.path)} size={14} />
              </span>
              <span className="file-row__meta">
                <span className="file-row__path" title={f.path}>
                  {f.path}
                </span>
                <span className="file-row__size">
                  {f.path.includes('/') ? `${safeName(f.path)} · ` : ''}
                  {formatBytes(f.size)}
                </span>
              </span>
              <span className="file-row__actions">
                {canOpen ? (
                  <button
                    className="file-row__btn"
                    onClick={() => onOpenFile(f)}
                    title="Open"
                    type="button"
                  >
                    <Icon name="play" size={13} />
                  </button>
                ) : null}
                <button
                  className="file-row__btn"
                  onClick={() => onOpenFile(f)}
                  title="Preview source"
                  type="button"
                >
                  <Icon name="eye" size={13} />
                </button>
                <button
                  className="file-row__btn"
                  onClick={() => downloadText(f.content, safeName(f.path), 'text/plain')}
                  title="Download"
                  type="button"
                >
                  <Icon name="download" size={13} />
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function FilePreview({
  file,
  onClose,
  onDownloadZip,
}: {
  file: ArtifactFile | null
  onClose: () => void
  onDownloadZip: (files: ArtifactFile[]) => void
}) {
  const ref = useFocusTrap<HTMLDivElement>(!!file)
  const [copied, setCopied] = useState(false)

  if (!file) return null

  const ext = (file.path.split('.').pop() || '').toLowerCase()
  const asHtml = OPENABLE.has(ext)
  const asImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
  const isImageData = asImage && /data:image\/|^\s*<svg/i.test(file.content)

  const onCopy = async () => {
    if (await copyText(file.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div
      className="preview"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="preview__panel" ref={ref} role="dialog" aria-label={`Preview ${file.path}`}>
        <div className="preview__bar">
          <Icon name={iconFor(file.path)} size={14} style={{ color: 'var(--muted)' }} />
          <span className="preview__name">{file.path}</span>
          <button className="code__btn" onClick={onCopy} type="button">
            <Icon name={copied ? 'check' : 'copy'} size={12.5} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="code__btn"
            onClick={() => onDownloadZip([file])}
            type="button"
            title="Download as ZIP"
          >
            <Icon name="zip" size={12.5} />
          </button>
          <button
            className="code__btn"
            onClick={() => downloadText(file.content, safeName(file.path), 'text/plain')}
            type="button"
          >
            <Icon name="download" size={12.5} />
            Download
          </button>
          <button className="icon-btn" onClick={onClose} type="button" aria-label="Close preview">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="preview__body">
          {asHtml ? (
            <iframe
              title={file.path}
              srcDoc={file.content}
              sandbox="allow-scripts allow-forms allow-modals"
            />
          ) : isImageData ? (
            <div style={{ padding: 20, display: 'grid', placeItems: 'center' }}>
              <img
                alt={file.path}
                src={ext === 'svg' ? `data:image/svg+xml;utf8,${encodeURIComponent(file.content)}` : file.content}
                style={{ maxWidth: '100%', borderRadius: 10 }}
              />
            </div>
          ) : (
            <pre>
              <code>{file.content}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
