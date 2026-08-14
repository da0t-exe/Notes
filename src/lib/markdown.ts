import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(src: string): string {
  return marked.parse(src, { async: false }) as string
}

export function parseChecklist(text: string): { id: string; text: string; done: boolean }[] {
  const lines = text.split(/\r?\n/)
  const items: { id: string; text: string; done: boolean }[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/)
    if (m) {
      items.push({
        id: `c${i}-${m[2]!.slice(0, 12)}`,
        text: m[2]!,
        done: m[1] !== ' ',
      })
    } else if (lines[i]!.trim()) {
      items.push({ id: `c${i}`, text: lines[i]!.trim(), done: false })
    }
  }
  return items
}

export function serializeChecklist(items: { text: string; done: boolean }[]): string {
  return items.map((it) => `- [${it.done ? 'x' : ' '}] ${it.text}`).join('\n')
}
