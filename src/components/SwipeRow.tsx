import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { IconClose, IconPin, IconRestore, IconTrash } from '../icons'
import { clampDrag, isDrag, REVEAL, snapTarget } from './swipe'

export type SwipeAction = {
  label: string
  tone: 'del' | 'pin' | 'restore' | 'close'
  onAct: () => void
}

/**
 * Pointer capture, but never fatal. `releasePointerCapture` throws when the
 * capture is already gone — which is exactly what pointercancel does, so a
 * touch scroll that interrupts a drag would otherwise throw before the row is
 * settled and strand it mid-swipe.
 */
function capture(el: Element, pointerId: number, grab: boolean) {
  try {
    if (grab) el.setPointerCapture(pointerId)
    else el.releasePointerCapture(pointerId)
  } catch {
    /* the pointer is already gone; the caller still settles the row */
  }
}

function icon(tone: SwipeAction['tone']) {
  if (tone === 'pin') return <IconPin />
  if (tone === 'restore') return <IconRestore />
  if (tone === 'close') return <IconClose />
  return <IconTrash />
}

/**
 * Drag a row sideways to reveal an action on either side. Replaces the inline
 * buttons that used to sit in every row: the actions are there when wanted and
 * invisible otherwise.
 */
export function SwipeRow({
  left,
  right,
  onTap,
  children,
}: {
  left?: SwipeAction
  right?: SwipeAction
  /** Fires when the row is pressed and released without being dragged. */
  onTap?: () => void
  children: ReactNode
}) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const offset = useRef(0)
  const origin = useRef<number | null>(null)
  const startOffset = useRef(0)
  const moved = useRef(false)
  const captured = useRef<number | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const open = Math.abs(x) >= REVEAL - 1

  const settle = useCallback((next: number) => {
    offset.current = next
    setX(next)
  }, [])

  // A row left open would otherwise stay open behind whatever the user does
  // next; any pointer landing elsewhere closes it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) settle(0)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(0)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, settle])

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    // Let controls inside the row keep their own clicks.
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return
    origin.current = e.clientX - offset.current
    startOffset.current = offset.current
    moved.current = false
    // Deliberately no pointer capture here. Capturing retargets the click that
    // ends the gesture onto this element, and events do not travel down to
    // children — so the card underneath would never be clickable. Capture is
    // taken in move(), once the pointer has actually committed to a drag.
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (origin.current === null) return
    const raw = e.clientX - origin.current

    // Nothing moves until the gesture clears the slop. Translating on the very
    // first pixel left `offset` non-zero after the faintest mouse wobble, and
    // the click guard below then swallowed the click that should open the note.
    if (!moved.current) {
      if (!isDrag(raw, startOffset.current)) return
      moved.current = true
      setDragging(true)
      // Now that this is a drag, hold the pointer so it keeps reporting even
      // if it leaves the row.
      capture(e.currentTarget, e.pointerId, true)
      captured.current = e.pointerId
    }

    settle(clampDrag(raw, Boolean(left), Boolean(right)))
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    if (origin.current === null) return
    origin.current = null
    setDragging(false)
    if (captured.current !== null) {
      capture(e.currentTarget, captured.current, false)
      captured.current = null
    }

    // Activation runs from here rather than from a click handler. Pointer
    // capture retargets the click that ends a gesture onto whichever element
    // holds the capture, and events never travel down to children — so a card
    // nested under the capture target can silently stop being clickable.
    // Resolving the gesture ourselves removes that whole class of problem.
    if (!moved.current) {
      if (offset.current === 0) onTap?.()
      else settle(0) // a press on an open row closes it instead
      return
    }

    settle(snapTarget(offset.current, Boolean(left), Boolean(right)))
  }

  function act(action: SwipeAction) {
    settle(0)
    action.onAct()
  }

  return (
    <div
      ref={wrap}
      className={[
        'swipe-wrap',
        x > 0 ? 'open-left' : '',
        x < 0 ? 'open-right' : '',
        dragging ? 'dragging' : '',
        open ? 'is-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {left ? (
        <button
          className={`swipe-action left ${left.tone}`}
          type="button"
          title={left.label}
          aria-label={left.label}
          onClick={() => act(left)}
        >
          {icon(left.tone)}
        </button>
      ) : null}
      {right ? (
        <button
          className={`swipe-action right ${right.tone}`}
          type="button"
          title={right.label}
          aria-label={right.label}
          onClick={() => act(right)}
        >
          {icon(right.tone)}
        </button>
      ) : null}

      <div
        className="swipe-front"
        style={{ transform: `translate3d(${x}px,0,0)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          // Taps are resolved on pointerup, so the click that trails a gesture
          // is redundant here. Swallow it unless it belongs to a real control
          // inside the row.
          if (!(e.target as HTMLElement).closest('button, a, input, textarea')) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
