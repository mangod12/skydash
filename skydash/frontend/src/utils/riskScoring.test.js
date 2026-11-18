import { afterEach, describe, it, expect, vi } from 'vitest';
import { calculateRiskScore, getRiskLevel, getRiskColor, scoreAllEntities } from './riskScoring';

const base = { id: 'e1', threatLevel: 'high', confidence: 100, coordinates: [37.0, -122.0] };
const now = () => Date.now();

describe('calculateRiskScore', () => {
  afterEach(() => vi.useRealTimers());
  it('excludes future, invalid, and expired timestamps from activity and escalation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T04:00:00Z'));
    const time = Date.now();
    const events = [time + 1, time + 3600000, String(time - 1), Infinity, NaN, null, true, time - 86400000 - 1]
      .map(time => ({ entityId: 'e1', time, severity: 'critical' }));
    const result = calculateRiskScore(base, [], events);
    expect(result.breakdown.activityBonus).toBe(0);
    expect(result.breakdown.escalationBonus).toBe(0);
    expect(result.score).toBe(60);
  });
  it('uses one inclusive 24-hour window for both bonuses and tolerates invalid rows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T04:00:00Z'));
    const time = Date.now();
    const events = [null, undefined, {}, { entityId: 'e1', time, severity: 'critical' },
      { entityId: 'e1', time: time - 86400000, severity: 'warning' }];
    const result = calculateRiskScore(base, [], events);
    expect(result.breakdown.activityBonus).toBe(6);
    expect(result.breakdown.escalationBonus).toBe(15);
    expect(result.score).toBe(81);
  });
  it.each([NaN, Infinity, -1, 101, '100', true, false, {}])('uses the existing unknown-confidence default for invalid input %j', confidence => {
    const result = calculateRiskScore({ ...base, confidence }, [], []);
    expect(result.breakdown.confidenceMultiplier).toBe(0.5);
    expect(result.score).toBe(30);
  });
  it.each(['constructor', '__proto__', 'toString'])('does not inherit a base threat from the object prototype: %s', threatLevel => {
    const result = calculateRiskScore({ ...base, threatLevel }, [], []);
    expect(result.breakdown.baseThreat).toBe(0);
    expect(result.score).toBe(0);
  });
  it.each([0, 25, 100])('preserves valid numeric confidence %s', confidence => {
    const result = calculateRiskScore({ ...base, confidence }, [], []);
    expect(result.breakdown.confidenceMultiplier).toBe(confidence / 100);
    expect(result.score).toBe(Math.round(60 * confidence / 100));
  });
  it('uses the base threat when nothing else applies', () => {
    expect(calculateRiskScore(base, [], []).score).toBe(60);
  });

  it('scales by confidence and defaults it to 50', () => {
    const { confidence, ...noConf } = base;
    expect(confidence).toBe(100);
    expect(calculateRiskScore(noConf, [], []).score).toBe(30);
  });

  it('adds 5 per relationship, capped at 20', () => {
    const rel = (n) => Array.from({ length: n }, (_, i) => ({ from: 'e1', to: `x${i}` }));
    expect(calculateRiskScore(base, rel(2), []).score).toBe(70);
    expect(calculateRiskScore(base, rel(9), []).breakdown.relBonus).toBe(20);
  });

  it('counts relationships in either direction', () => {
    const rels = [{ from: 'x', to: 'e1' }, { from: 'e1', to: 'y' }, { from: 'a', to: 'b' }];
    expect(calculateRiskScore(base, rels, []).breakdown.relBonus).toBe(10);
  });

  it('counts only events from the last 24 hours', () => {
    const events = [
      { entityId: 'e1', time: now() - 1000 },
      { entityId: 'e1', time: now() - 48 * 3600 * 1000 },
      { entityId: 'other', time: now() - 1000 },
    ];
    expect(calculateRiskScore(base, [], events).breakdown.activityBonus).toBe(3);
  });

  it('adds an escalation bonus after two recent warning or critical events', () => {
    const events = [
      { entityId: 'e1', time: now() - 1000, severity: 'critical' },
      { entityId: 'e1', time: now() - 2000, severity: 'warning' },
    ];
    const { score, breakdown } = calculateRiskScore(base, [], events);
    expect(breakdown.escalationBonus).toBe(15);
    expect(score).toBe(60 + 6 + 15);
  });

  it('adds a proximity bonus near a critical entity but not a far one', () => {
    const near = { id: 'c1', threatLevel: 'critical', coordinates: [37.001, -122.0] };
    const far = { id: 'c2', threatLevel: 'critical', coordinates: [38.0, -122.0] };
    expect(calculateRiskScore(base, [], [], [base, near]).breakdown.proximityBonus).toBe(10);
    expect(calculateRiskScore(base, [], [], [base, far]).breakdown.proximityBonus).toBe(0);
  });

  it.each([[null, 0], [0, null], ['0', 0], [false, 0], [NaN, 0], [Infinity, 0], [91, 0], [0, 181], {}, '00'].map((coords) => [coords]))(
    'does not infer proximity from invalid coordinates %j', (coordinates) => {
      const origin = { ...base, coordinates: [0, 0] };
      const critical = { id: 'c1', threatLevel: 'critical', coordinates };
      expect(calculateRiskScore(origin, [], [], [critical]).breakdown.proximityBonus).toBe(0);
      expect(calculateRiskScore({ ...origin, coordinates }, [], [], [{ ...critical, coordinates: [0, 0] }]).breakdown.proximityBonus).toBe(0);
    },
  );

  it('keeps genuine zero and boundary coordinates eligible for proximity', () => {
    for (const coordinates of [[0, 0], [90, 180], [-90, -180]]) {
      expect(calculateRiskScore({ ...base, coordinates }, [], [], [
        { id: 'c1', threatLevel: 'critical', coordinates },
      ]).breakdown.proximityBonus).toBe(10);
    }
  });

  it('treats an unknown threat level as zero and clamps to 100', () => {
    expect(calculateRiskScore({ ...base, threatLevel: 'weird' }, [], []).score).toBe(0);
    const rels = Array.from({ length: 9 }, (_, i) => ({ from: 'e1', to: `x${i}` }));
    expect(calculateRiskScore({ ...base, threatLevel: 'critical' }, rels, []).score).toBe(100);
  });
});

describe('risk labels', () => {
  it('maps score bands to levels', () => {
    expect([0, 19, 20, 40, 60, 80, 100].map(getRiskLevel)).toEqual([
      'minimal', 'minimal', 'low', 'moderate', 'high', 'critical', 'critical',
    ]);
  });

  it('maps score bands to colors', () => {
    expect(getRiskColor(85)).toBe('text-red-400');
    expect(getRiskColor(5)).toBe('text-zinc-400');
  });
});

describe('scoreAllEntities', () => {
  it('sorts highest risk first and attaches level', () => {
    const entities = [
      { id: 'a', threatLevel: 'low', confidence: 100 },
      { id: 'b', threatLevel: 'critical', confidence: 100 },
    ];
    const out = scoreAllEntities(entities, [], []);
    expect(out.map((o) => o.entity.id)).toEqual(['b', 'a']);
    expect(out[0].level).toBe('critical');
  });
});
