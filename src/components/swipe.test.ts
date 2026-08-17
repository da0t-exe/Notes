import { describe, expect, it } from 'vitest'
import { clampDrag, isDrag, REVEAL, snapTarget } from './swipe'

describe('isDrag', () => {
  it('treats small travel as a click', () => {
    // The regression this guards: any movement at all used to move the row,
    // leaving a non-zero offset that swallowed the click opening the note.
    expect(isDrag(0, 0)).toBe(false)
    expect(isDrag(3, 0)).toBe(false)
    expect(isDrag(-6, 0)).toBe(false)
  })

  it('treats travel past the slop as a drag', () => {
    expect(isDrag(7, 0)).toBe(true)
    expect(isDrag(-40, 0)).toBe(true)
  })

  it('measures from where the row already sits, not from zero', () => {
    // A row already open at -84 should not read as dragging when barely held.
    expect(isDrag(-84, -84)).toBe(false)
    expect(isDrag(-90, -84)).toBe(false)
    expect(isDrag(-140, -84)).toBe(true)
  })
})

describe('clampDrag', () => {
  it('refuses a direction that has no action', () => {
    expect(clampDrag(50, false, true)).toBe(0)
    expect(clampDrag(-50, true, false)).toBe(0)
  })

  it('follows the pointer up to the reveal', () => {
    expect(clampDrag(40, true, true)).toBe(40)
    expect(clampDrag(-40, true, true)).toBe(-40)
    expect(clampDrag(REVEAL, true, true)).toBe(REVEAL)
  })

  it('damps past the reveal instead of stopping dead', () => {
    const over = clampDrag(REVEAL + 100, true, true)
    expect(over).toBeGreaterThan(REVEAL)
    expect(over).toBeLessThan(REVEAL + 100)

    const under = clampDrag(-REVEAL - 100, true, true)
    expect(under).toBeLessThan(-REVEAL)
    expect(under).toBeGreaterThan(-REVEAL - 100)
  })

  it('is symmetric', () => {
    expect(clampDrag(-200, true, true)).toBe(-clampDrag(200, true, true))
  })
})

describe('snapTarget', () => {
  it('closes when released short of halfway', () => {
    expect(snapTarget(10, true, true)).toBe(0)
    expect(snapTarget(-10, true, true)).toBe(0)
  })

  it('opens when released past halfway', () => {
    expect(snapTarget(REVEAL / 2, true, true)).toBe(REVEAL)
    expect(snapTarget(-REVEAL / 2, true, true)).toBe(-REVEAL)
    expect(snapTarget(-200, true, true)).toBe(-REVEAL)
  })

  it('never opens a side with no action', () => {
    expect(snapTarget(-200, true, false)).toBe(0)
    expect(snapTarget(200, false, true)).toBe(0)
  })
})
