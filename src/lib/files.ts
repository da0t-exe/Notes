import { detectEncoding, detectLineEnding, decodeBytes, encodeForSave, isLikelyBinary } from './encoding'
import { FILE_PICKER_TYPES, STREAM_SIZE } from './languages'

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
  return pickWithInput(true)
}

export async function pickSaveFile(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      return await window.showSaveFilePicker({
        suggestedName,
        types: FILE_PICKER_TYPES,
      })
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return null
      throw err
    }
  }
  return null
}

function pickWithInput(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

export async function readHandle(handle: FileSystemFileHandle): Promise<File> {
  return handle.getFile()
}

export type ReadResult = {
  text: string
  encoding: string
  lineEnding: 'LF' | 'CRLF' | 'CR'
  binary: boolean
  size: number
}

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
    return {
      text,
      encoding,
      lineEnding: detectLineEnding(text),
      binary,
      size: file.size,
    }
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
  return {
    text,
    encoding,
    lineEnding: detectLineEnding(text),
    binary,
    size: file.size,
  }
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

export async function ensurePermission(handle: FileSystemFileHandle, mode: 'read' | 'readwrite' = 'readwrite'): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true
  const q = await handle.queryPermission({ mode })
  if (q === 'granted') return true
  const r = await handle.requestPermission({ mode })
  return r === 'granted'
}

export function isFileHandle(x: FileSystemFileHandle | File): x is FileSystemFileHandle {
  return 'getFile' in x
}
