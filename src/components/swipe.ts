/** How far a row opens to expose an action. */
export const REVEAL = 84
/** Past this on release, the row settles open rather than closed. */
const SNAP = REVEAL / 2
/** Movement past the reveal is damped rather than stopped, so the edge has give. */
const RUBBER = 0.22
/** Below this much travel the gesture is a click, not a drag. */
export const SLOP = 6

/**
 * Whether a gesture has travelled far enough to count as a drag.
 *
 * The row must not move at all until this is true. Translating on the first
 * pixel leaves a non-zero offset after the faintest mouse wobble, and the row
 * then swallows the click that should have opened the note.
 */
export function isDrag(raw: number, startOffset: number): boolean {
  return Math.abs(raw - startOffset) > SLOP
}

/** Clamps a raw offset to the sides that actually have an action. */
export function clampDrag(raw: number, hasLeft: boolean, hasRight: boolean): number {
  if (raw > 0) return hasLeft ? Math.min(raw, REVEAL + (raw - REVEAL) * RUBBER) : 0
  if (raw < 0) return hasRight ? Math.max(raw, -REVEAL + (raw + REVEAL) * RUBBER) : 0
  return 0
}

/** Where the row lands once the pointer is released. */
export function snapTarget(offset: number, hasLeft: boolean, hasRight: boolean): number {
  if (hasLeft && offset >= SNAP) return REVEAL
  if (hasRight && offset <= -SNAP) return -REVEAL
  return 0
}
