import { useState } from 'react'
import { IconClose, IconPlus } from '../icons'
import { addCategory, removeCategory, renameCategory, setFilter, useStore } from '../store'

export function CategoriesScreen() {
  const categories = useStore((s) => s.categories)
  const notes = useStore((s) => s.notes)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  function submitNew() {
    if (addCategory(name)) setName('')
  }

  return (
    <div className="page cats-page">
      <div className="row cats-add">
        <input
          value={name}
          placeholder="New category..."
          aria-label="New category name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitNew()
          }}
        />
        <button className="add-square" type="button" title="Add category" onClick={submitNew}>
          <IconPlus />
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="empty-hint">You don&apos;t have any categories yet</p>
      ) : (
        <div className="cat-group">
          {categories.map((c) => {
            const count = notes.filter((n) => n.categoryIds.includes(c.id)).length
            return (
              <div key={c.id} className="row" style={{ gap: 4 }}>
                <button
                  className="cat-btn"
                  type="button"
                  style={{ flex: 1 }}
                  onClick={() => setFilter(c.id)}
                  onDoubleClick={() => setEditing({ id: c.id, name: c.name })}
                  title="Click to filter, double-click to rename"
                >
                  {c.name}
                  {count > 0 ? ` · ${count}` : ''}
                </button>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  title="Delete category"
                  onClick={() => removeCategory(c.id)}
                >
                  <IconClose width={16} height={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {editing ? (
        <div className="sheet-back" onClick={() => setEditing(null)}>
          <div className="sheet card-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-label">Rename category</div>
            <input
              className="sheet-title"
              value={editing.name}
              autoFocus
              aria-label="Category name"
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null)
                if (e.key === 'Enter') {
                  renameCategory(editing.id, editing.name)
                  setEditing(null)
                }
              }}
            />
            <button
              className="sheet-action"
              type="button"
              onClick={() => {
                renameCategory(editing.id, editing.name)
                setEditing(null)
              }}
            >
              Rename
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
