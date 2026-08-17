import { useSyncExternalStore } from 'react'
import type { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'
import {
  applyLineEnding,
  decryptText,
  downloadText,
  encryptText,
  ensurePermission,
  formatBytes,
  hashPin,
  idbDel,
  idbGet,
  idbGetAll,
  idbSet,
  isFileHandle,
  isNative,
  kindFromName,
  kvGet,
  kvSet,
  languageLabel,
  MAX_OPEN,
  parseList,
  PERSIST_MAX,
  pickOpenFiles,
  pickSaveFile,
  readFileStreaming,
  serializeList,
  titleFromContent,
  uid,
  verifyPin,
  WARN_SIZE,
  writeHandle,
  type Category,
  type ListType,
  type LoadProgress,
  type NativeFile,
  type Note,
  type NoteKind,
  type Screen,
  type Settings,
  type Toast,
} from './lib'

export type { ListType, Note, NoteKind, Screen, Settings }

export type ConfirmDialog = { title: string; text: string }
export type TextPrompt = { title: string; label: string; secret?: boolean }

type State = {
  ready: boolean
  notes: Note[]
  categories: Category[]
  contents: Record<string, string>
  originals: Record<string, string>
  openTabs: string[]
  activeId: string | null
  screen: Screen
  sidebar: boolean
  filter: string
  preview: boolean
  diff: boolean
  settings: Settings
  toasts: Toast[]
  progress: LoadProgress | null
  appLocked: boolean
  unlockNoteId: string | null
  confirm: ConfirmDialog | null
  textPrompt: TextPrompt | null
  trash: Note[]
  trashContents: Record<string, string>
}

const defaultSettings: Settings = {
  theme: 'dark',
  language: 'en',
  wrap: true,
  fontSize: 15,
  pinHash: null,
  pinSalt: null,
  appLock: false,
}

function resolvedTheme(theme: Settings['theme']): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(theme: Settings['theme']) {
  document.documentElement.dataset.theme = resolvedTheme(theme)
}

const handles = new Map<string, FileSystemFileHandle>()
const views = new Map<string, EditorView>()

let confirmResolve: ((ok: boolean) => void) | null = null
let textResolve: ((value: string | null) => void) | null = null
let toastSeq = 1
let persistTimer = 0

const seedCats: Category[] = [
  { id: 'cat-shopping', name: 'Shopping' },
  { id: 'cat-work', name: 'Work' },
  { id: 'cat-personal', name: 'Personal' },
]

const seedMd = `# Organize your ideas

A _simple_ and \`powerful\` editor.

- Live Markdown
- Notepads-style tabs
- Large files (logs, JSON, code)

Open a file with **Ctrl+O**.`

const seedList = `- [ ] 🍎
- [ ] 🍞
- [x] 🍪
- [ ] 🍇
- [ ] 🍌`

function seedNotes(): { notes: Note[]; contents: Record<string, string> } {
  const now = Date.now()
  const md: Note = {
    id: uid(),
    title: 'Markdown',
    kind: 'markdown',
    categoryIds: ['cat-work'],
    createdAt: now - 86_400_000,
    updatedAt: now - 3_600_000,
    pinned: false,
    locked: false,
    encoding: 'utf-8',
    lineEnding: 'LF',
    fileName: 'markdown.md',
    filePath: null,
    fromDisk: false,
    language: 'Markdown',
    dirty: false,
    size: seedMd.length,
    images: [],
  }
  const shop: Note = {
    id: uid(),
    title: 'Shopping',
    kind: 'checklist',
    categoryIds: ['cat-shopping'],
    createdAt: now - 172_800_000,
    updatedAt: now - 7_200_000,
    pinned: true,
    locked: false,
    encoding: 'utf-8',
    lineEnding: 'LF',
    fileName: null,
    filePath: null,
    fromDisk: false,
    language: 'List',
    dirty: false,
    size: seedList.length,
    listType: 'checklist',
    images: [],
  }
  return {
    notes: [md, shop],
    contents: { [md.id]: seedMd, [shop.id]: seedList },
  }
}

let state: State = {
  ready: false,
  notes: [],
  categories: seedCats,
  contents: {},
  originals: {},
  openTabs: [],
  activeId: null,
  screen: 'library',
  sidebar: true,
  filter: 'all',
  preview: false,
  diff: false,
  settings: defaultSettings,
  toasts: [],
  progress: null,
  appLocked: false,
  unlockNoteId: null,
  confirm: null,
  textPrompt: null,
  trash: [],
  trashContents: {},
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function set(patch: Partial<State> | ((s: State) => State)) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }
  emit()
}

export function getState(): State {
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state))
}

let cursor = { line: 1, col: 1 }
const cursorFns = new Set<() => void>()

export function setCursor(line: number, col: number) {
  if (cursor.line === line && cursor.col === col) return
  cursor = { line, col }
  cursorFns.forEach((f) => f())
}

export function useCursor() {
  return useSyncExternalStore(
    (fn) => {
      cursorFns.add(fn)
      return () => cursorFns.delete(fn)
    },
    () => cursor,
    () => cursor,
  )
}

export function registerView(id: string, view: EditorView) {
  views.set(id, view)
}

export function unregisterView(id: string) {
  const view = views.get(id)
  if (view) {
    state.contents[id] = view.state.doc.toString()
    views.delete(id)
  }
}

export function getContent(id: string): string {
  const view = views.get(id)
  if (view) return view.state.doc.toString()
  return state.contents[id] ?? ''
}

export function notify(text: string, tone: Toast['tone'] = 'info') {
  toast(text, tone)
}

function toast(text: string, tone: Toast['tone'] = 'info') {
  const item: Toast = { id: toastSeq++, text, tone }
  set({ toasts: [...state.toasts, item] })
  window.setTimeout(() => {
    set({ toasts: state.toasts.filter((t) => t.id !== item.id) })
  }, 4200)
}

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

export function askText(title: string, label: string, secret = false): Promise<string | null> {
  return new Promise((resolve) => {
    textResolve = resolve
    set({ textPrompt: { title, label, secret } })
  })
}

export function answerText(value: string | null) {
  textResolve?.(value)
  textResolve = null
  set({ textPrompt: null })
}

export async function promptPin(title = 'PIN code'): Promise<string | null> {
  return askText(title, 'Enter your code', true)
}

function patchNote(id: string, patch: Partial<Note>) {
  set({
    notes: state.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  })
}

function schedulePersist() {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    void persist()
  }, 400)
}

async function persist() {
  const { notes, categories, settings, openTabs, activeId, filter, sidebar, contents, trash, trashContents } = state
  await kvSet('categories', categories)
  await kvSet('settings', settings)
  await kvSet('session', { openTabs, activeId, filter, sidebar })
  await kvSet('trash', { notes: trash, contents: trashContents })
  for (const note of notes) {
    const text = getContent(note.id)
    const size = new Blob([text]).size
    await idbSet('notes', { ...note, dirty: false, size, dirtyUi: note.dirty })
    if (size <= PERSIST_MAX && !note.locked) {
      await idbSet('contents', text, note.id)
    }
    const handle = handles.get(note.id)
    if (handle) await idbSet('handles', handle, note.id)
  }
  for (const id of Object.keys(contents)) {
    if (!notes.some((n) => n.id === id)) {
      await idbDel('contents', id)
      await idbDel('handles', id)
    }
  }
}

let initPromise: Promise<void> | null = null

export function init() {
  if (!initPromise) initPromise = boot()
  return initPromise
}

async function boot() {
  const savedSettings = await kvGet<Settings>('settings')
  const savedCats = await kvGet<Category[]>('categories')
  const session = await kvGet<{ openTabs: string[]; activeId: string | null; filter: string; sidebar: boolean }>(
    'session',
  )
  const storedNotes = await idbGetAll<Note & { dirtyUi?: boolean }>('notes')
  let notes = storedNotes.map(({ dirtyUi, ...n }) => ({ ...n, dirty: Boolean(dirtyUi) }))
  const contents: Record<string, string> = {}
  const originals: Record<string, string> = {}

  if (notes.length === 0) {
    const seed = seedNotes()
    notes = seed.notes
    Object.assign(contents, seed.contents)
    Object.assign(originals, seed.contents)
  } else {
    for (const note of notes) {
      const text = (await idbGet<string>('contents', note.id)) ?? ''
      contents[note.id] = text
      originals[note.id] = text
      const handle = await idbGet<FileSystemFileHandle>('handles', note.id)
      if (handle) handles.set(note.id, handle)
    }
  }

  const savedTrash = await kvGet<{ notes: Note[]; contents: Record<string, string> }>('trash')
  const settings = { ...defaultSettings, ...savedSettings }
  applyTheme(settings.theme)

  set({
    ready: true,
    notes,
    categories: savedCats?.length ? savedCats : seedCats,
    contents,
    originals,
    trash: savedTrash?.notes ?? [],
    trashContents: savedTrash?.contents ?? {},
    settings,
    openTabs: session?.openTabs?.filter((id) => notes.some((n) => n.id === id)) ?? [],
    activeId: session?.activeId && notes.some((n) => n.id === session.activeId) ? session.activeId : null,
    filter: session?.filter ?? 'all',
    sidebar: session?.sidebar ?? true,
    screen: session?.activeId ? 'editor' : 'library',
    appLocked: Boolean(settings.appLock && settings.pinHash),
  })
  schedulePersist()
}

export function setTheme(theme: Settings['theme']) {
  applyTheme(theme)
  set({ settings: { ...state.settings, theme } })
  schedulePersist()
}

export function setLanguage(language: string) {
  set({ settings: { ...state.settings, language } })
  schedulePersist()
}

export function setScreen(screen: Screen) {
  set({ screen })
}

export function toggleSidebar() {
  set({ sidebar: !state.sidebar })
  schedulePersist()
}

export function setFilter(filter: string) {
  set({ filter })
  schedulePersist()
}

export function togglePreview() {
  set({ preview: !state.preview, diff: false })
}

export function toggleDiff() {
  set({ diff: !state.diff, preview: false })
}

export function setWrap(wrap: boolean) {
  set({ settings: { ...state.settings, wrap } })
  schedulePersist()
}

export function setFontSize(fontSize: number) {
  set({ settings: { ...state.settings, fontSize } })
  schedulePersist()
}

export function markDirty(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  if (!note.dirty) patchNote(id, { dirty: true, updatedAt: Date.now() })
  schedulePersist()
}

export function setNoteContent(id: string, text: string) {
  state.contents[id] = text
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  patchNote(id, {
    dirty: true,
    updatedAt: Date.now(),
    size: new Blob([text]).size,
    title: note.fromDisk || note.title.trim() ? note.title : titleFromContent(text, note.title),
  })
  schedulePersist()
}

function openTab(id: string) {
  const openTabs = state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id]
  set({ openTabs, activeId: id, screen: 'editor', unlockNoteId: null })
  schedulePersist()
}

export function activateTab(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  if (note.locked) {
    set({ unlockNoteId: id, screen: 'editor' })
    return
  }
  openTab(id)
}

export function closeTab(id: string) {
  unregisterView(id)
  const openTabs = state.openTabs.filter((t) => t !== id)
  const activeId = state.activeId === id ? (openTabs[openTabs.length - 1] ?? null) : state.activeId
  set({ openTabs, activeId, screen: activeId ? 'editor' : 'library' })
  schedulePersist()
}

export function newNote(kind: NoteKind = 'markdown') {
  const id = uid()
  const now = Date.now()
  const titles: Record<NoteKind, string> = {
    markdown: '',
    text: '',
    checklist: '',
  }
  const starter = kind === 'checklist' ? '- [ ] ' : ''
  const note: Note = {
    id,
    title: titles[kind],
    kind,
    categoryIds: state.filter !== 'all' ? [state.filter] : [],
    createdAt: now,
    updatedAt: now,
    pinned: false,
    locked: false,
    encoding: 'utf-8',
    lineEnding: 'LF',
    fileName: kind === 'markdown' ? 'untitled.md' : kind === 'checklist' ? null : 'untitled.txt',
    filePath: null,
    fromDisk: false,
    language: languageLabel(kind === 'markdown' ? 'n.md' : null, kind),
    dirty: true,
    size: starter.length,
    images: [],
    listType: kind === 'checklist' ? 'checklist' : undefined,
  }
  set({
    notes: [note, ...state.notes],
    contents: { ...state.contents, [id]: starter },
    originals: { ...state.originals, [id]: starter },
  })
  openTab(id)
}

export function findInActive() {
  const id = state.activeId
  if (!id) return
  const view = views.get(id)
  if (view) openSearchPanel(view)
}

export function cancelUnlock() {
  set({ unlockNoteId: null, screen: state.openTabs.length ? 'editor' : 'library' })
}

export async function openFromDisk(incoming?: Array<FileSystemFileHandle | File>) {
  if (!incoming?.length && isNative() && window.notesNative) {
    const files = await window.notesNative.openFiles()
    for (const file of files) await ingestNative(file)
    schedulePersist()
    return
  }

  const picked = incoming ?? (await pickOpenFiles())
  if (!picked.length) return

  for (const item of picked) {
    try {
      const file = isFileHandle(item) ? await item.getFile() : item
      await ingestBrowserFile(file, isFileHandle(item) ? item : undefined)
    } catch (err) {
      set({ progress: null })
      toast(err instanceof Error ? err.message : 'Could not open the file', 'error')
    }
  }
  schedulePersist()
}

async function ingestNative(file: NativeFile) {
  if (file.size > MAX_OPEN) {
    toast(`${file.name} exceeds ${formatBytes(MAX_OPEN)}`, 'error')
    return
  }
  if (file.size > WARN_SIZE) {
    const ok = await ask(
      'Large file',
      `${file.name} is ${formatBytes(file.size)}. Editing may be slower. Continue?`,
    )
    if (!ok) return
  }
  if (file.binary) {
    const ok = await ask('Binary file?', `${file.name} does not look like text. Open it anyway?`)
    if (!ok) return
  }
  const id = uid()
  const note: Note = {
    id,
    title: file.name,
    kind: kindFromName(file.name),
    categoryIds: [],
    createdAt: file.lastModified || Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    locked: false,
    encoding: file.encoding,
    lineEnding: file.lineEnding,
    fileName: file.name,
    filePath: file.path,
    fromDisk: true,
    language: languageLabel(file.name, kindFromName(file.name)),
    dirty: false,
    size: file.size,
  }
  set({
    notes: [note, ...state.notes.filter((n) => n.filePath !== file.path)],
    contents: { ...state.contents, [id]: file.text },
    originals: { ...state.originals, [id]: file.text },
  })
  openTab(id)
  toast(`${file.name} · ${formatBytes(file.size)} · ${file.encoding}`)
}

async function ingestBrowserFile(file: File, handle?: FileSystemFileHandle) {
  if (file.size > MAX_OPEN) {
    toast(`${file.name} exceeds ${formatBytes(MAX_OPEN)}`, 'error')
    return
  }
  if (file.size > WARN_SIZE) {
    const ok = await ask(
      'Large file',
      `${file.name} is ${formatBytes(file.size)}. Editing may be slower. Continue?`,
    )
    if (!ok) return
  }

  set({ progress: { name: file.name, loaded: 0, total: file.size } })
  const result = await readFileStreaming(file, (loaded, total) => {
    set({ progress: { name: file.name, loaded, total } })
  })
  set({ progress: null })

  if (result.binary) {
    const ok = await ask('Binary file?', `${file.name} does not look like text. Open it anyway?`)
    if (!ok) return
  }

  const nativePath = 'path' in file && typeof (file as File & { path?: string }).path === 'string'
    ? (file as File & { path: string }).path
    : null

  const id = uid()
  const note: Note = {
    id,
    title: file.name,
    kind: kindFromName(file.name),
    categoryIds: [],
    createdAt: file.lastModified || Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    locked: false,
    encoding: result.encoding,
    lineEnding: result.lineEnding,
    fileName: file.name,
    filePath: nativePath,
    fromDisk: true,
    language: languageLabel(file.name, kindFromName(file.name)),
    dirty: false,
    size: result.size,
  }
  if (handle) handles.set(id, handle)
  set({
    notes: [note, ...state.notes.filter((n) => n.fileName !== file.name || !n.fromDisk)],
    contents: { ...state.contents, [id]: result.text },
    originals: { ...state.originals, [id]: result.text },
  })
  openTab(id)
  toast(`${file.name} · ${formatBytes(result.size)} · ${result.encoding}`)
}

export async function saveActive() {
  const id = state.activeId
  if (!id) return
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  const text = applyLineEnding(getContent(id), note.lineEnding)
  const handle = handles.get(id)
  try {
    if (note.filePath && window.notesNative) {
      await window.notesNative.writeFile(note.filePath, text, note.encoding)
    } else if (handle) {
      const ok = await ensurePermission(handle)
      if (!ok) {
        toast('File permission denied', 'error')
        return
      }
      await writeHandle(handle, text, note.encoding)
    } else if (note.fromDisk || isNative()) {
      await saveActiveAs()
      return
    } else {
      state.contents[id] = text
    }
    patchNote(id, { dirty: false, updatedAt: Date.now(), size: new Blob([text]).size })
    set({ originals: { ...state.originals, [id]: text } })
    toast('Saved')
    schedulePersist()
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Save failed', 'error')
  }
}

export async function saveActiveAs() {
  const id = state.activeId
  if (!id) return
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  const text = applyLineEnding(getContent(id), note.lineEnding)
  const name = note.fileName || `${note.title}.txt`
  if (window.notesNative) {
    const saved = await window.notesNative.saveFileAs(name, text, note.encoding)
    if (!saved) return
    patchNote(id, {
      dirty: false,
      fromDisk: true,
      fileName: saved.name,
      filePath: saved.path,
      title: saved.name,
      updatedAt: Date.now(),
      size: new Blob([text]).size,
      language: languageLabel(saved.name, note.kind),
    })
    set({ originals: { ...state.originals, [id]: text } })
    toast(`Saved as ${saved.name}`)
    schedulePersist()
    return
  }
  const handle = await pickSaveFile(name)
  if (handle) {
    await writeHandle(handle, text, note.encoding)
    handles.set(id, handle)
    patchNote(id, {
      dirty: false,
      fromDisk: true,
      fileName: handle.name,
      title: handle.name,
      updatedAt: Date.now(),
      size: new Blob([text]).size,
      language: languageLabel(handle.name, note.kind),
    })
    set({ originals: { ...state.originals, [id]: text } })
    toast(`Saved as ${handle.name}`)
  } else {
    downloadText(name, text, note.encoding)
    patchNote(id, { dirty: false, updatedAt: Date.now() })
    toast('Download started')
  }
  schedulePersist()
}

export function deleteNote(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  unregisterView(id)
  handles.delete(id)
  const contents = { ...state.contents }
  const originals = { ...state.originals }
  const text = contents[id] ?? ''
  delete contents[id]
  delete originals[id]
  const openTabs = state.openTabs.filter((t) => t !== id)
  const activeId = state.activeId === id ? (openTabs[openTabs.length - 1] ?? null) : state.activeId
  const next = {
    notes: state.notes.filter((n) => n.id !== id),
    contents,
    originals,
    openTabs,
    activeId,
    screen: (activeId ? state.screen : 'library') as Screen,
  }
  if (note.fromDisk) {
    set(next)
  } else {
    set({
      ...next,
      trash: [{ ...note, updatedAt: Date.now() }, ...state.trash.filter((n) => n.id !== id)],
      trashContents: { ...state.trashContents, [id]: text },
    })
    toast('Moved to trash')
  }
  void idbDel('notes', id)
  void idbDel('contents', id)
  void idbDel('handles', id)
  schedulePersist()
}

export function restoreNote(id: string) {
  const note = state.trash.find((n) => n.id === id)
  if (!note) return
  const content = state.trashContents[id] ?? ''
  const { [id]: _removed, ...trashContents } = state.trashContents
  set({
    trash: state.trash.filter((n) => n.id !== id),
    trashContents,
    notes: [{ ...note, updatedAt: Date.now() }, ...state.notes],
    contents: { ...state.contents, [id]: content },
    originals: { ...state.originals, [id]: content },
  })
  void idbSet('notes', { ...note, dirty: false, updatedAt: Date.now() })
  void idbSet('contents', content, id)
  schedulePersist()
  toast('Note restored')
  activateTab(id)
}

export function purgeNote(id: string) {
  const { [id]: _removed, ...trashContents } = state.trashContents
  set({
    trash: state.trash.filter((n) => n.id !== id),
    trashContents,
  })
  schedulePersist()
}

export function emptyTrash() {
  if (!state.trash.length) return
  set({ trash: [], trashContents: {} })
  schedulePersist()
  toast('Trash emptied')
}

export function addNoteImage(id: string, dataUrl: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  const images = [...(note.images ?? []), dataUrl]
  if (images.length > 8) {
    toast('Maximum 8 images per note', 'warn')
    return
  }
  patchNote(id, { images, updatedAt: Date.now() })
  schedulePersist()
}

export function removeNoteImage(id: string, index: number) {
  const note = state.notes.find((n) => n.id === id)
  if (!note?.images) return
  patchNote(id, { images: note.images.filter((_, i) => i !== index), updatedAt: Date.now() })
  schedulePersist()
}

export function exportNote(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  const name = `${(note.title.trim() || 'note').replace(/[<>:"/\\|?*]/g, '_')}.md`
  downloadText(name, getContent(id), 'utf-8')
  toast('Exported')
}

export function wrapActive(left: string, right = left) {
  const id = state.activeId
  if (!id) return
  const view = views.get(id)
  if (view) {
    const { from, to } = view.state.selection.main
    const selected = view.state.doc.sliceString(from, to)
    view.dispatch({
      changes: { from, to, insert: `${left}${selected}${right}` },
      selection: { anchor: from + left.length, head: from + left.length + selected.length },
    })
    markDirty(id)
    return
  }
  setNoteContent(id, `${left}${getContent(id)}${right}`)
}

export function prefixActiveLine(prefix: string) {
  const id = state.activeId
  if (!id) return
  const view = views.get(id)
  if (!view) {
    setNoteContent(id, `${prefix}${getContent(id)}`)
    return
  }
  const line = view.state.doc.lineAt(view.state.selection.main.from)
  const next = line.text.startsWith(prefix) ? line.text.slice(prefix.length) : `${prefix}${line.text}`
  view.dispatch({ changes: { from: line.from, to: line.to, insert: next } })
  markDirty(id)
}

export function setListType(id: string, listType: ListType) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  const current = note.listType ?? 'checklist'
  const items = parseList(getContent(id), current)
  setNoteContent(id, serializeList(items, listType))
  patchNote(id, { listType, kind: 'checklist', updatedAt: Date.now() })
  schedulePersist()
}

export function toggleNoteOrList(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  if (note.kind === 'checklist') {
    setNoteKind(id, 'markdown')
    return
  }
  const listType = note.listType ?? 'checklist'
  const items = parseList(getContent(id), listType)
  setNoteContent(id, items.length ? serializeList(items, listType) : '- [ ] ')
  setNoteKind(id, 'checklist')
  patchNote(id, { listType })
}

export function pinNote(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  patchNote(id, { pinned: !note.pinned })
  schedulePersist()
}

export function setNoteKind(id: string, kind: NoteKind) {
  const note = state.notes.find((n) => n.id === id)
  patchNote(id, {
    kind,
    language: languageLabel(note?.fileName ?? null, kind),
    listType: kind === 'checklist' ? (note?.listType ?? 'checklist') : note?.listType,
  })
  schedulePersist()
}

export function setNoteTitle(id: string, title: string) {
  patchNote(id, { title, updatedAt: Date.now() })
  schedulePersist()
}

export function toggleNoteCategory(noteId: string, categoryId: string) {
  const note = state.notes.find((n) => n.id === noteId)
  if (!note) return
  const categoryIds = note.categoryIds.includes(categoryId)
    ? note.categoryIds.filter((c) => c !== categoryId)
    : [...note.categoryIds, categoryId]
  patchNote(noteId, { categoryIds, updatedAt: Date.now() })
  schedulePersist()
}

export function renameCategory(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  set({ categories: state.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) })
  schedulePersist()
}

export function duplicateNote(id: string) {
  const note = state.notes.find((n) => n.id === id)
  if (!note || note.locked) return
  const nid = uid()
  const now = Date.now()
  const text = getContent(id)
  const copy: Note = {
    ...note,
    id: nid,
    title: note.title ? `${note.title} copy` : '',
    createdAt: now,
    updatedAt: now,
    fileName: null,
    filePath: null,
    fromDisk: false,
    dirty: true,
    images: [...(note.images ?? [])],
  }
  set({
    notes: [copy, ...state.notes],
    contents: { ...state.contents, [nid]: text },
    originals: { ...state.originals, [nid]: text },
  })
  openTab(nid)
  schedulePersist()
}

export function addCategory(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (state.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    toast('This category already exists', 'warn')
    return state.categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())?.id ?? null
  }
  const id = uid()
  set({ categories: [...state.categories, { id, name: trimmed }] })
  schedulePersist()
  return id
}

export function removeCategory(id: string) {
  set({
    categories: state.categories.filter((c) => c.id !== id),
    notes: state.notes.map((n) => ({ ...n, categoryIds: n.categoryIds.filter((c) => c !== id) })),
    filter: state.filter === id ? 'all' : state.filter,
  })
  schedulePersist()
}

export function setEncoding(id: string, encoding: string) {
  patchNote(id, { encoding })
  schedulePersist()
}

export function setLineEnding(id: string, lineEnding: Note['lineEnding']) {
  patchNote(id, { lineEnding, dirty: true })
}

export async function setAppPin(pin: string, enableLock: boolean) {
  if (!pin) {
    set({ settings: { ...state.settings, pinHash: null, pinSalt: null, appLock: false } })
    schedulePersist()
    toast('PIN removed')
    return
  }
  const { hash, salt } = await hashPin(pin)
  set({ settings: { ...state.settings, pinHash: hash, pinSalt: salt, appLock: enableLock } })
  schedulePersist()
  toast(enableLock ? 'PIN saved — the app locks on startup' : 'PIN saved')
}

export async function unlockApp(pin: string): Promise<boolean> {
  const { pinHash, pinSalt } = state.settings
  if (!pinHash || !pinSalt) {
    set({ appLocked: false })
    return true
  }
  const ok = await verifyPin(pin, pinHash, pinSalt)
  if (ok) set({ appLocked: false })
  return ok
}

export async function lockNote(id: string, pin: string) {
  const text = getContent(id)
  const cipher = await encryptText(pin, text)
  unregisterView(id)
  patchNote(id, { locked: true, ciphertext: cipher, dirty: false })
  set({
    contents: { ...state.contents, [id]: '' },
    openTabs: state.openTabs.filter((t) => t !== id),
    activeId: state.activeId === id ? null : state.activeId,
    screen: 'library',
  })
  await idbSet('contents', '', id)
  schedulePersist()
  toast('Note locked')
}

export async function unlockNote(id: string, pin: string): Promise<boolean> {
  const note = state.notes.find((n) => n.id === id)
  if (!note?.ciphertext) {
    patchNote(id, { locked: false })
    openTab(id)
    return true
  }
  try {
    const text = await decryptText(pin, note.ciphertext)
    patchNote(id, { locked: false, ciphertext: undefined })
    set({ contents: { ...state.contents, [id]: text }, originals: { ...state.originals, [id]: text } })
    openTab(id)
    return true
  } catch {
    return false
  }
}

export function lockAppNow() {
  if (!state.settings.pinHash) {
    toast('Set a PIN in Settings', 'warn')
    return
  }
  set({ appLocked: true, screen: 'library' })
}

export function insertIntoActive(snippet: string) {
  const id = state.activeId
  if (!id) return
  const view = views.get(id)
  if (view) {
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: snippet } })
    markDirty(id)
    return
  }
  setNoteContent(id, `${getContent(id)}${snippet}`)
}
