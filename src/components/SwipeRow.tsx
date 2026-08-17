import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { IconPin, IconRestore, IconTrash } from '../icons'

export type SwipeAction = {
  label: string
  tone: 'del' | 'pin' | 'restore'
  onAct: () => void
}

const REVEAL = 84
const SNAP = REVEAL / 2
/** Movement past the reveal is damped rather than stopped, so the edge has give. */
const RUBBER = 0.22
/** Below this the gesture is a click, not a drag. */
const SLOP = 6

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
  children,
}: {
  left?: SwipeAction
  right?: SwipeAction
  children: ReactNode
}) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const offset = useRef(0)
  const origin = useRef<number | null>(null)
  const moved = useRef(false)
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
    moved.current = false
    setDragging(true)
    capture(e.currentTarget, e.pointerId, true)
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (origin.current === null) return
    const raw = e.clientX - origin.current
    if (Math.abs(raw - offset.current) > SLOP) moved.current = true

    let next = raw
    if (raw > 0) next = left ? Math.min(raw, REVEAL + (raw - REVEAL) * RUBBER) : 0
    else if (raw < 0) next = right ? Math.max(raw, -REVEAL + (raw + REVEAL) * RUBBER) : 0
    settle(next)
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    if (origin.current === null) return
    origin.current = null
    setDragging(false)
    capture(e.currentTarget, e.pointerId, false)

    const cur = offset.current
    if (left && cur >= SNAP) settle(REVEAL)
    else if (right && cur <= -SNAP) settle(-REVEAL)
    else settle(0)
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
          // Swallow the click that ends a drag, and the one that closes an
          // open row, so neither opens the note underneath.
          if (moved.current || offset.current !== 0) {
            e.stopPropagation()
            e.preventDefault()
            if (!moved.current) settle(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
