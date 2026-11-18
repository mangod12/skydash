import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { ArrowLeft, Download, Grid2X2 } from 'lucide-react';
import { DARK_BASEMAP } from '../../utils/basemap';
import { generateSearchGrid, searchGridGeoJSON, GRID_SCOPE } from '../../utils/searchGrid';
const inputStyle = 'mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200';
const buttonStyle = 'inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed';
const latLng = point => [point[1], point[0]];

function GridMapController({ plan, onCenter }) {
  const map = useMap();
  useMapEvents({ click: event => onCenter(event.latlng) });
  useEffect(() => { if (plan) map.fitBounds(plan.boundary.map(latLng), { padding: [30, 30], maxZoom: 17 }); }, [plan, map]);
  return null;
}

export default function SearchGridPlanner({ initialCenter = [37.1624, -122.1486], onBack }) {
  const [form, setForm] = useState(() => ({ latitude: String(initialCenter[0]), longitude: String(initialCenter[1]), widthM: '500', heightM: '400', spacingM: '100', speedMps: '8', orientation: 'east-west' }));
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const change = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setMessage(''); };
  const centerFromMap = ({ lat, lng }) => {
    setForm(previous => ({ ...previous, latitude: lat.toFixed(6), longitude: lng.toFixed(6) })); setDirty(true); setMessage('Center selected from map. Generate the grid to apply it.');
  };
  const generate = event => {
    event.preventDefault();
    try {
      const parameters = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key === 'orientation' ? value : value.trim() ? Number(value) : NaN]));
      const generated = generateSearchGrid(parameters);
      setPlan(generated); setDirty(false); setError(''); setMessage('Search sketch generated. Review the geometry and exclusions before exporting.');
    } catch (failure) { setError(failure.message); setDirty(true); setMessage(''); }
  };
  const download = () => {
    if (!plan || dirty) return;
    let url;
    try {
      const payload = searchGridGeoJSON(plan);
      url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/geo+json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `skydash-search-concept-${plan.generatedAt}.geojson`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('GeoJSON download requested. This sketch cannot be uploaded as an aircraft mission.');
    } catch { if (url) URL.revokeObjectURL(url); setError('Export could not start. Regenerate the sketch and retry.'); }
  };
  const field = (key, label, hint, min, max, step = 'any') => <label key={key} className="block text-xs text-zinc-400">{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={form[key]} onChange={event => change(key, event.target.value)} className={inputStyle} /><span className="mt-1 block text-[10px] text-zinc-500">{hint}</span></label>;

  return <section aria-label="Search grid planner" className="h-full overflow-y-auto bg-zinc-950 p-4">
    <div className="mx-auto max-w-7xl space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200"><ArrowLeft size={14} /> Back to Scenario Lab</button>
      <div><p className="text-[10px] font-semibold tracking-[0.18em] text-cyan-300">SEARCH & RESCUE / CONCEPT PLANNING</p><h1 className="mt-1 text-2xl font-semibold text-zinc-100">Search Grid Planner</h1><p className="mt-2 max-w-5xl text-xs leading-relaxed text-zinc-400">{GRID_SCOPE}</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={generate} noValidate className="rounded-xl border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">1. Define a search rectangle</h2>
          <p className="text-xs text-zinc-500">Click the map to set the center, or enter coordinates. This draft is kept only while this screen stays open.</p>
          <div className="grid grid-cols-2 gap-3">{field('latitude', 'Center latitude', '75°S to 75°N', -75, 75)}{field('longitude', 'Center longitude', '180°W to 180°E', -180, 180)}{field('widthM', 'East-west width (m)', '50 to 5,000m', 50, 5000)}{field('heightM', 'North-south height (m)', '50 to 5,000m', 50, 5000)}{field('spacingM', 'Maximum lane spacing (m)', '10 to 1,000m; at most200 lanes', 10, 1000)}{field('speedMps', 'Sketch speed (m/s)', '1 to 30m/s; excludes turns', 1, 30)}</div>
          <label className="block text-xs text-zinc-400">Sweep direction<select aria-label="Sweep direction" value={form.orientation} onChange={event => change('orientation', event.target.value)} className={inputStyle}><option value="east-west">East-west legs</option><option value="north-south">North-south legs</option></select></label>
          <button type="submit" className={buttonStyle}><Grid2X2 size={14} /> Generate search grid</button>
          {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
          {message && <p role="status" className="text-xs leading-relaxed text-cyan-200">{message}</p>}
        </form>
        <div className="min-w-0 lg:col-span-2 space-y-3">
          <div className="relative h-[400px] overflow-hidden rounded-xl border border-white/10" aria-label="Search area map preview">
            <MapContainer center={initialCenter} zoom={14} className="h-full w-full" style={{ background: '#09090b' }}>
              <TileLayer url={DARK_BASEMAP.url} attribution={DARK_BASEMAP.attribution} className={DARK_BASEMAP.className} maxZoom={DARK_BASEMAP.maxZoom} maxNativeZoom={DARK_BASEMAP.maxNativeZoom} />
              <GridMapController plan={plan} onCenter={centerFromMap} />
              {plan && <><Polygon positions={plan.boundary.map(latLng)} pathOptions={{ color: '#818cf8', fillOpacity: 0.06, weight: 2 }} />
                <Polyline positions={plan.route.map(latLng)} pathOptions={{ color: '#64748b', weight: 2, dashArray: '5 5' }} />
                {plan.lanes.map((lane, index) => <Polyline key={index} positions={lane.map(latLng)} pathOptions={{ color: '#22d3ee', weight: 3 }}><Tooltip>Search leg {index + 1}</Tooltip></Polyline>)}
                <CircleMarker center={latLng(plan.route[0])} radius={7} pathOptions={{ color: '#34d399', fillOpacity: 1 }}><Tooltip permanent direction="top">START</Tooltip></CircleMarker>
                <CircleMarker center={latLng(plan.route.at(-1))} radius={7} pathOptions={{ color: '#fb923c', fillOpacity: 1 }}><Tooltip permanent direction="bottom">END</Tooltip></CircleMarker></>}
            </MapContainer>
          </div>
          <p className="text-[11px] text-zinc-500">Cyan: search legs. Dashed grey: straight connectors. Purple: concept AO boundary. No obstacle clearance or sensor-footprint model. Basemap is not aviation data.</p>
          {dirty && plan && <p role="alert" className="rounded-lg border border-amber-500/25 p-3 text-xs text-amber-300">Inputs changed. Preview and metrics still show the last generated sketch. Regenerate before export.</p>}
          {plan ? <article aria-label="Generated search grid summary" className="rounded-xl border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200">2. Review and export the concept</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Search legs', plan.laneCount], ['Actual spacing', `${plan.actualSpacingM.toFixed(1)}m`], ['Route length', `${(plan.distanceM / 1000).toFixed(2)}km`], ['Straight-line time', `${(plan.straightLineSeconds / 60).toFixed(1)}min`]].map(([label, value]) => <div key={label}><p className="text-[10px] text-zinc-500">{label}</p><p className="mt-1 text-lg font-mono text-cyan-200">{value}</p></div>)}</div>
            <p className="text-xs text-zinc-400">Nominal rectangle: {(plan.areaM2 / 1000000).toFixed(3)}km². Spacing is evenly reduced to include both rectangle edges; it is not a claim of complete search coverage.</p>
            <p className="text-[11px] text-zinc-500">Generated {new Date(plan.generatedAt).toISOString()}. Local equirectangular geometry, bounded to5km and75°latitude. GeoJSON uses longitude, latitude. No altitude or aircraft commands are exported.</p>
            <button type="button" disabled={dirty} onClick={download} className={buttonStyle}><Download size={14} /> Export concept GeoJSON</button>
          </article> : <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">Generate a grid to preview ordered legs, spacing, distance and a portable GeoJSON sketch.</div>}
        </div>
      </div>
    </div>
  </section>;
}
