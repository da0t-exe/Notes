import { useEffect, useMemo, useState } from 'react'

import { Drawer } from './components/Drawer'
import { TabBar } from './components/TabBar'
import { TitleBar } from './components/TitleBar'
import { EditorPane } from './editor/EditorPane'
import {
  IconBack,
  IconClose,
  IconFolder,
  IconMenu,
  IconPanel,
  IconPlus,
  IconPreview,
  IconTrash,
} from './icons'
import { formatBytes } from './lib/format'
import { previewMarkdownHybrid } from './lib/markdown'
import { isNative } from './lib/native'
import type { Note } from './lib/types'
import { CategoriesScreen } from './screens/Categories'
import { TrashScreen } from './screens/Trash'
import {
  activateTab,
  addCategory,
  answerConfirm,
  answerText,
  askText,
  closeTab,
  confirmQuit,
  emptyTrash,
  findInActive,
  getState,
  init,
  newNote,
  openFromDisk,
  saveActive,
  saveActiveAs,
  setFilter,
  setFontSize,
  setScreen,
  setTheme,
  setWrap,
  toggleNoteCategory,
  togglePreview,
  toggleSidebar,
  trashNote,
  useCursor,
  useStore,
} from './store'

export default function App() {
  const ready = useStore((s) => s.ready)

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

  useShortcuts()
  useCloseGuard()

  if (!ready) {
    return (
      <div className="app">
        <TitleBar />
        <div className="lock">Loading...</div>
      </div>
    )
  }
  return <Shell />
}

function useShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const hit = (fn: () => void) => {
        e.preventDefault()
        fn()
      }

      if (meta && key === 'n') hit(() => newNote('markdown'))
      else if (meta && key === 'o') hit(() => void openFromDisk())
      else if (meta && e.shiftKey && key === 's') hit(() => void saveActiveAs())
      else if (meta && key === 's') hit(() => void saveActive())
      else if (meta && key === 'w') {
        const id = getState().activeId
        if (id) hit(() => void closeTab(id))
      } else if (meta && key === 'f') hit(findInActive)
      else if (meta && key === 'b') hit(toggleSidebar)
      else if (e.altKey && key === 'p') hit(togglePreview)
      else if (meta && (e.key === '+' || e.key === '=')) {
        hit(() => setFontSize(Math.min(22, getState().settings.fontSize + 1)))
      } else if (meta && e.key === '-') {
        hit(() => setFontSize(Math.max(12, getState().settings.fontSize - 1)))
      } else if (meta && e.key === '0') hit(() => setFontSize(15))
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

/** Holds the window open when anything is unsaved. v0.3 had no such hook. */
function useCloseGuard() {
  useEffect(() => {
    if (!isNative() || !window.notesNative) return
    let stop: (() => void) | undefined
    void window.notesNative.onCloseRequested(confirmQuit).then((fn) => {
      stop = fn
    })
    return () => stop?.()
  }, [])
}

const TITLES: Record<string, string> = {
  categories: 'Categories',
  trash: 'Trash',
  settings: 'Settings',
  theme: 'Color theme',
}

function Shell() {
  const screen = useStore((s) => s.screen)
  const notes = useStore((s) => s.notes)
  const activeId = useStore((s) => s.activeId)
  const sidebar = useStore((s) => s.sidebar)
  const contents = useStore((s) => s.contents)
  const categories = useStore((s) => s.categories)
  const filter = useStore((s) => s.filter)
  const trash = useStore((s) => s.trash)
  const preview = useStore((s) => s.preview)

  const [drawer, setDrawer] = useState(false)
  const [query, setQuery] = useState('')
  const [drop, setDrop] = useState(false)

  const active = notes.find((n) => n.id === activeId) ?? null
  const inLibrary = screen === 'library'

  const visible = useMemo(() => {
    let list = filter === 'all' ? notes : notes.filter((n) => n.categoryIds.includes(filter))
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || (contents[n.id] ?? '').toLowerCase().includes(q),
      )
    }
    return list.toSorted((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, contents, query, filter])

  return (
    <div
      className={`app ${isNative() ? 'native' : ''} ${drop ? 'drop' : ''} ${drawer ? 'menu-open' : ''}`}
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
        {inLibrary ? (
          <button className="icon-btn" type="button" title="Menu" onClick={() => setDrawer(true)}>
            <IconMenu />
          </button>
        ) : (
          <button
            className="icon-btn circle-btn"
            type="button"
            title="Back"
            onClick={() => setScreen('library')}
          >
            <IconBack />
          </button>
        )}

        <h1 className="headline">{TITLES[screen] ?? active?.title ?? 'Notes'}</h1>

        {inLibrary ? (
          <>
            <button
              className={`icon-btn ${sidebar ? 'on' : ''}`}
              type="button"
              title={sidebar ? 'Hide notes (Ctrl+B)' : 'Show notes (Ctrl+B)'}
              onClick={toggleSidebar}
            >
              <IconPanel />
            </button>
            <button
              className={`icon-btn ${preview ? 'on' : ''}`}
              type="button"
              title="Markdown preview (Alt+P)"
              onClick={togglePreview}
            >
              <IconPreview />
            </button>
          </>
        ) : null}

        {screen === 'trash' && trash.length > 0 ? (
          <button className="icon-btn" type="button" title="Empty trash" onClick={() => void emptyTrash()}>
            <IconTrash />
          </button>
        ) : null}
      </header>

      <Drawer open={drawer} onClose={() => setDrawer(false)} />

      {screen === 'categories' ? (
        <CategoriesScreen />
      ) : screen === 'trash' ? (
        <TrashScreen />
      ) : (
        <div className={`workspace ide ${sidebar ? '' : 'collapsed'}`}>
          <aside className="sidebar">
            <div className="sidebar-scroll">
              <div className="search-row">
                <input
                  className="search-bar"
                  value={query}
                  placeholder="Search..."
                  aria-label="Search notes"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {filter !== 'all' ? (
                  <button className="filter-chip" type="button" onClick={() => setFilter('all')}>
                    {categories.find((c) => c.id === filter)?.name ?? 'Filter'}
                    <IconClose width={14} height={14} />
                  </button>
                ) : null}
              </div>
              {visible.length === 0 ? (
                <p className="empty-hint">
                  {filter === 'all' ? "You don't have any notes yet" : 'Nothing in this category'}
                </p>
              ) : (
                visible.map((note) => <NoteCard key={note.id} note={note} active={note.id === activeId} />)
              )}
            </div>
            <button
              className="fab sidebar-fab"
              type="button"
              title="New note (Ctrl+N)"
              onClick={() => newNote('markdown')}
            >
              <IconPlus />
            </button>
          </aside>

          <section className="editor-col">
            {active ? (
              <>
                <TabBar />
                {active.fromDisk ? null : <NoteChrome note={active} />}
                <EditorPane note={active} />
                <StatusBar note={active} />
              </>
            ) : (
              <p className="empty-hint">Select a note, or press Ctrl+N to write</p>
            )}
          </section>

          {!sidebar ? (
            <button className="rail-open" type="button" title="Show notes (Ctrl+B)" onClick={toggleSidebar}>
              <IconPanel />
            </button>
          ) : null}
        </div>
      )}

      <Overlays />
    </div>
  )
}

/**
 * Category chips for a stored note. Never rendered for a file opened from disk:
 * a file lives in the filesystem and has no business carrying app metadata.
 */
function NoteChrome({ note }: { note: Note }) {
  const categories = useStore((s) => s.categories)

  return (
    <div className="meta-bar">
      {categories.map((c) => (
        <button
          key={c.id}
          className={`ghost-pill ${note.categoryIds.includes(c.id) ? 'pill active' : ''}`}
          type="button"
          onClick={() => toggleNoteCategory(note.id, c.id)}
        >
          {c.name}
        </button>
      ))}
      <button
        className="plus circle"
        type="button"
        title="New category"
        onClick={async () => {
          const name = await askText('New category', 'Category name')
          if (!name) return
          const id = addCategory(name)
          if (id) toggleNoteCategory(note.id, id)
        }}
      >
        <IconPlus width={14} height={14} />
      </button>
    </div>
  )
}

function NoteCard({ note, active }: { note: Note; active: boolean }) {
  const content = useStore((s) => s.contents[note.id] ?? '')

  return (
    <div
      className={`note-card ${active ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => activateTab(note.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') activateTab(note.id)
      }}
    >
      <div className="note-card-head">
        <h3>{note.title || 'Untitled'}</h3>
        {note.dirty ? (
          <span className="lock-mark" title="Unsaved">
            •
          </span>
        ) : null}
      </div>
      {/* Escaped inside previewMarkdownHybrid before any markup is added. */}
      {/* eslint-disable-next-line react/no-danger */}
      <pre className="md-preview" dangerouslySetInnerHTML={{ __html: previewMarkdownHybrid(content) }} />
    </div>
  )
}

function StatusBar({ note }: { note: Note }) {
  const cursor = useCursor()
  const wrap = useStore((s) => s.settings.wrap)

  return (
    <div className="status">
      <span>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span>{formatBytes(note.size)}</span>
      <span>{note.language}</span>
      {note.fromDisk ? <span>{note.encoding.toUpperCase()}</span> : null}
      {note.fromDisk ? <span>{note.lineEnding}</span> : null}
      <button type="button" onClick={() => setWrap(!wrap)}>
        {wrap ? 'Wrap' : 'No wrap'}
      </button>
      <span style={{ flex: 1 }} />
      {note.dirty ? <span>Unsaved</span> : null}
      <button type="button" onClick={() => void saveActive()}>
        Save
      </button>
      {note.fromDisk ? null : (
        <button className="icon-btn" type="button" title="Move to trash" onClick={() => void trashNote(note.id)}>
          <IconTrash />
        </button>
      )}
      {note.fromDisk ? (
        <button className="icon-btn" type="button" title="Categories" onClick={() => setScreen('categories')}>
          <IconFolder />
        </button>
      ) : null}
      <button className="icon-btn" type="button" title="Close (Ctrl+W)" onClick={() => void closeTab(note.id)}>
        <IconClose />
      </button>
    </div>
  )
}

function Overlays() {
  const toasts = useStore((s) => s.toasts)
  const progress = useStore((s) => s.progress)
  const confirm = useStore((s) => s.confirm)
  const textPrompt = useStore((s) => s.textPrompt)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(textPrompt?.value ?? '')
  }, [textPrompt])

  return (
    <>
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
          <div className="modal" role="dialog" aria-modal="true" aria-label={confirm.title}>
            <h2>{confirm.title}</h2>
            <p>{confirm.text}</p>
            <div className="modal-actions">
              <button className="yes" type="button" autoFocus onClick={() => answerConfirm(true)}>
                Continue
              </button>
              <button type="button" onClick={() => answerConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {textPrompt ? (
        <div className="modal-back">
          <div className="modal" role="dialog" aria-modal="true" aria-label={textPrompt.title}>
            <h2>{textPrompt.title}</h2>
            <p>{textPrompt.label}</p>
            <input
              className="modal-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') answerText(draft)
                if (e.key === 'Escape') answerText(null)
              }}
            />
            <div className="modal-actions">
              <button className="yes" type="button" onClick={() => answerText(draft)}>
                Save
              </button>
              <button type="button" onClick={() => answerText(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
