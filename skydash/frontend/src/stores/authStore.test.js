import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, authEnabled: null, error: null });
  });

  it('returns no auth header without a token', () => {
    expect(useAuthStore.getState().getAuthHeader()).toEqual({});
  });

  it('returns a bearer header when a token is set', () => {
    useAuthStore.setState({ token: 'abc' });
    expect(useAuthStore.getState().getAuthHeader()).toEqual({ Authorization: 'Bearer abc' });
  });

  it('logout clears token and user', () => {
    useAuthStore.setState({ token: 'abc', user: { username: 'u' } });
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect([s.token, s.user]).toEqual([null, null]);
  });

  describe('with a mocked backend', () => {
    afterEach(() => vi.unstubAllGlobals());
    const mockFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));
    const json = (body, status = 200) => Promise.resolve({ status, json: () => Promise.resolve(body) });

    it('login stores the token and user on success', async () => {
      mockFetch(() => json({ success: true, data: { token: 't1', user: { username: 'op' } } }));
      expect(await useAuthStore.getState().login('op', 'pw')).toBe(true);
      const s = useAuthStore.getState();
      expect([s.token, s.user.username, s.error]).toEqual(['t1', 'op', null]);
    });

    it('login reports the server error on failure', async () => {
      mockFetch(() => json({ success: false, error: 'Bad credentials' }, 401));
      expect(await useAuthStore.getState().login('op', 'x')).toBe(false);
      expect(useAuthStore.getState().error).toBe('Bad credentials');
    });

    it('login reports an unreachable server', async () => {
      mockFetch(() => Promise.reject(new Error('down')));
      expect(await useAuthStore.getState().login('op', 'x')).toBe(false);
      expect(useAuthStore.getState().error).toBe('Cannot reach server');
    });

    it('does not restore a session when login completes after logout', async () => {
      let resolve;
      mockFetch(() => new Promise((done) => { resolve = done; }));
      const pending = useAuthStore.getState().login('old', 'pw');
      useAuthStore.getState().logout();
      resolve(await json({ success: true, data: { token: 'old-token', user: { username: 'old' } } }));
      expect(await pending).toBe(false);
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('does not overwrite a newer login with an older success', async () => {
      let resolve;
      mockFetch(() => new Promise((done) => { resolve = done; }));
      const old = useAuthStore.getState().login('old', 'pw');
      mockFetch(() => json({ success: true, data: { token: 'new-token', user: { username: 'new' } } }));
      expect(await useAuthStore.getState().login('new', 'pw')).toBe(true);
      resolve(await json({ success: true, data: { token: 'old-token', user: { username: 'old' } } }));
      expect(await old).toBe(false);
      expect(useAuthStore.getState().token).toBe('new-token');
      expect(useAuthStore.getState().user.username).toBe('new');
    });

    it('ignores a stale login network error after a newer success', async () => {
      let reject;
      mockFetch(() => new Promise((_resolve, fail) => { reject = fail; }));
      const old = useAuthStore.getState().login('old', 'pw');
      mockFetch(() => json({ success: true, data: { token: 'new-token', user: { username: 'new' } } }));
      await useAuthStore.getState().login('new', 'pw');
      reject(new Error('late failure'));
      expect(await old).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
      expect(useAuthStore.getState().token).toBe('new-token');
    });

    it('checkAuth detects protected and open responses', async () => {
      mockFetch(() => json({}, 401));
      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().authEnabled).toBe(true);
      mockFetch(() => json({}, 200));
      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().authEnabled).toBe(false);
    });

    it.each([null, true, false])('preserves auth mode %s on unsuccessful probes', async (authEnabled) => {
      useAuthStore.setState({ authEnabled });
      for (const status of [403, 404, 429, 500, 503]) {
        mockFetch(() => json({}, status));
        await useAuthStore.getState().checkAuth();
        expect(useAuthStore.getState().authEnabled).toBe(authEnabled);
      }
      mockFetch(() => Promise.reject(new Error('down')));
      await useAuthStore.getState().checkAuth();
      expect(useAuthStore.getState().authEnabled).toBe(authEnabled);
    });
  });
});
