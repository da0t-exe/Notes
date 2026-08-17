import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

/**
 * Markers hidden once the caret leaves their line. Structural markers are not
 * in here on purpose: list bullets and quote arrows carry meaning that the
 * rendered form does not replace, so they stay visible.
 */
const HIDDEN = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark', 'CodeMark', 'LinkMark'])

/** Content nodes that get a class so they actually look like what they are. */
const STYLED: Record<string, string> = {
  StrongEmphasis: 'cm-md-strong',
  Emphasis: 'cm-md-em',
  InlineCode: 'cm-md-code',
  Strikethrough: 'cm-md-strike',
  ATXHeading1: 'cm-md-h1',
  ATXHeading2: 'cm-md-h2',
  ATXHeading3: 'cm-md-h3',
  ATXHeading4: 'cm-md-h4',
  ATXHeading5: 'cm-md-h5',
  ATXHeading6: 'cm-md-h6',
}

const hide = Decoration.replace({})

/**
 * A marker only hides when hiding it leaves the line readable.
 *
 * A fenced code block's ``` sits on its own line and a setext underline is a
 * whole line of ===; blanking either leaves an empty line where a marker used
 * to be, which reads as a rendering bug rather than as a preview.
 */
function hideable(name: string, parent: string | undefined): boolean {
  if (!HIDDEN.has(name)) return false
  if (name === 'CodeMark') return parent === 'InlineCode'
  if (name === 'HeaderMark') return parent?.startsWith('ATXHeading') ?? false
  return true
}

function build(view: EditorView): DecorationSet {
  const { state } = view
  const ranges: Range<Decoration>[] = []

  /**
   * True when the selection touches this construct.
   *
   * Scoped to the construct rather than to its line: putting the caret in a
   * paragraph should reveal the emphasis you are actually inside, not every
   * marker that happens to share the line. Touching the edges counts, so the
   * closing marker is reachable from just after the word.
   */
  const touched = (from: number, to: number) =>
    state.selection.ranges.some((r) => r.from <= to && r.to >= from)

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const cls = STYLED[node.name]
        if (cls && node.to > node.from) {
          ranges.push(Decoration.mark({ class: cls }).range(node.from, node.to))
        }

        if (node.to === node.from) return
        const parent = node.node.parent
        if (!hideable(node.name, parent?.name)) return

        // The construct owns the reveal, not the marker: entering "bold" has to
        // bring back both of its asterisks, not only the one you are next to.
        if (touched(parent?.from ?? node.from, parent?.to ?? node.to)) return

        // Swallow the space after a heading's hashes too, otherwise the title
        // renders indented by exactly the marker that was meant to disappear.
        let end = node.to
        if (node.name === 'HeaderMark') {
          const line = state.doc.lineAt(node.from)
          while (end < line.to && state.doc.sliceString(end, end + 1) === ' ') end++
        }
        ranges.push(hide.range(node.from, end))
      },
    })
  }

  return Decoration.set(ranges, true)
}

/**
 * Markdown that shows its syntax only where you are working, the way a chat
 * composer does: the caret's line is raw text, every other line reads as the
 * rendered result.
 */
export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = build(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = build(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

export const livePreviewTheme = EditorView.baseTheme({
  '.cm-md-strong': { fontWeight: '500' },
  '.cm-md-em': { fontStyle: 'italic' },
  '.cm-md-strike': { textDecoration: 'line-through', opacity: '0.7' },
  '.cm-md-code': {
    fontFamily: '"Azeret Mono", ui-monospace, monospace',
    padding: '1px 4px',
    borderRadius: '4px',
    background: 'rgba(127,127,127,0.16)',
  },
  '.cm-md-h1, .cm-md-h2, .cm-md-h3, .cm-md-h4, .cm-md-h5, .cm-md-h6': {
    fontFamily: '"NType82 Headline", serif',
    fontWeight: '400',
    lineHeight: '1.3',
    // The syntax highlighter paints headings red. Size and face already say
    // "heading"; the colour only made titles look like errors.
    color: 'inherit',
  },
  // The highlighter styles spans nested inside the heading, so the reset has
  // to reach them too.
  '.cm-md-h1 span, .cm-md-h2 span, .cm-md-h3 span, .cm-md-h4 span, .cm-md-h5 span, .cm-md-h6 span':
    { color: 'inherit' },
  '.cm-md-h1': { fontSize: '1.7em' },
  '.cm-md-h2': { fontSize: '1.45em' },
  '.cm-md-h3': { fontSize: '1.25em' },
  '.cm-md-h4': { fontSize: '1.12em' },
  '.cm-md-h5': { fontSize: '1.05em' },
  '.cm-md-h6': { fontSize: '1em' },
})
