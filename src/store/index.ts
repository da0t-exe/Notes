import { useSyncExternalStore } from 'react'
import type { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'

import { applyLineEnding } from '../lib/encoding'
import {
  downloadText,
  ensurePermission,
  isFileHandle,
  MAX_OPEN,
  PERSIST_MAX,
  pickOpenFiles,
  pickSaveFile,
  readFileStreaming,
  WARN_SIZE,
  writeHandle,
} from '../lib/files'
import { formatBytes, titleFromContent, uid } from '../lib/format'
import { idbDel, idbGet, idbGetAll, idbSet, kvGet, kvSet } from '../lib/idb'
import { kindFromName, languageLabel } from '../lib/languages'
import { bootNative, isNative } from '../lib/native'
import type { LoadProgress, NativeFile, Note, NoteKind, Settings, Toast } from '../lib/types'

export { bootNative, isNative }

type ConfirmDialog = { title: string; text: string }

type State = {
  ready: boolean
  notes: Note[]
  contents: Record<string, string>
  originals: Record<string, string>
  openTabs: string[]
  activeId: string | null
  sidebar: boolean
  preview: boolean
  settings: Settings
  toasts: Toast[]
  progress: LoadProgress | null
  confirm: ConfirmDialog | null
}

const defaultSettings: Settings = { theme: 'dark', wrap: true, fontSize: 15 }

let state: State = {
  ready: false,
  notes: [],
  contents: {},
  originals: {},
  openTabs: [],
  activeId: null,
  sidebar: true,
  preview: false,
  settings: defaultSettings,
  toasts: [],
  progress: null,
  confirm: null,
}

const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getState(): State {
  return state
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => sel(state),
    () => sel(state),
  )
}

/* ------------------------------------------------------------------ views */

// CodeMirror owns the live document. Keeping the views out of reactive state
// is what lets typing avoid a store update per keystroke.
const views = new Map<string, EditorView>()
const handles = new Map<string, FileSystemFileHandle>()

export function registerView(id: string, view: EditorView) {
  views.set(id, view)
}

export function unregisterView(id: string) {
  const view = views.get(id)
  if (!view) return
  syncContent(id, view.state.doc.toString())
  views.delete(id)
}

export function getContent(id: string): string {
  const view = views.get(id)
  return view ? view.state.doc.toString() : (state.contents[id] ?? '')
}

export function findInActive() {
  const view = state.activeId ? views.get(state.activeId) : undefined
  if (view) openSearchPanel(view)
}

/* ------------------------------------------------------------- cursor -- */

let cursor = { line: 1, col: 1 }
const cursorListeners = new Set<() => void>()

export function setCursor(line: number, col: number) {
  if (cursor.line === line && cursor.col === col) return
  cursor = { line, col }
  cursorListeners.forEach((f) => f())
}

export function useCursor() {
  return useSyncExternalStore(
    (fn) => {
      cursorListeners.add(fn)
      return () => cursorListeners.delete(fn)
    },
    () => cursor,
    () => cursor,
  )
}

/* -------------------------------------------------------------- toasts -- */

let toastSeq = 1

export function notify(text: string, tone: Toast['tone'] = 'info') {
  const item: Toast = { id: toastSeq++, text, tone }
  set({ toasts: [...state.toasts, item] })
  window.setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== item.id) }), 4200)
}

let confirmResolve: ((ok: boolean) => void) | null = null

export function ask(title: string, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolve = resolve
    set({ confirm: { title, text } })
  })
}

export function answerConfirm(ok: boolean) {
  confirmResolve?.(ok)
  confirmResolve = null
  set({ confirm: null })
}

/* --------------------------------------------------------- persistence -- */

// v0.3 rewrote every note on every tick, so a single keystroke in an 8 MB log
// meant rewriting 8 MB. Only ids that actually changed are flushed.
const pending = new Set<string>()
let persistTimer = 0

function schedulePersist(id?: string) {
  if (id) pending.add(id)
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => void persist(), 500)
}

async function persist() {
  const ids = [...pending]
  pending.clear()

  await kvSet('settings', state.settings)
  await kvSet('session', {
    openTabs: state.openTabs,
    activeId: state.activeId,
    sidebar: state.sidebar,
  })

  for (const id of ids) {
    const note = state.notes.find((n) => n.id === id)
    if (!note) {
      await idbDel('notes', id)
      await idbDel('contents', id)
      await idbDel('handles', id)
      continue
    }
    const text = getContent(id)
    await idbSet('notes', { ...note, dirty: false, dirtyUi: note.dirty })
    if (text.length <= PERSIST_MAX) await idbSet('contents', text, id)
    const handle = handles.get(id)
    if (handle) await idbSet('handles', handle, id)
  }
}

/* -------------------------------------------------------------- content -- */

let syncTimer = 0

/**
 * Mirrors the live CodeMirror document back into the store. Debounced, because
 * the only consumers are the card preview and the byte counter — neither needs
 * to be correct mid-keystroke, and both cost a full document walk.
 */
function syncContent(id: string, text: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  set({
    contents: { ...state.contents, [id]: text },
    notes: state.notes.map((n) =>
      n.id === id
        ? {
            ...n,
            size: new Blob([text]).size,
            title: n.fromDisk || n.title.trim() ? n.title : titleFromContent(text, n.title),
          }
        : n,
    ),
  })
}

/** Called on every document change. Deliberately cheap. */
export function markDirty(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  if (!note.dirty) {
    set({ notes: state.notes.map((n) => (n.id === id ? { ...n, dirty: true, updatedAt: Date.now() } : n)) })
  }
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    const view = views.get(id)
    if (view) syncContent(id, view.state.doc.toString())
    schedulePersist(id)
  }, 400)
}

export function setNoteContent(id: string, text: string) {
  syncContent(id, text)
  set({ notes: state.notes.map((n) => (n.id === id ? { ...n, dirty: true, updatedAt: Date.now() } : n)) })
  schedulePersist(id)
}

/* ----------------------------------------------------------------- boot -- */

let initPromise: Promise<void> | null = null

export function init(): Promise<void> {
  initPromise ??= boot()
  return initPromise
}

async function boot() {
  const savedSettings = await kvGet<Partial<Settings>>('settings')
  const session = await kvGet<{ openTabs: string[]; activeId: string | null; sidebar: boolean }>('session')
  const stored = await idbGetAll<Note & { dirtyUi?: boolean }>('notes')

  const notes: Note[] = stored.map(({ dirtyUi, ...n }) => ({ ...n, dirty: Boolean(dirtyUi) }))
  const contents: Record<string, string> = {}
  const originals: Record<string, string> = {}

  for (const note of notes) {
    const text = (await idbGet<string>('contents', note.id)) ?? ''
    contents[note.id] = text
    originals[note.id] = text
    const handle = await idbGet<FileSystemFileHandle>('handles', note.id)
    if (handle) handles.set(note.id, handle)
  }

  const settings = { ...defaultSettings, ...savedSettings }
  applyTheme(settings.theme)

  const openTabs = session?.openTabs?.filter((id) => notes.some((n) => n.id === id)) ?? []
  const activeId = session?.activeId && notes.some((n) => n.id === session.activeId) ? session.activeId : null

  set({
    ready: true,
    notes,
    contents,
    originals,
    settings,
    openTabs,
    activeId,
    sidebar: session?.sidebar ?? true,
  })
}

/* ------------------------------------------------------------- settings -- */

function resolvedTheme(theme: Settings['theme']): 'dark' | 'light' {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return theme
}

export function applyTheme(theme: Settings['theme']) {
  document.documentElement.dataset['theme'] = resolvedTheme(theme)
}

export function setTheme(theme: Settings['theme']) {
  applyTheme(theme)
  set({ settings: { ...state.settings, theme } })
  schedulePersist()
}

export function setWrap(wrap: boolean) {
  set({ settings: { ...state.settings, wrap } })
  schedulePersist()
}

export function setFontSize(fontSize: number) {
  set({ settings: { ...state.settings, fontSize } })
  schedulePersist()
}

export function toggleSidebar() {
  set({ sidebar: !state.sidebar })
  schedulePersist()
}

export function togglePreview() {
  set({ preview: !state.preview })
}

/* ----------------------------------------------------------------- tabs -- */

function openTab(id: string) {
  set({
    openTabs: state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id],
    activeId: id,
  })
  schedulePersist()
}

export function activateTab(id: string) {
  if (state.notes.some((n) => n.id === id)) openTab(id)
}

/** Returns false when the user cancelled at the unsaved-changes prompt. */
export async function closeTab(id: string): Promise<boolean> {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return true

  if (note.dirty) {
    const ok = await ask('Unsaved changes', `“${note.title || 'Untitled'}” has unsaved edits. Close it anyway?`)
    if (!ok) return false
  }

  unregisterView(id)
  const openTabs = state.openTabs.filter((t) => t !== id)
  set({
    openTabs,
    activeId: state.activeId === id ? (openTabs[openTabs.length - 1] ?? null) : state.activeId,
  })
  schedulePersist()
  return true
}

export function unsavedCount(): number {
  return state.notes.filter((n) => n.dirty).length
}

/** Resolves true when the window may close. */
export async function confirmQuit(): Promise<boolean> {
  const n = unsavedCount()
  if (n === 0) return true
  return ask('Unsaved changes', `${n} note${n > 1 ? 's have' : ' has'} unsaved edits. Quit anyway?`)
}

/* ---------------------------------------------------------------- notes -- */

export function newNote(kind: NoteKind = 'markdown') {
  const id = uid()
  const now = Date.now()
  const note: Note = {
    id,
    title: '',
    kind,
    createdAt: now,
    updatedAt: now,
    fromDisk: false,
    dirty: true,
    size: 0,
    categoryIds: [],
    pinned: false,
    locked: false,
    encoding: 'utf-8',
    lineEnding: 'LF',
    fileName: kind === 'markdown' ? 'untitled.md' : 'untitled.txt',
    filePath: null,
    language: languageLabel(kind === 'markdown' ? 'n.md' : null, kind),
  }
  set({
    notes: [note, ...state.notes],
    contents: { ...state.contents, [id]: '' },
    originals: { ...state.originals, [id]: '' },
  })
  openTab(id)
  schedulePersist(id)
}

function adopt(note: Note, text: string) {
  set({
    notes: [note, ...state.notes],
    contents: { ...state.contents, [note.id]: text },
    originals: { ...state.originals, [note.id]: text },
  })
  openTab(note.id)
  schedulePersist(note.id)
}

export async function openFromDisk(incoming?: Array<FileSystemFileHandle | File>) {
  try {
    if (!incoming?.length && isNative() && window.notesNative) {
      for (const file of await window.notesNative.openFiles()) await ingestNative(file)
      return
    }
    const picked = incoming ?? (await pickOpenFiles())
    for (const item of picked) {
      const file = isFileHandle(item) ? await item.getFile() : item
      await ingestBrowserFile(file, isFileHandle(item) ? item : undefined)
    }
  } catch (err) {
    set({ progress: null })
    notify(err instanceof Error ? err.message : 'Could not open the file', 'error')
  }
}

function diskNote(id: string, name: string, path: string | null, size: number, created: number, encoding: string, lineEnding: Note['lineEnding']): Note {
  return {
    id,
    title: name,
    kind: kindFromName(name),
    createdAt: created || Date.now(),
    updatedAt: Date.now(),
    fromDisk: true,
    dirty: false,
    size,
    categoryIds: [],
    pinned: false,
    locked: false,
    encoding,
    lineEnding,
    fileName: name,
    filePath: path,
    language: languageLabel(name, kindFromName(name)),
  }
}

async function ingestNative(file: NativeFile) {
  if (file.binary && !(await ask('Binary file?', `${file.name} does not look like text. Open it anyway?`))) return
  const id = uid()
  adopt(diskNote(id, file.name, file.path, file.size, file.lastModified, file.encoding, file.lineEnding), file.text)
  notify(`${file.name} · ${formatBytes(file.size)} · ${file.encoding}`)
}

async function ingestBrowserFile(file: File, handle?: FileSystemFileHandle) {
  if (file.size > MAX_OPEN) {
    notify(`${file.name} exceeds ${formatBytes(MAX_OPEN)}`, 'error')
    return
  }
  if (file.size > WARN_SIZE) {
    const ok = await ask('Large file', `${file.name} is ${formatBytes(file.size)}. Editing may be slower. Continue?`)
    if (!ok) return
  }

  set({ progress: { name: file.name, loaded: 0, total: file.size } })
  const result = await readFileStreaming(file, (loaded, total) =>
    set({ progress: { name: file.name, loaded, total } }),
  )
  set({ progress: null })

  if (result.binary && !(await ask('Binary file?', `${file.name} does not look like text. Open it anyway?`))) return

  const id = uid()
  if (handle) handles.set(id, handle)
  adopt(
    diskNote(id, file.name, null, result.size, file.lastModified, result.encoding, result.lineEnding),
    result.text,
  )
  notify(`${file.name} · ${formatBytes(result.size)} · ${result.encoding}`)
}

/* ---------------------------------------------------------------- saving -- */

function markSaved(id: string, text: string, patch: Partial<Note> = {}) {
  set({
    notes: state.notes.map((n) =>
      n.id === id ? { ...n, ...patch, dirty: false, updatedAt: Date.now(), size: new Blob([text]).size } : n,
    ),
    contents: { ...state.contents, [id]: text },
    originals: { ...state.originals, [id]: text },
  })
  schedulePersist(id)
}

export async function saveActive() {
  const id = state.activeId
  const note = id ? state.notes.find((n) => n.id === id) : null
  if (!id || !note) return

  const text = applyLineEnding(getContent(id), note.lineEnding)
  const handle = handles.get(id)

  try {
    if (note.filePath && window.notesNative) {
      await window.notesNative.writeFile(note.filePath, text, note.encoding)
    } else if (handle) {
      if (!(await ensurePermission(handle))) {
        notify('File permission denied', 'error')
        return
      }
      await writeHandle(handle, text, note.encoding)
    } else if (note.fromDisk || isNative()) {
      await saveActiveAs()
      return
    }
    markSaved(id, text)
    notify('Saved')
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Save failed', 'error')
  }
}

export async function saveActiveAs() {
  const id = state.activeId
  const note = id ? state.notes.find((n) => n.id === id) : null
  if (!id || !note) return

  const text = applyLineEnding(getContent(id), note.lineEnding)
  const name = note.fileName ?? `${note.title || 'note'}.txt`

  try {
    if (window.notesNative) {
      const saved = await window.notesNative.saveFileAs(name, text, note.encoding)
      if (!saved) return
      markSaved(id, text, {
        fromDisk: true,
        fileName: saved.name,
        filePath: saved.path,
        title: saved.name,
        language: languageLabel(saved.name, note.kind),
      })
      notify(`Saved as ${saved.name}`)
      return
    }

    const handle = await pickSaveFile(name)
    if (handle) {
      await writeHandle(handle, text, note.encoding)
      handles.set(id, handle)
      markSaved(id, text, {
        fromDisk: true,
        fileName: handle.name,
        title: handle.name,
        language: languageLabel(handle.name, note.kind),
      })
      notify(`Saved as ${handle.name}`)
    } else {
      downloadText(name, text, note.encoding)
      notify('Download started')
    }
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Save failed', 'error')
  }
}
