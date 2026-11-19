import { useState } from 'react';
import { MAPPING_FIELDS } from '../../utils/csvColumnMapping';
import { MAX_RECIPE_BYTES, exportMappingRecipe, parseMappingRecipe, applyMappingRecipe } from '../../utils/mappingRecipe';
const button = 'rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-xs text-orange-200 disabled:opacity-40';
export default function MappingRecipe({ headers, mapping, onApply, onPause, disabled = false }) {
  const [label, setLabel] = useState('CSV column mapping'), [pending, setPending] = useState(null), [reading, setReading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const download = () => {
    let url; setError(''); setMessage(''); onPause();
    try { const text = exportMappingRecipe(headers, mapping, label); url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'skydash-csv-mapping-recipe.json'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Recipe download requested. It contains header names, selected column positions, units and label, but no CSV rows or source identity. Header names and labels can be sensitive.'); }
    catch (failure) { if (url) URL.revokeObjectURL(url); setError(failure.message || 'Recipe download could not start. Current mapping unchanged.'); }
  };
  const read = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || disabled || reading) return;
    onPause(); setReading(true); setError(''); setMessage(''); setPending(null);
    try { if (file.size > MAX_RECIPE_BYTES) throw new Error('Mapping recipe must be at most 64KiB.'); const text = new globalThis.TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); setPending(parseMappingRecipe(text, headers)); }
    catch (failure) { setError(failure.message || 'Recipe could not be read. Current mapping unchanged.'); }
    finally { setReading(false); }
  };
  return <section aria-label="Reusable CSV mapping recipe" className="rounded-lg border border-orange-500/20 p-3 space-y-3">
    <h3 className="text-sm text-orange-200">Reusable mapping recipe</h3>
    <p className="text-xs text-zinc-400">Save column choices for the same ordered CSV headers, without saving flight rows. A matching header is not proof of matching meanings or units. Imported labels are unverified. Recheck source semantics and confirm WGS84 coordinates for every CSV. Applying fills fields only, clears any converted preview and does not convert, open or upload a source. No automatic storage or sharing.</p>
    <label className="block text-xs text-zinc-400">Recipe label<input aria-label="Recipe label" maxLength={120} disabled={disabled || reading} value={label} onChange={event => setLabel(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-zinc-900 p-2 text-xs" /></label>
    <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled || reading} onClick={download}>Download mapping recipe JSON</button><label className="block min-w-0 text-xs text-zinc-400">Preview mapping recipe JSON<input aria-label="Import mapping recipe JSON" type="file" accept=".json,application/json" disabled={disabled || reading} onChange={read} className="mt-1 block w-full min-w-0 text-xs" /></label></div>
    {pending && <div aria-label="Mapping recipe preview" className="rounded border border-amber-500/30 p-3 space-y-2 text-xs text-amber-200"><p className="break-words">Unverified recipe label: {pending.label}. Exact ordered headers match the loaded CSV. Current mapping and conversion are unchanged until Apply.</p><ul className="space-y-1 break-words">{MAPPING_FIELDS.map(field => { const index = pending.configuration.columns[field.key]; return <li key={field.key}>{field.key}: {index === null ? 'unmapped / unknown' : `column ${index + 1}: ${headers[index]}`}</li>; })}</ul><p>Time: {pending.configuration.timeUnit}, {pending.configuration.timeOrigin}; altitude: {pending.configuration.altitudeUnit}; ground speed: {pending.configuration.speedUnit}; battery: percentage only. Altitude datum unverified. Coordinate confirmation will be cleared.</p><p>Replace current mapping fields and discard any converted preview? The current primary replay and reviews stay unchanged. You must check units/coordinates and preview conversion again before opening.</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={disabled || reading} onClick={() => { onPause(); onApply(applyMappingRecipe(pending, headers)); setLabel(pending.label); setPending(null); setMessage('Recipe applied to mapping fields only. Confirm source WGS84 coordinates and check every unit, then preview conversion again. Primary replay unchanged.'); }}>Apply recipe to mapping fields</button><button type="button" className={button} disabled={disabled || reading} onClick={() => { setPending(null); setMessage('Recipe canceled. Current mapping and conversion unchanged.'); }}>Keep current mapping</button></div></div>}
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}{message && <p role="status" className="text-xs text-orange-200">{message}</p>}
  </section>;
}
