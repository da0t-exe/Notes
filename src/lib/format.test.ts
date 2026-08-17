import { describe, expect, it } from 'vitest'
import { extOf, formatBytes, previewText, safeFileName, titleFromContent } from './format'

describe('formatBytes', () => {
  it('scales through each unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('drops the decimal on large values', () => {
    expect(formatBytes(500 * 1024)).toBe('500 KB')
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB')
  })
})

describe('extOf', () => {
  it('lowercases the extension', () => {
    expect(extOf('README.MD')).toBe('md')
    expect(extOf('archive.tar.gz')).toBe('gz')
  })

  it('returns empty when there is no extension', () => {
    expect(extOf('Makefile')).toBe('')
  })

  it('treats a dotfile as having no extension name of its own', () => {
    expect(extOf('.gitignore')).toBe('gitignore')
  })
})

describe('titleFromContent', () => {
  it('takes the first meaningful line and strips heading markers', () => {
    expect(titleFromContent('# My title\n\nbody', 'fallback')).toBe('My title')
    expect(titleFromContent('\n\n### Deep\n', 'fallback')).toBe('Deep')
  })

  it('falls back on empty or marker-only content', () => {
    expect(titleFromContent('', 'fallback')).toBe('fallback')
    expect(titleFromContent('\n\n   \n', 'fallback')).toBe('fallback')
    expect(titleFromContent('###', 'fallback')).toBe('fallback')
  })

  it('caps the length', () => {
    expect(titleFromContent('x'.repeat(200), 'fallback')).toHaveLength(80)
  })
})

describe('previewText', () => {
  it('collapses whitespace', () => {
    expect(previewText('a  \n\t b')).toBe('a b')
  })

  it('truncates with an ellipsis past the limit', () => {
    const out = previewText('x'.repeat(50), 10)
    expect(out).toBe(`${'x'.repeat(10)}…`)
  })

  it('leaves short text untouched', () => {
    expect(previewText('short', 10)).toBe('short')
  })
})

describe('safeFileName', () => {
  it('replaces characters Windows rejects', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })

  it('falls back when nothing usable remains', () => {
    expect(safeFileName('   ')).toBe('note')
    expect(safeFileName('...')).toBe('note')
  })

  it('keeps spaces, which are legal on Windows', () => {
    expect(safeFileName('meeting notes')).toBe('meeting notes')
  })

  it('strips control bytes', () => {
    expect(safeFileName('a\u0000b\u001fc')).toBe('a_b_c')
  })
})
