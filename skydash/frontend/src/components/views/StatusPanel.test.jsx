// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusPanel } from './StatusPanel';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';

beforeEach(() => {
  useTelemetryStore.setState({ isConnected: true, latency: 42, fleet: [{ drone_id: 'A' }, { drone_id: 'B' }] });
  useIntelStore.setState({ entities: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  useMissionStore.setState({ missions: [{ id: 'm1', status: 'active' }, { id: 'm2', status: 'closed' }] });
});
afterEach(cleanup);

describe('StatusPanel', () => {
  it('shows counts from the stores', () => {
    render(<StatusPanel />);
    expect(screen.getByText('2 TOTAL')).toBeTruthy();
    expect(screen.getByText('42ms')).toBeTruthy();
    expect(screen.getByText('IN FLEET')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('reports connection state in words', () => {
    const { unmount } = render(<StatusPanel />);
    expect(screen.getByText('ONLINE')).toBeTruthy();
    unmount();
    useTelemetryStore.setState({ isConnected: false });
    render(<StatusPanel />);
    expect(screen.getByText('OFFLINE')).toBeTruthy();
  });

  it('does not show an invented message rate', () => {
    const { container } = render(<StatusPanel />);
    expect(container.textContent).not.toMatch(/msg\/s/);
    expect(screen.getByText('DRONES REPORTING')).toBeTruthy();
  });

  it('labels the timer as session time starting at zero', () => {
    render(<StatusPanel />);
    expect(screen.getByText('SESSION')).toBeTruthy();
    expect(screen.getByText('0h 0m')).toBeTruthy();
  });
});
