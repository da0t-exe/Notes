import { describe, expect, it } from 'vitest'
import { previewMarkdown } from './preview'

/** The visible result, with the styling tags taken back off. */
const shown = (src: string) => previewMarkdown(src).replace(/<[^>]+>/g, '')

describe('previewMarkdown', () => {
  it('strips the markers rather than showing them', () => {
    // The regression this guards: cards used to read "# Organise tes idées".
    expect(shown('# Organise tes idées')).toBe('Organise tes idées')
    expect(shown('**gras**')).toBe('gras')
    expect(shown('*italique*')).toBe('italique')
    expect(shown('_italique_')).toBe('italique')
    expect(shown('`code`')).toBe('code')
    expect(shown('~~barré~~')).toBe('barré')
    expect(shown('> une citation')).toBe('une citation')
  })

  it('keeps only the text of a link or image', () => {
    expect(shown('[le site](https://example.com)')).toBe('le site')
    expect(shown('![alt](img.png)')).toBe('alt')
  })

  it('styles what it strips', () => {
    expect(previewMarkdown('**gras**')).toContain('<strong>')
    expect(previewMarkdown('# Titre')).toContain('md-h')
    expect(previewMarkdown('`code`')).toContain('<code>')
  })

  it('escapes HTML before adding any of its own', () => {
    const out = previewMarkdown('<img src=x onerror="alert(1)">')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })

  it('leaves list markers alone — they carry meaning a preview cannot replace', () => {
    expect(shown('- [ ] acheter du pain')).toBe('- [ ] acheter du pain')
    expect(shown('1. premier')).toBe('1. premier')
  })

  it('caps the number of lines', () => {
    const many = Array.from({ length: 20 }, (_, i) => `ligne ${i}`).join('\n')
    expect(previewMarkdown(many).split('\n')).toHaveLength(7)
    expect(previewMarkdown(many, 3).split('\n')).toHaveLength(3)
  })

  it('keeps blank lines as breaks instead of collapsing them', () => {
    expect(previewMarkdown('a\n\nb')).toBe('a\n<br>\nb')
  })

  it('handles an empty note', () => {
    expect(previewMarkdown('')).toBe('<br>')
  })
})
