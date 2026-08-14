export type NativeFile = {
  path: string
  name: string
  text: string
  size: number
  lastModified: number
  encoding: string
  binary: boolean
  lineEnding: 'LF' | 'CRLF' | 'CR'
}

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
  onMenu: (handler: (action: string) => void) => () => void
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
