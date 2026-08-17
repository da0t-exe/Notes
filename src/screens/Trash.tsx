import { formatStamp, previewText } from '../lib/format'
import { emptyTrash, purgeNote, restoreNote, useStore } from '../store'

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
      <div className="section-label">
        {trash.length} note{trash.length > 1 ? 's' : ''}
      </div>

      <div className="cat-group">
        {trash.map((note) => (
          <div key={note.id} className="note-card trash-card">
            <div className="note-card-head">
              <h3>{note.title || 'Untitled'}</h3>
            </div>
            <pre>{previewText(trashContents[note.id] ?? '', 160)}</pre>
            <div className="trash-actions">
              <button type="button" onClick={() => restoreNote(note.id)}>
                Restore
              </button>
              <button type="button" onClick={() => void purgeNote(note.id)}>
                Delete
              </button>
              <span style={{ flex: 1 }} />
              <span className="status-inline">{formatStamp(note.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="empty-trash">
        <button type="button" onClick={() => void emptyTrash()}>
          Empty trash
        </button>
      </div>
    </div>
  )
}
