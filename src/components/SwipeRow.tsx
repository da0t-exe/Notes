import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { IconPin, IconRestore, IconTrash } from '../icons'
import { clampDrag, isDrag, REVEAL, snapTarget } from './swipe'

export type SwipeAction = {
  label: string
  tone: 'del' | 'pin' | 'restore'
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
  const startOffset = useRef(0)
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
    startOffset.current = offset.current
    moved.current = false
    setDragging(true)
    capture(e.currentTarget, e.pointerId, true)
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
    }

    settle(clampDrag(raw, Boolean(left), Boolean(right)))
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    if (origin.current === null) return
    origin.current = null
    setDragging(false)
    capture(e.currentTarget, e.pointerId, false)

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
