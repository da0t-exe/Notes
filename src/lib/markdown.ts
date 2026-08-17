import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

/**
 * `marked` passes raw HTML through by design, and the preview pane is injected
 * with dangerouslySetInnerHTML inside a Tauri webview that can reach
 * `__TAURI_INTERNALS__`. Without this sanitiser, opening a hostile .md file and
 * pressing Preview is enough to invoke a native command. Every path that turns
 * note text into HTML must go through here.
 */
export function renderMarkdown(src: string): string {
  const raw = marked.parse(src, { async: false })
  return DOMPurify.sanitize(raw, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'link', 'meta'],
    FORBID_ATTR: ['style', 'srcset', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: false,
  })
}

// Anything rendered outside the app's own origin is untrusted; force external
// links to open detached from the opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The card preview: markers stay visible but get styled, so a note reads the
 * same in the list as in the editor. Escapes first, so the output carries no
 * markup beyond the spans added here and is safe to inject directly.
 */
export function previewMarkdownHybrid(text: string, maxLines = 7): string {
  return text
    .split(/\r?\n/)
    .slice(0, maxLines)
    .map((line) => {
      let html = escapeHtml(line)
      html = html.replace(/^(#{1,6})(\s+)(.*)$/, '<span class="md-h">$1$2$3</span>')
      html = html.replace(/`([^`]+)`/g, '<code>`$1`</code>')
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>**$1**</strong>')
      html = html.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<strong>*$2*</strong>')
      html = html.replace(/_([^_]+)_/g, '<em>_$1_</em>')
      html = html.replace(/~([^~]+)~/g, '<s>~$1</s>')
      return html || '<br>'
    })
    .join('\n')
}
