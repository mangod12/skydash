// Key-less basemap. Carto's dark_all endpoint now returns an "API KEY REQUIRED"
// watermark tile, so use OpenStreetMap standard tiles and darken them with CSS
// (see .basemap-dark in index.css). OSM tile policy: attribution required, light use.
export const DARK_BASEMAP = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  maxNativeZoom: 19,
  className: 'basemap-dark',
};

// Satellite imagery: Esri World Imagery through the ArcGIS basemap tile service.
// Needs a basemap-scoped API key (restricted to our origins) in VITE_ESRI_API_KEY.
// Without a key the satellite toggle falls back to the standard basemap.
const ESRI_KEY = import.meta.env.VITE_ESRI_API_KEY;

export function buildSatelliteBasemap(key = ESRI_KEY) {
  if (!key) return DARK_BASEMAP;
  return {
    url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(key)}`,
    attribution: 'Powered by <a href="https://www.esri.com">Esri</a> | Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
    maxNativeZoom: 19,
  };
}

export const SATELLITE_BASEMAP = buildSatelliteBasemap();
