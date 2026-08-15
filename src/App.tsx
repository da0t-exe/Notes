import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { EditorPane } from './Editor'
import {
  IconBack,
  IconChevron,
  IconClose,
  IconCopy,
  IconExternal,
  IconFingerprint,
  IconFolder,
  IconGear,
  IconLock,
  IconMenu,
  IconPanel,
  IconPin,
  IconPlus,
  IconRadio,
  IconRestore,
  IconSort,
  IconTrash,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore,
} from './icons'
import { parseList, previewMarkdownHybrid, serializeList } from './lib/markdown'
import { formatBytes, previewText } from './lib/format'
import { ENCODINGS } from './lib/encoding'
import { isNative } from './native'
import {
  activateTab,
  addCategory,
  answerConfirm,
  answerText,
  ask,
  cancelUnlock,
  closeTab,
  deleteNote,
  duplicateNote,
  emptyTrash,
  exportNote,
  findInActive,
  getState,
  init,
  lockNote,
  newNote,
  openFromDisk,
  pinNote,
  promptPin,
  purgeNote,
  restoreNote,
  removeCategory,
  renameCategory,
  saveActive,
  saveActiveAs,
  setEncoding,
  setFilter,
  setFontSize,
  setLanguage,
  setLineEnding,
  setNoteContent,
  setNoteKind,
  setScreen,
  setTheme,
  setWrap,
  toggleSidebar,
  toggleDiff,
  togglePreview,
  unlockApp,
  unlockNote,
  useCursor,
  useStore,
} from './store'
import type { Note } from './types'

type SortKey = 'updated-desc' | 'updated-asc' | 'title-asc' | 'title-desc' | 'created-desc' | 'created-asc'

export default function App() {
  const ready = useStore((s) => s.ready)
  const appLocked = useStore((s) => s.appLocked)

  useEffect(() => {
    void init()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      if (getState().settings.theme === 'system') setTheme('system')
    }
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newNote(e.shiftKey ? 'checklist' : 'markdown')
      } else if (meta && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        void openFromDisk()
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActiveAs()
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActive()
      } else if (meta && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        const id = getState().activeId
        if (id) closeTab(id)
      } else if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        findInActive()
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePreview()
      } else if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggleDiff()
      } else if (meta && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setFontSize(Math.min(22, getState().settings.fontSize + 1))
      } else if (meta && e.key === '-') {
        e.preventDefault()
        setFontSize(Math.max(12, getState().settings.fontSize - 1))
      } else if (meta && e.key === '0') {
        e.preventDefault()
        setFontSize(15)
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    if (!window.notesNative) return
    return window.notesNative.onMenu((action) => {
      if (action === 'new') newNote('markdown')
      if (action === 'new-list') newNote('checklist')
      if (action === 'open') void openFromDisk()
      if (action === 'save') void saveActive()
      if (action === 'save-as') void saveActiveAs()
      if (action === 'find') findInActive()
      if (action === 'preview') togglePreview()
      if (action === 'diff') toggleDiff()
    })
  }, [])

  if (!ready) {
    return (
      <div className="app">
        <TitleBar />
        <div className="lock">Loading...</div>
      </div>
    )
  }
  if (appLocked) return <LockApp />
  return <Shell />
}

function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isNative()) return
    let stop: (() => void) | undefined
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow()
      setMaximized(await win.isMaximized())
      stop = await win.onResized(async () => {
        setMaximized(await win.isMaximized())
      })
    })
    return () => stop?.()
  }, [])

  if (!isNative()) return null
  return (
    <div className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region>
        <img className="titlebar-icon" src={`${import.meta.env.BASE_URL}icon.png`} width={16} height={16} alt="" />
        <span className="titlebar-name">Notes</span>
      </div>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="titlebar-controls">
        <button type="button" className="win-btn" onClick={() => window.notesNative?.minimize()} title="Minimize">
          <IconWinMin />
        </button>
        <button type="button" className="win-btn" onClick={() => window.notesNative?.maximize()} title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? <IconWinRestore /> : <IconWinMax />}
        </button>
        <button type="button" className="win-btn close" onClick={() => window.notesNative?.close()} title="Close">
          <IconWinClose />
        </button>
      </div>
    </div>
  )
}

function quitApp() {
  if (window.notesNative) window.notesNative.close()
  else window.close()
}

type SwipeAction = { label: string; onClick: () => void; tone?: 'del' | 'pin' | 'restore' }

const SWIPE_BTN = 72
const SWIPE_GAP = 17
const SWIPE_REVEAL = SWIPE_BTN + SWIPE_GAP
const SWIPE_SNAP = SWIPE_REVEAL / 2

function SwipeRow({
  left,
  right,
  children,
}: {
  left?: SwipeAction
  right?: SwipeAction
  children: ReactNode
}) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const xRef = useRef(0)
  const startX = useRef<number | null>(null)
  const dragged = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const open = Math.abs(x) >= SWIPE_REVEAL - 1

  function setOffset(next: number) {
    xRef.current = next
    setX(next)
  }

  function followFinger(raw: number) {
    let next = raw
    if (raw > 0) {
      if (!left) next = 0
      else if (raw > SWIPE_REVEAL) next = SWIPE_REVEAL + (raw - SWIPE_REVEAL) * 0.22
    } else if (raw < 0) {
      if (!right) next = 0
      else if (raw < -SWIPE_REVEAL) next = -SWIPE_REVEAL + (raw + SWIPE_REVEAL) * 0.22
    }
    next = Math.max(-SWIPE_REVEAL - 40, Math.min(SWIPE_REVEAL + 40, next))
    setOffset(next)
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.box, input, a, .swipe-action')) return
    e.preventDefault()
    e.stopPropagation()
    const origin = xRef.current
    startX.current = e.clientX - origin
    dragged.current = false
    setDragging(true)
    const move = (ev: globalThis.PointerEvent) => {
      if (startX.current == null) return
      ev.preventDefault()
      const next = ev.clientX - startX.current
      if (Math.abs(next - origin) > 6) dragged.current = true
      followFinger(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      startX.current = null
      setDragging(false)
      const cur = xRef.current
      if (left && cur >= SWIPE_SNAP) setOffset(SWIPE_REVEAL)
      else if (right && cur <= -SWIPE_SNAP) setOffset(-SWIPE_REVEAL)
      else setOffset(0)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
  }

  function icon(tone?: SwipeAction['tone']) {
    if (tone === 'pin') return <IconPin />
    if (tone === 'restore') return <IconRestore />
    return <IconTrash />
  }

  return (
    <div
      ref={wrapRef}
      className={`swipe-wrap ${x < 0 ? 'open-right' : ''} ${x > 0 ? 'open-left' : ''} ${dragging ? 'dragging' : ''} ${open ? 'is-open' : ''}`}
    >
      {left ? (
        <button
          className={`swipe-action left ${left.tone ?? 'pin'}`}
          type="button"
          title={left.label}
          aria-label={left.label}
          onClick={left.onClick}
        >
          {icon(left.tone)}
        </button>
      ) : null}
      {right ? (
        <button
          className={`swipe-action right ${right.tone ?? 'del'}`}
          type="button"
          title={right.label}
          aria-label={right.label}
          onClick={right.onClick}
        >
          {icon(right.tone)}
        </button>
      ) : null}
      <div
        className="swipe-front"
        style={{ transform: `translate3d(${x}px,0,0)` }}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={down}
        onClickCapture={(e) => {
          if (dragged.current || xRef.current !== 0) {
            e.stopPropagation()
            e.preventDefault()
            if (!dragged.current) setOffset(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Shell() {
  const screen = useStore((s) => s.screen)
  const notes = useStore((s) => s.notes)
  const activeId = useStore((s) => s.activeId)
  const filter = useStore((s) => s.filter)
  const categories = useStore((s) => s.categories)
  const toasts = useStore((s) => s.toasts)
  const progress = useStore((s) => s.progress)
  const confirm = useStore((s) => s.confirm)
  const textPrompt = useStore((s) => s.textPrompt)
  const unlockNoteId = useStore((s) => s.unlockNoteId)
  const trash = useStore((s) => s.trash)
  const contents = useStore((s) => s.contents)
  const sidebar = useStore((s) => s.sidebar)
  const [drawer, setDrawer] = useState(false)
  const [sort, setSort] = useState<SortKey>('updated-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [drop, setDrop] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  const active = notes.find((n) => n.id === activeId) ?? null
  const inEditor = screen === 'editor' && Boolean(activeId)

  const title =
    screen === 'categories'
      ? 'Categories'
      : screen === 'settings'
        ? 'Settings'
        : screen === 'theme'
          ? 'Color theme'
          : screen === 'trash'
            ? 'Trash'
            : inEditor
              ? ''
              : 'Notes'

  const visible = useMemo(() => {
    let list = notes
    if (filter !== 'all') list = list.filter((n) => n.categoryIds.includes(filter))
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || (contents[n.id] ?? '').toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sort === 'title-asc') return a.title.localeCompare(b.title)
      if (sort === 'title-desc') return b.title.localeCompare(a.title)
      if (sort === 'created-asc') return a.createdAt - b.createdAt
      if (sort === 'created-desc') return b.createdAt - a.createdAt
      if (sort === 'updated-asc') return a.updatedAt - b.updatedAt
      return b.updatedAt - a.updatedAt
    })
  }, [notes, filter, sort, query, contents])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [sortOpen])

  return (
    <div
      className={`app ${drop ? 'drop' : ''} ${isNative() ? 'native' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrop(true)
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrop(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) void openFromDisk(files)
      }}
    >
      <TitleBar />
      <header className="header">
        {screen === 'categories' || screen === 'settings' || screen === 'theme' || screen === 'trash' ? (
          <button
            className="icon-btn"
            type="button"
            title="Back"
            onClick={() => setScreen(screen === 'theme' ? 'settings' : 'library')}
          >
            <IconBack />
          </button>
        ) : (
          <button className="icon-btn" type="button" title="Menu" onClick={() => setDrawer(true)}>
            <IconMenu />
          </button>
        )}
        <h1
          className="headline"
          role="button"
          tabIndex={0}
          onClick={() => setScreen('library')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setScreen('library')
          }}
        >
          {title || active?.title || 'Notes'}
        </h1>
        {(screen === 'library' || screen === 'editor') ? (
          <button
            className={`icon-btn ${sidebar ? 'on' : ''}`}
            type="button"
            title={sidebar ? 'Hide notes (Ctrl+B)' : 'Show notes (Ctrl+B)'}
            onClick={() => toggleSidebar()}
          >
            <IconPanel />
          </button>
        ) : null}
        {inEditor && active ? (
          <>
            <button className="icon-btn" type="button" title="Duplicate" onClick={() => duplicateNote(active.id)}>
              <IconCopy />
            </button>
            <button className={`icon-btn ${active.pinned ? 'on' : ''}`} type="button" title="Pin" onClick={() => pinNote(active.id)}>
              <IconPin />
            </button>
            <button
              className="icon-btn"
              type="button"
              title="Move to trash"
              onClick={() => deleteNote(active.id)}
            >
              <IconTrash />
            </button>
          </>
        ) : null}
        {screen === 'library' || screen === 'editor' ? (
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button className="icon-btn" type="button" title="Sort" onClick={() => setSortOpen((v) => !v)}>
              <IconSort />
            </button>
            {sortOpen ? (
              <div className="menu radio-menu">
                {(
                  [
                    ['title-asc', 'Title A-Z'],
                    ['title-desc', 'Title Z-A'],
                    ['created-asc', 'Oldest'],
                    ['created-desc', 'Newest'],
                    ['updated-asc', 'Least updated'],
                    ['updated-desc', 'Most updated'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSort(key)
                      setSortOpen(false)
                    }}
                  >
                    {label}
                    <IconRadio on={sort === key} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {screen === 'trash' ? (
          <button
            className="icon-btn"
            type="button"
            title="Empty trash"
            onClick={async () => {
              if (!trash.length) return
              const ok = await ask('Empty trash', 'Permanently delete all notes in trash?')
              if (ok) emptyTrash()
            }}
          >
            <IconTrash />
          </button>
        ) : null}
        {screen === 'library' || screen === 'editor' ? (
          <button className="icon-btn" type="button" title="Settings" onClick={() => setScreen('settings')}>
            <IconGear />
          </button>
        ) : null}
      </header>

      {drawer ? (
        <div className="drawer-back" onClick={() => setDrawer(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()}>
            <button
              className={`drawer-item ${screen === 'library' ? 'active' : ''}`}
              type="button"
              onClick={() => {
                setScreen('library')
                setDrawer(false)
              }}
            >
              Notes
              <IconChevron />
            </button>
            <button
              className={`drawer-item ${screen === 'categories' ? 'active' : ''}`}
              type="button"
              onClick={() => {
                setScreen('categories')
                setDrawer(false)
              }}
            >
              Categories
              <IconChevron />
            </button>
            <button
              className={`drawer-item ${screen === 'trash' ? 'active' : ''}`}
              type="button"
              onClick={() => {
                setScreen('trash')
                setDrawer(false)
              }}
            >
              Trash
              <IconChevron />
            </button>
          </nav>
        </div>
      ) : null}

      {screen === 'categories' ? (
        <CategoriesPage />
      ) : screen === 'settings' ? (
        <SettingsPage />
      ) : screen === 'theme' ? (
        <ThemePage />
      ) : screen === 'trash' ? (
        <TrashPage />
      ) : (
        <div className={`workspace ide ${sidebar ? '' : 'collapsed'}`}>
          <aside className="sidebar">
            <div className="sidebar-scroll">
              <div className="search-row">
                <input
                  className="search-bar"
                  value={query}
                  placeholder="Search..."
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search notes"
                />
                {filter !== 'all' ? (
                  <button className="filter-chip" type="button" onClick={() => setFilter('all')}>
                    {categories.find((c) => c.id === filter)?.name ?? 'Filter'}
                    <IconClose width={14} height={14} />
                  </button>
                ) : null}
              </div>
              {visible.length === 0 ? (
                <p className="empty-hint">You don&apos;t have any notes yet</p>
              ) : (
                visible.map((note) => (
                  <SwipeRow
                    key={note.id}
                    left={{
                      label: note.pinned ? 'Unpin' : 'Pin',
                      tone: 'pin',
                      onClick: () => pinNote(note.id),
                    }}
                    right={{ label: 'Trash', tone: 'del', onClick: () => deleteNote(note.id) }}
                  >
                    <NoteCard note={note} active={note.id === activeId} />
                  </SwipeRow>
                ))
              )}
            </div>
            <button className="fab sidebar-fab" type="button" title="New note" onClick={() => newNote('markdown')}>
              <IconPlus />
            </button>
          </aside>
          <section className="editor-col">
            {unlockNoteId ? (
              <UnlockNote id={unlockNoteId} />
            ) : active ? (
              <>
                <EditorPane note={active} />
                {active.fromDisk ? <StatusBar note={active} /> : null}
              </>
            ) : (
              <p className="empty-hint">Select a note or press + to write</p>
            )}
          </section>
          {!sidebar ? (
            <button className="rail-open" type="button" title="Show notes (Ctrl+B)" onClick={() => toggleSidebar()}>
              <IconPanel />
            </button>
          ) : null}
        </div>
      )}

      {progress ? (
        <div className="progress">
          {progress.name} · {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
        </div>
      ) : null}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      {confirm ? (
        <div className="modal-back">
          <div className="modal">
            <h2>{confirm.title}</h2>
            <p>{confirm.text}</p>
            <div className="modal-actions">
              <button className="yes" type="button" onClick={() => answerConfirm(true)}>
                Continue
              </button>
              <button type="button" onClick={() => answerConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {textPrompt ? <PromptModal prompt={textPrompt} /> : null}
    </div>
  )
}

function PromptModal({ prompt }: { prompt: { title: string; label: string; secret?: boolean } }) {
  const [value, setValue] = useState('')
  return (
    <div className="modal-back">
      <div className="modal">
        <h2>{prompt.title}</h2>
        <p>{prompt.label}</p>
        <input
          autoFocus
          className="modal-input"
          type={prompt.secret ? 'password' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') answerText(value)
            if (e.key === 'Escape') answerText(null)
          }}
        />
        <div className="modal-actions">
          <button className="yes" type="button" onClick={() => answerText(value)}>
            Save
          </button>
          <button type="button" onClick={() => answerText(null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function NoteCard({ note, active }: { note: Note; active?: boolean }) {
  const content = useStore((s) => s.contents[note.id] ?? '')
  const listType = note.listType ?? 'checklist'
  const items = note.kind === 'checklist' ? parseList(content, listType) : []
  const thumbs = note.locked ? [] : (note.images ?? []).slice(0, 3)

  return (
    <div
      className={`note-card ${active ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      draggable={false}
      onClick={() => activateTab(note.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') activateTab(note.id)
      }}
    >
      {(note.title || note.locked || note.pinned) && (
        <div className="note-card-head">
          {note.title ? <h3>{note.title}</h3> : <span />}
          {note.locked ? (
            <span className="lock-mark">
              <IconLock width={18} height={18} />
            </span>
          ) : note.pinned ? (
            <span className="lock-mark">
              <IconPin width={16} height={16} />
            </span>
          ) : null}
        </div>
      )}
      {note.locked ? null : note.kind === 'checklist' ? (
        <div className="checks">
          {items.slice(0, 6).map((it, i) => (
            <div className="check-row" key={it.id}>
              {listType === 'checklist' ? (
                <button
                  className={`box ${it.done ? 'done' : ''}`}
                  type="button"
                  aria-label={it.done ? 'Mark undone' : 'Mark done'}
                  onClick={(e) => {
                    e.stopPropagation()
                    const next = items.map((x, j) => (j === i ? { ...x, done: !x.done } : x))
                    setNoteContent(note.id, serializeList(next, listType))
                  }}
                >
                  {it.done ? '✓' : ''}
                </button>
              ) : listType === 'numbered' ? (
                <span className="list-index">{i + 1}.</span>
              ) : (
                <span className="bullet" />
              )}
              <span>{it.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <pre
          className="md-preview"
          dangerouslySetInnerHTML={{ __html: previewMarkdownHybrid(content) }}
        />
      )}
      {thumbs.length ? (
        <div className="note-thumbs">
          {thumbs.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TrashPage() {
  const trash = useStore((s) => s.trash)
  const trashContents = useStore((s) => s.trashContents)

  return (
    <div className="workspace library-only">
      <aside className="sidebar">
        {trash.length === 0 ? (
          <p className="empty-hint">You don&apos;t have any notes yet</p>
        ) : (
          trash.map((note) => {
            const content = trashContents[note.id] ?? ''
            return (
              <SwipeRow
                key={note.id}
                left={{ label: 'Restore', tone: 'restore', onClick: () => restoreNote(note.id) }}
                right={{ label: 'Delete', tone: 'del', onClick: () => purgeNote(note.id) }}
              >
                <div className="note-card trash-card">
                  <div className="note-card-head">
                    <h3>{note.title || 'Untitled'}</h3>
                  </div>
                  <pre>{previewText(content, 160)}</pre>
                </div>
              </SwipeRow>
            )
          })
        )}
      </aside>
    </div>
  )
}

function StatusBar({ note }: { note: Note }) {
  const cursor = useCursor()
  const wrap = useStore((s) => s.settings.wrap)
  const preview = useStore((s) => s.preview)
  const diff = useStore((s) => s.diff)

  if (!note.fromDisk) {
    return (
      <div className="status slim">
        <button type="button" onClick={() => pinNote(note.id)}>
          {note.pinned ? 'Pinned' : 'Pin'}
        </button>
        <button type="button" onClick={() => exportNote(note.id)}>
          Export
        </button>
        <button
          type="button"
          onClick={async () => {
            const ok = await ask('Move to trash', `Move “${note.title || 'this note'}” to trash?`)
            if (ok) deleteNote(note.id)
          }}
        >
          Trash
        </button>
        <span style={{ flex: 1 }} />
        <span>{formatBytes(note.size)}</span>
      </div>
    )
  }

  return (
    <div className="status">
      <span>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span>{formatBytes(note.size)}</span>
      <select value={note.encoding} onChange={(e) => setEncoding(note.id, e.target.value)} title="Encoding">
        {ENCODINGS.map((enc) => (
          <option key={enc} value={enc}>
            {enc.toUpperCase()}
          </option>
        ))}
      </select>
      <select
        value={note.lineEnding}
        onChange={(e) => setLineEnding(note.id, e.target.value as Note['lineEnding'])}
        title="Line endings"
      >
        <option value="LF">LF</option>
        <option value="CRLF">CRLF</option>
        <option value="CR">CR</option>
      </select>
      <select value={note.kind} onChange={(e) => setNoteKind(note.id, e.target.value as Note['kind'])} title="Type">
        <option value="text">Text</option>
        <option value="markdown">Markdown</option>
        <option value="checklist">List</option>
      </select>
      <button type="button" onClick={() => setWrap(!wrap)}>
        {wrap ? 'Wrap' : 'No wrap'}
      </button>
      <button type="button" onClick={togglePreview}>
        {preview ? 'Edit' : 'Preview'}
      </button>
      <button type="button" onClick={toggleDiff}>
        {diff ? 'Hide diff' : 'Diff'}
      </button>
      <span style={{ flex: 1 }} />
      <button className="icon-btn" type="button" title="Pin" onClick={() => pinNote(note.id)}>
        <IconPin />
      </button>
      <button className="icon-btn" type="button" title="Categories" onClick={() => setScreen('categories')}>
        <IconFolder />
      </button>
      <button
        className="icon-btn"
        type="button"
        title="Lock"
        onClick={async () => {
          const pin = await promptPin('Add password')
          if (pin) void lockNote(note.id, pin)
        }}
      >
        <IconLock />
      </button>
      <button
        className="icon-btn"
        type="button"
        title="Close file"
        onClick={async () => {
          const ok = await ask('Close file', `Close “${note.title}”?`)
          if (ok) deleteNote(note.id)
        }}
      >
        <IconTrash />
      </button>
    </div>
  )
}

function CategoriesPage() {
  const categories = useStore((s) => s.categories)
  const [name, setName] = useState('')
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null)

  function saveNew() {
    addCategory(name)
    setName('')
  }

  return (
    <div className="page">
      <div className="row">
        <input
          value={name}
          placeholder="New category..."
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveNew()
          }}
        />
        <button className="add-square" type="button" title="Add" onClick={saveNew}>
          <IconPlus />
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="empty-hint">You don&apos;t have any categories yet</p>
      ) : (
        categories.map((c) => (
          <SwipeRow key={c.id} right={{ label: 'Delete', tone: 'del', onClick: () => removeCategory(c.id) }}>
            <button
              className="cat-btn"
              type="button"
              onClick={() => {
                setFilter(c.id)
                setScreen('library')
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEdit({ id: c.id, name: c.name })
              }}
            >
              {c.name}
            </button>
          </SwipeRow>
        ))
      )}
      {edit ? (
        <div className="sheet-back" onClick={() => setEdit(null)}>
          <div className="sheet card-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-label">Update category</div>
            <input
              className="sheet-title"
              value={edit.name}
              autoFocus
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  renameCategory(edit.id, edit.name)
                  setEdit(null)
                }
              }}
            />
            <button
              className="sheet-action"
              type="button"
              onClick={() => {
                renameCategory(edit.id, edit.name)
                setEdit(null)
              }}
            >
              Update
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const LANGUAGES = [
  { id: 'ar', label: 'العربية' },
  { id: 'cs', label: 'Čeština' },
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'it', label: 'Italiano' },
  { id: 'ja', label: '日本語' },
]

function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const [langOpen, setLangOpen] = useState(false)
  const currentLang = LANGUAGES.find((l) => l.id === settings.language)?.label ?? 'English'

  return (
    <div className="page">
      <div className="section-label">General</div>
      <div className="option-group">
        <button className="option" type="button" onClick={() => setLangOpen(true)}>
          <div className="left">
            <span>Language</span>
            <span className="desc">{currentLang}</span>
          </div>
          <IconChevron />
        </button>
        <button className="option" type="button" onClick={() => setScreen('theme')}>
          <div className="left">
            <span>Color theme</span>
          </div>
          <IconChevron />
        </button>
      </div>

      <div className="section-label">About the app</div>
      <div className="option-group">
        <a className="option" href="https://github.com/da0t-exe/Notes" target="_blank" rel="noreferrer">
          <div className="left">
            <span>GitHub repository</span>
            <span className="desc">Report issues, contribute or request new features.</span>
          </div>
          <IconExternal />
        </a>
        <a className="option" href="https://github.com/da0t-exe/Notes" target="_blank" rel="noreferrer">
          <div className="left">
            <span>Contribute to the translation</span>
            <span className="desc">Help us translate the app to your language.</span>
          </div>
          <IconExternal />
        </a>
        <a className="option" href="https://github.com/da0t-exe/Notes/releases" target="_blank" rel="noreferrer">
          <div className="left">
            <span>Software update</span>
            <span className="desc">Version 0.2.0</span>
          </div>
          <IconExternal />
        </a>
      </div>

      {langOpen ? (
        <div className="sheet-back" onClick={() => setLangOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-label center">Language</div>
            <div className="radio-list">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLanguage(l.id)
                    setLangOpen(false)
                  }}
                >
                  {l.label}
                  <IconRadio on={settings.language === l.id} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ThemePage() {
  const theme = useStore((s) => s.settings.theme)
  return (
    <div className="page theme-page">
      <p className="theme-lead">Choose a color theme for the app.</p>
      <button className={`theme-circle light ${theme === 'light' ? 'active' : ''}`} type="button" onClick={() => setTheme('light')}>
        Light
      </button>
      <button className={`theme-circle dark ${theme === 'dark' ? 'active' : ''}`} type="button" onClick={() => setTheme('dark')}>
        Dark
      </button>
      <button className={`theme-circle system ${theme === 'system' ? 'active' : ''}`} type="button" onClick={() => setTheme('system')}>
        System
      </button>
    </div>
  )
}

function LockApp() {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  async function submit() {
    const ok = await unlockApp(pin)
    setErr(!ok)
  }

  return (
    <div className="app native">
      <TitleBar />
      <div className="lock">
        <button className="icon-btn" type="button" style={{ alignSelf: 'flex-start' }} title="Quit" onClick={quitApp}>
          <IconBack />
        </button>
        <h1>Unlock</h1>
        <button className="finger-btn" type="button" title="Unlock" onClick={() => void submit()}>
          <IconFingerprint className="finger" />
        </button>
        <input
          autoFocus
          inputMode="numeric"
          value={pin}
          placeholder="••••"
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        {err ? <div className="toast error">Wrong password</div> : null}
        <button className="lock-btn" type="button" onClick={() => void submit()}>
          Enter
        </button>
        <button type="button" onClick={quitApp}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function UnlockNote({ id }: { id: string }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  async function submit() {
    const ok = await unlockNote(id, pin)
    setErr(!ok)
  }

  return (
    <div className="lock">
      <button className="icon-btn" type="button" style={{ alignSelf: 'flex-start' }} onClick={cancelUnlock}>
        <IconBack />
      </button>
        <h1>Unlock</h1>
        <button className="finger-btn" type="button" onClick={() => void submit()}>
        <IconFingerprint className="finger" />
      </button>
      <input
        autoFocus
        value={pin}
        placeholder="••••"
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
      />
      {err ? <div className="toast error">Wrong password</div> : null}
      <button className="lock-btn" type="button" onClick={() => void submit()}>
        Enter
      </button>
      <button type="button" onClick={cancelUnlock}>
        Cancel
      </button>
    </div>
  )
}
