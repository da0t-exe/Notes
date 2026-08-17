import { describe, expect, it } from 'vitest'
import {
  applyLineEnding,
  detectEncoding,
  detectLineEnding,
  encodeForSave,
  isLikelyBinary,
} from './encoding'

const bytes = (...n: number[]) => new Uint8Array(n)
const utf8 = (s: string) => new TextEncoder().encode(s)

describe('detectEncoding', () => {
  it('recognises each BOM', () => {
    expect(detectEncoding(bytes(0xef, 0xbb, 0xbf, 0x41))).toBe('utf-8')
    expect(detectEncoding(bytes(0xff, 0xfe, 0x41, 0x00))).toBe('utf-16le')
    expect(detectEncoding(bytes(0xfe, 0xff, 0x00, 0x41))).toBe('utf-16be')
  })

  it('accepts valid UTF-8 without a BOM', () => {
    expect(detectEncoding(utf8('héllo — wörld 日本語'))).toBe('utf-8')
  })

  it('falls back to windows-1252 on invalid UTF-8', () => {
    // 0xE9 is "é" in latin-1 but an incomplete sequence in UTF-8.
    expect(detectEncoding(bytes(0x61, 0xe9, 0x62))).toBe('windows-1252')
  })

  it('handles an empty buffer', () => {
    expect(detectEncoding(bytes())).toBe('utf-8')
  })
})

describe('isLikelyBinary', () => {
  it('flags a NUL byte', () => {
    expect(isLikelyBinary(bytes(0x41, 0x00, 0x42), 'utf-8')).toBe(true)
  })

  it('accepts plain text', () => {
    expect(isLikelyBinary(utf8('hello\r\n\tworld\n'), 'utf-8')).toBe(false)
  })

  it('never flags UTF-16, whose ASCII range is full of NULs', () => {
    expect(isLikelyBinary(bytes(0x41, 0x00, 0x42, 0x00), 'utf-16le')).toBe(false)
  })

  it('flags a high ratio of control bytes', () => {
    expect(isLikelyBinary(new Uint8Array(100).fill(0x01), 'utf-8')).toBe(true)
  })

  it('treats an empty buffer as text', () => {
    expect(isLikelyBinary(bytes(), 'utf-8')).toBe(false)
  })
})

describe('detectLineEnding', () => {
  it('detects each style', () => {
    expect(detectLineEnding('a\r\nb\r\nc')).toBe('CRLF')
    expect(detectLineEnding('a\nb\nc')).toBe('LF')
    expect(detectLineEnding('a\rb\rc')).toBe('CR')
  })

  it('picks the dominant style in a mixed file', () => {
    expect(detectLineEnding('a\r\nb\r\nc\r\nd\ne')).toBe('CRLF')
    expect(detectLineEnding('a\nb\nc\nd\r\ne')).toBe('LF')
  })

  it('defaults to LF with no line breaks at all', () => {
    expect(detectLineEnding('single line')).toBe('LF')
  })

  it('does not count the CR of a CRLF as a lone CR', () => {
    expect(detectLineEnding('a\r\nb')).toBe('CRLF')
  })
})

describe('applyLineEnding', () => {
  it('converts between styles without stacking separators', () => {
    expect(applyLineEnding('a\r\nb', 'LF')).toBe('a\nb')
    expect(applyLineEnding('a\nb', 'CRLF')).toBe('a\r\nb')
    expect(applyLineEnding('a\r\nb', 'CR')).toBe('a\rb')
  })

  it('is idempotent', () => {
    const once = applyLineEnding('a\nb\r\nc\rd', 'CRLF')
    expect(applyLineEnding(once, 'CRLF')).toBe(once)
  })
})

describe('encodeForSave', () => {
  it('writes UTF-8 without a BOM', () => {
    expect(Array.from(encodeForSave('AB', 'utf-8'))).toEqual([0x41, 0x42])
  })

  it('writes UTF-16 with the matching BOM and byte order', () => {
    expect(Array.from(encodeForSave('A', 'utf-16le'))).toEqual([0xff, 0xfe, 0x41, 0x00])
    expect(Array.from(encodeForSave('A', 'utf-16be'))).toEqual([0xfe, 0xff, 0x00, 0x41])
  })

  it('round-trips UTF-16 through the platform decoder', () => {
    const text = 'héllo 日本語'
    const encoded = encodeForSave(text, 'utf-16le')
    expect(new TextDecoder('utf-16le').decode(encoded).replace('﻿', '')).toBe(text)
  })
})
