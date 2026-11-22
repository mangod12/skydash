import { useState } from 'react';
import MappingRecipe from './MappingRecipe';
import { Download } from 'lucide-react';
import { MAX_LOG_BYTES } from '../../utils/flightLog';
import { MAPPING_FIELDS, MAPPING_SCOPE, readMappingCSV, convertMappedCSV, mappingReport } from '../../utils/csvColumnMapping';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-xs text-orange-200 disabled:opacity-40 disabled:cursor-not-allowed';
const input = 'mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-200';
const empty = () => ({ columns: Object.fromEntries(MAPPING_FIELDS.map(field => [field.key, null])), timeUnit: '', timeOrigin: '', altitudeUnit: 'm', speedUnit: 'm/s', coordinateReference: '' });
export default function CSVColumnMapping({ onOpen, onPause, workspaceBusy = false, destination = 'primary', initialCSV = null }) {
  const isBaseline = destination === 'baseline';
  const [source, setSource] = useState(() => {
    if (!initialCSV) return null;
    const { text, filename } = initialCSV;
    if (typeof filename !== 'string' || !filename.trim() || filename.length > 120) throw Error('Invalid explicit initial mapping input.');
    return { ...readMappingCSV(text), text, filename, revision: 1 };
  }), [mapping, setMapping] = useState(empty), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [confirm, setConfirm] = useState(false);
  const changed = value => { setMapping(value); setResult(null); setConfirm(false); setError(''); setMessage('Mapping changed. Preview conversion again before download or opening.'); };
  const read = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy || workspaceBusy) return;
    onPause(); setBusy(true); setError(''); setMessage('');
    try {
      if (file.size > MAX_LOG_BYTES) throw new Error('Input CSV must be at most 1MiB.');
      const text = new globalThis.TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      const parsed = readMappingCSV(text);
      setSource(previous => ({ ...parsed, text, filename: file.name.slice(0, 120), revision: (previous?.revision ?? 0) + 1 })); setMapping(empty()); setResult(null); setConfirm(false); setMessage('CSV structure loaded locally. No columns inferred or current replay replaced. Choose meanings and units explicitly.');
    } catch (failure) { setError(failure.message || 'Input CSV could not be read. Previous mapping remains.'); }
    finally { setBusy(false); }
  };
  const preview = async event => {
    event.preventDefault(); onPause(); setBusy(true); setResult(null); setConfirm(false); setError(''); setMessage('');
    try { setResult(await convertMappedCSV(source.text, source.filename, mapping)); setMessage('Converted rows validated against the existing replay contract. Preview is local, not a verified source interpretation. Nothing replaced.'); }
    catch (failure) { setError(failure.message || 'Conversion failed. No rows opened.'); }
    finally { setBusy(false); }
  };
  const download = record => {
    let url;
    try { url = URL.createObjectURL(new Blob([record ? mappingReport(result) : result.csv_text], { type: record ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = record ? `skydash-conversion-${result.sha256.slice(0, 12)}.txt` : result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Download requested. Keep original CSV, conversion record and converted CSV together; case JSON later contains only converted source.'); }
    catch { if (url) URL.revokeObjectURL(url); setError('Conversion download could not start. Mapping and preview remain.'); }
  };
  return <article aria-label={isBaseline ? "Baseline CSV column mapping" : "CSV column mapping"} id={isBaseline ? "baseline-csv-column-mapping" : "csv-column-mapping"} className="rounded-xl border border-orange-500/25 p-4 space-y-3">
    <header><p className="text-[10px] tracking-widest text-orange-300">TRAINING / EXPLICIT CSV ADAPTER</p><h2 className="mt-1 text-lg font-semibold text-zinc-100">{isBaseline ? 'Map numeric CSV as baseline B' : 'Map another numeric CSV'}</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">{MAPPING_SCOPE}</p></header>
    <p className="text-xs text-zinc-500">Comma-separated UTF-8, one unique header,2to10,000 data rows,3to64columns,1MiB. Quoted single-line cells and escaped quotes allowed; no multiline fields, ISO dates, binary flight logs, semicolon files, scaled coordinates, radians or battery voltage conversion. Extra columns are excluded. Required numeric time/coordinates cannot be missing. Optional blank cells stay unknown.</p>
    <label className="block text-xs text-zinc-300">Choose CSV for explicit mapping<input aria-label={isBaseline ? "Choose numeric CSV for baseline mapping" : "Choose CSV for mapping"} disabled={busy || workspaceBusy} type="file" accept=".csv,text/csv" onChange={read} className="mt-2 block w-full min-w-0 text-xs text-zinc-400" /></label>
    {source && <><p className="break-words text-xs text-zinc-400">{source.filename}: {source.rows.length} rows, {source.headers.length} columns. No automatic semantic detection.</p><MappingRecipe key={source.revision} headers={source.headers} mapping={mapping} onApply={changed} onPause={onPause} disabled={busy || workspaceBusy} /><form onSubmit={preview} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MAPPING_FIELDS.map(field => <label key={field.key} className="text-xs text-zinc-400">{field.label}{field.required ? ' (required)' : ' (optional)'}<select aria-label={`Map ${field.key}`} disabled={busy} className={input} value={mapping.columns[field.key] ?? ''} onChange={event => changed({ ...mapping, columns: { ...mapping.columns, [field.key]: event.target.value === '' ? null : Number(event.target.value) } })}><option value="">{field.required ? 'Choose source column' : 'Unmapped / unknown'}</option>{source.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header}</option>)}</select></label>)}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ['timeUnit', 'Input time unit', [['', 'Choose unit'], ['s', 'Seconds'], ['ms', 'Milliseconds']]],
        ['timeOrigin', 'Input time origin', [['', 'Choose origin'], ['zero', 'Already starts at zero'], ['subtract-first', 'Subtract first timestamp']]],
        ['altitudeUnit', 'Input altitude unit', [['m', 'Metres'], ['ft', 'Feet']]],
        ['speedUnit', 'Input ground speed unit', [['m/s', 'Metres per second'], ['km/h', 'Kilometres per hour']]],
      ].map(([key, label, options]) => <label key={key} className="text-xs text-zinc-400">{label}<select aria-label={label} disabled={busy} value={mapping[key]} onChange={event => changed({ ...mapping, [key]: event.target.value })} className={input}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}</div>
      <label className="flex gap-2 items-start text-xs text-zinc-400"><input type="checkbox" aria-label="Confirm WGS84 decimal-degree source coordinates" checked={Boolean(mapping.coordinateReference)} disabled={busy} onChange={event => changed({ ...mapping, coordinateReference: event.target.checked ? 'WGS84-decimal-degrees' : '' })} />I have checked that the selected source coordinates are WGS84 decimal degrees. SkyDash cannot verify their meaning, aircraft identity or altitude datum.</label>
      <p className="text-xs text-zinc-500">Battery is percentage0to100 only, never voltage or fraction. Feet x0.3048; km/h /3.6; milliseconds /1000. Subtract-first converts each timestamp to seconds then subtracts the first; absolute date/time is not retained. No timestamp sorting, duplicate removal or rounding. Existing replay range limits apply.</p><button type="submit" disabled={busy || workspaceBusy} className={button}>Preview mapped conversion</button>
    </form></>}
    {error && <p role="alert" className="text-xs text-amber-300">{error} Current replay source and review are unchanged.</p>}{message && <p role="status" className="text-xs text-orange-200">{message}</p>}
    {result && <section aria-label="Mapped conversion preview" className="rounded-lg border border-white/10 p-3 space-y-3"><h3 className="text-sm text-zinc-200">Validated numeric conversion / {result.samples.length} rows / {result.samples.at(-1).time_s}s</h3><p className="text-xs text-zinc-500 break-all">Original SHA-256 {result.original_sha256}<br />Converted SHA-256 {result.sha256}. Replay and case identity use converted bytes. Keep original CSV and this separate record for lineage.</p><div className="overflow-x-auto"><table className="w-full text-left text-[10px] text-zinc-300"><caption className="text-left text-zinc-500">First {Math.min(3, result.samples.length)} converted rows only. All rows checked. Scroll table horizontally on narrow screens.</caption><thead><tr>{MAPPING_FIELDS.map(field => <th className="p-2" key={field.key}>{field.key}</th>)}</tr></thead><tbody>{result.samples.slice(0, 3).map((sample, index) => <tr key={index}>{MAPPING_FIELDS.map(field => <td className="p-2" key={field.key}>{sample[field.key] === null ? 'unknown' : sample[field.key]}</td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap gap-2"><button className={button} onClick={() => download(false)}><Download size={14} />Download mapped CSV</button><button className={button} onClick={() => download(true)}><Download size={14} />Download conversion record</button><button disabled={workspaceBusy} className={button} onClick={() => { onPause(); setConfirm(true); }}>Review before opening mapped CSV</button></div>
      {confirm && <div className="rounded border border-amber-500/30 p-3 text-xs text-amber-300"><p>{isBaseline ? 'Use this converted CSV for baseline B? If a baseline already exists, a separate checked replacement preview still requires confirmation before comparison notes, anchors and derived panels are cleared. Primary A and its reviews/clock remain unchanged. Conversion source semantics remain unverified. No server record is created. Keep original source and conversion record separately.' : 'Replace the current primary source, analyst notes, instructor timeline, criteria and comparison with this converted CSV? Unsaved work will be discarded. Conversion source semantics remain unverified. No server record is created. Download current work first.'}</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={workspaceBusy} className={button} onClick={() => { onOpen(result); setConfirm(false); setMessage(isBaseline ? 'Mapped baseline submitted for checked opening. Inspect the baseline source/replacement preview. Primary reviews unchanged. Keep original source and conversion record separately; portable bundles contain only converted CSV.' : 'Mapped CSV opened locally at zero. Current reviews cleared. Original source and conversion record are not embedded in portable cases; keep them separately.'); }}>{isBaseline ? 'Use mapped CSV as baseline' : 'Confirm open mapped CSV'}</button><button className={button} onClick={() => setConfirm(false)}>{isBaseline ? 'Keep current baseline mapping' : 'Keep current replay'}</button></div></div>}
    </section>}
  </article>;
}
