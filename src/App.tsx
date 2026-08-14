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
  IconMoon,
  IconPin,
  IconPlus,
  IconSearch,
  IconSort,
  IconSun,
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
  toggleSidebar,
  unlockApp,
  unlockNote,
  useCursor,
  useStore,
} from './store'
import type { Note } from './types'

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
        <div className="lock">Chargement…</div>
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
      <button type="button" className="win-btn" onClick={() => window.notesNative?.minimize()} title="Réduire">
        ─
      </button>
      <button type="button" className="win-btn" onClick={() => window.notesNative?.maximize()} title="Agrandir">
        □
      </button>
      <button type="button" className="win-btn close" onClick={() => window.notesNative?.close()} title="Fermer">
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
  const sidebar = useStore((s) => s.sidebar)
  const notes = useStore((s) => s.notes)
  const openTabs = useStore((s) => s.openTabs)
  const activeId = useStore((s) => s.activeId)
  const filter = useStore((s) => s.filter)
  const categories = useStore((s) => s.categories)
  const theme = useStore((s) => s.settings.theme)
  const toasts = useStore((s) => s.toasts)
  const progress = useStore((s) => s.progress)
  const confirm = useStore((s) => s.confirm)
  const textPrompt = useStore((s) => s.textPrompt)
  const unlockNoteId = useStore((s) => s.unlockNoteId)
  const [menu, setMenu] = useState(false)
  const [sort, setSort] = useState<'updated' | 'name'>('updated')
  const [drop, setDrop] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const active = notes.find((n) => n.id === activeId) ?? null

  const visible = useMemo(() => {
    let list = notes
    if (filter !== 'all') list = list.filter((n) => n.categoryIds.includes(filter))
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sort === 'name') return a.title.localeCompare(b.title)
      return b.updatedAt - a.updatedAt
    })
  }, [notes, filter, sort])

  const libraryOnly = screen === 'library' || !activeId
  const showSidebar = sidebar || libraryOnly

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menu && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  return (
    <div
      className={`app ${libraryOnly ? 'is-library' : ''} ${drop ? 'drop' : ''} ${isNative() ? 'native' : ''}`}
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
        {screen === 'categories' || screen === 'settings' ? (
          <button
            className="icon-btn"
            type="button"
            title="Retour"
            onClick={() => setScreen(activeId ? 'editor' : 'library')}
          >
            <IconBack />
          </button>
        ) : (
          <button className="icon-btn" type="button" title="Menu / notes" onClick={toggleSidebar}>
            <IconMenu />
          </button>
        )}
        <h1
          className="serif"
          role="button"
          tabIndex={0}
          title="Bibliothèque / éditeur"
          onClick={() => {
            if (screen === 'library' && activeId) setScreen('editor')
            else setScreen('library')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setScreen(screen === 'library' && activeId ? 'editor' : 'library')
          }}
        >
          {screen === 'categories' ? 'Catégories' : screen === 'settings' ? 'Paramètres' : 'Notes'}
        </h1>
        <button
          className="icon-btn"
          type="button"
          title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setSort((s) => (s === 'updated' ? 'name' : 'updated'))}
          title={sort === 'updated' ? 'Trier par nom' : 'Trier par date'}
        >
          <IconSort />
        </button>
        <button className="icon-btn" type="button" title="Rechercher" onClick={findInActive}>
          <IconSearch />
        </button>
        <button className="icon-btn" type="button" title="Paramètres" onClick={() => setScreen('settings')}>
          <IconGear />
        </button>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="icon-btn" type="button" title="Nouveau" onClick={() => setMenu((v) => !v)}>
            <IconPlus />
          </button>
          {menu ? (
            <div className="menu">
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  newNote('markdown')
                }}
              >
                Nouvelle note
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  newNote('checklist')
                }}
              >
                Nouvelle liste
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  newNote('text')
                }}
              >
                Fichier texte
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  void openFromDisk()
                }}
              >
                Ouvrir un fichier…
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {screen === 'library' || screen === 'editor' ? (
        <div className="pills">
          <button className={`pill ${filter === 'all' ? 'active' : ''}`} type="button" onClick={() => setFilter('all')}>
            TOUT
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`pill ${filter === c.id ? 'active' : ''}`}
              type="button"
              onClick={() => setFilter(c.id)}
            >
              {c.name.toUpperCase()}
            </button>
          ))}
          <button className="pill" type="button" title="Gérer les catégories" onClick={() => setScreen('categories')}>
            +
          </button>
        </div>
      ) : (
        <div />
      )}

      {screen === 'categories' ? (
        <CategoriesPage />
      ) : screen === 'settings' ? (
        <SettingsPage />
      ) : (
        <div
          className={`workspace ${showSidebar ? '' : 'no-sidebar'} ${libraryOnly ? 'library-only' : ''} ${sidebar && !libraryOnly ? 'force-side' : ''}`}
        >
          {showSidebar ? (
            <aside className={`sidebar ${libraryOnly ? 'library-full' : ''}`}>
              {visible.length === 0 ? (
                <p className="empty-hint">Aucune note ici. Appuie sur + pour en créer une.</p>
              ) : (
                visible.map((note) => <NoteCard key={note.id} note={note} />)
              )}
            </aside>
          ) : null}
          {!libraryOnly ? (
            <section className="editor-col">
              <div className="tabs">
                {openTabs.map((id) => {
                  const n = notes.find((x) => x.id === id)
                  if (!n) return null
                  return (
                    <button
                      key={id}
                      className={`tab ${id === activeId ? 'active' : ''}`}
                      type="button"
                      onClick={() => activateTab(id)}
                    >
                      {n.dirty ? <span className="dot" /> : null}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(id)
                        }}
                      >
                        <IconClose width={14} height={14} />
                      </span>
                    </button>
                  )
                })}
              </div>
              {unlockNoteId ? (
                <UnlockNote id={unlockNoteId} />
              ) : active ? (
                <>
                  <EditorPane note={active} />
                  <StatusBar note={active} />
                </>
              ) : null}
            </section>
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
            <h2 className="serif">{confirm.title}</h2>
            <p>{confirm.text}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => answerConfirm(false)}>
                ANNULER
              </button>
              <button className="yes" type="button" onClick={() => answerConfirm(true)}>
                CONTINUER
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
        <h2 className="serif">{prompt.title}</h2>
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
          <button type="button" onClick={() => answerText(null)}>
            ANNULER
          </button>
          <button className="yes" type="button" onClick={() => answerText(value)}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

function NoteCard({ note }: { note: Note }) {
  const content = useStore((s) => s.contents[note.id] ?? '')
  const cats = useStore((s) => s.categories)
  const label = cats.find((c) => note.categoryIds.includes(c.id))?.name ?? note.language
  const items = note.kind === 'checklist' ? parseChecklist(content) : []

  return (
    <div className="note-card" role="button" tabIndex={0} onClick={() => activateTab(note.id)} onKeyDown={(e) => {
      if (e.key === 'Enter') activateTab(note.id)
    }}>
      <div className="kicker">{note.locked ? 'Verrouillé' : label}</div>
      {note.kind === 'checklist' ? (
        <>
          <h3>{note.title}</h3>
          {items.slice(0, 5).map((it, i) => (
            <div
              className="check-row"
              key={it.id}
              onClick={(e) => {
                e.stopPropagation()
                if (note.locked) {
                  activateTab(note.id)
                  return
                }
                const next = items.map((x, j) => (j === i ? { ...x, done: !x.done } : x))
                setNoteContent(note.id, serializeChecklist(next))
              }}
            >
              <span className={`box ${it.done ? 'done' : ''}`}>{it.done ? '✓' : ''}</span>
              <span>{it.text}</span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="kicker" style={{ marginTop: -4 }}>
            {note.title}
          </div>
          <pre>{note.locked ? '••••••••' : previewText(content, 260)}</pre>
        </>
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
      <span>{note.language}</span>
      <select value={note.encoding} onChange={(e) => setEncoding(note.id, e.target.value)} title="Encodage">
        {ENCODINGS.map((enc) => (
          <option key={enc} value={enc}>
            {enc.toUpperCase()}
          </option>
        ))}
      </select>
      <select
        value={note.lineEnding}
        onChange={(e) => setLineEnding(note.id, e.target.value as Note['lineEnding'])}
        title="Fins de ligne"
      >
        <option value="LF">LF</option>
        <option value="CRLF">CRLF</option>
        <option value="CR">CR</option>
      </select>
      <select value={note.kind} onChange={(e) => setNoteKind(note.id, e.target.value as Note['kind'])} title="Type">
        <option value="text">Texte</option>
        <option value="markdown">Markdown</option>
        <option value="checklist">Liste</option>
      </select>
      <button type="button" onClick={() => setWrap(!wrap)}>
        {wrap ? 'RETOUR LIGNE' : 'SANS RETOUR'}
      </button>
      <button type="button" onClick={togglePreview}>
        {preview ? 'ÉDITION' : 'APERÇU'}
      </button>
      <button type="button" onClick={toggleDiff}>
        {diff ? 'MASQUER DIFF' : 'DIFF'}
      </button>
      <button type="button" onClick={() => void saveActive()}>
        ENREGISTRER
      </button>
      <button type="button" onClick={() => void saveActiveAs()}>
        SOUS…
      </button>
      <span style={{ flex: 1 }} />
      <button className="icon-btn" type="button" title="Épingler" onClick={() => pinNote(note.id)}>
        <IconPin />
      </button>
      <button className="icon-btn" type="button" title="Catégories" onClick={() => setScreen('categories')}>
        <IconFolder />
      </button>
      <button
        className="icon-btn"
        type="button"
        title="Verrouiller"
        onClick={async () => {
          const pin = await promptPin('Verrouiller cette note')
          if (pin) void lockNote(note.id, pin)
        }}
      >
        <IconLock />
      </button>
      <button
        className="icon-btn"
        type="button"
        title="Supprimer"
        onClick={async () => {
          const ok = await ask('Supprimer ?', `Supprimer « ${note.title} » ?`)
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
          placeholder="Nouvelle catégorie..."
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
          ADD
        </button>
      </div>
      {categories.map((c) => (
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
          <button className="icon-btn" type="button" title="Supprimer" onClick={() => removeCategory(c.id)}>
            <IconClose />
          </button>
        </div>
      ))}
    </div>
  )
}

function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const [pin, setPin] = useState('')

  return (
    <div className="page">
      <div className="settings-block">
        <h2>APPARENCE</h2>
        <div className="setting">
          <span>Thème</span>
          <button type="button" onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}>
            {settings.theme === 'dark' ? 'Sombre' : 'Clair'}
          </button>
        </div>
        <div className="setting">
          <span>Taille du texte</span>
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
        <div className="setting">
          <span>Retour à la ligne</span>
          <button type="button" onClick={() => setWrap(!settings.wrap)}>
            {settings.wrap ? 'Oui' : 'Non'}
          </button>
        </div>
      </div>
      <div className="settings-block">
        <h2>SÉCURITÉ</h2>
        <div className="setting">
          <span>Code PIN</span>
          <input
            type="password"
            value={pin}
            placeholder="••••"
            onChange={(e) => setPin(e.target.value)}
            style={{ width: 120, background: 'transparent', border: 0, textAlign: 'right', outline: 'none' }}
          />
        </div>
        <button
          className="add-item"
          type="button"
          onClick={() => {
            if (!pin.trim()) return
            void setAppPin(pin, true)
            setPin('')
          }}
        >
          ENREGISTRER LE PIN
        </button>
        {settings.pinHash ? (
          <button
            className="lock-btn"
            type="button"
            style={{ marginTop: 12 }}
            onClick={() => void setAppPin('', false)}
          >
            RETIRER LE PIN
          </button>
        ) : null}
        <button className="lock-btn" type="button" style={{ marginTop: 12 }} onClick={lockAppNow}>
          VERROUILLER L’APP
        </button>
      </div>
      <div className="settings-block">
        <h2>RACCOURCIS</h2>
        <div className="setting">
          <span>Nouveau</span>
          <span>Ctrl+N</span>
        </div>
        <div className="setting">
          <span>Ouvrir</span>
          <span>Ctrl+O</span>
        </div>
        <div className="setting">
          <span>Enregistrer</span>
          <span>Ctrl+S</span>
        </div>
        <div className="setting">
          <span>Rechercher</span>
          <span>Ctrl+F</span>
        </div>
        <div className="setting">
          <span>Aperçu Markdown</span>
          <span>Alt+P</span>
        </div>
        <div className="setting">
          <span>Diff</span>
          <span>Alt+D</span>
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
        <button className="icon-btn" type="button" style={{ alignSelf: 'flex-start' }} title="Quitter" onClick={quitApp}>
          <IconBack />
        </button>
        <h1 className="serif">Unlock</h1>
        <button className="finger-btn" type="button" title="Déverrouiller" onClick={() => void submit()}>
          <IconFingerprint className="finger" />
        </button>
        <input
          autoFocus
          inputMode="numeric"
          value={pin}
          placeholder="PIN"
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        {err ? <div className="toast error">Code incorrect</div> : null}
        <button className="lock-btn" type="button" onClick={() => void submit()}>
          UNLOCK WITH PIN
        </button>
        <button type="button" onClick={quitApp}>
          CANCEL
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
      <h1 className="serif">Unlock</h1>
      <button className="finger-btn" type="button" onClick={() => void submit()}>
        <IconFingerprint className="finger" />
      </button>
      <input
        autoFocus
        value={pin}
        placeholder="PIN"
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
      />
      {err ? <div>Code incorrect</div> : null}
      <button className="lock-btn" type="button" onClick={() => void submit()}>
        UNLOCK WITH PIN
      </button>
      <button type="button" onClick={cancelUnlock}>
        CANCEL
      </button>
    </div>
  )
}
