import { useMemo, useState, type Ref } from 'react'
import type { Conversation } from '../lib/ai/types'
import { Icon } from './Icon'
import { BrandLockup } from './Mark'
import { Popover, useAnchored } from './Overlay'
import { cx, relativeDay } from '../lib/utils'

/**
 * Conversation sidebar.
 *
 * Compact by design: brand, new chat, search, history, settings. It never
 * becomes a management surface — rename/archive/delete live behind a single
 * hover affordance per row.
 */

const GROUP_ORDER: ReturnType<typeof relativeDay>[] = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Previous 30 days',
  'Older',
]

export interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  showArchived: boolean
  onToggleArchived: () => void
  query: string
  onQuery: (q: string) => void
  onOpenWorkspace: () => void
  onOpenSettings: (tab?: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  isMobile: boolean
  isOpen: boolean
  onClose: () => void
  displayName: string
  email: string
  accent: string
  savedCount: number
  searchRef?: Ref<HTMLInputElement>
  photoURL?: string
}

export function Sidebar(props: SidebarProps) {
  const {
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onDelete,
    onRename,
    onArchive,
    onUnarchive,
    showArchived,
    onToggleArchived,
    query,
    onQuery,
    onOpenWorkspace,
    onOpenSettings,
    collapsed,
    onToggleCollapsed,
    isMobile,
    isOpen,
    onClose,
    displayName,
    email,
    accent,
    savedCount,
    searchRef,
    photoURL,
  } = props

  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menu = useAnchored()
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const live = conversations.filter((c) => (showArchived ? c.archived : !c.archived))
    if (!q) return live
    return live.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true
      return c.messages.some((m) => m.content.toLowerCase().includes(q))
    })
  }, [conversations, query, showArchived])

  const archivedCount = useMemo(() => conversations.filter((c) => c.archived).length, [conversations])

  const groups = useMemo(() => {
    const map = new Map<string, Conversation[]>()
    for (const c of filtered) {
      const key = relativeDay(c.updatedAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ key: g, items: map.get(g)! }))
  }, [filtered])

  const initials = (displayName || 'You').trim().slice(0, 2).toUpperCase() || 'YO'
  const label = displayName || 'Your profile'

  return (
    <>
      {isMobile && isOpen ? <div className="scrim" onClick={onClose} /> : null}

      <aside className={cx('sidebar', isMobile && isOpen && 'is-open')} aria-label="Conversations">
        <div className="sidebar__head">
          {isMobile ? (
            <button className="icon-btn" onClick={onClose} type="button" aria-label="Close sidebar">
              <Icon name="x" size={16} />
            </button>
          ) : (
            <button
              className="icon-btn"
              onClick={onToggleCollapsed}
              type="button"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ flex: 'none' }}
            >
              <Icon name="panelLeft" size={16} />
            </button>
          )}
          <button
            onClick={() => {
              onSelect('')
              onNewChat()
            }}
            type="button"
            title="ShadowAI by ShadowMotion"
            style={{ minWidth: 0, flex: 1 }}
          >
            <BrandLockup size={collapsed && !isMobile ? 24 : 26} />
          </button>
        </div>

        <div className="sidebar__body">
          <button
            className="new-chat"
            onClick={() => {
              onNewChat()
              if (isMobile) onClose()
            }}
            type="button"
          >
            <Icon name="plus" size={16} />
            <span className="new-chat__label">New Chat</span>
          </button>
          <button className="workspace-nav" onClick={onOpenWorkspace} type="button" title="Plugins, skills, and libraries">
            <Icon name="grid" size={15} />
            <span className="new-chat__label">Workspace</span>
            <span className="workspace-nav__hint">Plugins · Skills · Libraries</span>
          </button>

          <div className="sidebar__search">
            <Icon name="search" size={14} className="search__icon" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              spellCheck={false}
            />
            {query ? (
              <button className="search__clear" onClick={() => onQuery('')} type="button" aria-label="Clear search">
                <Icon name="x" size={11} />
              </button>
            ) : null}
          </div>

          {archivedCount > 0 || showArchived ? (
            <button
              className={cx('sidebar__archived-toggle', showArchived && 'is-active')}
              onClick={onToggleArchived}
              type="button"
              title={showArchived ? 'Back to active conversations' : 'View archived conversations'}
            >
              <Icon name="archive" size={13} />
              <span>{showArchived ? 'Active chats' : 'Archived'}</span>
              <span style={{ opacity: 0.6 }}>{showArchived ? undefined : archivedCount}</span>
            </button>
          ) : null}

          <div className="sidebar__list">
            {groups.length === 0 ? (
              <p className="sidebar__empty">
                {query ? (
                  <>
                    No conversations match
                    <br />
                    <span style={{ color: 'var(--muted)' }}>“{query}”</span>
                  </>
                ) : showArchived ? (
                  <>
                    Nothing archived.
                    <br />
                    <span style={{ color: 'var(--muted)' }}>Archive a chat to stash it here.</span>
                  </>
                ) : (
                  <>
                    No conversations yet.
                    <br />
                    Ask something to begin.
                  </>
                )}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.key}>
                  <div className="sidebar__section-title">
                    <span>{g.key}</span>
                    <span style={{ opacity: 0.6 }}>{g.items.length}</span>
                  </div>
                  {g.items.map((c) => (
                    <div
                      key={c.id}
                      className={cx('conv-item', c.id === activeId && 'is-active')}
                      onClick={() => {
                        onSelect(c.id)
                        if (isMobile) onClose()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSelect(c.id)
                      }}
                      role="button"
                      tabIndex={0}
                      title={c.title}
                    >
                      <Icon name={c.messages.some((m) => m.mode === 'agent') ? 'sparkle' : 'chat'} size={14} />
                      {renaming?.id === c.id ? (
                        <input
                          className="conv-item__title"
                          value={renaming.value}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') {
                              onRename(c.id, renaming.value.trim() || c.title)
                              setRenaming(null)
                            }
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          onBlur={() => {
                            onRename(c.id, renaming.value.trim() || c.title)
                            setRenaming(null)
                          }}
                          style={{
                            background: 'var(--surface-3)',
                            border: '1px solid var(--accent-line)',
                            borderRadius: 6,
                            padding: '2px 6px',
                            fontSize: 13,
                          }}
                        />
                      ) : (
                        <span className="conv-item__title">{c.title}</span>
                      )}
                      <button
                        className="conv-item__menu"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (menuFor === c.id) {
                            setMenuFor(null)
                            menu.close()
                          } else {
                            setMenuFor(c.id)
                            menu.openAt(e.currentTarget)
                          }
                        }}
                        type="button"
                        aria-label={`Options for ${c.title}`}
                        aria-expanded={menuFor === c.id}
                      >
                        <Icon name="more" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar__foot">
          <button
            className="sidebar__foot-btn"
            onClick={() => onOpenSettings('appearance')}
            type="button"
            title="Settings"
          >
            <Icon name="settings" size={16} />
            <span className="sidebar__foot-label">Settings</span>
          </button>
          <button
            className="sidebar__foot-btn"
            onClick={() => onOpenSettings('account')}
            type="button"
            title={email || label}
          >
            <span className="avatar" style={{ background: `${accent}1f`, borderColor: `${accent}55`, color: accent }}>
              {photoURL ? <img src={photoURL} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials}
            </span>
            <span className="sidebar__foot-label">{label}</span>
          </button>
        </div>
      </aside>

      <Popover
        open={menuFor !== null}
        anchor={menu.anchor}
        onClose={() => {
          setMenuFor(null)
          menu.close()
        }}
        width={200}
        align="end"
        ariaLabel="Conversation options"
      >
        {menuFor ? (
          <>
            <button
              className="menu-item"
              onClick={() => {
                const c = conversations.find((x) => x.id === menuFor)
                setRenaming({ id: menuFor, value: c?.title ?? '' })
                setMenuFor(null)
                menu.close()
              }}
              type="button"
            >
              <Icon name="edit" size={14} style={{ color: 'var(--muted)' }} />
              <span className="menu-item__body">
                <span className="menu-item__title">Rename</span>
              </span>
            </button>
            <button
              className="menu-item"
              onClick={() => {
                const c = conversations.find((x) => x.id === menuFor)
                if (c?.archived) onUnarchive(menuFor)
                else onArchive(menuFor)
                setMenuFor(null)
                menu.close()
              }}
              type="button"
            >
              <Icon name="archive" size={14} style={{ color: 'var(--muted)' }} />
              <span className="menu-item__body">
                <span className="menu-item__title">
                  {conversations.find((x) => x.id === menuFor)?.archived ? 'Restore' : 'Archive'}
                </span>
              </span>
            </button>
            <div className="menu-sep" />
            <button
              className="menu-item menu-item--danger"
              onClick={() => {
                onDelete(menuFor)
                setMenuFor(null)
                menu.close()
              }}
              type="button"
            >
              <Icon name="trash" size={14} />
              <span className="menu-item__body">
                <span className="menu-item__title">Delete</span>
              </span>
            </button>
          </>
        ) : null}
        {savedCount > 0 ? (
          <>
            <div className="menu-sep" />
            <button
              className="menu-item"
              onClick={() => {
                onOpenSettings('data')
                setMenuFor(null)
                menu.close()
              }}
              type="button"
            >
              <Icon name="bookmark" size={14} style={{ color: 'var(--muted)' }} />
              <span className="menu-item__body">
                <span className="menu-item__title">{savedCount} saved response{savedCount === 1 ? '' : 's'}</span>
              </span>
            </button>
          </>
        ) : null}
      </Popover>
    </>
  )
}
