import { TileLayer } from 'react-leaflet';
import { DARK_BASEMAP } from '../../utils/basemap';
export function RecordedBasemapControl({ enabled, onChange, label }) {
  return <section aria-label={`${label} basemap privacy`} className="rounded-lg border border-amber-500/25 p-3 space-y-2">
    <h3 className="text-sm text-amber-200">Background tile requests off by default</h3>
    <p className="text-xs text-zinc-400">Recorded track lines and sample markers work on a blank map without tile requests from this map. Optional background tiles disclose the viewed area and connection details to the configured tile provider (external by default). Do not enable for sensitive locations unless your deployment policy allows it. This controls only this recorded-review map, not other SkyDash network traffic, live maps, archive requests or browser extensions. It is not an offline or air-gapped mode.</p>
    <label className="flex items-start gap-2 text-xs text-zinc-300"><input type="checkbox" aria-label={`Allow external basemap for ${label}`} checked={enabled} onChange={event => onChange(event.target.checked)} />For this source view, request configured background map tiles. I understand this discloses the viewed area.</label>
    <p role="status" className="text-xs text-amber-200">{enabled ? 'Configured background tiles enabled for this map. Turning off stops new layer requests; it cannot recall requests already made or remove provider/browser caches.' : 'Background tiles off for this map. Blank background is intentional, not missing telemetry. Coordinates and source track remain visible.'}</p>
  </section>;
}
export default function RecordedBasemapLayer({ enabled }) {
  return enabled ? <TileLayer url={DARK_BASEMAP.url} attribution={DARK_BASEMAP.attribution} className={DARK_BASEMAP.className} maxZoom={DARK_BASEMAP.maxZoom} maxNativeZoom={DARK_BASEMAP.maxNativeZoom} /> : null;
}
