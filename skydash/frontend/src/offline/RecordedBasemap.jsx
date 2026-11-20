export function RecordedBasemapControl({ label }) {
  return <section aria-label={`${label} basemap privacy`} className="rounded-lg border border-amber-500/25 p-3 text-xs text-amber-200"><h3 className="font-semibold">Background tiles unavailable in standalone recorded review</h3><p>Exact source tracks and markers use a blank local map. No tile provider, live fleet or external map permission is configured by this build. Source coordinates remain sensitive. This is not a certified air-gap boundary; browser extensions, external links and system traffic remain outside the app.</p></section>;
}
export default function RecordedBasemapLayer() { return null; }
