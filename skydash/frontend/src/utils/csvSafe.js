/** Quote a CSV cell and neutralise spreadsheet formula injection. */
export function csvCell(value) {
  const missing = value == null || (typeof value === 'number' && !Number.isFinite(value));
  let text = missing ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
