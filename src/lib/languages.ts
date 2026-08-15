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

const ini = StreamLanguage.define(properties)

export const TEXT_EXTS = [
  'txt',
  'md',
  'markdown',
  'mdx',
  'rst',
  'org',
  'adoc',
  'tex',
  'log',
  'out',
  'csv',
  'tsv',
  'json',
  'jsonc',
  'json5',
  'xml',
  'yml',
  'yaml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'properties',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'svg',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'mts',
  'cts',
  'tsx',
  'vue',
  'svelte',
  'py',
  'rb',
  'php',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cc',
  'cs',
  'go',
  'rs',
  'kt',
  'kts',
  'swift',
  'm',
  'mm',
  'sql',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'cmd',
  'lua',
  'r',
  'pl',
  'pm',
  'dart',
  'scala',
  'graphql',
  'gql',
  'proto',
  'dockerfile',
  'gitignore',
  'editorconfig',
  'lock',
]

export const FILE_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'Text documents',
    accept: {
      'text/plain': ['.txt', '.log', '.csv', '.tsv', '.ini', '.cfg', '.conf', '.env'],
      'text/markdown': ['.md', '.markdown', '.mdx'],
    },
  },
  {
    description: 'Data',
    accept: {
      'application/json': ['.json', '.jsonc', '.json5'],
      'application/xml': ['.xml', '.svg'],
      'application/x-yaml': ['.yml', '.yaml'],
      'application/toml': ['.toml'],
    },
  },
  {
    description: 'Code',
    accept: {
      'text/javascript': ['.js', '.mjs', '.cjs', '.jsx'],
      'text/typescript': ['.ts', '.tsx', '.mts', '.cts'],
      'text/html': ['.html', '.htm'],
      'text/css': ['.css', '.scss', '.sass', '.less'],
      'text/x-python': ['.py'],
      'text/x-java': ['.java'],
      'text/x-c': ['.c', '.h', '.cpp', '.hpp', '.cc', '.cs'],
      'text/x-go': ['.go'],
      'text/x-rust': ['.rs'],
      'text/x-php': ['.php'],
      'text/x-ruby': ['.rb'],
      'text/x-sql': ['.sql'],
      'text/x-sh': ['.sh', '.bash', '.zsh', '.ps1'],
    },
  },
]

export function languageLabel(fileName: string | null, kind: string): string {
  if (!fileName) {
    if (kind === 'markdown') return 'Markdown'
    if (kind === 'checklist') return 'List'
    return 'Texte'
  }
  const ext = extOf(fileName)
  const map: Record<string, string> = {
    md: 'Markdown',
    markdown: 'Markdown',
    json: 'JSON',
    jsonc: 'JSON',
    js: 'JavaScript',
    mjs: 'JavaScript',
    cjs: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    html: 'HTML',
    htm: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    xml: 'XML',
    svg: 'SVG',
    py: 'Python',
    java: 'Java',
    c: 'C',
    h: 'C',
    cpp: 'C++',
    hpp: 'C++',
    cs: 'C#',
    go: 'Go',
    rs: 'Rust',
    php: 'PHP',
    rb: 'Ruby',
    sql: 'SQL',
    yml: 'YAML',
    yaml: 'YAML',
    toml: 'TOML',
    sh: 'Shell',
    bash: 'Shell',
    ps1: 'PowerShell',
    lua: 'Lua',
    r: 'R',
    swift: 'Swift',
    kt: 'Kotlin',
    vue: 'Vue',
    svelte: 'Svelte',
    csv: 'CSV',
    log: 'Log',
    txt: 'Texte',
  }
  return map[ext] ?? (ext.toUpperCase() || 'Texte')
}

export function languageExtension(fileName: string | null, kind: string): Extension | null {
  const ext = fileName ? extOf(fileName) : kind === 'markdown' ? 'md' : ''
  switch (ext) {
    case 'md':
    case 'markdown':
    case 'mdx':
      return markdown()
    case 'json':
    case 'jsonc':
    case 'json5':
      return json()
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return javascript({ jsx: ext === 'jsx' })
    case 'ts':
    case 'mts':
    case 'cts':
    case 'tsx':
      return javascript({ typescript: true, jsx: ext === 'tsx' })
    case 'html':
    case 'htm':
    case 'vue':
    case 'svelte':
      return html()
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return css()
    case 'xml':
    case 'svg':
      return xml()
    case 'py':
      return python()
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cs':
      return cpp()
    case 'java':
      return java()
    case 'sql':
      return sql()
    case 'yml':
    case 'yaml':
      return yaml()
    case 'rs':
      return rust()
    case 'php':
      return php()
    case 'go':
      return StreamLanguage.define(go)
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
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
    case 'pl':
    case 'pm':
      return StreamLanguage.define(perl)
    case 'r':
      return StreamLanguage.define(r)
    case 'ini':
    case 'cfg':
    case 'conf':
    case 'env':
    case 'properties':
    case 'editorconfig':
      return ini
    default:
      return kind === 'markdown' ? markdown() : null
  }
}

export function kindFromName(fileName: string): 'text' | 'markdown' | 'checklist' {
  const ext = extOf(fileName)
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown'
  return 'text'
}

export const HIGHLIGHT_MAX = 1_500_000
export const PREVIEW_MAX = 400_000
export const PERSIST_MAX = 8_000_000
export const WARN_SIZE = 20_000_000
export const MAX_OPEN = 80_000_000
export const STREAM_SIZE = 2_000_000
