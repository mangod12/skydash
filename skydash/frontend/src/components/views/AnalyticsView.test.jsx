// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const seen = {};
const { cap } = vi.hoisted(() => ({ cap: (name, key) => ({ default: (props) => { globalThis.__seen[name] = props; return <div data-testid={key || name} />; } }) }));
globalThis.__seen = seen;
vi.mock('../intel/RiskOverview', () => cap('risk'));
vi.mock('./ThreatTrendChart', () => cap('trend'));
vi.mock('./TemporalHeatmap', () => cap('heat'));
vi.mock('./EntityTypeCards', () => cap('types'));
vi.mock('./AnalyticsNetwork', () => cap('network'));
vi.mock('./AnalyticsCharts', () => ({
  EntityDistributionChart: (p) => { globalThis.__seen.dist = p; return null; },
  ThreatBreakdownChart: (p) => { globalThis.__seen.threat = p; return null; },
  AltitudeTrendChart: (p) => { globalThis.__seen.alt = p; return null; },
}));

import AnalyticsView from './AnalyticsView';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => {
  for (const k of Object.keys(seen)) delete seen[k];
  useTelemetryStore.setState({ history: [], fleet: [] });
  useIntelStore.setState({ entities: [], relationships: [], events: [] });
});
afterEach(cleanup);

describe('AnalyticsView', () => {
  it('renders zero stats on an empty store', () => {
    render(<AnalyticsView />);
    expect(screen.getByText('TOTAL ENTITIES')).toBeTruthy();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(seen.dist.typeData).toEqual([]);
    expect(seen.network.topEntities).toEqual([]);
  });

  it('counts entities, events, high threat and drones', () => {
    useIntelStore.setState({
      entities: [{ id: 'a', name: 'A', type: 'person', threatLevel: 'high' }, { id: 'b', name: 'B', type: 'person', threatLevel: 'critical' }, { id: 'c', name: 'C', type: 'vehicle', threatLevel: 'low' }],
      events: [{ id: 1, entityId: 'a' }],
    });
    useTelemetryStore.setState({ fleet: [{ drone_id: 'd1' }] });
    render(<AnalyticsView />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(seen.dist.typeData).toEqual([{ name: 'person', value: 2 }, { name: 'vehicle', value: 1 }]);
    expect(seen.threat.threatData).toEqual(expect.arrayContaining([{ name: 'high', value: 1 }, { name: 'critical', value: 1 }, { name: 'low', value: 1 }]));
  });

  it('buckets missing type and threat level instead of the string undefined', () => {
    useIntelStore.setState({ entities: [{ id: 'x', name: 'X' }] });
    render(<AnalyticsView />);
    expect(seen.dist.typeData).toEqual([{ name: 'unknown', value: 1 }]);
    expect(seen.threat.threatData).toEqual([{ name: 'none', value: 1 }]);
  });

  it('ranks top entities by event count with name lookup and id fallback, max five', () => {
    const events = [];
    const add = (id, n) => { for (let i = 0; i < n; i++) events.push({ id: id + i, entityId: id }); };
    add('a', 3); add('b', 1); add('ghost', 2); add('d', 4); add('e', 5); add('f', 6);
    useIntelStore.setState({ entities: [{ id: 'a', name: 'Alpha' }, { id: 'f', name: 'Foxtrot' }], events });
    render(<AnalyticsView />);
    const top = seen.network.topEntities;
    expect(top).toHaveLength(5);
    expect(top[0]).toEqual({ name: 'Foxtrot', count: 6 });
    expect(top.map((t) => t.name)).toContain('Alpha');
    expect(top.map((t) => t.name)).not.toContain('b');
  });

  it('tolerates missing relationships', () => {
    useIntelStore.setState({ relationships: undefined });
    expect(() => render(<AnalyticsView />)).not.toThrow();
  });
});
