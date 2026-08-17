function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The card preview: markers are stripped and the text styled in their place, so
 * a card shows what a note says rather than how it is written.
 *
 * Escapes first, so the output carries no markup beyond the tags added here and
 * is safe to inject directly. That ordering is also why the quote rule matches
 * the already-escaped `&gt;`.
 *
 * Kept apart from markdown.ts on purpose: that module pulls in DOMPurify, which
 * needs a DOM, and this is plain string work that should stay testable without
 * one.
 */
export function previewMarkdown(text: string, maxLines = 7): string {
  return text
    .split(/\r?\n/)
    .slice(0, maxLines)
    .map((line) => {
      let html = escapeHtml(line)
      html = html.replace(/^\s*&gt;\s?/, '')
      html = html.replace(/^(#{1,6})\s+(.*)$/, '<span class="md-h">$2</span>')
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      html = html.replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
      html = html.replace(/~~?([^~]+)~~?/g, '<s>$1</s>')
      html = html.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      return html || '<br>'
    })
    .join('\n')
}
