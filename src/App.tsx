import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorPane } from './Editor'
import {
  IconBack,
  IconClose,
  IconFingerprint,
  IconFolder,
  IconGear,
  IconLock,
  IconMenu,
  IconPin,
  IconPlus,
  IconSort,
  IconTrash,
} from './icons'
import { parseChecklist, serializeChecklist } from './lib/markdown'
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
  findInActive,
  getState,
  init,
  lockAppNow,
  lockNote,
  newNote,
  openFromDisk,
  pinNote,
  promptPin,
  removeCategory,
  saveActive,
  saveActiveAs,
  setAppPin,
  setEncoding,
  setFilter,
  setFontSize,
  setLineEnding,
  setNoteContent,
  setNoteKind,
  setScreen,
  setTheme,
  setWrap,
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
  if (!isNative()) return null
  return (
    <div className="titlebar" data-tauri-drag-region>
      <img src={`${import.meta.env.BASE_URL}icon.png`} width={16} height={16} alt="" />
      <span className="titlebar-name">Notes</span>
      <span style={{ flex: 1 }} />
      <button type="button" className="win-btn" onClick={() => window.notesNative?.minimize()} title="Minimize">
        ─
      </button>
      <button type="button" className="win-btn" onClick={() => window.notesNative?.maximize()} title="Maximize">
        □
      </button>
      <button type="button" className="win-btn close" onClick={() => window.notesNative?.close()} title="Close">
        ×
      </button>
    </div>
  )
}

function quitApp() {
  if (window.notesNative) window.notesNative.close()
  else window.close()
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
  const [drawer, setDrawer] = useState(false)
  const [sort, setSort] = useState<SortKey>('updated-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [drop, setDrop] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  const active = notes.find((n) => n.id === activeId) ?? null
  const libraryOnly = screen === 'library' || !activeId

  const title =
    screen === 'categories' ? 'Categories' : screen === 'settings' ? 'Settings' : libraryOnly ? 'Notes' : 'Notes'

  const visible = useMemo(() => {
    let list = notes
    if (filter !== 'all') list = list.filter((n) => n.categoryIds.includes(filter))
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sort === 'title-asc') return a.title.localeCompare(b.title)
      if (sort === 'title-desc') return b.title.localeCompare(a.title)
      if (sort === 'created-asc') return a.createdAt - b.createdAt
      if (sort === 'created-desc') return b.createdAt - a.createdAt
      if (sort === 'updated-asc') return a.updatedAt - b.updatedAt
      return b.updatedAt - a.updatedAt
    })
  }, [notes, filter, sort])

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
        {screen === 'categories' || screen === 'settings' || !libraryOnly ? (
          <button
            className="icon-btn"
            type="button"
            title="Back"
            onClick={() => setScreen('library')}
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
          {title}
        </h1>
        {libraryOnly && screen === 'library' ? (
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button className="icon-btn" type="button" title="Sort" onClick={() => setSortOpen((v) => !v)}>
              <IconSort />
            </button>
            {sortOpen ? (
              <div className="menu">
                {(
                  [
                    ['updated-desc', 'Newest'],
                    ['updated-asc', 'Least updated'],
                    ['created-desc', 'Newest created'],
                    ['created-asc', 'Oldest'],
                    ['title-asc', 'Title A-Z'],
                    ['title-desc', 'Title Z-A'],
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
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <button className="icon-btn" type="button" title="Settings" onClick={() => setScreen('settings')}>
          <IconGear />
        </button>
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
              <span>›</span>
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
              <span>›</span>
            </button>
            <button
              className="drawer-item"
              type="button"
              onClick={() => {
                setFilter('all')
                setScreen('library')
                setDrawer(false)
              }}
            >
              Trash
              <span>›</span>
            </button>
          </nav>
        </div>
      ) : null}

      {screen === 'library' || screen === 'editor' ? (
        <div className="pills">
          {filter !== 'all' ? (
            <button className="pill-clear" type="button" title="Show all" onClick={() => setFilter('all')}>
              <IconClose width={16} height={16} />
            </button>
          ) : null}
          {categories.map((c) => (
            <button
              key={c.id}
              className={`pill ${filter === c.id ? 'active' : ''}`}
              type="button"
              onClick={() => setFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {screen === 'categories' ? (
        <CategoriesPage />
      ) : screen === 'settings' ? (
        <SettingsPage />
      ) : libraryOnly ? (
        <div className="workspace library-only">
          <aside className="sidebar">
            {visible.length === 0 ? (
              <p className="empty-hint">You don&apos;t have any notes yet</p>
            ) : (
              visible.map((note) => <NoteCard key={note.id} note={note} />)
            )}
          </aside>
        </div>
      ) : (
        <div className="workspace with-editor">
          <section className="editor-col">
            {unlockNoteId ? (
              <UnlockNote id={unlockNoteId} />
            ) : active ? (
              <>
                <EditorPane note={active} />
                <StatusBar note={active} />
              </>
            ) : null}
          </section>
        </div>
      )}

      {libraryOnly && screen === 'library' ? (
        <button className="fab" type="button" title="New note" onClick={() => newNote('markdown')}>
          <IconPlus />
        </button>
      ) : null}

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

function NoteCard({ note }: { note: Note }) {
  const content = useStore((s) => s.contents[note.id] ?? '')
  const items = note.kind === 'checklist' ? parseChecklist(content) : []

  return (
    <div
      className="note-card"
      role="button"
      tabIndex={0}
      onClick={() => activateTab(note.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') activateTab(note.id)
      }}
    >
      {(note.title || note.locked) && (
        <div className="note-card-head">
          {note.title ? <h3>{note.title}</h3> : <span />}
          {note.locked ? (
            <span className="lock-mark">
              <IconLock width={18} height={18} />
            </span>
          ) : null}
        </div>
      )}
      {note.locked ? null : note.kind === 'checklist' ? (
        <div className="checks">
          {items.slice(0, 6).map((it, i) => (
            <div
              className="check-row"
              key={it.id}
              onClick={(e) => {
                e.stopPropagation()
                const next = items.map((x, j) => (j === i ? { ...x, done: !x.done } : x))
                setNoteContent(note.id, serializeChecklist(next))
              }}
            >
              <span className={`box ${it.done ? 'done' : ''}`}>{it.done ? '✓' : ''}</span>
              <span>{it.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <pre>{previewText(content, 220)}</pre>
      )}
    </div>
  )
}

function StatusBar({ note }: { note: Note }) {
  const cursor = useCursor()
  const wrap = useStore((s) => s.settings.wrap)
  const preview = useStore((s) => s.preview)
  const diff = useStore((s) => s.diff)

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
        title="Delete"
        onClick={async () => {
          const ok = await ask('Delete note', `Delete “${note.title}”?`)
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

  return (
    <div className="page">
      <div className="row">
        <input
          value={name}
          placeholder="New category..."
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              addCategory(name)
              setName('')
            }
          }}
        />
        <button
          className="add-btn"
          type="button"
          onClick={() => {
            addCategory(name)
            setName('')
          }}
        >
          Save
        </button>
      </div>
      {categories.length === 0 ? (
        <p className="empty-hint">You don&apos;t have any categories yet</p>
      ) : (
        categories.map((c) => (
          <div key={c.id} className="cat-row">
            <button
              className="cat-btn"
              type="button"
              onClick={() => {
                setFilter(c.id)
                setScreen('library')
              }}
            >
              {c.name}
            </button>
            <button className="icon-btn" type="button" title="Delete" onClick={() => removeCategory(c.id)}>
              <IconClose />
            </button>
          </div>
        ))
      )}
    </div>
  )
}

function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const [pin, setPin] = useState('')

  return (
    <div className="page">
      <div className="section-label">General</div>
      <div className="option-group">
        <button className="option" type="button" onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}>
          <div className="left">
            <span>Color theme</span>
            <span className="desc">Choose a color theme for the app.</span>
          </div>
          <span>{settings.theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <div className="option">
          <div className="left">
            <span>Font size</span>
          </div>
          <span>
            <button type="button" onClick={() => setFontSize(Math.max(12, settings.fontSize - 1))}>
              −
            </button>{' '}
            {settings.fontSize}px{' '}
            <button type="button" onClick={() => setFontSize(Math.min(22, settings.fontSize + 1))}>
              +
            </button>
          </span>
        </div>
        <button className="option" type="button" onClick={() => setWrap(!settings.wrap)}>
          <div className="left">
            <span>Word wrap</span>
          </div>
          <span>{settings.wrap ? 'On' : 'Off'}</span>
        </button>
      </div>

      <div className="themes">
        <button
          className={`theme-opt light ${settings.theme === 'light' ? 'active' : ''}`}
          type="button"
          onClick={() => setTheme('light')}
        >
          Light
        </button>
        <button
          className={`theme-opt dark ${settings.theme === 'dark' ? 'active' : ''}`}
          type="button"
          onClick={() => setTheme('dark')}
        >
          Dark
        </button>
      </div>

      <div className="section-label">Security</div>
      <div className="option-group">
        <div className="option">
          <div className="left">
            <span>Add password</span>
            <span className="desc">The password must have at least 4 characters</span>
          </div>
          <input
            type="password"
            value={pin}
            placeholder="••••"
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        <button
          className="option"
          type="button"
          onClick={() => {
            if (pin.trim().length < 4) return
            void setAppPin(pin, true)
            setPin('')
          }}
        >
          <div className="left">
            <span>Save</span>
          </div>
        </button>
        {settings.pinHash ? (
          <>
            <button className="option" type="button" onClick={() => void setAppPin('', false)}>
              <div className="left">
                <span>Remove password</span>
              </div>
            </button>
            <button className="option" type="button" onClick={lockAppNow}>
              <div className="left">
                <span>Lock the app</span>
              </div>
            </button>
          </>
        ) : null}
      </div>

      <div className="section-label">About the app</div>
      <div className="option-group">
        <a className="option" href="https://github.com/da0t-exe/Notes" target="_blank" rel="noreferrer">
          <div className="left">
            <span>GitHub repository</span>
            <span className="desc">Report issues, contribute, or request new features.</span>
          </div>
          <span>↗</span>
        </a>
        <div className="option">
          <div className="left">
            <span>Version</span>
          </div>
          <span>0.1.0</span>
        </div>
      </div>
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
