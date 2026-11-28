// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, exit, whileHover, transition, children, ...p }) => [p, children]; // eslint-disable-line no-unused-vars
  const el = (Tag) => {
    const C = ({ ref: _ref, ...props }) => { const [p, children] = strip(props); return <Tag {...p}>{children}</Tag>; };
    return C;
  };
  return { AnimatePresence: ({ children }) => <>{children}</>, motion: { div: el('div'), button: el('button') } };
});

import KeyboardHelp from './KeyboardHelp';

afterEach(cleanup);

describe('KeyboardHelp', () => {
  it('shows only the KEYS pill when closed and opens via onOpen', () => {
    const onOpen = vi.fn();
    render(<KeyboardHelp open={false} onClose={() => {}} onOpen={onOpen} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByLabelText('Keys, open keyboard shortcuts'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('hides the pill while a text field has focus', () => {
    render(<div><input aria-label="other" /><KeyboardHelp open={false} onClose={() => {}} onOpen={() => {}} /></div>);
    expect(screen.getByLabelText('Keys, open keyboard shortcuts')).toBeTruthy();
    act(() => { screen.getByLabelText('other').focus(); });
    expect(screen.queryByLabelText('Keys, open keyboard shortcuts')).toBeNull();
    act(() => { screen.getByLabelText('other').blur(); });
    expect(screen.getByLabelText('Keys, open keyboard shortcuts')).toBeTruthy();
  });

  it('opens as a labelled modal listing every group and the shortcut count', () => {
    render(<KeyboardHelp open onClose={() => {}} onOpen={() => {}} />);
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('KEYBOARD SHORTCUTS')).toBeTruthy();
    ['NAVIGATION', 'ACTIONS', 'MAP', 'TELEMETRY'].forEach((g) => expect(screen.getByText(g)).toBeTruthy());
    expect(screen.getByText('19 shortcuts')).toBeTruthy();
  });

  it('filters by description or key and hides empty groups', () => {
    render(<KeyboardHelp open onClose={() => {}} onOpen={() => {}} />);
    const box = screen.getByLabelText('Search keyboard shortcuts');
    fireEvent.change(box, { target: { value: 'sidebar' } });
    expect(screen.getByText('Toggle sidebar')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('MAP')).toBeNull();
    fireEvent.change(box, { target: { value: 'ctrl' } });
    expect(screen.getByText('Command palette')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'zzzz' } });
    expect(screen.queryByText('ACTIONS')).toBeNull();
  });

  it('closes on Escape and on a backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<KeyboardHelp open onClose={onClose} onOpen={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.bg-black\\/50'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('copies all shortcuts, grouped, then shows COPIED', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<KeyboardHelp open onClose={() => {}} onOpen={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByLabelText('Copy all keyboard shortcuts')); });
    const text = writeText.mock.calls[0][0];
    expect(text).toContain('## NAVIGATION\nD - Dashboard');
    expect(text).toContain('Ctrl + K - Command palette');
    expect(screen.getByText('COPIED')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(screen.getByText('COPY ALL')).toBeTruthy();
    vi.useRealTimers();
  });

  it('does not throw when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    render(<KeyboardHelp open onClose={() => {}} onOpen={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByLabelText('Copy all keyboard shortcuts')); });
    expect(screen.getByText('COPY ALL')).toBeTruthy();
  });
});
