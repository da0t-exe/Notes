import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { xml } from '@codemirror/lang-xml'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { rust } from '@codemirror/lang-rust'
import { php } from '@codemirror/lang-php'
import { StreamLanguage } from '@codemirror/language'
import { go } from '@codemirror/legacy-modes/mode/go'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { perl } from '@codemirror/legacy-modes/mode/perl'
import { r } from '@codemirror/legacy-modes/mode/r'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import type { Extension } from '@codemirror/state'
import { extOf } from './format'
import type { NoteKind } from './types'

const ini = StreamLanguage.define(properties)

const LABELS: Record<string, string> = {
  md: 'Markdown', markdown: 'Markdown', mdx: 'Markdown',
  json: 'JSON', jsonc: 'JSON', json5: 'JSON',
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  html: 'HTML', htm: 'HTML',
  css: 'CSS', scss: 'SCSS', sass: 'SASS', less: 'LESS',
  xml: 'XML', svg: 'SVG',
  py: 'Python', java: 'Java',
  c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', cc: 'C++', cs: 'C#',
  go: 'Go', rs: 'Rust', php: 'PHP', rb: 'Ruby', sql: 'SQL',
  yml: 'YAML', yaml: 'YAML', toml: 'TOML',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell',
  lua: 'Lua', r: 'R', swift: 'Swift', kt: 'Kotlin',
  vue: 'Vue', svelte: 'Svelte',
  csv: 'CSV', log: 'Log', txt: 'Text',
}

export function languageLabel(fileName: string | null, kind: NoteKind): string {
  if (!fileName) {
    if (kind === 'markdown') return 'Markdown'
    if (kind === 'checklist') return 'List'
    return 'Text'
  }
  const ext = extOf(fileName)
  return LABELS[ext] ?? (ext.toUpperCase() || 'Text')
}

export function kindFromName(fileName: string): NoteKind {
  const ext = extOf(fileName)
  return ext === 'md' || ext === 'markdown' || ext === 'mdx' ? 'markdown' : 'text'
}

export function languageExtension(fileName: string | null, kind: NoteKind): Extension | null {
  const ext = fileName ? extOf(fileName) : kind === 'markdown' ? 'md' : ''
  switch (ext) {
    case 'md': case 'markdown': case 'mdx':
      return markdown()
    case 'json': case 'jsonc': case 'json5':
      return json()
    case 'js': case 'mjs': case 'cjs': case 'jsx':
      return javascript({ jsx: ext === 'jsx' })
    case 'ts': case 'mts': case 'cts': case 'tsx':
      return javascript({ typescript: true, jsx: ext === 'tsx' })
    case 'html': case 'htm': case 'vue': case 'svelte':
      return html()
    case 'css': case 'scss': case 'sass': case 'less':
      return css()
    case 'xml': case 'svg':
      return xml()
    case 'py':
      return python()
    case 'c': case 'h': case 'cpp': case 'hpp': case 'cc': case 'cs':
      return cpp()
    case 'java':
      return java()
    case 'sql':
      return sql()
    case 'yml': case 'yaml':
      return yaml()
    case 'rs':
      return rust()
    case 'php':
      return php()
    case 'go':
      return StreamLanguage.define(go)
    case 'sh': case 'bash': case 'zsh': case 'bat': case 'cmd':
      return StreamLanguage.define(shell)
    case 'ps1':
      return StreamLanguage.define(powerShell)
    case 'toml':
      return StreamLanguage.define(toml)
    case 'dockerfile':
      return StreamLanguage.define(dockerFile)
    case 'rb':
      return StreamLanguage.define(ruby)
    case 'swift':
      return StreamLanguage.define(swift)
    case 'lua':
      return StreamLanguage.define(lua)
    case 'pl': case 'pm':
      return StreamLanguage.define(perl)
    case 'r':
      return StreamLanguage.define(r)
    case 'ini': case 'cfg': case 'conf': case 'env': case 'properties': case 'editorconfig':
      return ini
    default:
      return kind === 'markdown' ? markdown() : null
  }
}
