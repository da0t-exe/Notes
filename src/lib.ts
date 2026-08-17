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
import { marked } from 'marked'

export type Theme = 'dark' | 'light' | 'system'
export type NoteKind = 'text' | 'markdown' | 'checklist'
export type ListType = 'checklist' | 'bulleted' | 'numbered'
export type LineEnding = 'LF' | 'CRLF' | 'CR'
export type Screen = 'library' | 'editor' | 'categories' | 'settings' | 'trash' | 'theme'

export type Category = { id: string; name: string }
export type Note = {
  id: string
  title: string
  kind: NoteKind
  categoryIds: string[]
  createdAt: number
  updatedAt: number
  pinned: boolean
  locked: boolean
  encoding: string
  lineEnding: LineEnding
  fileName: string | null
  filePath?: string | null
  fromDisk: boolean
  language: string
  dirty: boolean
  size: number
  ciphertext?: string
  images?: string[]
  listType?: ListType
}
export type Settings = {
  theme: Theme
  language: string
  wrap: boolean
  fontSize: number
  pinHash: string | null
  pinSalt: string | null
  appLock: boolean
}
export type Toast = { id: number; text: string; tone: 'info' | 'warn' | 'error' }
export type LoadProgress = { name: string; loaded: number; total: number }

export type NativeFile = {
  path: string
  name: string
  text: string
  size: number
  lastModified: number
  encoding: string
  binary: boolean
  lineEnding: LineEnding
}
type NativeAPI = {
  isNative: true
  openFiles: () => Promise<NativeFile[]>
  writeFile: (filePath: string, text: string, encoding: string) => Promise<{ path: string; name: string }>
  saveFileAs: (name: string, text: string, encoding: string) => Promise<{ path: string; name: string } | null>
  minimize: () => void
  maximize: () => void
  close: () => void
  onMenu: (handler: (action: string) => void) => () => void
}

declare global {
  interface FilePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }
  interface FileSystemWritableFileStream extends WritableStream<BufferSource | Blob | string> {
    write(data: BufferSource | Blob | string): Promise<void>
    close(): Promise<void>
  }
  interface FileSystemFileHandle {
    readonly kind: 'file'
    readonly name: string
    getFile(): Promise<File>
    createWritable(): Promise<FileSystemWritableFileStream>
    queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
    requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  }
  interface Window {
    notesNative?: NativeAPI
    __TAURI_INTERNALS__?: unknown
    showOpenFilePicker?: (options?: {
      multiple?: boolean
      excludeAcceptAllOption?: boolean
      types?: FilePickerAcceptType[]
    }) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      excludeAcceptAllOption?: boolean
      types?: FilePickerAcceptType[]
    }) => Promise<FileSystemFileHandle>
  }
}

export function uid(): string {
  return crypto.randomUUID()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function formatStamp(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(ts))
    .toUpperCase()
}

export function previewText(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trim()}…`
}

export function titleFromContent(text: string, fallback: string): string {
  const line = text.split(/\r?\n/).find((l) => l.replace(/^#+\s*/, '').trim())
  if (!line) return fallback
  return line.replace(/^#+\s*/, '').trim().slice(0, 80) || fallback
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export const ENCODINGS = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1'] as const

export function detectEncoding(bytes: Uint8Array): (typeof ENCODINGS)[number] {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)))
    return 'utf-8'
  } catch {
    return 'windows-1252'
  }
}

export function isLikelyBinary(bytes: Uint8Array, encoding: string): boolean {
  if (encoding.startsWith('utf-16')) return false
  const n = Math.min(bytes.length, 8192)
  let control = 0
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!
    if (b === 0) return true
    if (b < 9 || (b > 13 && b < 32)) control++
  }
  return n > 0 && control / n > 0.08
}

export function detectLineEnding(text: string): LineEnding {
  const crlf = (text.match(/\r\n/g) || []).length
  const cr = (text.match(/\r(?!\n)/g) || []).length
  const lf = (text.match(/(?<!\r)\n/g) || []).length
  if (crlf >= lf && crlf >= cr && crlf > 0) return 'CRLF'
  if (cr > lf && cr > crlf) return 'CR'
  return 'LF'
}

export function applyLineEnding(text: string, ending: LineEnding): string {
  const norm = text.replace(/\r\n|\r|\n/g, '\n')
  if (ending === 'CRLF') return norm.replace(/\n/g, '\r\n')
  if (ending === 'CR') return norm.replace(/\n/g, '\r')
  return norm
}

function decodeBytes(buffer: ArrayBuffer, encoding: string): string {
  return new TextDecoder(encoding).decode(buffer)
}

function encodeForSave(text: string, encoding: string): Uint8Array {
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    const bom = encoding === 'utf-16le' ? [0xff, 0xfe] : [0xfe, 0xff]
    const out = new Uint8Array(2 + text.length * 2)
    out[0] = bom[0]!
    out[1] = bom[1]!
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (encoding === 'utf-16le') {
        out[2 + i * 2] = c & 0xff
        out[3 + i * 2] = c >> 8
      } else {
        out[2 + i * 2] = c >> 8
        out[3 + i * 2] = c & 0xff
      }
    }
    return out
  }
  return new TextEncoder().encode(text)
}

const ini = StreamLanguage.define(properties)

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

export function kindFromName(fileName: string): NoteKind {
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

export async function pickOpenFiles(): Promise<FileSystemFileHandle[] | File[]> {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      return await window.showOpenFilePicker({
        multiple: true,
        excludeAcceptAllOption: false,
        types: FILE_PICKER_TYPES,
      })
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return []
      throw err
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

export async function pickSaveFile(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      return await window.showSaveFilePicker({ suggestedName, types: FILE_PICKER_TYPES })
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return null
      throw err
    }
  }
  return null
}

export async function readFileStreaming(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  encodingOverride?: string,
): Promise<{ text: string; encoding: string; lineEnding: LineEnding; binary: boolean; size: number }> {
  const head = new Uint8Array(await file.slice(0, 65_536).arrayBuffer())
  const encoding = encodingOverride ?? detectEncoding(head)
  const binary = isLikelyBinary(head, encoding)

  if (file.size < STREAM_SIZE) {
    const buffer = await file.arrayBuffer()
    onProgress?.(file.size, file.size)
    const text = decodeBytes(buffer, encoding)
    return { text, encoding, lineEnding: detectLineEnding(text), binary, size: file.size }
  }

  const decoder = new TextDecoder(encoding)
  const reader = file.stream().getReader()
  const chunks: string[] = []
  let loaded = 0
  let lastYield = performance.now()

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      loaded += value.byteLength
      chunks.push(decoder.decode(value, { stream: !done }))
      onProgress?.(loaded, file.size)
    }
    if (done) {
      chunks.push(decoder.decode())
      break
    }
    if (performance.now() - lastYield > 32) {
      await new Promise((r) => setTimeout(r, 0))
      lastYield = performance.now()
    }
  }

  const text = chunks.join('')
  return { text, encoding, lineEnding: detectLineEnding(text), binary, size: file.size }
}

export async function writeHandle(handle: FileSystemFileHandle, text: string, encoding: string): Promise<void> {
  const bytes = encodeForSave(text, encoding)
  const writable = await handle.createWritable()
  await writable.write(new Blob([bytes.buffer as ArrayBuffer]))
  await writable.close()
}

export function downloadText(name: string, text: string, encoding: string): void {
  const bytes = encodeForSave(text, encoding)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true
  const q = await handle.queryPermission({ mode })
  if (q === 'granted') return true
  return (await handle.requestPermission({ mode })) === 'granted'
}

export function isFileHandle(x: FileSystemFileHandle | File): x is FileSystemFileHandle {
  return 'getFile' in x
}

const DB_NAME = 'notes-app'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('contents')) db.createObjectStore('contents')
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    if (key !== undefined) tx.objectStore(store).put(value, key)
    else tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDel(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return idbGet<T>('kv', key)
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  return idbSet('kv', value, key)
}

const ITERATIONS = 120_000

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derive(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function hashPin(pin: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    raw,
    256,
  )
  return { hash: b64(bits), salt: b64(salt) }
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const next = await hashPin(pin, salt)
  return next.hash === hash
}

export async function encryptText(pin: string, text: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(pin, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text))
  return `v1.${b64(salt)}.${b64(iv)}.${b64(cipher)}`
}

export async function decryptText(pin: string, packed: string): Promise<string> {
  const parts = packed.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Format verrou invalide')
  const salt = fromB64(parts[1]!)
  const iv = fromB64(parts[2]!)
  const data = fromB64(parts[3]!)
  const key = await derive(pin, salt)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer,
  )
  return new TextDecoder().decode(plain)
}

marked.setOptions({ gfm: true, breaks: true })

export function renderMarkdown(src: string): string {
  return marked.parse(src, { async: false }) as string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function previewMarkdownHybrid(text: string, maxLines = 7): string {
  const lines = text.split(/\r?\n/).slice(0, maxLines)
  return lines
    .map((line) => {
      let html = escapeHtml(line)
      html = html.replace(/^(#{1,6})(\s+)(.*)$/, '<span class="md-h">$1$2$3</span>')
      html = html.replace(/`([^`]+)`/g, '<code>`$1`</code>')
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>**$1**</strong>')
      html = html.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<strong>*$2*</strong>')
      html = html.replace(/_([^_]+)_/g, '<em>_$1_</em>')
      html = html.replace(/~([^~]+)~/g, '<s>~$1</s>')
      return html || '<br>'
    })
    .join('\n')
}

export function parseList(text: string, type: ListType = 'checklist'): { id: string; text: string; done: boolean }[] {
  const lines = text.split(/\r?\n/)
  const items: { id: string; text: string; done: boolean }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const check = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
    if (type === 'checklist' && check) items.push({ id: `c${i}`, text: check[2]!, done: check[1] !== ' ' })
    else if (type === 'bulleted' && bullet && !check) items.push({ id: `c${i}`, text: bullet[1]!, done: false })
    else if (type === 'numbered' && numbered) items.push({ id: `c${i}`, text: numbered[1]!, done: false })
    else if (line.trim()) items.push({ id: `c${i}`, text: line.trim(), done: false })
  }
  return items
}

export function serializeList(items: { text: string; done: boolean }[], type: ListType = 'checklist'): string {
  return items
    .map((it, i) => {
      if (type === 'numbered') return `${i + 1}. ${it.text}`
      if (type === 'bulleted') return `- ${it.text}`
      return `- [${it.done ? 'x' : ' '}] ${it.text}`
    })
    .join('\n')
}

export function isNative(): boolean {
  return Boolean(window.notesNative?.isNative) || Boolean(window.__TAURI_INTERNALS__)
}

export async function bootNative(): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return
  const { invoke } = await import('@tauri-apps/api/core')
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const { listen } = await import('@tauri-apps/api/event')
  const win = getCurrentWindow()
  window.notesNative = {
    isNative: true,
    openFiles: () => invoke<NativeFile[]>('open_files'),
    writeFile: (filePath, text, encoding) =>
      invoke<{ path: string; name: string }>('write_file', { filePath, text, encoding }),
    saveFileAs: (name, text, encoding) =>
      invoke<{ path: string; name: string } | null>('save_file_as', { name, text, encoding }),
    minimize: () => {
      void win.minimize()
    },
    maximize: () => {
      void win.toggleMaximize()
    },
    close: () => {
      void win.close()
    },
    onMenu: (handler) => {
      let unlisten: (() => void) | undefined
      void listen<string>('menu', (event) => handler(event.payload)).then((fn) => {
        unlisten = fn
      })
      return () => unlisten?.()
    },
  }
}
