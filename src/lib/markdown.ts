import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(src: string): string {
  return marked.parse(src, { async: false }) as string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function previewMarkdownHybrid(text: string, maxLines = 7): string {
  const lines = text.split(/\r?\n/).slice(0, maxLines)
  return lines
    .map((line) => {
      let html = escapeHtml(line)
      html = html.replace(/^(#{1,6})(\s+)(.*)$/, '<span class="md-h">$1$2$3</span>')
      html = html.replace(/`([^`]+)`/g, '<code>`$1`</code>')
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>**$1**</strong>')
      html = html.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<strong>*$2*</strong>')
      html = html.replace(/_([^_]+)_/g, '<em>_$1_</em>')
      html = html.replace(/~([^~]+)~/g, '<s>~$1~</s>')
      return html || '<br>'
    })
    .join('\n')
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
  return serializeList(items, 'checklist')
}

export type ListType = 'checklist' | 'bulleted' | 'numbered'

export function parseList(text: string, type: ListType = 'checklist'): { id: string; text: string; done: boolean }[] {
  const lines = text.split(/\r?\n/)
  const items: { id: string; text: string; done: boolean }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const check = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
    if (type === 'checklist' && check) {
      items.push({ id: `c${i}`, text: check[2]!, done: check[1] !== ' ' })
    } else if (type === 'bulleted' && bullet && !check) {
      items.push({ id: `c${i}`, text: bullet[1]!, done: false })
    } else if (type === 'numbered' && numbered) {
      items.push({ id: `c${i}`, text: numbered[1]!, done: false })
    } else if (line.trim()) {
      items.push({ id: `c${i}`, text: line.trim(), done: false })
    }
  }
  return items
}

export function serializeList(items: { text: string; done: boolean }[], type: ListType = 'checklist'): string {
  return items
    .map((it, i) => {
      if (type === 'numbered') return `${i + 1}. ${it.text}`
      if (type === 'bulleted') return `- ${it.text}`
      return `- [${it.done ? 'x' : ' '}] ${it.text}`
    })
    .join('\n')
}
