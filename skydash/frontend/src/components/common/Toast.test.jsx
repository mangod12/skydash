// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToastContainer, { toast } from './Toast';
vi.mock('framer-motion', () => ({ AnimatePresence: ({children}) => <>{children}</>, motion: { div: ({children, initial: _initial, animate: _animate, exit: _exit, ...props}) => <div {...props}>{children}</div> } }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('recorded review notification provenance', () => {
  it('keeps current app alerts visible and relabels them when entering or leaving recorded review', () => {
    const { rerender } = render(<ToastContainer />); act(() => toast('Background fleet battery alert', 'error', 0)); expect(screen.getByText('Background fleet battery alert')).toBeTruthy(); expect(screen.queryByText('BACKGROUND APP, NOT RECORDED CSV')).toBeNull();
    rerender(<ToastContainer recordedReview />); expect(screen.getByText('BACKGROUND APP, NOT RECORDED CSV')).toBeTruthy(); expect(screen.getByLabelText('Background app notifications, not recorded CSV evidence')).toBeTruthy(); expect(screen.getByText('Background fleet battery alert')).toBeTruthy();
    rerender(<ToastContainer />); expect(screen.queryByText('BACKGROUND APP, NOT RECORDED CSV')).toBeNull(); expect(screen.getByText('Background fleet battery alert')).toBeTruthy();
  });
  it('does not drop new alerts during review or replay them on leaving and still expires notifications', () => {
    vi.useFakeTimers(); const { rerender } = render(<ToastContainer recordedReview />); act(() => toast('New fleet warning', 'warning', 1000)); expect(screen.getByText('New fleet warning')).toBeTruthy(); expect(screen.getByText('BACKGROUND APP, NOT RECORDED CSV')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1001)); expect(screen.queryByText('New fleet warning')).toBeNull(); rerender(<ToastContainer />); expect(screen.queryByText('New fleet warning')).toBeNull();
  });
});
