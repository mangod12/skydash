// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SignalMeter from './SignalMeter';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => useTelemetryStore.setState({ data: null }));
afterEach(cleanup);

const bars = (c) => [...c.querySelectorAll('.items-end > div')];
const active = (c) => bars(c).filter((b) => !b.className.includes('bg-zinc-800'));

describe('SignalMeter', () => {
  it('shows a dash and no active bars without a reading', () => {
    const { container } = render(<SignalMeter />);
    expect(screen.getByText('--')).toBeTruthy();
    expect(bars(container).length).toBe(5);
    expect(active(container).length).toBe(0);
  });

  it('treats an invalid reading as unavailable', () => {
    useTelemetryStore.setState({ data: { signal_strength: 140 } });
    const { container } = render(<SignalMeter />);
    expect(screen.getByText('--')).toBeTruthy();
    expect(active(container).length).toBe(0);
  });

  it('lights bars in proportion to strength, rounding up', () => {
    for (const [value, count] of [[1, 1], [20, 1], [21, 2], [55, 3], [100, 5]]) {
      useTelemetryStore.setState({ data: { signal_strength: value } });
      const { container, unmount } = render(<SignalMeter />);
      expect(active(container).length, String(value)).toBe(count);
      unmount();
    }
  });

  it('shows the percent and colors by threshold', () => {
    for (const [value, cls] of [[85, 'bg-emerald-500'], [55, 'bg-amber-500'], [10, 'bg-red-500']]) {
      useTelemetryStore.setState({ data: { signal_strength: value } });
      const { container, unmount } = render(<SignalMeter />);
      expect(screen.getByText(`${value}%`)).toBeTruthy();
      expect(active(container)[0].className).toContain(cls);
      unmount();
    }
  });

  it('uses the boundary values 70 and 40 for the upper bands', () => {
    useTelemetryStore.setState({ data: { signal_strength: 70 } });
    let r = render(<SignalMeter />);
    expect(active(r.container)[0].className).toContain('bg-emerald-500');
    r.unmount();
    useTelemetryStore.setState({ data: { signal_strength: 40 } });
    r = render(<SignalMeter />);
    expect(active(r.container)[0].className).toContain('bg-amber-500');
  });
});
