import { decodeBytes, detectEncoding, detectLineEnding, encodeForSave, isLikelyBinary } from './encoding'
import type { LineEnding } from './types'

/** Above this, syntax highlighting is dropped — the parser dominates typing latency. */
export const HIGHLIGHT_MAX = 1_500_000
/** Above this, the markdown preview and the diff pane are disabled. */
export const PREVIEW_MAX = 400_000
/** Above this, content is kept in memory but not mirrored into IndexedDB. */
export const PERSIST_MAX = 8_000_000
/** Above this, opening asks for confirmation first. */
export const WARN_SIZE = 20_000_000
/** Hard ceiling, mirrored by MAX_OPEN_BYTES in src-tauri/src/main.rs. */
export const MAX_OPEN = 80_000_000
/** Below this, read in one shot; above it, stream so the UI keeps painting. */
export const STREAM_SIZE = 2_000_000

export type FilePickerAcceptType = {
  description?: string
  accept: Record<string, string[]>
}

declare global {
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

export function isFileHandle(x: FileSystemFileHandle | File): x is FileSystemFileHandle {
  return 'getFile' in x
}

export async function pickOpenFiles(): Promise<FileSystemFileHandle[] | File[]> {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      return await window.showOpenFilePicker({ multiple: true, types: FILE_PICKER_TYPES })
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
  if (typeof window.showSaveFilePicker !== 'function') return null
  try {
    return await window.showSaveFilePicker({ suggestedName, types: FILE_PICKER_TYPES })
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null
    throw err
  }
}

export type ReadResult = {
  text: string
  encoding: string
  lineEnding: LineEnding
  binary: boolean
  size: number
}

/**
 * Reads a file, yielding to the event loop every 32 ms on the streaming path so
 * a large log does not freeze the window while it loads.
 */
export async function readFileStreaming(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  encodingOverride?: string,
): Promise<ReadResult> {
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

  for (;;) {
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

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true
  if ((await handle.queryPermission({ mode })) === 'granted') return true
  return (await handle.requestPermission({ mode })) === 'granted'
}

export async function writeHandle(
  handle: FileSystemFileHandle,
  text: string,
  encoding: string,
): Promise<void> {
  const bytes = encodeForSave(text, encoding)
  const writable = await handle.createWritable()
  await writable.write(new Blob([bytes]))
  await writable.close()
}

export function downloadText(name: string, text: string, encoding: string): void {
  const blob = new Blob([encodeForSave(text, encoding)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
