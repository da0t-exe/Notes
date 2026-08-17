import type { LineEnding } from './types'

export const ENCODINGS = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1'] as const
export type Encoding = (typeof ENCODINGS)[number]

export function detectEncoding(bytes: Uint8Array): Encoding {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  // No BOM: if the head decodes as strict UTF-8 it almost certainly is UTF-8,
  // since arbitrary byte soup fails the multi-byte continuation rules fast.
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)))
    return 'utf-8'
  } catch {
    return 'windows-1252'
  }
}

export function isLikelyBinary(bytes: Uint8Array, encoding: string): boolean {
  // UTF-16 text is full of NUL bytes for ASCII-range characters, so the
  // control-byte heuristic below would flag all of it.
  if (encoding.startsWith('utf-16')) return false
  const n = Math.min(bytes.length, 8192)
  let control = 0
  for (let i = 0; i < n; i++) {
    const b = bytes[i]
    if (b === undefined) break
    if (b === 0) return true
    if (b < 9 || (b > 13 && b < 32)) control++
  }
  return n > 0 && control / n > 0.08
}

export function detectLineEnding(text: string): LineEnding {
  const crlf = (text.match(/\r\n/g) ?? []).length
  const cr = (text.match(/\r(?!\n)/g) ?? []).length
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length
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

export function decodeBytes(buffer: ArrayBuffer, encoding: string): string {
  return new TextDecoder(encoding).decode(buffer)
}

export function encodeForSave(text: string, encoding: string): Uint8Array {
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    const little = encoding === 'utf-16le'
    const out = new Uint8Array(2 + text.length * 2)
    out[0] = little ? 0xff : 0xfe
    out[1] = little ? 0xfe : 0xff
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      out[2 + i * 2] = little ? c & 0xff : c >> 8
      out[3 + i * 2] = little ? c >> 8 : c & 0xff
    }
    return out
  }
  return new TextEncoder().encode(text)
}
