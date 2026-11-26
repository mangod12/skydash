// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const health = vi.hoisted(() => ({ value: null }));
vi.mock('../../hooks/useSystemHealth', () => ({ useSystemHealth: () => health.value }));
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="chart">{children}</div>,
  Line: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import SystemHealth from './SystemHealth';

const base = () => ({
  status: 'healthy',
  ws: { isConnected: true, latency: 42 },
  rateHistory: [{ v: 1 }, { v: 2 }],
  latencyHistory: [{ v: 3 }],
  pipeline: { activeDrones: 3, total: 5, dataPoints: 12345 },
  database: { entities: 10, relationships: 4, events: 99 },
  memory: { historyUsed: 500, historyMax: 1000, notifications: 20, notificationsMax: 100, audit: 95, auditMax: 100, annotations: 2 },
  uptime: { session: 3723000, backend: null },
});

beforeEach(() => { health.value = base(); });
afterEach(cleanup);

describe('SystemHealth', () => {
  it('shows the status label for each state', () => {
    for (const [status, label] of [['healthy', 'HEALTHY'], ['degraded', 'DEGRADED'], ['error', 'ERROR']]) {
      health.value = { ...base(), status };
      const { unmount } = render(<SystemHealth />);
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it('shows websocket connection, latency and pipeline counts', () => {
    render(<SystemHealth />);
    expect(screen.getByText('CONNECTED')).toBeTruthy();
    expect(screen.getByText('42ms')).toBeTruthy();
    expect(screen.getByText('3/5 active')).toBeTruthy();
    expect(screen.getByText(/Data points: 12,345/)).toBeTruthy();
  });

  it('shows DISCONNECTED when the socket is down', () => {
    health.value = { ...base(), ws: { isConnected: false, latency: 0 } };
    render(<SystemHealth />);
    expect(screen.getByText('DISCONNECTED')).toBeTruthy();
  });

  it('formats session uptime and shows a placeholder without backend uptime', () => {
    render(<SystemHealth />);
    expect(screen.getByText('01:02:03')).toBeTruthy();
    expect(screen.getByText('--:--:--')).toBeTruthy();
  });

  it('formats backend uptime from seconds', () => {
    health.value = { ...base(), uptime: { session: 0, backend: 90 } };
    render(<SystemHealth />);
    expect(screen.getByText('00:01:30')).toBeTruthy();
  });

  it('shows a sparkline only with two or more samples', () => {
    render(<SystemHealth />);
    expect(screen.getAllByTestId('chart').length).toBe(1);
    expect(screen.getAllByText('--').length).toBe(1);
  });

  it('caps the progress bar at 100 percent and flags near-full buffers', () => {
    health.value = { ...base(), memory: { ...base().memory, audit: 250, auditMax: 100 } };
    const { container } = render(<SystemHealth />);
    const bars = [...container.querySelectorAll('div[style]')].map((d) => d.style.width);
    expect(bars).toContain('100%');
    expect(bars).toContain('50%');
    expect(container.querySelector('.bg-amber-500.rounded-full.transition-all')).toBeTruthy();
  });

  it('handles a zero max without dividing by zero', () => {
    health.value = { ...base(), memory: { ...base().memory, notifications: 0, notificationsMax: 0 } };
    const { container } = render(<SystemHealth />);
    expect([...container.querySelectorAll('div[style]')].map((d) => d.style.width)).toContain('0%');
  });
});
