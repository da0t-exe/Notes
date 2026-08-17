import { useEffect, useRef } from 'react'
import { IconChevron } from '../icons'
import type { Screen } from '../lib/types'
import { setScreen, useStore } from '../store'

const ITEMS: { label: string; screen: Screen }[] = [
  { label: 'Notes', screen: 'library' },
  { label: 'Trash', screen: 'trash' },
]

/**
 * Section navigation. Distinct from the tab strip, which switches between open
 * documents: this switches between parts of the app, and is where anything new
 * (settings, export) gets hung.
 */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trashCount = useStore((s) => s.trash.length)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={`drawer-back ${open ? 'open' : ''}`}
      // Hidden from assistive tech and from tab order when closed: the panel
      // stays mounted for the slide transition, and its buttons would otherwise
      // stay focusable behind the app.
      aria-hidden={!open}
      inert={!open}
      onClick={onClose}
    >
      <nav
        className="drawer"
        ref={panel}
        tabIndex={-1}
        aria-label="Sections"
        onClick={(e) => e.stopPropagation()}
      >
        {ITEMS.map((item) => (
          <button
            key={item.screen}
            className="drawer-item"
            type="button"
            onClick={() => {
              setScreen(item.screen)
              onClose()
            }}
          >
            {item.label}
            {item.screen === 'trash' && trashCount > 0 ? ` (${trashCount})` : ''}
            <IconChevron />
          </button>
        ))}
      </nav>
    </div>
  )
}
