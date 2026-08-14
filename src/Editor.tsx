import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import type { Note } from './types'
import {
  getContent,
  askText,
  addCategory,
  insertIntoActive,
  lockNote,
  markDirty,
  notify,
  promptPin,
  setNoteKind,
  registerView,
  setCursor,
  setNoteContent,
  setNoteTitle,
  toggleNoteCategory,
  togglePreview,
  unregisterView,
  useCursor,
  useStore,
} from './store'
import { HIGHLIGHT_MAX, PREVIEW_MAX, languageExtension } from './lib/languages'
import { formatBytes, formatUpdated } from './lib/format'
import { parseChecklist, renderMarkdown, serializeChecklist } from './lib/markdown'
import { IconClose, IconGrip, IconImage, IconList, IconLock, IconPlus, IconSliders } from './icons'

const wrapComp = new Compartment()
const langComp = new Compartment()
const themeComp = new Compartment()

function editorTheme(dark: boolean, fontSize: number) {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'transparent',
        color: dark ? '#fff' : '#111',
        fontSize: `${fontSize}px`,
        height: '100%',
      },
      '.cm-content': {
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        caretColor: dark ? '#fff' : '#111',
        padding: '8px 18px 48px',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: dark ? '#555' : '#888',
      },
      '.cm-activeLine': { backgroundColor: dark ? '#ffffff08' : '#00000008' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: dark ? '#ffffff24' : '#00000022',
      },
    },
    { dark },
  )
}

function lineDiff(a: string, b: string) {
  const al = a.split('\n')
  const bl = b.split('\n')
  const max = Math.max(al.length, bl.length)
  const rows: { type: 'same' | 'add' | 'del'; text: string }[] = []
  for (let i = 0; i < max; i++) {
    const L = al[i]
    const R = bl[i]
    if (L === R) rows.push({ type: 'same', text: R ?? L ?? '' })
    else {
      if (L !== undefined) rows.push({ type: 'del', text: L })
      if (R !== undefined) rows.push({ type: 'add', text: R })
    }
  }
  return rows
}

export function EditorPane({ note }: { note: Note }) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const theme = useStore((s) => s.settings.theme)
  const wrap = useStore((s) => s.settings.wrap)
  const fontSize = useStore((s) => s.settings.fontSize)
  const preview = useStore((s) => s.preview)
  const diff = useStore((s) => s.diff)
  const categories = useStore((s) => s.categories)
  const original = useStore((s) => s.originals[note.id] ?? '')
  const content = useStore((s) => s.contents[note.id] ?? '')
  const cursor = useCursor()

  const [tick, setTick] = useState(0)
  const liveTimer = useRef(0)
  const dark = theme === 'dark'
  const large = note.size > HIGHLIGHT_MAX
  const canPreview = note.kind !== 'checklist' && note.size <= PREVIEW_MAX

  useEffect(() => {
    if (note.kind === 'checklist' || !host.current) return
    const lang = large ? null : languageExtension(note.fileName, note.kind)
    const state = EditorState.create({
      doc: getContent(note.id),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        rectangularSelection(),
        history(),
        bracketMatching(),
        search(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        langComp.of(lang ? [lang, syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle)] : []),
        wrapComp.of(wrap ? EditorView.lineWrapping : []),
        themeComp.of(editorTheme(dark, fontSize)),
        EditorView.updateListener.of((u) => {
          const head = u.state.selection.main.head
          const line = u.state.doc.lineAt(head)
          setCursor(line.number, head - line.from + 1)
          if (u.docChanged) {
            markDirty(note.id)
            window.clearTimeout(liveTimer.current)
            liveTimer.current = window.setTimeout(() => setTick((n) => n + 1), 180)
          }
        }),
      ],
    })
    const view = new EditorView({ state, parent: host.current })
    viewRef.current = view
    registerView(note.id, view)
    return () => {
      unregisterView(note.id)
      view.destroy()
      viewRef.current = null
    }
  }, [note.id, note.kind, note.fileName, large])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const lang = large ? null : languageExtension(note.fileName, note.kind)
    view.dispatch({
      effects: [
        wrapComp.reconfigure(wrap ? EditorView.lineWrapping : []),
        themeComp.reconfigure(editorTheme(dark, fontSize)),
        langComp.reconfigure(lang ? [lang, syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle)] : []),
      ],
    })
  }, [wrap, dark, fontSize, large, note.fileName, note.kind])

  const live = viewRef.current?.state.doc.toString() ?? content

  const html = useMemo(() => {
    if (!preview || !canPreview) return ''
    return renderMarkdown(live)
  }, [preview, canPreview, live, tick])

  const diffRows = useMemo(() => {
    if (!diff || note.size > PREVIEW_MAX) return []
    return lineDiff(original, live)
  }, [diff, original, live, note.size, tick])

  if (note.kind === 'checklist') {
    return <ChecklistNote note={note} content={content} />
  }

  const split = (preview && canPreview) || (diff && note.size <= PREVIEW_MAX)

  return (
    <>
      <div className="meta-bar">
        <div className="label">CATÉGORIES</div>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`ghost-pill ${note.categoryIds.includes(c.id) ? 'pill active' : ''}`}
            onClick={() => toggleNoteCategory(note.id, c.id)}
            type="button"
          >
            {c.name.toUpperCase()}
            {note.categoryIds.includes(c.id) ? ' ×' : ''}
          </button>
        ))}
        <button
          className="plus"
          type="button"
          title="Ajouter une catégorie"
          onClick={async () => {
            const name = await askText('Nouvelle catégorie', 'Nom de la catégorie')
            if (!name) return
            const id = addCategory(name)
            if (id) toggleNoteCategory(note.id, id)
          }}
        >
          <IconPlus width={14} height={14} />
        </button>
      </div>
      <div className={`stage ${split ? 'split' : ''}`}>
        <div className="cm-host" ref={host} />
        {preview && canPreview ? (
          <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
        {preview && !canPreview ? (
          <div className="preview">Aperçu désactivé au-delà de {formatBytes(PREVIEW_MAX)}.</div>
        ) : null}
        {diff ? (
          <div className="diff">
            {note.size > PREVIEW_MAX ? (
              'Diff désactivé pour ce volume.'
            ) : (
              diffRows.map((row, i) => (
                <div key={i} className={`diff-line ${row.type}`}>
                  {row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  '}
                  {row.text}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
      <div className="toolbar">
        <button className="icon-btn" type="button" title="Liste / case à cocher" onClick={() => insertIntoActive('\n- [ ] ')}>
          <IconList />
        </button>
        <button className="icon-btn" type="button" title="Insérer une image" onClick={() => void insertImage()}>
          <IconImage />
        </button>
        <button className="icon-btn" type="button" title="Aperçu Markdown" onClick={togglePreview}>
          <IconSliders />
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
        <span style={{ flex: 1 }} />
        <span className="status" style={{ border: 0, padding: 0 }}>
          Ln {cursor.line}, Col {cursor.col}
        </span>
      </div>
    </>
  )
}

async function insertImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 1_500_000) {
      notify('Image trop lourde (max 1,5 Mo)', 'warn')
      return
    }
    const data = await fileToDataUrl(file)
    insertIntoActive(`\n![${file.name}](${data})\n`)
  }
  input.click()
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function ChecklistNote({ note, content }: { note: Note; content: string }) {
  const categories = useStore((s) => s.categories)
  const items = parseChecklist(content)
  const [drag, setDrag] = useState<number | null>(null)

  function write(next: { text: string; done: boolean }[]) {
    setNoteContent(note.id, serializeChecklist(next))
  }

  return (
    <div className="checklist">
      <input
        className="note-title serif"
        value={note.title}
        onChange={(e) => setNoteTitle(note.id, e.target.value)}
      />
      <div className="updated">{formatUpdated(note.updatedAt)}</div>
      <div className="meta-bar">
        <div className="label">CATÉGORIES</div>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`ghost-pill ${note.categoryIds.includes(c.id) ? 'pill active' : ''}`}
            onClick={() => toggleNoteCategory(note.id, c.id)}
            type="button"
          >
            {c.name.toUpperCase()}
            {note.categoryIds.includes(c.id) ? ' ×' : ''}
          </button>
        ))}
        <button
          className="plus"
          type="button"
          title="Ajouter une catégorie"
          onClick={async () => {
            const name = await askText('Nouvelle catégorie', 'Nom de la catégorie')
            if (!name) return
            const id = addCategory(name)
            if (id) toggleNoteCategory(note.id, id)
          }}
        >
          <IconPlus width={14} height={14} />
        </button>
      </div>
      {items.map((it, i) => (
        <div
          className="check-edit"
          key={`${it.id}-${i}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (drag === null || drag === i) return
            const next = [...items]
            const [moved] = next.splice(drag, 1)
            if (!moved) return
            next.splice(i, 0, moved)
            write(next)
            setDrag(null)
          }}
        >
          <button
            className="icon-btn"
            style={{ width: 22, height: 22, cursor: 'grab' }}
            type="button"
            title="Réordonner"
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnd={() => setDrag(null)}
          >
            <IconGrip />
          </button>
          <button
            className={`check-box ${it.done ? 'on' : ''}`}
            type="button"
            onClick={() => write(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
          >
            {it.done ? '✓' : ''}
          </button>
          <input
            type="text"
            value={it.text}
            onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
          <button className="icon-btn" type="button" title="Supprimer l’élément" onClick={() => write(items.filter((_, j) => j !== i))}>
            <IconClose />
          </button>
        </div>
      ))}
      <button className="add-item" type="button" onClick={() => write([...items, { text: '', done: false }])}>
        + AJOUTER
      </button>
      <div className="toolbar">
        <button
          className="icon-btn"
          type="button"
          title="Ajouter un élément"
          onClick={() => write([...items, { text: '', done: false }])}
        >
          <IconList />
        </button>
        <button
          className="icon-btn"
          type="button"
          title="Passer en Markdown"
          onClick={() => setNoteKind(note.id, 'markdown')}
        >
          <IconSliders />
        </button>
        <span style={{ flex: 1 }} />
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
      </div>
    </div>
  )
}
