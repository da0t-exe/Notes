export type Theme = 'dark' | 'light'
export type NoteKind = 'text' | 'markdown' | 'checklist'
export type LineEnding = 'LF' | 'CRLF' | 'CR'
export type Screen = 'library' | 'editor' | 'categories' | 'settings'

export type Category = {
  id: string
  name: string
}

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
}

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
}

export type Settings = {
  theme: Theme
  wrap: boolean
  fontSize: number
  pinHash: string | null
  pinSalt: string | null
  appLock: boolean
}

export type Toast = {
  id: number
  text: string
  tone: 'info' | 'warn' | 'error'
}

export type LoadProgress = {
  name: string
  loaded: number
  total: number
}
