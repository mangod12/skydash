import { describe, it, expect } from 'vitest';
import { idleLimitMs, idleState } from './idleTimeout';

describe('idleLimitMs', () => {
  it('defaults to 15 minutes', () => {
    expect(idleLimitMs({})).toBe(900000);
  });
  it('reads minutes from the env and 0 disables', () => {
    expect(idleLimitMs({ VITE_IDLE_TIMEOUT_MINUTES: '5' })).toBe(300000);
    expect(idleLimitMs({ VITE_IDLE_TIMEOUT_MINUTES: '0' })).toBe(0);
    expect(idleLimitMs({ VITE_IDLE_TIMEOUT_MINUTES: 'abc' })).toBe(0);
  });
});

describe('idleState', () => {
  it('moves from active to warning to expired', () => {
    expect(idleState(0, 300000)).toBe('active');
    expect(idleState(240000, 300000)).toBe('warning');
    expect(idleState(300000, 300000)).toBe('expired');
  });
  it('never expires when disabled', () => {
    expect(idleState(10 ** 9, 0)).toBe('active');
  });
});
