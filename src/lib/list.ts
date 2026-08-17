import type { ListItem, ListType } from './types'

const CHECK = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/
const BULLET = /^\s*[-*]\s+(.*)$/
const NUMBERED = /^\s*\d+\.\s+(.*)$/

/**
 * Reads a checklist / bullet / numbered list out of plain text. Lines that do
 * not match the expected marker are kept as bare items rather than dropped, so
 * switching list type never loses content.
 */
export function parseList(text: string, type: ListType = 'checklist'): ListItem[] {
  const items: ListItem[] = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue

    const check = CHECK.exec(line)
    if (type === 'checklist' && check) {
      items.push({ id: `c${i}`, text: check[2] ?? '', done: check[1] !== ' ' })
      continue
    }

    const bullet = BULLET.exec(line)
    if (type === 'bulleted' && bullet && !check) {
      items.push({ id: `c${i}`, text: bullet[1] ?? '', done: false })
      continue
    }

    const numbered = NUMBERED.exec(line)
    if (type === 'numbered' && numbered) {
      items.push({ id: `c${i}`, text: numbered[1] ?? '', done: false })
      continue
    }

    if (line.trim()) items.push({ id: `c${i}`, text: line.trim(), done: false })
  }

  return items
}

export function serializeList(items: Pick<ListItem, 'text' | 'done'>[], type: ListType = 'checklist'): string {
  return items
    .map((it, i) => {
      if (type === 'numbered') return `${i + 1}. ${it.text}`
      if (type === 'bulleted') return `- ${it.text}`
      return `- [${it.done ? 'x' : ' '}] ${it.text}`
    })
    .join('\n')
}
