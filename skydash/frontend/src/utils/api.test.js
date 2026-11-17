import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

vi.mock('../stores/authStore', () => ({ useAuthStore: { getState: vi.fn() } }));
let session;
beforeEach(() => {
  session = { token: 'old', logout: vi.fn(), getAuthHeader: () => ({ Authorization: `Bearer ${session.token}` }) };
  useAuthStore.getState.mockImplementation(() => session);
});
afterEach(() => vi.unstubAllGlobals());

describe('authenticated request session boundaries', () => {
  it('logs out the current session on its own unauthorized response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
    await expect(apiFetch('/api/entities')).rejects.toThrow('Unauthorized');
    expect(session.logout).toHaveBeenCalledOnce();
  });

  it('does not log out a newer login when an old request returns 401', async () => {
    let resolve;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done; })));
    const request = apiFetch('/api/entities');
    const rejection = expect(request).rejects.toThrow('Unauthorized');
    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer old');
    session = { ...session, token: 'new', logout: vi.fn() };
    resolve({ status: 401 });
    await rejection;
    expect(session.logout).not.toHaveBeenCalled();
    expect(session.token).toBe('new');
  });

  it.each([
    new Headers({ 'Content-Type': 'application/json', 'X-Request-ID': 'req-1' }),
    [['Content-Type', 'application/json'], ['X-Request-ID', 'req-1']],
  ])('preserves standard HeadersInit forms', async (headers) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    await apiFetch('/api/entities', { headers });
    const sent = new Headers(fetch.mock.calls[0][1].headers);
    expect(sent.get('content-type')).toBe('application/json');
    expect(sent.get('x-request-id')).toBe('req-1');
    expect(sent.get('authorization')).toBe('Bearer old');
  });

  it('replaces an old authorization header regardless of casing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    await apiFetch('/api/entities', { headers: { authorization: 'Bearer obsolete' } });
    expect(fetch.mock.calls[0][1].headers).toEqual({ authorization: 'Bearer old' });
  });

  it('returns successful responses and preserves request options', async () => {
    const response = { status: 200 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    expect(await apiFetch('/api/entities', { method: 'PUT', headers: { 'Content-Type': 'application/json' } })).toBe(response);
    expect(fetch).toHaveBeenCalledWith('/api/entities', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer old' } });
    expect(session.logout).not.toHaveBeenCalled();
  });
});
