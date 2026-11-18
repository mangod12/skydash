import { describe, it, expect } from 'vitest';
import { assessMissionReadiness, formatReadinessReport } from './missionReadiness';
const now = 1800000000000;
const fixture = () => ({ now,
  mission: { id: 'm1', name: 'Training perimeter', status: 'active', description: 'Observe the test area.', center_lat: 0, center_lng: 0, entityIds: ['e1'] },
  entities: [{ id: 'e1' }],
  telemetry: { data: { drone_id: 'd1', gps: { latitude: 0, longitude: 0 }, battery_percentage: 80, signal_strength: 90 }, activeDroneId: 'd1', isConnected: true, dataReceivedAt: now },
  connectors: { state: 'loaded', checkedAt: now, data: { opensky: { available: true }, shodan: { available: true, mode: 'live' } } },
});
const check = (input, id) => assessMissionReadiness(input).checks.find(item => item.id === id);

describe('training mission readiness evidence', () => {
  it('passes complete training evidence, preserving zero coordinates and explicit limits', () => {
    const report = assessMissionReadiness(fixture());
    expect(report.counts).toEqual({ pass: 9, warn: 0, unknown: 0 });
    expect(report.result).toBe('Training checks complete');
    expect(report.scope).toContain('not clearance to fly');
    expect(check(fixture(), 'connectors').evidence).toContain('not proof of live feed');
  });
  it('handles entirely missing evidence without fabricating telemetry', () => {
    const report = assessMissionReadiness({ now });
    expect(report.counts.unknown).toBe(6);
    expect(report.result).toBe('Review required');
    expect(report.droneId).toBeNull();
  });
  it.each([null, '', false, NaN, Infinity, -1, 101, '90'])('rejects invalid percentage %s', value => {
    const input = fixture();
    input.telemetry.data.battery_percentage = value;
    input.telemetry.data.signal_strength = value;
    expect(check(input, 'battery').state).toBe('unknown');
    expect(check(input, 'signal').state).toBe('unknown');
  });
  it('uses explicit inclusive training boundaries and warns on real zero', () => {
    const input = fixture();
    input.telemetry.data.battery_percentage = 20;
    input.telemetry.data.signal_strength = 50;
    expect(check(input, 'battery').state).toBe('pass');
    expect(check(input, 'signal').state).toBe('pass');
    input.telemetry.data.battery_percentage = 0;
    input.telemetry.data.signal_strength = 0;
    expect(check(input, 'battery').state).toBe('warn');
    expect(check(input, 'signal').state).toBe('warn');
  });
  it.each([5001, -1, Infinity, null, '0'])('does not pass stale, future or malformed receipt age %s', age => {
    const input = fixture();
    input.telemetry.dataReceivedAt = typeof age === 'number' ? now - age : age;
    input.telemetry.lastUpdate = now;
    for (const id of ['freshness', 'position', 'battery', 'signal']) expect(check(input, id).state).toBe('unknown');
  });
  it('permits the five-second boundary only while connected and selected identity matches', () => {
    const input = fixture();
    input.telemetry.dataReceivedAt = now - 5000;
    expect(check(input, 'freshness').state).toBe('pass');
    input.telemetry.activeDroneId = 'other';
    expect(check(input, 'freshness').state).toBe('unknown');
    input.telemetry.activeDroneId = 'd1';
    input.telemetry.isConnected = false;
    expect(check(input, 'freshness').state).toBe('unknown');
  });
  it('rejects partial, out-of-range and coerced positions', () => {
    for (const gps of [{ latitude: 0 }, { latitude: true, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) {
      const input = fixture(); input.telemetry.data.gps = gps;
      expect(check(input, 'position').state).toBe('unknown');
    }
  });
  it('never derives battery capacity from voltage', () => {
    const input = fixture(); delete input.telemetry.data.battery_percentage;
    input.telemetry.data.battery_voltage = 16.8;
    expect(check(input, 'battery').state).toBe('unknown');
  });
  it('warns for missing objective, inactive mission, absent area and unresolved linked entities', () => {
    const input = fixture(); Object.assign(input.mission, { description: ' ', status: 'closed', center_lat: null, entityIds: ['e1', 'missing'] });
    for (const id of ['objective', 'status', 'area', 'entities']) expect(check(input, id).state).toBe('warn');
    input.mission.entityIds = [];
    expect(check(input, 'entities').state).toBe('warn');
  });
  it('deduplicates entity links and distinguishes unloaded details', () => {
    const input = fixture(); input.mission.entityIds = ['e1', 'e1'];
    expect(check(input, 'entities').evidence).toContain('1/1');
    delete input.mission.entityIds;
    expect(check(input, 'entities').state).toBe('unknown');
  });
  it('never interprets missing, expired or mock connector status as verified feeds', () => {
    const input = fixture();
    for (const connectors of [{ state: 'error' }, { state: 'loading' }, { state: 'loaded', checkedAt: now, data: {} }, { ...input.connectors, checkedAt: now - 60001 }, { ...input.connectors, checkedAt: now + 1 }]) {
      expect(check({ ...input, connectors }, 'connectors').state).toBe('unknown');
    }
    input.connectors.data.shodan = { available: false, mode: 'mock' };
    expect(check(input, 'connectors').state).toBe('warn');
    expect(check(input, 'connectors').evidence).toContain('mock');
  });
  it('exports a fixed timestamp, mission identity, evidence, actions and simulation disclaimer', () => {
    const input = fixture(); input.telemetry.data.battery_percentage = 10;
    const report = assessMissionReadiness(input);
    const output = formatReadinessReport(report);
    expect(output).toContain(new Date(now).toISOString());
    expect(output).toContain('Training perimeter (m1)');
    expect(output).toContain('[WARN] Battery training threshold');
    expect(output).toContain('Next: Verify the aircraft-specific');
    expect(output).toContain('Snapshot only');
    expect(output).toContain('not clearance to fly');
    input.mission.name = 'Changed';
    expect(formatReadinessReport(report)).toBe(output);
  });
});
