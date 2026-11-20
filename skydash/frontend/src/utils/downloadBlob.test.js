// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './downloadBlob';

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => 'blob:local-download');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('temporary local download resources', () => {
  it('keeps exact blob and filename, removes anchor and revokes only after acceptance window', () => {
    const blob = new Blob(['private exact content'], { type: 'application/json' });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe('exact-previous.json');
      expect(this.getAttribute('href')).toBe('blob:local-download');
    });
    downloadBlob(blob, 'exact-previous.json');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:local-download');
  });

  it.each(['create', 'href', 'append', 'click'])('cleans partial resources and preserves %s failure for caller', stage => {
    const failure = new Error(`${stage} failed`);
    const anchor = document.createElement('a');
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(name => {
      if (name !== 'a') return create(name);
      if (stage === 'create') throw failure;
      return anchor;
    });
    if (stage === 'href') Object.defineProperty(anchor, 'href', { set() { throw failure; } });
    if (stage === 'append') vi.spyOn(document.body, 'appendChild').mockImplementation(() => { throw failure; });
    vi.spyOn(anchor, 'click').mockImplementation(() => { if (stage === 'click') throw failure; });
    expect(() => downloadBlob(new Blob(['x']), 'x.txt')).toThrow(failure);
    expect(anchor.isConnected).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:local-download');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not create an anchor or schedule work if object URL creation fails', () => {
    const failure = new Error('object URL denied');
    URL.createObjectURL.mockImplementation(() => { throw failure; });
    const create = vi.spyOn(document, 'createElement');
    expect(() => downloadBlob(new Blob(['x']), 'x.txt')).toThrow(failure);
    expect(create).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
