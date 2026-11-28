// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('./FleetSparklines', () => ({ default: () => <div data-testid="spark" /> }));
vi.mock('./WidgetItems', () => ({
  ThreatGaugeWidget: () => <div>gauge</div>, EntityListWidget: () => <div>elist</div>,
  FeedWidget: () => <div>feed</div>, ClockWidget: () => <div>clock</div>, WeatherWidget: () => <div>weather</div>,
}));

import WidgetRenderer, { WIDGET_LABELS } from './DashboardWidgets';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';

afterEach(cleanup);

function setup({ fleet = [], isConnected = true, latency = 12, entities = [], missions = [] } = {}) {
  useTelemetryStore.setState({ fleet, isConnected, latency });
  useIntelStore.setState({ entities });
  useMissionStore.setState({ missions });
}

describe('WidgetRenderer', () => {
  it('shows an unknown-widget notice', () => {
    render(<WidgetRenderer type="nope" />);
    expect(screen.getByText('UNKNOWN WIDGET')).toBeTruthy();
  });

  it('has a label for every widget type', () => {
    expect(Object.keys(WIDGET_LABELS)).toHaveLength(8);
  });

  it('fleet stat averages battery, ignoring non-finite values', () => {
    setup({ fleet: [{ battery_percentage: 80 }, { battery_percentage: NaN }, { battery_percentage: 60 }] });
    render(<WidgetRenderer type="stat-card" config={{ metric: 'fleet' }} />);
    expect(screen.getByText('FLEET STATUS')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('47% AVG BAT')).toBeTruthy();
  });

  it('threat stat counts high and critical', () => {
    setup({ entities: [{ threatLevel: 'high' }, { threatLevel: 'critical' }, { threatLevel: 'low' }] });
    render(<WidgetRenderer type="stat-card" config={{ metric: 'threat' }} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('missions stat counts active only', () => {
    setup({ missions: [{ status: 'active' }, { status: 'closed' }], entities: [{}, {}, {}] });
    render(<WidgetRenderer type="stat-card" config={{ metric: 'missions' }} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('3 ENTITIES')).toBeTruthy();
  });

  it('system stat shows online with latency, and unknown latency honestly', () => {
    setup({ latency: 42 });
    render(<WidgetRenderer type="stat-card" config={{ metric: 'system' }} />);
    expect(screen.getByText('ONLINE')).toBeTruthy();
    expect(screen.getByText('42ms LATENCY')).toBeTruthy();
    cleanup();
    setup({ isConnected: false, latency: null });
    render(<WidgetRenderer type="stat-card" config={{ metric: 'system' }} />);
    expect(screen.getByText('OFFLINE')).toBeTruthy();
    expect(screen.getByText('LATENCY UNKNOWN')).toBeTruthy();
  });

  it('defaults to the fleet stat for a missing or bad metric', () => {
    setup();
    render(<WidgetRenderer type="stat-card" config={{ metric: 'zzz' }} />);
    expect(screen.getByText('FLEET STATUS')).toBeTruthy();
  });
});
