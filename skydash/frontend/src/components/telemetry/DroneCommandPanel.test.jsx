// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DroneCommandPanel from './DroneCommandPanel';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../utils/api';

vi.mock('../../utils/runtimeConfig', () => ({ API_BASE: 'https://test', API_CONFIGURED: true }));
vi.mock('../../utils/api', () => ({ apiFetch: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { ack: 'confirmed' } }) });
  useAuthStore.setState({ authEnabled: false });
  useTelemetryStore.setState({ fleet: [], activeDroneId: null, isConnected: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const mount = () => { const result = render(<DroneCommandPanel />); act(() => { vi.advanceTimersByTime(1); }); return result; };
const fleet = (...ids) => ids.map(drone_id => ({ drone_id }));

it('does not invent command targets for an authoritative empty fleet', () => {
  mount();
  expect(screen.getByRole('option').textContent).toBe('NO FLEET');
  expect(screen.getByRole('button', { name: 'HOLD' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'EMERGENCY STOP' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'HOLD' }));
  expect(apiFetch).not.toHaveBeenCalled();
});

it('locks a vanished explicit target instead of sending to it or silently selecting another drone', async () => {
  useTelemetryStore.setState({ fleet: fleet('one', 'two'), activeDroneId: 'one' });
  mount();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
  act(() => { useTelemetryStore.setState({ fleet: fleet('one'), activeDroneId: 'one' }); });
  expect(screen.getByRole('combobox').value).toBe('two');
  expect(screen.getByRole('option', { name: 'two (UNAVAILABLE)' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'HOLD' }).disabled).toBe(true);
  expect(useTelemetryStore.getState().activeDroneId).toBe('one');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'one' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'HOLD' })); });
  expect(apiFetch.mock.calls[0][0]).toBe('https://test/api/drone/one/command');
});

it('requires a new emergency confirmation after changing targets', async () => {
  useTelemetryStore.setState({ fleet: fleet('one', 'two'), activeDroneId: 'one' });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'EMERGENCY STOP' }));
  expect(screen.getByRole('button', { name: 'CONFIRM STOP' })).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
  expect(screen.queryByRole('button', { name: 'CONFIRM STOP' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'EMERGENCY STOP' }));
  expect(apiFetch).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'CONFIRM STOP' })); });
  expect(apiFetch.mock.calls[0][0]).toBe('https://test/api/drone/two/command');
  expect(JSON.parse(apiFetch.mock.calls[0][1].body).command).toBe('emergency_stop');
});

it('clears emergency confirmation when connectivity is lost', () => {
  useTelemetryStore.setState({ fleet: fleet('one'), activeDroneId: 'one' });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'EMERGENCY STOP' }));
  act(() => { useTelemetryStore.setState({ isConnected: false }); });
  act(() => { vi.advanceTimersByTime(1); });
  act(() => { useTelemetryStore.setState({ isConnected: true }); });
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByRole('button', { name: 'CONFIRM STOP' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'EMERGENCY STOP' }));
  expect(apiFetch).not.toHaveBeenCalled();
});

it('deduplicates targets and excludes malformed fleet records', () => {
  useTelemetryStore.setState({ fleet: [null, {}, { drone_id: ' ' }, ...fleet('one', 'one')] });
  mount();
  expect(screen.getAllByRole('option')).toHaveLength(1);
  expect(screen.getByRole('combobox').value).toBe('one');
});


it('uses the target mode from telemetry rather than carrying a command highlight between drones', async () => {
  useTelemetryStore.setState({ fleet: [{ drone_id: 'one', flight_mode: 'HOLD' }, { drone_id: 'two', flight_mode: 'GRID' }], activeDroneId: 'one' });
  mount();
  expect(screen.getByRole('button', { name: 'HOLD' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
  expect(screen.getByRole('button', { name: 'GRID' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'HOLD' }).getAttribute('aria-pressed')).toBe('false');
});

it('locks target selection during an in-flight command and labels the result with its target', async () => {
  let resolve;
  apiFetch.mockReturnValue(new Promise(done => { resolve = done; }));
  useTelemetryStore.setState({ fleet: fleet('one', 'two'), activeDroneId: 'one' });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'HOLD' }));
  expect(screen.getByRole('combobox').disabled).toBe(true);
  await act(async () => { resolve({ ok: true, json: async () => ({ success: true, data: { ack: 'confirmed' } }) }); });
  expect(screen.getByRole('combobox').disabled).toBe(false);
  expect(screen.getByText('one: Simulator state updated')).toBeTruthy();
});
