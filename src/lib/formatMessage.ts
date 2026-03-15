/**
 * Formats message content by converting asterisk syntax to HTML.
 * - **text** → <strong>text</strong> (bold)
 * - *text* → <em>text</em> (italic)
 *
 * Input is HTML-escaped before formatting to prevent XSS.
 */
export function formatMessageContent(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  // Double asterisks must be processed before single asterisks.
  // [\s\S] is used instead of . with the /s flag so that the pattern also
  // matches across newlines while staying compatible with ES2017 targets.
  const withBold = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>')

  return withItalic
}
