// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const circles = [];
vi.mock('react-leaflet', () => ({
  Circle: (p) => { circles.push(p); return <i data-testid="circle" />; },
}));

import ThreatZones from './ThreatZones';
import { useIntelStore } from '../../stores/intelStore';

beforeEach(() => { circles.length = 0; });
afterEach(cleanup);

const ent = (id, threatLevel, coordinates = [10, 20]) => ({ id, threatLevel, coordinates });
const draw = (entities) => { useIntelStore.setState({ entities }); render(<ThreatZones />); };

describe('ThreatZones', () => {
  it('draws nothing without threatening entities', () => {
    draw([ent('a', 'low'), ent('b', 'none'), ent('c', 'critical', null)]);
    expect(circles.length).toBe(0);
  });

  it('draws an outer and inner ring per medium/high/critical entity', () => {
    draw([ent('a', 'critical'), ent('b', 'high'), ent('c', 'medium'), ent('d', 'low')]);
    expect(circles.length).toBe(6);
  });

  it('sizes rings by threat level, inner ring at 40 percent', () => {
    draw([ent('a', 'critical'), ent('b', 'high'), ent('c', 'medium')]);
    expect(circles.map((c) => c.radius)).toEqual([400, 160, 300, 120, 200, 80]);
  });

  it('centers rings on the entity and fills the inner ring more strongly', () => {
    draw([ent('a', 'high', [12.5, 77.5])]);
    const [outer, inner] = circles;
    expect(outer.center).toEqual([12.5, 77.5]);
    expect(inner.center).toEqual([12.5, 77.5]);
    expect(outer.pathOptions.color).toBe('#ef4444');
    expect(inner.pathOptions.fillOpacity).toBeCloseTo(outer.pathOptions.fillOpacity * 2);
    expect(outer.pathOptions.dashArray).toBe('6 4');
  });
});
