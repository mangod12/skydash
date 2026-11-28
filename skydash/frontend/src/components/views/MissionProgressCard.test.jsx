// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import MissionProgressCard from './MissionProgressCard';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-28T10:00:00Z')); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const base = { name: 'Alpha', status: 'active', created_at: '2026-11-28T08:58:55Z' };

describe('MissionProgressCard', () => {
  it('shows the empty state without a mission', () => {
    render(<MissionProgressCard mission={null} />);
    expect(screen.getByText('No active mission')).toBeTruthy();
  });

  it('shows elapsed time and ticks each second', () => {
    render(<MissionProgressCard mission={base} />);
    expect(screen.getByText('01:01:05')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('01:01:07')).toBeTruthy();
  });

  it('does not show NaN or negative time for a bad or future start', () => {
    render(<MissionProgressCard mission={{ ...base, created_at: 'garbage' }} />);
    expect(screen.getByText('--:--:--')).toBeTruthy();
    cleanup();
    render(<MissionProgressCard mission={{ ...base, created_at: '2026-11-28T12:00:00Z' }} />);
    expect(screen.getByText('00:00:00')).toBeTruthy();
  });

  it('derives the phase from entities and notes', () => {
    const phase = (m) => { const { unmount } = render(<MissionProgressCard mission={{ ...base, ...m }} />); const l = screen.getByRole('img').getAttribute('aria-label'); unmount(); return l; };
    expect(phase({})).toContain('PLAN, step 1');
    expect(phase({ entityIds: ['e'] })).toContain('DEPLOY, step 2');
    expect(phase({ entityIds: ['e'], notes: ['n'] })).toContain('EXECUTE, step 3');
    expect(phase({ status: 'closed' })).toContain('DEBRIEF, step 4');
    expect(phase({ status: 'archived' })).toContain('DEBRIEF, step 4');
  });

  it('shows counts and uppercased status', () => {
    render(<MissionProgressCard mission={{ ...base, entityIds: ['a', 'b'], notes: ['n'], status: 'closed' }} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('CLOSED')).toBeTruthy();
  });
});
