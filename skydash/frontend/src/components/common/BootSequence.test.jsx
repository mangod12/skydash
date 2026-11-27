// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, exit, transition, ...rest }) => rest; // eslint-disable-line no-unused-vars
  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: new Proxy({}, { get: (_, tag) => ({ children, ...p }) => { const T = tag; return <T {...strip(p)}>{children}</T>; } }),
  };
});
vi.mock('./BrandMark', () => ({ default: () => <div data-testid="brand" /> }));

import BootSequence from './BootSequence';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('BootSequence', () => {
  it('reveals boot lines over time', () => {
    render(<BootSequence />);
    expect(screen.queryByText(/Initializing telemetry/)).toBeNull();
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText(/Initializing telemetry/)).toBeTruthy();
    expect(screen.queryByText('SYSTEM READY')).toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('SYSTEM READY')).toBeTruthy();
  });

  it('calls onComplete once after 2.2s and removes the overlay', () => {
    const done = vi.fn();
    render(<BootSequence onComplete={done} />);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(done).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('brand')).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('does not fire onComplete after unmount', () => {
    const done = vi.fn();
    const { unmount } = render(<BootSequence onComplete={done} />);
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(done).not.toHaveBeenCalled();
  });
});
