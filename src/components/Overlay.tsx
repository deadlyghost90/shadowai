import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

export interface PopoverAnchor {
  rect: DOMRect
}

interface PopoverProps {
  open: boolean
  anchor: PopoverAnchor | null
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  side?: 'auto' | 'top' | 'bottom'
  width?: number
  role?: string
  ariaLabel?: string
}

const GAP = 8
const MARGIN = 10

/**
 * Anchored popover rendered in a portal so it can escape the sidebar's
 * overflow and stacking context. Auto-flips above the trigger when there isn't
 * room below.
 */
export function Popover({
  open,
  anchor,
  onClose,
  children,
  align = 'start',
  side = 'auto',
  width,
  role = 'menu',
  ariaLabel,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)

  const place = useCallback(() => {
    const el = ref.current
    if (!el || !anchor) return
    const h = el.offsetHeight
    const w = width || el.offsetWidth
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = anchor.rect.bottom + GAP
    if (side === 'top') top = anchor.rect.top - h - GAP
    else if (side === 'auto' && top + h > vh - MARGIN) {
      const above = anchor.rect.top - h - GAP
      top = above >= MARGIN ? above : Math.max(MARGIN, vh - h - MARGIN)
    }

    let left =
      align === 'end' ? anchor.rect.right - w : anchor.rect.left
    left = Math.min(Math.max(MARGIN, left), vw - w - MARGIN)

    const maxHeight = Math.max(160, vh - top - MARGIN)
    setPos({ top, left, maxHeight })
  }, [anchor, align, side, width])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
    // measure again once web fonts / content settle
    const r = requestAnimationFrame(place)
    return () => cancelAnimationFrame(r)
  }, [open, place, children])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      onClose()
    }
    const onScroll = () => onClose()
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="popover-layer" role="presentation">
      <div
        ref={ref}
        className="popover"
        role={role}
        aria-label={ariaLabel}
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          maxHeight: pos?.maxHeight,
          width,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function useAnchored() {
  const ref = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null)

  const toggle = useCallback(() => {
    setAnchor((a) => (a ? null : ref.current ? { rect: ref.current.getBoundingClientRect() } : null))
  }, [])

  /** anchor to an arbitrary element (e.g. a per-row menu button) */
  const openAt = useCallback((el: HTMLElement | null) => {
    setAnchor(el ? { rect: el.getBoundingClientRect() } : null)
  }, [])

  const close = useCallback(() => setAnchor(null), [])

  return { ref, anchor, toggle, close, openAt, open: anchor !== null }
}

/** Traps focus and returns focus on unmount — used by every dialog. */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!active) return
    const root = ref.current
    if (!root) return
    const previous = document.activeElement as HTMLElement | null
    const sel =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    const first = root.querySelector<HTMLElement>(sel)
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
        (el) => el.offsetParent !== null,
      )
      if (!items.length) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [active])
  return ref
}

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  variant = 'md',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  labelledBy?: string
  variant?: 'md' | 'sm'
}) {
  const ref = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={ref} className={`modal${variant === 'sm' ? ' modal--sm' : ''}`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export type Ref<T> = RefObject<T>
