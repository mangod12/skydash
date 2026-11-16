// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import FreshnessIndicator from './FreshnessIndicator';

const NOW = new Date('2026-01-01T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FreshnessIndicator', () => {
  it('shows NO DATA without a timestamp', () => {
    render(<FreshnessIndicator />);
    expect(screen.getByText('NO DATA')).toBeTruthy();
  });

  it.each([
    [1000, 'LIVE', 'just now'],
    [30000, 'RECENT', '30s ago'],
    [5 * 60000, 'STALE', '5m ago'],
    [2 * 3600000, 'OFFLINE', '2h ago'],
  ])('age %ims is %s (%s)', (age, label, relative) => {
    render(<FreshnessIndicator timestamp={NOW - age} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(relative)).toBeTruthy();
  });

  it('hides source and time in compact mode and shows source otherwise', () => {
    const { rerender } = render(<FreshnessIndicator timestamp={NOW} source="sim" compact />);
    expect(screen.queryByText('sim')).toBeNull();
    expect(screen.queryByText('just now')).toBeNull();
    rerender(<FreshnessIndicator timestamp={NOW} source="sim" />);
    expect(screen.getByText('sim')).toBeTruthy();
  });

  it('puts the source in the tooltip and accepts Date objects', () => {
    const { container } = render(<FreshnessIndicator timestamp={new Date(NOW)} source="sim" />);
    expect(container.firstChild.getAttribute('title')).toMatch(/^sim - \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('ages as time passes', () => {
    render(<FreshnessIndicator timestamp={NOW} />);
    expect(screen.getByText('LIVE')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText('RECENT')).toBeTruthy();
    expect(screen.getByText('10s ago')).toBeTruthy();
  });
});
