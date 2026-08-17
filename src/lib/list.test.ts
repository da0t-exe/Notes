import { describe, expect, it } from 'vitest'
import { parseList, serializeList } from './list'

describe('parseList', () => {
  it('reads checkboxes and their state', () => {
    const items = parseList('- [ ] milk\n- [x] bread\n- [X] eggs', 'checklist')
    expect(items.map((i) => [i.text, i.done])).toEqual([
      ['milk', false],
      ['bread', true],
      ['eggs', true],
    ])
  })

  it('reads bullets and numbered items', () => {
    expect(parseList('- one\n- two', 'bulleted').map((i) => i.text)).toEqual(['one', 'two'])
    expect(parseList('1. one\n2. two', 'numbered').map((i) => i.text)).toEqual(['one', 'two'])
  })

  it('keeps unmarked lines instead of dropping them', () => {
    // Switching list type must never silently lose the user's text.
    expect(parseList('- [ ] marked\nplain line', 'checklist').map((i) => i.text)).toEqual([
      'marked',
      'plain line',
    ])
  })

  it('skips blank lines', () => {
    expect(parseList('- [ ] a\n\n\n- [ ] b', 'checklist')).toHaveLength(2)
  })

  it('returns nothing for empty text', () => {
    expect(parseList('', 'checklist')).toEqual([])
  })

  it('gives every item a distinct id', () => {
    const ids = parseList('- [ ] a\n- [ ] b\n- [ ] c', 'checklist').map((i) => i.id)
    expect(new Set(ids).size).toBe(3)
  })
})

describe('serializeList', () => {
  it('writes each list style', () => {
    const items = [
      { text: 'a', done: false },
      { text: 'b', done: true },
    ]
    expect(serializeList(items, 'checklist')).toBe('- [ ] a\n- [x] b')
    expect(serializeList(items, 'bulleted')).toBe('- a\n- b')
    expect(serializeList(items, 'numbered')).toBe('1. a\n2. b')
  })

  it('renumbers from one', () => {
    const items = [{ text: 'x', done: false }, { text: 'y', done: false }, { text: 'z', done: false }]
    expect(serializeList(items, 'numbered')).toBe('1. x\n2. y\n3. z')
  })
})

describe('round trip', () => {
  it('survives parse → serialize for each type', () => {
    for (const [type, text] of [
      ['checklist', '- [ ] a\n- [x] b'],
      ['bulleted', '- a\n- b'],
      ['numbered', '1. a\n2. b'],
    ] as const) {
      expect(serializeList(parseList(text, type), type)).toBe(text)
    }
  })

  it('preserves item text when converting between types', () => {
    const items = parseList('- [ ] milk\n- [x] bread', 'checklist')
    const asNumbered = serializeList(items, 'numbered')
    expect(parseList(asNumbered, 'numbered').map((i) => i.text)).toEqual(['milk', 'bread'])
  })
})
