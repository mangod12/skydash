// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FleetPanel } from './FleetPanel';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => {
  cleanup();
  useTelemetryStore.setState({ fleet: [], isConnected: false });
});

describe('FleetPanel', () => {
  it('shows empty state and OFFLINE when disconnected', () => {
    render(<FleetPanel />);
    expect(screen.getByText('No fleet data')).toBeTruthy();
    expect(screen.getByText('OFFLINE')).toBeTruthy();
  });

  it('shows LIVE when connected', () => {
    useTelemetryStore.setState({ isConnected: true });
    render(<FleetPanel />);
    expect(screen.getByText('LIVE')).toBeTruthy();
  });

  it('renders drone readings', () => {
    useTelemetryStore.setState({
      fleet: [{ drone_id: 'D1', altitude: 120.4, ground_speed: 5, battery_percentage: 80, signal_strength: 55, pattern: 'orbit' }],
    });
    render(<FleetPanel />);
    expect(screen.getByText('D1')).toBeTruthy();
    expect(screen.getByText('orbit')).toBeTruthy();
    expect(screen.getByText('120m')).toBeTruthy();
    expect(screen.getByText(/80%/)).toBeTruthy();
    expect(screen.getByText(/55%/)).toBeTruthy();
  });

  it('shows placeholders, not fake numbers, for bad readings', () => {
    useTelemetryStore.setState({
      fleet: [{ drone_id: 'D2', altitude: NaN, ground_speed: -3, battery_percentage: 140, signal_strength: null }],
    });
    const { container } = render(<FleetPanel />);
    expect(screen.getByText('--m')).toBeTruthy();
    expect(container.textContent).not.toContain('140%');
    expect(container.textContent).not.toContain('NaN');
    expect(screen.getAllByText(/--/).length).toBeGreaterThanOrEqual(4);
  });

  it('colours battery by level', () => {
    useTelemetryStore.setState({ fleet: [{ drone_id: 'D3', battery_percentage: 20 }] });
    const { container } = render(<FleetPanel />);
    expect(container.querySelector('.text-red-400')).toBeTruthy();
  });
});
