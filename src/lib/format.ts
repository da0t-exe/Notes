export function uid(): string {
  return crypto.randomUUID()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
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

// NTFS rejects these nine characters outright, plus every byte below 0x20.
// Spaces (0x20) are legal and are deliberately left alone. Written with
// explicit escapes so the class stays readable in a diff.
// eslint-disable-next-line no-control-regex -- stripping control bytes is the point
const ILLEGAL_IN_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g

/** Makes a note title usable as a Windows file name. */
export function safeFileName(name: string, fallback = 'note'): string {
  const clean = name
    .trim()
    .replace(ILLEGAL_IN_FILENAME, '_')
    .replace(/\.+$/, '')
    .trim()
  return clean || fallback
}
