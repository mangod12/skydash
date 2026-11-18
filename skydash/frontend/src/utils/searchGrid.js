import { distanceBetween, isValidCoordinate } from './coordinates';

export const GRID_SCOPE = 'CONCEPT / SIMULATION ONLY. This is a geometric search sketch, not an executable aircraft mission or flight authorization. It does not check terrain, obstacles, restricted airspace, weather, aircraft performance or sensor coverage. Distance and travel time omit turns, climb, transit, wind and reserves. Independent planning and authorization are required.';
const R = 6371000;
const rad = degrees => degrees * Math.PI / 180;
const deg = radians => radians * 180 / Math.PI;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fields = ['latitude', 'longitude', 'widthM', 'heightM', 'spacingM', 'speedMps'];

export function generateSearchGrid(input, now = Date.now()) {
  if (!input || fields.some(key => !finite(input[key]))) throw new Error('Enter a finite number in every planning field.');
  const { latitude, longitude, widthM, heightM, spacingM, speedMps, orientation } = input;
  if (!isValidCoordinate(latitude, longitude) || Math.abs(latitude) > 75) throw new Error('Center must be valid and between 75°S and 75°N.');
  if (widthM < 50 || widthM > 5000 || heightM < 50 || heightM > 5000) throw new Error('Area width and height must each be 50 to 5,000m.');
  if (spacingM < 10 || spacingM > 1000) throw new Error('Lane spacing must be 10 to 1,000m.');
  if (speedMps < 1 || speedMps > 30) throw new Error('Sketch speed must be 1 to 30m/s.');
  if (!['east-west', 'north-south'].includes(orientation)) throw new Error('Choose an east-west or north-south sweep.');
  if (!finite(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) throw new Error('Invalid plan timestamp.');
  const coordinate = (east, north) => {
    // Local equirectangular approximation bounded to a 5km AO away from poles/dateline.
    const point = [longitude + deg(east / (R * Math.cos(rad(latitude)))), latitude + deg(north / R)];
    if (!isValidCoordinate(point[1], point[0])) throw new Error('Area crosses the dateline or geographic bounds. Choose another center.');
    return point;
  };
  const boundary = [[-widthM / 2, -heightM / 2], [widthM / 2, -heightM / 2], [widthM / 2, heightM / 2], [-widthM / 2, heightM / 2], [-widthM / 2, -heightM / 2]].map(([east, north]) => coordinate(east, north));
  const crossTrack = orientation === 'east-west' ? heightM : widthM;
  const intervals = Math.max(1, Math.ceil(crossTrack / spacingM));
  if (intervals + 1 > 200) throw new Error('More than 200 lanes. Increase spacing or reduce the area.');
  const actualSpacingM = crossTrack / intervals;
  const lanes = Array.from({ length: intervals + 1 }, (_, index) => {
    const cross = -crossTrack / 2 + index * actualSpacingM;
    const endpoints = orientation === 'east-west'
      ? [[-widthM / 2, cross], [widthM / 2, cross]]
      : [[cross, -heightM / 2], [cross, heightM / 2]];
    return (index % 2 ? endpoints.reverse() : endpoints).map(([east, north]) => coordinate(east, north));
  });
  const route = lanes.flat();
  let distanceM = 0;
  for (let i = 1; i < route.length; i += 1) distanceM += distanceBetween(route[i - 1][1], route[i - 1][0], route[i][1], route[i][0]);
  return { version: 1, generatedAt: now, parameters: { latitude, longitude, widthM, heightM, spacingM, speedMps, orientation }, boundary, lanes, route, laneCount: lanes.length,
    actualSpacingM, distanceM, straightLineSeconds: distanceM / speedMps, areaM2: widthM * heightM, scope: GRID_SCOPE };
}

export function searchGridGeoJSON(plan) {
  // Rebuild from validated parameters. Never trust manually altered geometry on export.
  const checked = generateSearchGrid(plan.parameters, plan.generatedAt);
  return { type: 'FeatureCollection', name: 'SkyDash search grid concept',
    properties: { scope: GRID_SCOPE, generatedAt: new Date(checked.generatedAt).toISOString(), coordinateOrder: 'longitude, latitude', geometryModel: 'Local equirectangular approximation; at most5km and within75degrees latitude',
      ...checked.parameters, laneCount: checked.laneCount, actualSpacingM: checked.actualSpacingM, routeDistanceM: checked.distanceM, straightLineSeconds: checked.straightLineSeconds },
    features: [
      { type: 'Feature', properties: { kind: 'search-area', areaM2: checked.areaM2 }, geometry: { type: 'Polygon', coordinates: [checked.boundary] } },
      ...checked.lanes.map((coordinates, index) => ({ type: 'Feature', properties: { kind: 'search-lane', sequence: index + 1 }, geometry: { type: 'LineString', coordinates } })),
      { type: 'Feature', properties: { kind: 'concept-route', executable: false, includes: 'Search legs and straight connectors only' }, geometry: { type: 'LineString', coordinates: checked.route } },
    ],
  };
}
