import { useEffect, useMemo, useRef, useState } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  placeholder,
  rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'

import { HIGHLIGHT_MAX, PREVIEW_MAX } from '../lib/files'
import { formatBytes } from '../lib/format'
import { languageExtension } from '../lib/languages'
import { renderMarkdown } from '../lib/markdown'
import type { Note } from '../lib/types'
import { getContent, markDirty, registerView, setCursor, unregisterView, useStore } from '../store'
import { editorTheme } from './theme'

const wrapComp = new Compartment()
const langComp = new Compartment()
const themeComp = new Compartment()

export function EditorPane({ note }: { note: Note }) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const theme = useStore((s) => s.settings.theme)
  const wrap = useStore((s) => s.settings.wrap)
  const fontSize = useStore((s) => s.settings.fontSize)
  const preview = useStore((s) => s.preview)
  const content = useStore((s) => s.contents[note.id] ?? '')

  const [dark, setDark] = useState(() => theme !== 'light')

  // Highlighting is dropped past a threshold: the language parser, not
  // CodeMirror itself, is what makes a multi-megabyte file feel sluggish.
  const large = note.size > HIGHLIGHT_MAX
  const canPreview = note.kind !== 'checklist' && note.size <= PREVIEW_MAX

  useEffect(() => {
    const resolve = () => setDark(document.documentElement.dataset['theme'] !== 'light')
    resolve()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', resolve)
    return () => mq.removeEventListener('change', resolve)
  }, [theme])

  useEffect(() => {
    if (!host.current) return
    const lang = large ? null : languageExtension(note.fileName, note.kind)

    const view = new EditorView({
      state: EditorState.create({
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
          langComp.of(
            lang ? [lang, syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle)] : [],
          ),
          wrapComp.of(wrap ? EditorView.lineWrapping : []),
          themeComp.of(editorTheme(dark, fontSize)),
          EditorView.updateListener.of((u) => {
            const head = u.state.selection.main.head
            const line = u.state.doc.lineAt(head)
            setCursor(line.number, head - line.from + 1)
            if (u.docChanged) markDirty(note.id)
          }),
        ],
      }),
      parent: host.current,
    })

    viewRef.current = view
    registerView(note.id, view)
    return () => {
      unregisterView(note.id)
      view.destroy()
      viewRef.current = null
    }
    // Rebuilding on note identity only. Theme, wrap and font size are pushed
    // through compartments below instead of tearing the document down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, note.kind, note.fileName, large])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const lang = large ? null : languageExtension(note.fileName, note.kind)
    view.dispatch({
      effects: [
        wrapComp.reconfigure(wrap ? EditorView.lineWrapping : []),
        themeComp.reconfigure(editorTheme(dark, fontSize)),
        langComp.reconfigure(
          lang ? [lang, syntaxHighlighting(dark ? oneDarkHighlightStyle : defaultHighlightStyle)] : [],
        ),
      ],
    })
  }, [wrap, dark, fontSize, large, note.fileName, note.kind])

  // Reads the store mirror rather than the live view, so this stays a pure
  // render. The mirror lags typing by one debounce, which the preview can wear.
  const html = useMemo(
    () => (preview && canPreview ? renderMarkdown(content) : ''),
    [preview, canPreview, content],
  )

  return (
    <div className={`stage ${preview && canPreview ? 'split' : ''}`}>
      <div className="cm-host" ref={host} />
      {preview && canPreview ? (
        // Sanitised in renderMarkdown — see the note there on why this matters.
        // eslint-disable-next-line react/no-danger
        <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
      ) : null}
      {preview && !canPreview ? (
        <div className="preview">Preview is disabled above {formatBytes(PREVIEW_MAX)}.</div>
      ) : null}
    </div>
  )
}
