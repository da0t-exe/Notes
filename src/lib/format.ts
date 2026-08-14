export function uid(): string {
  return crypto.randomUUID()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} Ko`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} Mo`
}

export function formatUpdated(ts: number): string {
  const d = new Date(ts)
  const months = [
    'JAN',
    'FÉV',
    'MAR',
    'AVR',
    'MAI',
    'JUIN',
    'JUIL',
    'AOÛT',
    'SEP',
    'OCT',
    'NOV',
    'DÉC',
  ]
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `MIS À JOUR : ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h12}:${m}${ampm}`
}

export function previewText(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trim()}…`
}

export function titleFromContent(text: string, fallback: string): string {
  const line = text.split(/\r?\n/).find((l) => l.replace(/^#+\s*/, '').trim())
  if (!line) return fallback
  return line.replace(/^#+\s*/, '').trim().slice(0, 80) || fallback
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}
