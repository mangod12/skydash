import { describe, it, expect } from 'vitest';
import { parseQuery } from './nlqParser';

const ENTITIES = [
  { id: '1', type: 'vehicle', name: 'SUV-4892', confidence: 82, threatLevel: 'medium', tags: ['suspicious'], properties: { plate: '4XBC892' }, lastSeen: Date.now() },
  { id: '2', type: 'person', name: 'TANGO-7', confidence: 65, threatLevel: 'high', tags: ['poi'], properties: {}, lastSeen: Date.now() },
  { id: '3', type: 'building', name: 'Compound ECHO', confidence: 95, threatLevel: 'critical', tags: ['restricted'], properties: {}, lastSeen: Date.now() },
  { id: '4', type: 'device', name: 'RF-Signal', confidence: 45, threatLevel: 'low', tags: [], properties: {}, lastSeen: Date.now() },
  { id: '5', type: 'person', name: 'FOXTROT-3', confidence: 30, threatLevel: 'none', tags: [], properties: {}, lastSeen: Date.now() - 7200000 },
];

describe('parseQuery', () => {
  it('returns all entities for empty query', () => {
    expect(parseQuery('', ENTITIES)).toHaveLength(5);
    expect(parseQuery('   ', ENTITIES)).toHaveLength(5);
  });

  // Type filters
  it('filters by type: vehicles', () => {
    const results = parseQuery('vehicles', ENTITIES);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('vehicle');
  });

  it('filters by type: people', () => {
    const results = parseQuery('people', ENTITIES);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.type).toBe('person'));
  });

  it('filters by type: building keywords', () => {
    expect(parseQuery('warehouse', ENTITIES)).toHaveLength(1);
    expect(parseQuery('building', ENTITIES)).toHaveLength(1);
  });

  it('filters by type: device keywords', () => {
    expect(parseQuery('rf', ENTITIES)).toHaveLength(1);
    expect(parseQuery('electronic', ENTITIES)).toHaveLength(1);
  });

  // Threat filters
  it('filters high threat', () => {
    const results = parseQuery('high threat', ENTITIES);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(['high', 'critical']).toContain(r.threatLevel));
  });

  it('filters critical', () => {
    const results = parseQuery('critical', ENTITIES);
    expect(results).toHaveLength(2); // high + critical
  });

  it('filters low threat', () => {
    const results = parseQuery('low threat', ENTITIES);
    expect(results).toHaveLength(2); // low + none
  });

  it('filters suspicious', () => {
    const results = parseQuery('suspicious', ENTITIES);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('SUV-4892');
  });

  // Confidence filters
  it('filters high confidence (>=80)', () => {
    const results = parseQuery('high confidence', ENTITIES);
    expect(results.every((r) => r.confidence >= 80)).toBe(true);
  });

  it('filters low confidence (<60)', () => {
    const results = parseQuery('uncertain', ENTITIES);
    expect(results.every((r) => r.confidence < 60)).toBe(true);
  });

  // Name search
  it('searches by name', () => {
    const results = parseQuery('TANGO', ENTITIES);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('TANGO-7');
  });

  it('searches by property value', () => {
    const results = parseQuery('4XBC892', ENTITIES);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('SUV-4892');
  });

  // Case insensitive
  it('is case insensitive', () => {
    expect(parseQuery('VEHICLES', ENTITIES)).toHaveLength(1);
    expect(parseQuery('High Threat', ENTITIES)).toHaveLength(2);
  });
});
