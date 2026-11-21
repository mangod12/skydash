// Fixed stored ZIP encoder shared by local CLI and browser packaging.
// No compression, extraction, timestamps from inputs, links or file operations.
const encode = value => new TextEncoder().encode(value);
const crcTable = Array.from({ length: 256 }, (_, index) => { let value = index; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }
export function storedZipBytes(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 65535) throw Error('Invalid entry count.');
  const locals = [], central = [], names = new Set(); let offset = 0, centralSize = 0;
  for (const [name, contents] of entries) {
    if (typeof name !== 'string' || name.includes('\\') || name.startsWith('/') || name.split('/').some(part => ['', '.', '..'].includes(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)) || /[\x00-\x1f\x7f:<>"|?*]/.test(name) || names.has(name.normalize('NFC').toLowerCase())) throw Error('Archive paths must be unique safe relative names, including case.');
    const key = name.normalize('NFC').toLowerCase();
    if ([...names].some(other => key.startsWith(other + '/') || other.startsWith(key + '/'))) throw Error('Archive file and folder paths conflict.');
    names.add(key);
    const filename = encode(name), bytes = typeof contents === 'string' ? encode(contents) : contents;
    if (new TextDecoder().decode(filename) !== name || !(bytes instanceof Uint8Array) || filename.length > 65535 || bytes.length > 0xffffffff) throw Error('Unsupported archive bytes.');
    const crc = crc32(bytes), local = new Uint8Array(30), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint16(12, 33, true); l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true); l.setUint16(26, filename.length, true);
    const record = new Uint8Array(46), r = new DataView(record.buffer);
    r.setUint32(0, 0x02014b50, true); r.setUint16(4, 20, true); r.setUint16(6, 20, true); r.setUint16(8, 0x800, true); r.setUint16(14, 33, true); r.setUint32(16, crc, true); r.setUint32(20, bytes.length, true); r.setUint32(24, bytes.length, true); r.setUint16(28, filename.length, true); r.setUint32(42, offset, true);
    locals.push(local, filename, bytes); central.push(record, filename); centralSize += record.length + filename.length; offset += local.length + filename.length + bytes.length;
    if (offset + centralSize + 22 > 0xffffffff) throw Error('ZIP64 unsupported.');
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer); e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length); let cursor = 0;
  for (const bytes of [...locals, ...central, end]) { result.set(bytes, cursor); cursor += bytes.length; }
  return result;
}
