// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const { stub } = vi.hoisted(() => ({ stub: (name) => () => <div data-testid={name} /> }));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children, ...p }) => <div className={p.className}>{children}</div> }),
}));
vi.mock('../common/GlassCard', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../common/DataFreshnessBar', () => ({ default: stub('freshness') }));
vi.mock('./DashboardCards', () => ({
  StatCard: ({ label, value, sub, empty }) => (
    <div data-testid={`stat-${label}`} data-empty={String(!!empty)}><b>{String(value)}</b><i>{sub}</i></div>
  ),
}));
vi.mock('./DashboardActivityFeed', () => ({ default: stub('feed') }));
vi.mock('./ThreatGaugeCard', () => ({ default: ({ score }) => <div data-testid="gauge">{score}</div> }));
vi.mock('./DashboardIntelSummary', () => ({ default: stub('intel') }));
vi.mock('./DashboardMiniMap', () => ({ default: stub('minimap') }));
vi.mock('./FleetSparklines', () => ({ default: stub('spark') }));
vi.mock('../telemetry/FleetOverview', () => ({ default: stub('fleet') }));
vi.mock('./AlertTimeline', () => ({ default: stub('alerts') }));
vi.mock('./MissionProgressCard', () => ({ default: ({ mission }) => <div data-testid="progress">{mission ? mission.id : 'none'}</div> }));
vi.mock('./EntityRadar', () => ({ default: stub('radar') }));
vi.mock('./CommsLog', () => ({ default: stub('comms') }));
vi.mock('./WidgetGrid', () => ({ default: stub('widgets') }));
vi.mock('./ScenarioSummaryCard', () => ({ default: stub('scenario') }));
vi.mock('../../utils/runtimeConfig', async (orig) => ({ ...(await orig()), BACKEND_CONFIGURED: true }));

import DashboardView from './DashboardView';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';

const fetchMissions = vi.fn();
const setup = ({ fleet = [], isConnected = false, latency = 0, entities = [], missions = [] } = {}) => {
  useTelemetryStore.setState({ fleet, isConnected, latency });
  useIntelStore.setState({ entities, events: [], relationships: [] });
  useMissionStore.setState({ missions, fetchMissions });
};
const stat = (l) => screen.getByTestId(`stat-${l}`);

beforeEach(() => fetchMissions.mockClear());
afterEach(cleanup);

describe('DashboardView', () => {
  it('shows empty states with no data and fetches missions once', () => {
    setup();
    render(<DashboardView />);
    expect(fetchMissions).toHaveBeenCalledTimes(1);
    expect(stat('FLEET STATUS').textContent).toContain('NO DRONES');
    expect(stat('FLEET STATUS').dataset.empty).toBe('true');
    expect(stat('THREAT OVERVIEW').dataset.empty).toBe('true');
    expect(stat('SYSTEM HEALTH').textContent).toContain('OFFLINE');
    expect(stat('SYSTEM HEALTH').textContent).toContain('RECONNECTING...');
    expect(screen.getByTestId('progress').textContent).toBe('none');
  });

  it('reports a connected fleet with average battery and latency', () => {
    setup({
      fleet: [{ battery_percentage: 80 }, { battery_percentage: 41 }],
      isConnected: true, latency: 42,
    });
    render(<DashboardView />);
    expect(stat('FLEET STATUS').textContent).toContain('ALL CONNECTED');
    expect(stat('FLEET STATUS').textContent).toContain('61% AVG BAT');
    expect(stat('SYSTEM HEALTH').textContent).toContain('ONLINE');
    expect(stat('SYSTEM HEALTH').textContent).toContain('42ms LATENCY');
    expect(stat('SYSTEM HEALTH').textContent).toContain('2 DRONES');
  });

  it('says PARTIAL when drones exist but the link is down, and treats missing battery as 0', () => {
    setup({ fleet: [{}], isConnected: false });
    render(<DashboardView />);
    expect(stat('FLEET STATUS').textContent).toContain('PARTIAL');
    expect(stat('FLEET STATUS').textContent).toContain('0% AVG BAT');
  });

  it('counts threat levels and computes the score from medium and above', () => {
    setup({
      entities: [
        { threatLevel: 'low' }, { threatLevel: 'medium' },
        { threatLevel: 'high' }, { threatLevel: 'critical' }, { threatLevel: 'bogus' },
      ],
    });
    render(<DashboardView />);
    const t = stat('THREAT OVERVIEW').textContent;
    expect(t).toContain('2');
    expect(t).toContain('1 HIGH');
    expect(t).toContain('1 CRIT');
    expect(t).toContain('60% SCORE');
    expect(screen.getByTestId('gauge').textContent).toBe('60');
  });

  it('counts only active missions and passes the first to the progress card', () => {
    setup({
      entities: [{ threatLevel: 'low' }],
      missions: [
        { id: 'm1', status: 'complete', entityIds: ['a'] },
        { id: 'm2', status: 'active', entityIds: ['a', 'b'], created_at: '2026-01-01T00:00:00Z' },
      ],
    });
    render(<DashboardView />);
    const m = stat('ACTIVE MISSIONS').textContent;
    expect(m).toContain('3 LINKED ENTITIES');
    expect(m).toContain('1 TOTAL');
    expect(screen.getByTestId('progress').textContent).toBe('m2');
  });

  it('toggles between classic and widget layouts', () => {
    setup();
    render(<DashboardView />);
    fireEvent.click(screen.getByText('WIDGETS'));
    expect(screen.getByTestId('widgets')).toBeTruthy();
    expect(screen.queryByTestId('alerts')).toBeNull();
    fireEvent.click(screen.getByText('CLASSIC VIEW'));
    expect(screen.getByTestId('alerts')).toBeTruthy();
  });
});
