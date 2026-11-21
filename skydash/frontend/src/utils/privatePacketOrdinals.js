// Explicit selection only. Null preserves the existing whole-manifest packet.
export function privatePacketOrdinals(value, count = 20) {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 20 || value.some(n => !Number.isSafeInteger(n) || n < 1 || n > count) || new Set(value).size !== value.length) throw Error('Explicit unique listed ordinals required.');
  return [...value].sort((a,b)=>a-b);
}
export function parsePrivatePacketOrdinals(text) {
  if (typeof text !== 'string' || !/^(?:[1-9]|1[0-9]|20)(?:\s*,\s*(?:[1-9]|1[0-9]|20))*$/.test(text.trim())) throw Error('Comma-separated manifest ordinals required.');
  return privatePacketOrdinals(text.trim().split(',').map(Number));
}
