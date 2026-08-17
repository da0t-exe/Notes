import { useEffect, useMemo, useState } from 'react'

import { Drawer } from './components/Drawer'
import { SwipeRow } from './components/SwipeRow'
import { TitleBar } from './components/TitleBar'
import { ChecklistEditor } from './editor/ChecklistEditor'
import { EditorPane } from './editor/EditorPane'
import { IconBack, IconClose, IconMenu, IconPanel, IconPin, IconPlus, IconPreview, IconTrash } from './icons'
import { formatBytes } from './lib/format'
import { parseList } from './lib/list'
import { previewMarkdownHybrid } from './lib/markdown'
import { isNative } from './lib/native'
import type { Note } from './lib/types'
import { TrashScreen } from './screens/Trash'
import {
  activateTab,
  answerConfirm,
  closeTab,
  confirmQuit,
  emptyTrash,
  findInActive,
  getState,
  init,
  newNote,
  openFromDisk,
  pinNote,
  saveActive,
  saveActiveAs,
  setFontSize,
  setScreen,
  setTheme,
  setWrap,
  toggleNoteKind,
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

      if (meta && key === 'n') hit(() => newNote(e.shiftKey ? 'checklist' : 'markdown'))
      else if (meta && key === 'o') hit(() => void openFromDisk())
      else if (meta && e.shiftKey && key === 's') hit(() => void saveActiveAs())
      else if (meta && key === 's') hit(() => void saveActive())
      else if (meta && key === 'w') {
        const id = getState().activeId
        if (id) hit(() => void closeTab(id))
      } else if (meta && key === 'd') {
        const id = getState().activeId
        if (id) hit(() => void trashNote(id))
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

function Shell() {
  const screen = useStore((s) => s.screen)
  const notes = useStore((s) => s.notes)
  const activeId = useStore((s) => s.activeId)
  const sidebar = useStore((s) => s.sidebar)
  const contents = useStore((s) => s.contents)
  const trash = useStore((s) => s.trash)
  const preview = useStore((s) => s.preview)

  const [drawer, setDrawer] = useState(false)
  const [query, setQuery] = useState('')
  const [drop, setDrop] = useState(false)

  const active = notes.find((n) => n.id === activeId) ?? null
  const inLibrary = screen === 'library'

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? notes.filter(
          (n) => n.title.toLowerCase().includes(q) || (contents[n.id] ?? '').toLowerCase().includes(q),
        )
      : notes
    return list.toSorted((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [notes, contents, query])

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

        <h1 className="headline">{inLibrary ? (active?.title ?? 'Notes') : 'Trash'}</h1>

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
        ) : trash.length > 0 ? (
          <button className="icon-btn" type="button" title="Empty trash" onClick={() => void emptyTrash()}>
            <IconTrash />
          </button>
        ) : null}
      </header>

      <Drawer open={drawer} onClose={() => setDrawer(false)} />

      {screen === 'trash' ? (
        <div className="screen-in">
          <TrashScreen />
        </div>
      ) : (
        <div className={`workspace ide screen-in ${sidebar ? '' : 'collapsed'}`}>
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
              </div>
              {visible.length === 0 ? (
                <p className="empty-hint">You don&apos;t have any notes yet</p>
              ) : (
                visible.map((note) => (
                  <SwipeRow
                    key={note.id}
                    onTap={() => activateTab(note.id)}
                    left={{
                      label: note.pinned ? 'Unpin' : 'Pin',
                      tone: 'pin',
                      onAct: () => pinNote(note.id),
                    }}
                    {...(note.fromDisk
                      ? {}
                      : { right: { label: 'Move to trash', tone: 'del' as const, onAct: () => void trashNote(note.id) } })}
                  >
                    <NoteCard note={note} active={note.id === activeId} />
                  </SwipeRow>
                ))
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
                {active.kind === 'checklist' ? (
                  <ChecklistEditor note={active} />
                ) : (
                  <EditorPane note={active} />
                )}
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

function NoteCard({ note, active }: { note: Note; active: boolean }) {
  const content = useStore((s) => s.contents[note.id] ?? '')

  return (
    <div
      className={`note-card ${active ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      // Pointer activation is handled by the enclosing SwipeRow's onTap. This
      // covers the keyboard, which has no gesture to resolve.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activateTab(note.id)
        }
      }}
    >
      <div className="note-card-head">
        <h3>{note.title || 'Untitled'}</h3>
        <span className="card-marks">
          {note.pinned ? <IconPin width={14} height={14} /> : null}
          {note.dirty ? <span className="dot" title="Unsaved" /> : null}
        </span>
      </div>
      {note.kind === 'checklist' ? (
        <ChecklistPreview note={note} content={content} />
      ) : (
        // Escaped inside previewMarkdownHybrid before any markup is added.
        // eslint-disable-next-line react/no-danger
        <pre className="md-preview" dangerouslySetInnerHTML={{ __html: previewMarkdownHybrid(content) }} />
      )}
    </div>
  )
}

function ChecklistPreview({ note, content }: { note: Note; content: string }) {
  const listType = note.listType ?? 'checklist'
  const items = parseList(content, listType).slice(0, 6)

  return (
    <div className="checks">
      {items.map((item, i) => (
        <div className="check-row" key={item.id}>
          {listType === 'checklist' ? (
            <span className={`box ${item.done ? 'done' : ''}`}>{item.done ? '✓' : ''}</span>
          ) : listType === 'numbered' ? (
            <span className="list-index">{i + 1}.</span>
          ) : (
            <span className="bullet" />
          )}
          <span>{item.text}</span>
        </div>
      ))}
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
      {note.kind === 'checklist' ? null : (
        <button type="button" onClick={() => setWrap(!wrap)}>
          {wrap ? 'Wrap' : 'No wrap'}
        </button>
      )}
      {note.fromDisk ? null : (
        <button type="button" onClick={() => toggleNoteKind(note.id)}>
          {note.kind === 'checklist' ? 'To note' : 'To list'}
        </button>
      )}
      <span style={{ flex: 1 }} />
      {note.dirty ? <span>Unsaved</span> : null}
      <button type="button" onClick={() => void saveActive()}>
        Save
      </button>
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
    </>
  )
}
