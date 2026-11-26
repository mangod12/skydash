// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboard } from './useKeyboard';
import { useUIStore } from '../stores/uiStore';

const press = (key, init = {}, target = window) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

beforeEach(() => {
  useUIStore.setState({ activeView: 'dashboard', commandPaletteOpen: false, consoleOpen: false, notificationOpen: false });
});
afterEach(cleanup);

describe('useKeyboard', () => {
  it('switches views with single keys and opens help', () => {
    const onHelp = vi.fn();
    renderHook(() => useKeyboard({ onHelp }));
    press('m');
    expect(useUIStore.getState().activeView).toBe('map');
    press('a');
    expect(useUIStore.getState().activeView).toBe('analytics');
    press('?');
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+K and Cmd+K toggle the command palette and prevent default', () => {
    renderHook(() => useKeyboard());
    expect(press('k', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    press('k', { metaKey: true });
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('does not hijack browser or OS combos like Ctrl+A or Cmd+D', () => {
    renderHook(() => useKeyboard());
    press('a', { ctrlKey: true });
    press('d', { metaKey: true });
    press('t', { altKey: true });
    expect(useUIStore.getState().activeView).toBe('dashboard');
  });

  it('ignores shortcuts while typing in inputs, selects and editable text', () => {
    renderHook(() => useKeyboard());
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      press('m', {}, el);
      el.remove();
    }
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.appendChild(editable);
    press('m', {}, editable);
    editable.remove();
    expect(useUIStore.getState().activeView).toBe('dashboard');
  });

  it('Escape closes the console first, then the palette, then notifications', () => {
    renderHook(() => useKeyboard());
    useUIStore.setState({ consoleOpen: true, commandPaletteOpen: true, notificationOpen: true });
    press('Escape');
    expect(useUIStore.getState()).toMatchObject({ consoleOpen: false, commandPaletteOpen: true, notificationOpen: true });
    press('Escape');
    expect(useUIStore.getState()).toMatchObject({ commandPaletteOpen: false, notificationOpen: true });
    press('Escape');
    expect(useUIStore.getState().notificationOpen).toBe(false);
  });

  it('removes its listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboard());
    unmount();
    press('m');
    expect(useUIStore.getState().activeView).toBe('dashboard');
  });
});
