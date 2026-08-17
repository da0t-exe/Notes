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

