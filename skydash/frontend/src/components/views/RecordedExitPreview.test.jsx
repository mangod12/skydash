// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RecordedExitPreview from './RecordedExitPreview';
afterEach(cleanup);
it('renders nothing without a request', () => { const { container } = render(<RecordedExitPreview pending={null} />); expect(container.textContent).toBe(''); });
it('focuses a safe destination preview, explains incomplete exports and offers explicit keep/leave actions', () => {
  const onKeep = vi.fn(), onLeave = vi.fn(); render(<RecordedExitPreview pending={{ kind: 'workspace', value: 'analyst' }} onKeep={onKeep} onLeave={onLeave} />);
  expect(screen.getByRole('heading')).toBe(document.activeElement); expect(screen.getByText(/Requested destination/).textContent).toContain('analyst workspace'); expect(screen.getByText(/No single export/)).toBeTruthy(); expect(screen.getByText(/Authentication expiry/)).toBeTruthy();
  fireEvent.click(screen.getByText('Keep recorded workspace open')); expect(onKeep).toHaveBeenCalledOnce(); expect(onLeave).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Leave and discard recorded session')); expect(onLeave).toHaveBeenCalledOnce();
});
it('blocks both actions while source work is busy', () => { const onLeave = vi.fn(); render(<RecordedExitPreview pending={{ kind: 'back' }} disabled onLeave={onLeave} />); expect(screen.getByText(/Requested destination/).textContent).toContain('Scenario Lab'); fireEvent.click(screen.getByText('Leave and discard recorded session')); expect(onLeave).not.toHaveBeenCalled(); expect(screen.getByText('Keep recorded workspace open').disabled).toBe(true); });
it('names an explicit standalone reset destination without changing default routing or discard scope', () => { render(<RecordedExitPreview pending={{ kind: 'back' }} backDestination="new empty local review" />); expect(screen.getByText(/Requested destination/).textContent).toContain('new empty local review'); expect(screen.getByText(/Leaving discards/)).toBeTruthy(); expect(screen.queryByText(/Requested destination: Scenario Lab/)).toBeNull(); });
