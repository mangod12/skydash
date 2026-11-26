// @vitest-environment jsdom
import { useRef } from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDialogFocus } from './useDialogFocus';

function Harness({ open, withInitialFocus = false }) {
  const ref = useRef(null);
  useDialogFocus(open, ref);
  return (
    <div>
      <button>opener</button>
      {open && (
        <div ref={ref} tabIndex={-1} role="dialog">
          <button>first</button>
          <input aria-label="field" autoFocus={withInitialFocus} />
          <button>last</button>
        </div>
      )}
    </div>
  );
}

const flush = () => act(() => { vi.advanceTimersByTime(50); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useDialogFocus', () => {
  it('moves focus to the first control on open and restores the opener on close', () => {
    const { rerender } = render(<Harness open={false} />);
    screen.getByText('opener').focus();
    rerender(<Harness open />);
    flush();
    expect(document.activeElement).toBe(screen.getByText('first'));
    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(screen.getByText('opener'));
  });

  it('keeps focus already inside the dialog', () => {
    const { rerender } = render(<Harness open={false} withInitialFocus />);
    rerender(<Harness open withInitialFocus />);
    flush();
    expect(document.activeElement).toBe(screen.getByLabelText('field'));
  });

  it('wraps Tab and Shift+Tab inside the dialog', () => {
    const { rerender } = render(<Harness open={false} />);
    rerender(<Harness open />);
    flush();
    screen.getByText('last').focus();
    const tab = fireEvent.keyDown(document, { key: 'Tab' });
    expect(tab).toBe(false);
    expect(document.activeElement).toBe(screen.getByText('first'));
    const back = fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(back).toBe(false);
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('pulls stray focus back in and leaves middle tabs alone', () => {
    const { rerender } = render(<Harness open={false} />);
    rerender(<Harness open />);
    flush();
    screen.getByText('opener').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('first'));
    screen.getByLabelText('field').focus();
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true);
  });
});
