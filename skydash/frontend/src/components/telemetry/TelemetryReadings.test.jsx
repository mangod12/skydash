// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TelemetryPanel from './TelemetryPanel';
import { FleetPanel } from '../views/FleetPanel';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => {
  useTelemetryStore.setState({ data: null, history: [], fleet: [] });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('renders unknown sensor readings without crashing or manufacturing zero/full battery data', () => {
  const store = useTelemetryStore.getState();
  const source = { drone_id: 'one', altitude: 'bad', ground_speed: {}, battery_voltage: '16.8',
    signal_strength: [], gps: { satellites: 'many' }, attitude: { roll: 'level', pitch: false, yaw: {} }, flight_mode: {} };
  store.updateTelemetry(source, 0);
  store.updateFleet([source]);
  const { container } = render(<><TelemetryPanel /><FleetPanel /></>);
  expect(screen.getByText('ATTITUDE UNAVAILABLE')).toBeTruthy();
  expect(screen.getByText('-- SATS')).toBeTruthy();
  expect(container.textContent).not.toContain('NaN');
  expect(container.textContent).not.toContain('Infinity');
  expect(container.textContent).not.toContain('100%');
  expect(container.textContent).not.toContain('0%');
});

it('caps satellite drawing work while retaining the actual valid count', () => {
  useTelemetryStore.getState().updateTelemetry({ drone_id: 'one', gps: { satellites: 1000000 } }, 0);
  const { container } = render(<TelemetryPanel />);
  expect(screen.getByText('1000000 SATS')).toBeTruthy();
  expect(container.querySelectorAll('circle animate')).toHaveLength(32);
});

it('preserves genuine zero readings instead of replacing them with unknown values', () => {
  useTelemetryStore.getState().updateTelemetry({ drone_id: 'one', altitude: 0, ground_speed: 0,
    battery_voltage: 0, signal_strength: 0, gps: { satellites: 0 }, attitude: { roll: 0, pitch: 0, yaw: 0 } }, 0);
  render(<TelemetryPanel />);
  expect(screen.getByText('0 SATS')).toBeTruthy();
  expect(screen.queryByText('ATTITUDE UNAVAILABLE')).toBeNull();
  expect(screen.getByText('0%')).toBeTruthy();
  expect(screen.getByText('0% EST')).toBeTruthy();
});


it('uses reported battery percentage instead of replacing it with a 4S voltage estimate', () => {
  useTelemetryStore.getState().updateTelemetry({ drone_id: 'one', battery_percentage: 82, battery_voltage: 16 }, 0);
  render(<TelemetryPanel />);
  expect(screen.getByText('82%')).toBeTruthy();
  expect(screen.queryByText('71%')).toBeNull();
});
