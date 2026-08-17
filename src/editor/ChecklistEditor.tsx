import { useRef, useState } from 'react'
import { IconClose, IconGrip, IconPlus } from '../icons'
import { parseList, serializeList } from '../lib/list'
import type { ListItem, ListType, Note } from '../lib/types'
import { setListType, setNoteContent, useStore } from '../store'

const TYPES: { id: ListType; label: string }[] = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'bulleted', label: 'Bullets' },
  { id: 'numbered', label: 'Numbered' },
]

/**
 * The list view of a note. The text stays the source of truth — items are
 * parsed out of it on every render and written straight back — so switching
 * between prose and list never has two representations to reconcile.
 */
export function ChecklistEditor({ note }: { note: Note }) {
  const content = useStore((s) => s.contents[note.id] ?? '')
  const listType = note.listType ?? 'checklist'
  const items = parseList(content, listType)

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const lastInput = useRef<HTMLInputElement | null>(null)

  function write(next: Pick<ListItem, 'text' | 'done'>[]) {
    setNoteContent(note.id, serializeList(next, listType))
  }

  function addItem() {
    write([...items, { text: '', done: false }])
    // Focus lands on the new row once React has drawn it.
    requestAnimationFrame(() => lastInput.current?.focus())
  }

  return (
    <div className="checklist">
      <div className="list-types">
        {TYPES.map((t) => (
          <button
            key={t.id}
            className={`ghost-pill ${listType === t.id ? 'pill active' : ''}`}
            type="button"
            onClick={() => setListType(note.id, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.map((item, i) => (
        <div
          className="check-edit"
          key={item.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom === null || dragFrom === i) return
            const next = [...items]
            const [moved] = next.splice(dragFrom, 1)
            if (moved) next.splice(i, 0, moved)
            write(next)
            setDragFrom(null)
          }}
        >
          <button
            className="icon-btn"
            style={{ width: 22, height: 22, cursor: 'grab' }}
            type="button"
            title="Reorder"
            aria-label={`Reorder ${item.text || 'item'}`}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => setDragFrom(null)}
          >
            <IconGrip />
          </button>

          {listType === 'checklist' ? (
            <button
              className={`check-box ${item.done ? 'on' : ''}`}
              type="button"
              aria-pressed={item.done}
              aria-label={item.done ? 'Mark not done' : 'Mark done'}
              onClick={() => write(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            >
              {item.done ? '✓' : ''}
            </button>
          ) : listType === 'numbered' ? (
            <span className="list-index">{i + 1}.</span>
          ) : (
            <span className="bullet" />
          )}

          <input
            type="text"
            value={item.text}
            aria-label={`Item ${i + 1}`}
            ref={i === items.length - 1 ? lastInput : null}
            onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
              // Backspace on an empty row removes it, the way a list behaves
              // everywhere else.
              if (e.key === 'Backspace' && item.text === '' && items.length > 1) {
                e.preventDefault()
                write(items.filter((_, j) => j !== i))
              }
            }}
          />

          <button
            className="icon-btn"
            type="button"
            title="Delete item"
            aria-label={`Delete ${item.text || 'item'}`}
            onClick={() => write(items.filter((_, j) => j !== i))}
          >
            <IconClose />
          </button>
        </div>
      ))}

      <button className="add-item" type="button" onClick={addItem}>
        <IconPlus width={14} height={14} /> Add item
      </button>
    </div>
  )
}
