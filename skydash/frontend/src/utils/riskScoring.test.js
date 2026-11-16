import { describe, it, expect } from 'vitest';
import { calculateRiskScore, getRiskLevel, getRiskColor, scoreAllEntities } from './riskScoring';

const base = { id: 'e1', threatLevel: 'high', confidence: 100, coordinates: [37.0, -122.0] };
const now = () => Date.now();

describe('calculateRiskScore', () => {
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
