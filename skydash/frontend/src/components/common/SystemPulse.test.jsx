// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import SystemPulse from './SystemPulse';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => {
  vi.useFakeTimers();
  useTelemetryStore.setState({ isConnected: false, fleet: [] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SystemPulse', () => {
  it('labels the link state, not just its color', () => {
    const { rerender } = render(<SystemPulse />);
    const dot = screen.getByRole('img');
    expect(dot.getAttribute('aria-label')).toBe('Telemetry link: offline');
    expect(dot.querySelector('.bg-red-500')).toBeTruthy();
    expect(dot.querySelector('.animate-ping')).toBeNull();
    act(() => useTelemetryStore.setState({ isConnected: true }));
    rerender(<SystemPulse />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Telemetry link: live');
    expect(screen.getByRole('img').querySelector('.animate-ping')).toBeTruthy();
  });

  it('starts at zero', () => {
    const { container } = render(<SystemPulse />);
    expect(container.textContent).toContain('0/s');
    expect(container.textContent).toContain('0 msg');
  });

  it('counts messages while connected and reports them each second', () => {
    useTelemetryStore.setState({ isConnected: true });
    const { container } = render(<SystemPulse />);
    act(() => useTelemetryStore.setState({ fleet: [{ id: 1 }] }));
    act(() => useTelemetryStore.setState({ fleet: [{ id: 2 }] }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(container.textContent).toContain('3/s');
    expect(container.textContent).toContain('3 msg');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(container.textContent).toContain('0/s');
    expect(container.textContent).toContain('3 msg');
  });
});
