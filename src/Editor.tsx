import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
  rectangularSelection,
  placeholder,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import type { ListType, Note } from './lib'
import {
  getContent,
  askText,
  addCategory,
  addNoteImage,
  lockNote,
  markDirty,
  notify,
  prefixActiveLine,
  promptPin,
  registerView,
  removeNoteImage,
  setCursor,
  setListType,
  setNoteContent,
  setNoteTitle,
  toggleNoteCategory,
  toggleNoteOrList,
  togglePreview,
  unregisterView,
  useStore,
  wrapActive,
} from './store'
import { formatBytes, formatStamp, HIGHLIGHT_MAX, languageExtension, parseList, PREVIEW_MAX, renderMarkdown, serializeList } from './lib'
import {
  IconBold,
  IconCamera,
  IconClose,
  IconCode,
  IconGrip,
  IconHeading,
  IconImage,
  IconItalic,
  IconList,
  IconLock,
  IconNote,
  IconPlus,
  IconPreview,
  IconQuote,
  IconStrike,
} from './icons'

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
        fontFamily: '"Azeret Mono", ui-monospace, monospace',
        fontWeight: '300',
        color: dark ? '#f0f2f1' : '#111',
        caretColor: dark ? '#f0f2f1' : '#111',
        padding: '8px 16px 120px',
      },
      '.cm-line': {
        color: dark ? '#f0f2f1' : '#111',
      },
      '.cm-header, .tok-header': {
        fontFamily: '"NType82 Headline", serif',
        fontSize: '1.35em',
        fontWeight: '400',
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
  const original = useStore((s) => s.originals[note.id] ?? '')
  const content = useStore((s) => s.contents[note.id] ?? '')

  const [tick, setTick] = useState(0)
  const liveTimer = useRef(0)
  const dark =
    theme === 'light'
      ? false
      : theme === 'dark'
        ? true
        : typeof document !== 'undefined'
          ? document.documentElement.dataset.theme !== 'light'
          : true
  const large = note.size > HIGHLIGHT_MAX
  const canPreview = note.kind !== 'checklist' && note.size <= PREVIEW_MAX

  useEffect(() => {
    if (note.kind === 'checklist' || !host.current) return
    const lang = large ? null : languageExtension(note.fileName, note.kind)
    const state = EditorState.create({
      doc: getContent(note.id),
      extensions: [
        highlightActiveLine(),
        drawSelection(),
        rectangularSelection(),
        history(),
        placeholder('Type your note here...'),
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
      <NoteChrome note={note} />
      <div className={`stage ${split ? 'split' : ''}`}>
        <div className="cm-host" ref={host} />
        {preview && canPreview ? (
          <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
        {preview && !canPreview ? (
          <div className="preview">Preview disabled above {formatBytes(PREVIEW_MAX)}.</div>
        ) : null}
        {diff ? (
          <div className="diff">
            {note.size > PREVIEW_MAX ? (
              'Diff disabled for this file size.'
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
      <div className="editor-dock">
        <div className="md-bar">
          <button className="icon-btn" type="button" title="Bold" onClick={() => wrapActive('*')}>
            <IconBold />
          </button>
          <button className="icon-btn" type="button" title="Italic" onClick={() => wrapActive('_')}>
            <IconItalic />
          </button>
          <button className="icon-btn" type="button" title="Strikethrough" onClick={() => wrapActive('~')}>
            <IconStrike />
          </button>
          <button className="icon-btn" type="button" title="Heading" onClick={() => prefixActiveLine('# ')}>
            <IconHeading />
          </button>
          <button className="icon-btn" type="button" title="Quote" onClick={() => prefixActiveLine('> ')}>
            <IconQuote />
          </button>
          <button
            className="icon-btn"
            type="button"
            title="Code"
            onClick={() => {
              const selected = viewRef.current?.state.sliceDoc(
                viewRef.current.state.selection.main.from,
                viewRef.current.state.selection.main.to,
              )
              if (selected?.includes('\n')) wrapActive('```\n', '\n```')
              else wrapActive('`')
            }}
          >
            <IconCode />
          </button>
        </div>
        <div className="editor-dock-actions">
          <button className={`eye-fab ${preview ? 'on' : ''}`} type="button" title="Preview" onClick={togglePreview}>
            <IconPreview />
          </button>
          <EditorActions note={note} />
        </div>
      </div>
    </>
  )
}

function NoteChrome({ note }: { note: Note }) {
  const categories = useStore((s) => s.categories)
  return (
    <>
      <input
        className="note-title"
        value={note.title}
        placeholder="Your title..."
        onChange={(e) => setNoteTitle(note.id, e.target.value)}
      />
      <div className="updated">Updated: {formatStamp(note.updatedAt)}</div>
      <div className="meta-label">Categories</div>
      <div className="meta-bar">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`ghost-pill ${note.categoryIds.includes(c.id) ? 'pill active' : ''}`}
            onClick={() => toggleNoteCategory(note.id, c.id)}
            type="button"
          >
            {c.name}
          </button>
        ))}
        <button
          className="plus circle"
          type="button"
          title="Add category"
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
      <NoteImages note={note} />
    </>
  )
}

function NoteImages({ note }: { note: Note }) {
  const images = note.images ?? []
  if (!images.length) return null
  return (
    <div className="note-images">
      {images.map((src, i) => (
        <div className="note-image" key={`${i}-${src.slice(-12)}`}>
          <img src={src} alt="" />
          <button className="icon-btn" type="button" title="Remove image" onClick={() => removeNoteImage(note.id, i)}>
            <IconClose width={14} height={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function EditorActions({ note }: { note: Note }) {
  return (
    <div className="toolbar">
      <button className="icon-btn" type="button" title="Camera" onClick={() => void pickNoteImage(note.id)}>
        <IconCamera />
      </button>
      <button className="icon-btn" type="button" title="Add image" onClick={() => void pickNoteImage(note.id)}>
        <IconImage />
      </button>
      <button
        className="icon-btn"
        type="button"
        title={note.kind === 'checklist' ? 'Switch to note' : 'Switch to list'}
        onClick={() => toggleNoteOrList(note.id)}
      >
        {note.kind === 'checklist' ? <IconNote /> : <IconList />}
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
    </div>
  )
}

async function pickNoteImage(noteId: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 1_500_000) {
      notify('Image too large (max 1.5 MB)', 'warn')
      return
    }
    addNoteImage(noteId, await fileToDataUrl(file))
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
  const listType: ListType = note.listType ?? 'checklist'
  const items = parseList(content, listType)
  const [drag, setDrag] = useState<number | null>(null)

  function write(next: { text: string; done: boolean }[]) {
    setNoteContent(note.id, serializeList(next, listType))
  }

  const types: { id: ListType; label: string }[] = [
    { id: 'checklist', label: 'Checklist' },
    { id: 'bulleted', label: 'Bullets' },
    { id: 'numbered', label: 'Numbered' },
  ]

  return (
    <div className="checklist">
      <NoteChrome note={note} />
      <div className="list-types">
        {types.map((t) => (
          <button
            key={t.id}
            className={`ghost-pill ${listType === t.id ? 'pill active' : ''}`}
            type="button"
            onClick={() => setListType(note.id, t.id)}
          >
            {t.label}
          </button>
        ))}
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
            title="Reorder"
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnd={() => setDrag(null)}
          >
            <IconGrip />
          </button>
          {listType === 'checklist' ? (
            <button
              className={`check-box ${it.done ? 'on' : ''}`}
              type="button"
              onClick={() => write(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            >
              {it.done ? '✓' : ''}
            </button>
          ) : listType === 'numbered' ? (
            <span className="list-index">{i + 1}.</span>
          ) : (
            <span className="bullet" />
          )}
          <input
            type="text"
            value={it.text}
            onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
          <button className="icon-btn" type="button" title="Delete item" onClick={() => write(items.filter((_, j) => j !== i))}>
            <IconClose />
          </button>
        </div>
      ))}
      <button className="add-item" type="button" onClick={() => write([...items, { text: '', done: false }])}>
        Add item
      </button>
      <EditorActions note={note} />
    </div>
  )
}
