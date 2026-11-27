// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

let resizeCb;
let observed = 0;
beforeEach(() => {
  observed = 0;
  globalThis.ResizeObserver = class {
    constructor(cb) { resizeCb = cb; }
    observe() { observed += 1; }
    disconnect() {}
  };
});
afterEach(cleanup);

import VirtualList from './VirtualList';

const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
const row = (it) => <div key={it.id} data-row={it.id}>row {it.id}</div>;
const rows = (c) => [...c.querySelectorAll('[data-row]')].map((n) => Number(n.dataset.row));

describe('VirtualList', () => {
  it('renders nothing for empty items', () => {
    const { container } = render(<VirtualList items={[]} itemHeight={20} renderItem={row} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders only the visible window plus overscan', () => {
    const { container } = render(<VirtualList items={items} itemHeight={20} renderItem={row} overscan={2} />);
    act(() => resizeCb([{ contentRect: { height: 100 } }]));
    expect(rows(container)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(container.firstChild.firstChild.style.height).toBe('2000px');
  });

  it('moves the window on scroll and offsets it', () => {
    const { container } = render(<VirtualList items={items} itemHeight={20} renderItem={row} overscan={1} />);
    act(() => resizeCb([{ contentRect: { height: 100 } }]));
    const scroller = container.firstChild;
    scroller.scrollTop = 400;
    act(() => { scroller.dispatchEvent(new Event('scroll')); });
    expect(rows(container)).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(scroller.firstChild.firstChild.style.transform).toBe('translateY(380px)');
  });

  it('starts observing when items arrive after an empty first render', () => {
    const { rerender, container } = render(<VirtualList items={[]} itemHeight={20} renderItem={row} />);
    expect(observed).toBe(0);
    rerender(<VirtualList items={items} itemHeight={20} renderItem={row} overscan={1} />);
    expect(observed).toBe(1);
    act(() => resizeCb([{ contentRect: { height: 100 } }]));
    expect(rows(container).length).toBeLessThan(10);
  });
});
