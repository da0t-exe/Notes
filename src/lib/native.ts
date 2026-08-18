import type { NativeFile } from './types'

export type NativeAPI = {
  isNative: true
  openFiles: () => Promise<NativeFile[]>
  writeFile: (filePath: string, text: string, encoding: string) => Promise<{ path: string; name: string }>
  saveFileAs: (
    name: string,
    text: string,
    encoding: string,
  ) => Promise<{ path: string; name: string } | null>
  minimize: () => void
  maximize: () => void
  close: () => void
  onCloseRequested: (handler: () => Promise<boolean>) => Promise<() => void>
  /** The file Explorer launched us with, consumed once. */
  takeLaunchFile: () => Promise<NativeFile | null>
  /** Fires when a second launch hands its file to this window. */
  onOpenFile: (handler: (file: NativeFile) => void) => Promise<() => void>
}

declare global {
  interface Window {
    notesNative?: NativeAPI
    __TAURI_INTERNALS__?: unknown
  }
}

export function isNative(): boolean {
  return Boolean(window.notesNative?.isNative) || Boolean(window.__TAURI_INTERNALS__)
}

/**
 * Builds `window.notesNative` when running inside Tauri, and does nothing in a
 * plain browser so `npm run dev` still works. The Tauri modules are imported
 * dynamically so the browser build never pulls them in.
 */
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
    takeLaunchFile: () => invoke<NativeFile | null>('take_launch_file'),
    onOpenFile: (handler) => listen<NativeFile>('open-file', (e) => handler(e.payload)),
    minimize: () => void win.minimize(),
    maximize: () => void win.toggleMaximize(),
    close: () => void win.close(),
    // The handler resolves true to let the window go. This is what makes the
    // unsaved-changes prompt possible — v0.3 had no close hook at all, so
    // quitting discarded pending edits without a word.
    onCloseRequested: (handler) =>
      win.onCloseRequested(async (event) => {
        if (!(await handler())) event.preventDefault()
      }),
  }
}
