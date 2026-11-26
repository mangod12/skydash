// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import FleetOverview from './FleetOverview';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';

const drone = (over) => ({ drone_id: 'D1', altitude: 120.4, battery_percentage: 80, signal_strength: 90, flight_mode: 'AUTO', ...over });

beforeEach(() => {
  useTelemetryStore.setState({ fleet: [] });
  useUIStore.setState({ activeView: 'dashboard' });
});
afterEach(cleanup);

const row = (id) => screen.getByLabelText(`Open telemetry for ${id}`);

describe('FleetOverview', () => {
  it('renders nothing for an empty fleet', () => {
    const { container } = render(<FleetOverview />);
    expect(container.textContent).toBe('');
  });

  it('shows a healthy drone with rounded altitude, battery, signal and mode', () => {
    useTelemetryStore.setState({ fleet: [drone()] });
    render(<FleetOverview />);
    const r = row('D1');
    expect(r.textContent).toContain('OK');
    expect(r.textContent).toContain('120m');
    expect(r.textContent).toContain('80%');
    expect(r.textContent).toContain('90%');
    expect(r.textContent).toContain('AUTO');
  });

  it('derives CRIT below 15 percent battery, WARN below 30 percent or weak signal', () => {
    useTelemetryStore.setState({
      fleet: [
        drone({ drone_id: 'A', battery_percentage: 10 }),
        drone({ drone_id: 'B', battery_percentage: 25 }),
        drone({ drone_id: 'C', signal_strength: 40 }),
        drone({ drone_id: 'D', battery_percentage: 30, signal_strength: 50 }),
      ],
    });
    render(<FleetOverview />);
    expect(row('A').textContent).toContain('CRIT');
    expect(row('B').textContent).toContain('WARN');
    expect(row('C').textContent).toContain('WARN');
    expect(row('D').textContent).toContain('OK');
  });

  it('falls back to zero values and a dash for missing fields', () => {
    useTelemetryStore.setState({ fleet: [{ drone_id: 'X' }] });
    render(<FleetOverview />);
    const r = row('X');
    expect(r.textContent).toContain('CRIT');
    expect(r.textContent).toContain('0m');
    expect(r.textContent).toContain('--');
  });

  it('opens the telemetry view on click', () => {
    useTelemetryStore.setState({ fleet: [drone()] });
    render(<FleetOverview />);
    fireEvent.click(row('D1'));
    expect(useUIStore.getState().activeView).toBe('telemetry');
  });

  it('opens the telemetry view from the keyboard on Enter and Space only', () => {
    useTelemetryStore.setState({ fleet: [drone()] });
    render(<FleetOverview />);
    expect(row('D1').tabIndex).toBe(0);
    fireEvent.keyDown(row('D1'), { key: 'Tab' });
    expect(useUIStore.getState().activeView).toBe('dashboard');
    fireEvent.keyDown(row('D1'), { key: 'Enter' });
    expect(useUIStore.getState().activeView).toBe('telemetry');
    useUIStore.setState({ activeView: 'dashboard' });
    fireEvent.keyDown(row('D1'), { key: ' ' });
    expect(useUIStore.getState().activeView).toBe('telemetry');
  });
});
