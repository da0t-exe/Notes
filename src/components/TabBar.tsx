import { IconClose } from '../icons'
import type { Note } from '../lib/types'
import { activateTab, closeTab, useStore } from '../store'

/**
 * The open-document strip. v0.3 tracked `openTabs` and persisted it across
 * restarts but never rendered it, and shipped a `.tabs { display: none }` rule
 * to hide the leftover markup — while the README advertised the feature.
 */
export function TabBar() {
  const openTabs = useStore((s) => s.openTabs)
  const notes = useStore((s) => s.notes)
  const activeId = useStore((s) => s.activeId)

  // A tab can outlive its note if the note was deleted; drop those rather than
  // rendering a hole.
  const tabs = openTabs
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is Note => n !== undefined)

  if (tabs.length < 2) return null

  return (
    <div className="tabs" role="tablist" aria-label="Open documents">
      {tabs.map((note) => (
        <div
          key={note.id}
          className={`tab ${note.id === activeId ? 'active' : ''} ${note.dirty ? 'dirty' : ''}`}
          role="tab"
          tabIndex={0}
          aria-selected={note.id === activeId}
          title={note.filePath ?? note.fileName ?? note.title}
          onClick={() => activateTab(note.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              activateTab(note.id)
            }
          }}
        >
          <span className="tab-name">{note.title || note.fileName || 'Untitled'}</span>
          <button
            className="tab-close"
            type="button"
            aria-label={`Close ${note.title || 'Untitled'}`}
            onClick={(e) => {
              e.stopPropagation()
              void closeTab(note.id)
            }}
          >
            <IconClose width={12} height={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
