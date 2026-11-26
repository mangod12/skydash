// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, renderHook, act } from '@testing-library/react';
import ContextMenu, { useContextMenu } from './ContextMenu';

afterEach(cleanup);

const items = (over = {}) => [
  { label: 'Inspect', action: vi.fn() },
  { separator: true },
  { label: 'Delete', action: vi.fn(), danger: true },
  { label: 'Locked', action: vi.fn(), disabled: true },
  ...(over.extra || []),
];

describe('ContextMenu', () => {
  it('renders items and runs the action, then closes', () => {
    const list = items();
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={list} onClose={onClose} />);
    fireEvent.click(screen.getByText('Inspect'));
    expect(list[0].action).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not run a disabled action', () => {
    const list = items();
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={list} onClose={onClose} />);
    expect(screen.getByText('Locked').closest('button').disabled).toBe(true);
    fireEvent.click(screen.getByText('Locked'));
    expect(list[3].action).not.toHaveBeenCalled();
  });

  it('closes on Escape, outside mousedown and scroll, but not on inside mousedown', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={items()} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByText('Inspect'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.scroll(window);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the menu inside the viewport', () => {
    window.innerWidth = 400;
    window.innerHeight = 300;
    render(<ContextMenu x={999} y={999} items={items()} onClose={() => {}} />);
    const menu = screen.getByText('Inspect').closest('div[style]');
    const left = parseFloat(menu.style.left);
    const top = parseFloat(menu.style.top);
    expect(left).toBe(400 - 224 - 8);
    expect(top).toBeLessThan(300 - 8);
    expect(top).toBeGreaterThan(0);
  });

  it('removes its listeners on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ContextMenu x={1} y={1} items={items()} onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useContextMenu', () => {
  it('shows and hides a menu', () => {
    const { result } = renderHook(() => useContextMenu());
    expect(result.current.menu).toBeNull();
    act(() => result.current.show(5, 6, [{ label: 'A' }]));
    expect(result.current.menu).toEqual({ x: 5, y: 6, items: [{ label: 'A' }] });
    act(() => result.current.hide());
    expect(result.current.menu).toBeNull();
  });
});
