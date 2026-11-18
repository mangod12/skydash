// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReplayBar from './ReplayBar';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { apiFetch } from '../../utils/api';

vi.mock('../../utils/runtimeConfig', () => ({ API_BASE: 'https://test', API_CONFIGURED: true }));
vi.mock('../../utils/api', () => ({ apiFetch: vi.fn() }));
const response = altitude => ({ ok: true, json: async () => ({ data: [{ timestamp: 100, altitude }] }) });
beforeEach(() => { vi.resetAllMocks(); useTelemetryStore.setState({ activeDroneId: 'one' }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it.each(['request', 'body'])('releases a stalled %s after ten seconds and ignores its late result', async phase => {
  vi.useFakeTimers();
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  apiFetch.mockReturnValueOnce(phase === 'request' ? pending : Promise.resolve({ ok: true, json: () => pending }));
  render(<ReplayBar />);
  await act(async () => { fireEvent.click(screen.getByText('Load last 5 min')); });
  const signal = apiFetch.mock.calls[0][1].signal;
  await act(async () => { vi.advanceTimersByTime(10000); });
  expect(signal.aborted).toBe(true);
  expect(screen.getByText('Could not load history')).toBeTruthy();
  expect(screen.getByText('Load last 5 min').disabled).toBe(false);
  apiFetch.mockResolvedValueOnce(response(456));
  await act(async () => { fireEvent.click(screen.getByText('Load last 5 min')); });
  await act(async () => { resolve(phase === 'request' ? response(123) : { data: [{ timestamp: 100, altitude: 123 }] }); });
  expect(screen.getByText('456.0 m')).toBeTruthy();
  expect(screen.queryByText('123.0 m')).toBeNull();
});
it('clears loaded history and stops playback when switching drones', async () => {
  apiFetch.mockResolvedValue(response(123));
  render(<ReplayBar />);
  await act(async () => { fireEvent.click(screen.getByText('Load last 5 min')); });
  expect(screen.getByText('123.0 m')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Play replay' }));
  act(() => useTelemetryStore.setState({ activeDroneId: 'two' }));
  expect(screen.queryByText('123.0 m')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Pause replay' })).toBeNull();
  expect(screen.getByText('No history loaded')).toBeTruthy();
});
it('ignores old drone responses even if the cancelled request resolves late', async () => {
  let resolve;
  apiFetch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  render(<ReplayBar />);
  fireEvent.click(screen.getByText('Load last 5 min'));
  const signal = apiFetch.mock.calls[0][1]?.signal;
  act(() => useTelemetryStore.setState({ activeDroneId: 'two' }));
  expect(screen.getByText('Load last 5 min').disabled).toBe(false);
  apiFetch.mockResolvedValueOnce(response(456));
  await act(async () => { fireEvent.click(screen.getByText('Load last 5 min')); });
  await act(async () => { resolve(response(123)); });
  expect(screen.getByText('456.0 m')).toBeTruthy();
  expect(screen.queryByText('123.0 m')).toBeNull();
  expect(signal.aborted).toBe(true);
});
it('aborts pending history when unmounted', () => {
  apiFetch.mockReturnValue(new Promise(() => {}));
  const view = render(<ReplayBar />);
  fireEvent.click(screen.getByText('Load last 5 min'));
  const signal = apiFetch.mock.calls[0][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
