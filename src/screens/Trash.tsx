import { SwipeRow } from '../components/SwipeRow'
import { formatStamp, previewText } from '../lib/format'
import { purgeNote, restoreNote, useStore } from '../store'

export function TrashScreen() {
  const trash = useStore((s) => s.trash)
  const trashContents = useStore((s) => s.trashContents)

  if (trash.length === 0) {
    return (
      <div className="page">
        <p className="empty-hint">The trash is empty</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="section-label">Swipe a note to restore or delete</div>

      <div className="cat-group">
        {trash.map((note) => (
          <SwipeRow
            key={note.id}
            left={{ label: 'Restore', tone: 'restore', onAct: () => restoreNote(note.id) }}
            right={{ label: 'Delete permanently', tone: 'del', onAct: () => void purgeNote(note.id) }}
          >
            <div className="note-card trash-card">
              <div className="note-card-head">
                <h3>{note.title || 'Untitled'}</h3>
                <span className="status-inline">{formatStamp(note.updatedAt)}</span>
              </div>
              <pre>{previewText(trashContents[note.id] ?? '', 160)}</pre>
            </div>
          </SwipeRow>
        ))}
      </div>
    </div>
  )
}
