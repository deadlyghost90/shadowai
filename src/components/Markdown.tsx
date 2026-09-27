import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

/**
 * Message typography.
 *
 * Deliberately not a card: AI output sits directly on the page with generous
 * line-height so a long answer stays comfortable to read.
 */

const components: Components = {
  code({ className, children, ...props }) {
    const raw = String(children ?? '')
    const match = /language-([\w+#-]+)/.exec(className || '')
    const isBlock = Boolean(match) || raw.includes('\n')
    if (!isBlock) {
      return <code className={className} {...props}>{children}</code>
    }
    return <CodeBlock code={raw.replace(/\n$/, '')} language={match?.[1]} />
  },
  pre({ children }) {
    return <>{children}</>
  },
  a({ href, children, ...props }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
        {children}
      </a>
    )
  },
  table({ children, ...props }) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table {...props}>{children}</table>
      </div>
    )
  },
  img({ src, alt }) {
    if (!src) return null
    return <img src={src} alt={alt ?? ''} loading="lazy" />
  },
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={(url) => {
          if (/^(https?:|mailto:|tel:|data:image\/|blob:)/i.test(url)) return url
          if (url.startsWith('/') || url.startsWith('./')) return url
          return url
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
