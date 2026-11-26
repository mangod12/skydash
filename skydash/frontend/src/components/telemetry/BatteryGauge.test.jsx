// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BatteryGauge from './BatteryGauge';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => useTelemetryStore.setState({ data: null }));
afterEach(cleanup);

const set = (data) => useTelemetryStore.setState({ data });
const fill = (c) => c.querySelector('.h-2 > div');

describe('BatteryGauge', () => {
  it('shows dashes and an empty bar without telemetry', () => {
    const { container } = render(<BatteryGauge />);
    expect(screen.getAllByText('--').length).toBe(2);
    expect(fill(container).style.width).toBe('0%');
    expect(fill(container).className).toContain('bg-zinc-700');
  });

  it('uses the reported percentage without an EST marker', () => {
    set({ battery_percentage: 80, battery_voltage: 16.1 });
    const { container } = render(<BatteryGauge />);
    expect(screen.getByText('80%')).toBeTruthy();
    expect(fill(container).style.width).toBe('80%');
    expect(fill(container).className).toContain('bg-emerald-500');
  });

  it('estimates from voltage when no percentage is reported', () => {
    set({ battery_voltage: 15.4 });
    render(<BatteryGauge />);
    expect(screen.getByText('50% EST')).toBeTruthy();
  });

  it('clamps estimated percent to 0 to 100', () => {
    set({ battery_voltage: 13.0 });
    const { unmount } = render(<BatteryGauge />);
    expect(screen.getByText('0% EST')).toBeTruthy();
    unmount();
    set({ battery_voltage: 17.5 });
    render(<BatteryGauge />);
    expect(screen.getByText('100% EST')).toBeTruthy();
  });

  it('switches color at the 50 and 25 percent thresholds', () => {
    const cls = (p) => {
      set({ battery_percentage: p });
      const { container, unmount } = render(<BatteryGauge />);
      const c = fill(container).className;
      unmount();
      return c;
    };
    expect(cls(51)).toContain('bg-emerald-500');
    expect(cls(50)).toContain('bg-amber-500');
    expect(cls(26)).toContain('bg-amber-500');
    expect(cls(25)).toContain('bg-red-500');
  });
});
