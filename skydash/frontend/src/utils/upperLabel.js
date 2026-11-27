/** Upper-cased label for a field that may be missing or not a string. */
export function upperLabel(value, fallback = 'UNKNOWN') {
  return typeof value === 'string' && value ? value.toUpperCase() : fallback;
}
