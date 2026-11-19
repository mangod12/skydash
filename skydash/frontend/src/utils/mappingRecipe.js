import { LOG_VERSION } from './flightLog';
import { MAPPING_VERSION, validateColumnMapping } from './csvColumnMapping';
export const MAPPING_RECIPE_VERSION = 'skydash-csv-mapping-recipe-v1';
export const MAX_RECIPE_BYTES = 65536;
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const configKeys = ['columns', 'timeUnit', 'timeOrigin', 'altitudeUnit', 'speedUnit'];
function validateRecipe(value) {
  if (!keys(value, ['format', 'conversion_model', 'replay_model', 'label', 'headers', 'configuration']) || value.format !== MAPPING_RECIPE_VERSION || value.conversion_model !== MAPPING_VERSION || value.replay_model !== LOG_VERSION) throw new Error('Unsupported mapping recipe fields or model.');
  if (typeof value.label !== 'string' || !value.label.trim() || value.label.length > 120) throw new Error('Recipe label must be 1 to 120 characters.');
  if (!Array.isArray(value.headers) || value.headers.length < 3 || value.headers.length > 64 || value.headers.some(header => typeof header !== 'string' || !header.trim() || header !== header.trim() || header.length > 120) || new Set(value.headers).size !== value.headers.length) throw new Error('Invalid recipe headers.');
  if (!keys(value.configuration, configKeys)) throw new Error('Unsupported recipe configuration fields. Coordinate confirmation cannot be imported.');
  validateColumnMapping({ headers: value.headers }, { ...value.configuration, coordinateReference: 'WGS84-decimal-degrees' });
  return value;
}
export function exportMappingRecipe(headers, mapping, label) {
  validateColumnMapping({ headers }, mapping);
  const configuration = Object.fromEntries(configKeys.map(key => [key, key === 'columns' ? { ...mapping.columns } : mapping[key]]));
  const recipe = validateRecipe({ format: MAPPING_RECIPE_VERSION, conversion_model: MAPPING_VERSION, replay_model: LOG_VERSION, label: label.trim(), headers: [...headers], configuration });
  const text = JSON.stringify(recipe, null, 2);
  if (new Blob([text]).size > MAX_RECIPE_BYTES) throw new Error('Mapping recipe exceeds 64KiB.');
  return text;
}
export function parseMappingRecipe(text, headers) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_RECIPE_BYTES) throw new Error('Mapping recipe must be at most 64KiB.');
  let value; try { value = JSON.parse(text); } catch { throw new Error('Mapping recipe is not valid JSON.'); }
  const recipe = validateRecipe(value);
  if (JSON.stringify(recipe.headers) !== JSON.stringify(headers)) throw new Error('Recipe headers must exactly match the loaded CSV header names and order. No automatic remapping or unit detection.');
  return recipe;
}
export function applyMappingRecipe(recipe, headers) {
  const checked = parseMappingRecipe(JSON.stringify(recipe), headers);
  return { ...checked.configuration, columns: { ...checked.configuration.columns }, coordinateReference: '' };
}
