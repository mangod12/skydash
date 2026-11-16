import { describe, it, expect } from 'vitest';
import { connectionPhase, WAKE_GRACE_MS } from './connectionPhase';

const base = { isConnected: false, hasEverConnected: false, startedAt: 0 };

describe('connectionPhase', () => {
  it('is connected when the link is live', () => {
    expect(connectionPhase({ ...base, isConnected: true, now: 10 })).toBe('connected');
  });
  it('is waking during the first minute without a connection', () => {
    expect(connectionPhase({ ...base, now: WAKE_GRACE_MS - 1 })).toBe('waking');
  });
  it('is offline after the grace period', () => {
    expect(connectionPhase({ ...base, now: WAKE_GRACE_MS })).toBe('offline');
  });
  it('is offline right away if it was connected before', () => {
    expect(connectionPhase({ ...base, hasEverConnected: true, now: 5 })).toBe('offline');
  });
});
