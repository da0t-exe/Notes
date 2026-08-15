export function uid(): string {
  return crypto.randomUUID()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function formatPrettyDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function formatUpdated(ts: number): string {
  return `Updated: ${formatPrettyDate(ts)}`
}

export function formatStamp(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(ts))
    .toUpperCase()
}

export function formatCreated(ts: number): string {
  return `Created: ${formatPrettyDate(ts)}`
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
