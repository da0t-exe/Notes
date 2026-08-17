import { EditorView } from '@codemirror/view'

export function editorTheme(dark: boolean, fontSize: number) {
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
      '.cm-line': { color: dark ? '#f0f2f1' : '#111' },
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
