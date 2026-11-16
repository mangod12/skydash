import { describe, it, expect } from 'vitest';
import { evaluateRule } from './alertEvaluator';

const drone = (extra = {}) => ({ drone_id: 'D1', ...extra });
const rule = (type, config = {}) => ({ type, config });

describe('evaluateRule', () => {
  it('ignores unknown rule types', () => {
    expect(evaluateRule(rule('nope'), drone(), [], [])).toEqual({ triggered: false });
  });

  describe('battery_low', () => {
    it('triggers below the threshold', () => {
      const r = evaluateRule(rule('battery_low', { threshold: 30 }), drone({ battery_percentage: 20 }), [], []);
      expect(r.triggered).toBe(true);
      expect(r.message).toContain('20%');
    });
    it('does not trigger at or above the threshold', () => {
      expect(evaluateRule(rule('battery_low', { threshold: 30 }), drone({ battery_percentage: 30 }), [], []).triggered).toBe(false);
    });
    it('does not raise a false alarm when battery data is missing', () => {
      expect(evaluateRule(rule('battery_low', { threshold: 30 }), drone(), [], []).triggered).toBe(false);
    });
  });

  describe('signal_weak', () => {
    it('triggers below the threshold and not when missing', () => {
      expect(evaluateRule(rule('signal_weak', { threshold: 50 }), drone({ signal_strength: 40 }), [], []).triggered).toBe(true);
      expect(evaluateRule(rule('signal_weak', { threshold: 50 }), drone(), [], []).triggered).toBe(false);
    });
  });

  describe('altitude and speed limits', () => {
    it('triggers only above the altitude limit', () => {
      const cfg = { maxAlt: 120 };
      expect(evaluateRule(rule('altitude_limit', cfg), drone({ altitude: 121 }), [], []).triggered).toBe(true);
      expect(evaluateRule(rule('altitude_limit', cfg), drone({ altitude: 120 }), [], []).triggered).toBe(false);
    });
    it('triggers only above the speed limit', () => {
      const cfg = { maxSpeed: 15 };
      expect(evaluateRule(rule('speed_limit', cfg), drone({ ground_speed: 15.5 }), [], []).triggered).toBe(true);
      expect(evaluateRule(rule('speed_limit', cfg), drone({ ground_speed: 15 }), [], []).triggered).toBe(false);
    });
  });

  describe('geofence_breach', () => {
    const fence = { id: 'f1', type: 'circle', center: { lat: 10, lng: 10 }, radius: 500 };
    it('triggers outside the fence', () => {
      const d = drone({ gps: { latitude: 10.1, longitude: 10 } });
      expect(evaluateRule(rule('geofence_breach'), d, [fence], []).triggered).toBe(true);
    });
    it('does not trigger inside the fence', () => {
      const d = drone({ gps: { latitude: 10, longitude: 10 } });
      expect(evaluateRule(rule('geofence_breach'), d, [fence], []).triggered).toBe(false);
    });
    it('respects a specific geofenceId and skips non-circle fences', () => {
      const d = drone({ gps: { latitude: 10.1, longitude: 10 } });
      expect(evaluateRule(rule('geofence_breach', { geofenceId: 'other' }), d, [fence], []).triggered).toBe(false);
      expect(evaluateRule(rule('geofence_breach'), d, [{ id: 'p', type: 'polygon' }], []).triggered).toBe(false);
    });
    it('does not trigger without a GPS fix', () => {
      expect(evaluateRule(rule('geofence_breach'), drone(), [fence], []).triggered).toBe(false);
    });
  });

  describe('proximity', () => {
    const entities = [{ id: 'e1', name: 'Target', coordinates: [10, 10] }];
    it('triggers within the radius', () => {
      const d = drone({ gps: { latitude: 10, longitude: 10.001 } });
      const r = evaluateRule(rule('proximity', { entityId: 'e1', radiusM: 500 }), d, [], entities);
      expect(r.triggered).toBe(true);
      expect(r.message).toContain('Target');
    });
    it('does not trigger far away or for unknown entities', () => {
      const d = drone({ gps: { latitude: 11, longitude: 11 } });
      expect(evaluateRule(rule('proximity', { entityId: 'e1' }), d, [], entities).triggered).toBe(false);
      expect(evaluateRule(rule('proximity', { entityId: 'zzz' }), d, [], entities).triggered).toBe(false);
    });
  });
});
