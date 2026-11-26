// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IdleGuard from './IdleGuard';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../utils/idleTimeout', () => ({
  idleLimitMs: () => 120000,
  idleState: (idle, limit) => (idle >= limit ? 'expired' : idle >= limit - 60000 ? 'warning' : 'active'),
}));

const logout = vi.fn(() => useAuthStore.setState({ token: null }));
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  logout.mockClear();
  useAuthStore.setState({ token: 't', authEnabled: true, logout });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('IdleGuard', () => {
  it('stays quiet while active, warns in the last minute, then signs out', () => {
    render(<IdleGuard />);
    tick(30000);
    expect(screen.queryByRole('alert')).toBeNull();
    tick(31000);
    expect(screen.getByRole('alert').textContent).toContain('Signing out for inactivity in');
    expect(logout).not.toHaveBeenCalled();
    tick(59000);
    tick(1000);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('STAY SIGNED IN and real input both reset the timer', () => {
    render(<IdleGuard />);
    tick(65000);
    fireEvent.click(screen.getByText('STAY SIGNED IN'));
    expect(screen.queryByRole('alert')).toBeNull();
    tick(65000);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });
    tick(30000);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it('does nothing when auth is off or nobody is signed in', () => {
    useAuthStore.setState({ authEnabled: false });
    const { rerender } = render(<IdleGuard />);
    tick(300000);
    useAuthStore.setState({ authEnabled: true, token: null });
    rerender(<IdleGuard />);
    tick(300000);
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
