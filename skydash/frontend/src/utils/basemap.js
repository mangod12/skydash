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
