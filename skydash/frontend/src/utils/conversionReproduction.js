import { readMappingCSV, convertMappedCSV, MAPPING_VERSION } from './csvColumnMapping';
import { parseMappingRecipe, applyMappingRecipe, MAPPING_RECIPE_VERSION } from './mappingRecipe';
export async function reproduceCSVConversion(originalText, recipeText, convertedBytes, { confirmedWGS84 = false } = {}) {
  if (confirmedWGS84 !== true) throw Error('Fresh source-coordinate confirmation required.');
  const source = readMappingCSV(originalText), checked = parseMappingRecipe(recipeText, source.headers), mapping = applyMappingRecipe(checked, source.headers);
  // A recipe never supplies this caller statement, nor independently verifies coordinates.
  mapping.coordinateReference = 'WGS84-decimal-degrees';
  const result = await convertMappedCSV(originalText, 'source.csv', mapping), expected = new TextEncoder().encode(result.csv_text);
  if (!(convertedBytes instanceof Uint8Array) || convertedBytes.length !== expected.length || expected.some((byte, index) => byte !== convertedBytes[index])) throw Error('Converted bytes do not exactly reproduce.');
  return { exact_converted_bytes_reproduced: true, conversion_model: MAPPING_VERSION, recipe_format: MAPPING_RECIPE_VERSION, replay_model: result.model_version, source_coordinate_confirmation_supplied: true, converted_samples: result.samples.length };
}
