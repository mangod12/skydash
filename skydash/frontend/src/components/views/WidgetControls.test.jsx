// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('framer-motion', () => ({ motion: { div: ({ children, className }) => <div className={className}>{children}</div> } }));

import { AddWidgetPicker, ResizeHandle } from './WidgetControls';
import { useWidgetStore } from '../../stores/widgetStore';

let resizeWidget;
beforeEach(() => {
  resizeWidget = vi.fn();
  useWidgetStore.setState({ widgetTypes: ['clock', 'stat-card', 'custom'], resizeWidget });
});
afterEach(cleanup);

describe('AddWidgetPicker', () => {
  it('lists labelled types, falling back to uppercase for unknown ones', () => {
    render(<AddWidgetPicker onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByText('CLOCK')).toBeTruthy();
    expect(screen.getByText('STAT CARD')).toBeTruthy();
    expect(screen.getByText('CUSTOM')).toBeTruthy();
  });

  it('adds the chosen type then closes', () => {
    const onAdd = vi.fn(), onClose = vi.fn();
    render(<AddWidgetPicker onAdd={onAdd} onClose={onClose} />);
    fireEvent.click(screen.getByText('STAT CARD'));
    expect(onAdd).toHaveBeenCalledWith('stat-card');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ResizeHandle', () => {
  it('is keyboard reachable and labelled with the current size', () => {
    render(<ResizeHandle widgetId="w1" currentW={4} currentH={3} />);
    const h = screen.getByRole('button', { name: /Resize widget, currently 4 by 3/ });
    expect(h.getAttribute('tabindex')).toBe('0');
  });

  it('resizes with arrow keys and ignores other keys', () => {
    render(<ResizeHandle widgetId="w1" currentW={4} currentH={3} />);
    const h = screen.getByRole('button');
    fireEvent.keyDown(h, { key: 'ArrowRight' });
    expect(resizeWidget).toHaveBeenLastCalledWith('w1', 5, 3);
    fireEvent.keyDown(h, { key: 'ArrowUp' });
    expect(resizeWidget).toHaveBeenLastCalledWith('w1', 4, 2);
    fireEvent.keyDown(h, { key: 'ArrowLeft' });
    expect(resizeWidget).toHaveBeenLastCalledWith('w1', 3, 3);
    fireEvent.keyDown(h, { key: 'ArrowDown' });
    expect(resizeWidget).toHaveBeenLastCalledWith('w1', 4, 4);
    resizeWidget.mockClear();
    fireEvent.keyDown(h, { key: 'a' });
    expect(resizeWidget).not.toHaveBeenCalled();
  });
});
