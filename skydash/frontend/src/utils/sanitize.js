/**
 * Escape HTML special characters to prevent XSS.
 * Use for any user-generated content rendered in innerHTML contexts.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a string for use in Leaflet DivIcon HTML.
 * Strips all HTML tags and escapes remaining content.
 */
export function sanitizeLabel(str) {
  if (typeof str !== 'string') return '';
  // Strip tags first, then escape
  return escapeHtml(str.replace(/<[^>]*>/g, ''));
}

/**
 * Escaped, truncated label for map markers (entity names are user-controlled).
 */
export function shortLabel(name, max = 14) {
  const text = String(name ?? '');
  return sanitizeLabel(text.length > max ? text.slice(0, max) + '\u2026' : text);
}


/** Escape XML 1.0 text while replacing unrepresentable control and surrogate characters. */
export function escapeXml(value) {
  const clean = Array.from(String(value ?? ''), (char) => {
    const code = char.codePointAt(0);
    return code === 9 || code === 10 || code === 13
      || (code >= 0x20 && code <= 0xD7FF) || (code >= 0xE000 && code <= 0xFFFD)
      || (code >= 0x10000 && code <= 0x10FFFF) ? char : '\uFFFD';
  }).join('');
  return escapeHtml(clean);
}
