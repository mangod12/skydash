// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConnectionLost from './ConnectionLost';
import { useTelemetryStore } from '../../stores/telemetryStore';

vi.mock('../../utils/runtimeConfig', () => ({ BACKEND_CONFIGURED: true }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T20:00:00Z'));
  useTelemetryStore.setState({ isConnected: false, lastUpdate: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows a current age on its first lost-link render, even if data arrived after mounting', () => {
  useTelemetryStore.setState({ isConnected: true });
  render(<ConnectionLost />);
  act(() => { vi.advanceTimersByTime(1000); });
  act(() => { useTelemetryStore.setState({ lastUpdate: Date.now() }); });
  act(() => { vi.advanceTimersByTime(5000); });
  act(() => { useTelemetryStore.setState({ isConnected: false }); });
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole('alert').textContent).toContain('(10s old)');
  expect(screen.getByRole('alert').textContent).not.toContain('-- old');
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.getByRole('alert').textContent).toContain('(11s old)');
  act(() => { useTelemetryStore.setState({ isConnected: true }); });
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByRole('alert')).toBeNull();
});
