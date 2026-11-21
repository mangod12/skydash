import { reproduceCSVConversion } from './conversionReproduction';
const roles = ['original', 'recipe', 'converted'];
const pin = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
export async function browserConversionReproduction(files, { confirmedWGS84 = false, expected = {} } = {}) {
  if (confirmedWGS84 !== true) throw Error('Fresh confirmation required before reading.');
  for (const role of roles) {
    const file = files?.[role], value = expected[role] ?? '';
    if (!file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > (role === 'recipe' ? 65536 : 1048576) || (value !== '' && !pin(value))) throw Error('Bounded explicit files and valid independent expectations required.');
  }
  const inputs = {};
  for (const role of roles) {
    const file = files[role], bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw Error('Changed file bytes.');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (expected[role] && sha256 !== expected[role].toLowerCase()) throw Error('Independent raw-file expectation mismatch.');
    inputs[role] = { bytes, sha256 };
  }
  // All optional raw-file pins are checked before decoding/parsing or conversion.
  const decode = role => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(inputs[role].bytes);
  const reproduced = await reproduceCSVConversion(decode('original'), decode('recipe'), inputs.converted.bytes, { confirmedWGS84 });
  return { format: 'skydash-browser-csv-conversion-reproduction-v1', ...Object.fromEntries(roles.map(role => ['exact_'+role+'_sha256', inputs[role].sha256])), ...reproduced, expected_raw_digests_matched: Object.fromEntries(roles.map(role => [role, Boolean(expected[role])])), scope: 'Freshly reproduced exact converted CSV bytes using current numeric adapter and exact-header recipe validators. Optional independent expected digests cover complete raw files separately, not source identity. Caller coordinate confirmation is a statement covering this original, not independent verification. A co-delivered hash or recipe cannot authenticate itself. No filenames, header names, recipe labels, coordinates, individual readings, original absolute timestamps or reviewer text printed. Hashes/sample counts can identify sensitive work. Editable unsigned receipt, not trusted units/datum, OEM compatibility, authorship/custody, telemetry truth, flight/student identity, grades, completion or readiness. Original extra columns may be excluded and configured numeric origin may be subtracted. No sorting, interpolation, repair or row skipping. Not a source/recipe backup or reopenable workspace. No file writes, upload, automatic storage/sharing or aircraft commands. Explicit download only; keep all originals and excluded work separately.' };
}
