export type Theme = 'dark' | 'light' | 'system'
export type NoteKind = 'text' | 'markdown' | 'checklist'
export type ListType = 'checklist' | 'bulleted' | 'numbered'
export type LineEnding = 'LF' | 'CRLF' | 'CR'
export type Screen = 'library' | 'trash' | 'settings'

/**
 * A note is either stored in IndexedDB (`fromDisk: false`) or is a view onto a
 * file on disk (`fromDisk: true`). The two halves of this type are disjoint by
 * design — see the files-vs-notes table in CLAUDE.md. Fields in the disk group
 * are meaningless for stored notes and vice versa.
 */
export type Note = {
  id: string
  title: string
  kind: NoteKind
  createdAt: number
  updatedAt: number
  fromDisk: boolean
  dirty: boolean
  size: number

  /* stored notes only */
  pinned: boolean
  listType?: ListType
  images?: string[]

  /* disk files only */
  encoding: string
  lineEnding: LineEnding
  fileName: string | null
  filePath?: string | null
  language: string
}

export type Settings = {
  theme: Theme
  wrap: boolean
  fontSize: number
}

export type Toast = { id: number; text: string; tone: 'info' | 'warn' | 'error' }
export type LoadProgress = { name: string; loaded: number; total: number }

export type ListItem = { id: string; text: string; done: boolean }

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
