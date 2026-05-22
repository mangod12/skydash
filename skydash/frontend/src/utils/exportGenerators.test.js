import { describe, it, expect } from 'vitest';
import { generateGeoJSON, generateKML, generateCSV } from './exportGenerators';

const ENTITIES = [
  {
    id: 'ent-001', type: 'vehicle', name: 'SUV-Black-4892',
    coordinates: [37.7780, -122.4160],
    properties: { plate: '4XBC892', color: 'Black' },
    confidence: 82, source: 'ALPHA-1 Camera',
    firstSeen: Date.now() - 3600000, lastSeen: Date.now() - 120000,
    tags: ['suspicious'], threatLevel: 'medium',
  },
  {
    id: 'ent-002', type: 'person', name: 'TANGO-7',
    coordinates: [37.7730, -122.4220],
    properties: { description: 'Male, dark jacket' },
    confidence: 65, source: 'CHARLIE-3 Camera',
    firstSeen: Date.now() - 1800000, lastSeen: Date.now() - 60000,
    tags: ['poi'], threatLevel: 'high',
  },
];

const RELATIONSHIPS = [
  { from: 'ent-001', to: 'ent-002', type: 'associated_with', confidence: 55 },
];

describe('generateGeoJSON', () => {
  it('returns valid FeatureCollection', () => {
    const raw = generateGeoJSON(ENTITIES);
    const json = JSON.parse(raw);
    expect(json.type).toBe('FeatureCollection');
    expect(json.features).toHaveLength(2);
  });

  it('each feature has correct geometry type', () => {
    const json = JSON.parse(generateGeoJSON(ENTITIES));
    json.features.forEach((f) => {
      expect(f.type).toBe('Feature');
      expect(f.geometry.type).toBe('Point');
      expect(f.geometry.coordinates).toHaveLength(2);
    });
  });

  it('swaps lat/lng to GeoJSON lon/lat order', () => {
    const json = JSON.parse(generateGeoJSON(ENTITIES));
    const coords = json.features[0].geometry.coordinates;
    // GeoJSON is [lng, lat] — entity coords are [lat, lng]
    expect(coords[0]).toBe(ENTITIES[0].coordinates[1]); // lng
    expect(coords[1]).toBe(ENTITIES[0].coordinates[0]); // lat
  });

  it('includes entity properties in feature properties', () => {
    const json = JSON.parse(generateGeoJSON(ENTITIES));
    const props = json.features[0].properties;
    expect(props.id).toBe('ent-001');
    expect(props.name).toBe('SUV-Black-4892');
    expect(props.threatLevel).toBe('medium');
  });

  it('returns empty FeatureCollection for empty input', () => {
    const json = JSON.parse(generateGeoJSON([]));
    expect(json.type).toBe('FeatureCollection');
    expect(json.features).toHaveLength(0);
  });
});

describe('generateKML', () => {
  it('returns valid XML with kml root element', () => {
    const kml = generateKML(ENTITIES);
    expect(kml).toContain('<?xml version="1.0"');
    expect(kml).toContain('<kml');
    expect(kml).toContain('</kml>');
  });

  it('contains Document and Folder elements', () => {
    const kml = generateKML(ENTITIES);
    expect(kml).toContain('<Document>');
    expect(kml).toContain('<Folder>');
  });

  it('contains Placemark elements for each entity', () => {
    const kml = generateKML(ENTITIES);
    expect(kml).toContain('<Placemark>');
    expect(kml).toContain('SUV-Black-4892');
    expect(kml).toContain('TANGO-7');
  });

  it('handles empty entities', () => {
    const kml = generateKML([]);
    expect(kml).toContain('<kml');
    expect(kml).toContain('</kml>');
  });
});

describe('generateCSV', () => {
  it('has correct header row', () => {
    const csv = generateCSV(ENTITIES, RELATIONSHIPS);
    const header = csv.split('\n')[0];
    expect(header).toContain('ID');
    expect(header).toContain('Name');
    expect(header).toContain('Type');
    expect(header).toContain('Threat');
    expect(header).toContain('Latitude');
    expect(header).toContain('Longitude');
  });

  it('has one data row per entity plus header', () => {
    const csv = generateCSV(ENTITIES, RELATIONSHIPS);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(ENTITIES.length + 1);
  });

  it('includes relationship data in rows', () => {
    const csv = generateCSV(ENTITIES, RELATIONSHIPS);
    // Entity ent-001 has relationship to ent-002
    expect(csv).toContain('ent-002(associated_with)');
  });

  it('handles empty input', () => {
    const csv = generateCSV([], []);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // header only
  });
});
