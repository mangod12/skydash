import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('logout with unavailable browser storage', () => {
  it.each(['skydash_token', 'skydash_user'])('clears the active session when removing %s fails', async (brokenKey) => {
    const removeItem = vi.fn((key) => {
      if (key === brokenKey) throw new Error('Storage unavailable');
    });
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({ token: 'old-token', user: { username: 'old' } });
    expect(() => useAuthStore.getState().logout()).not.toThrow();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().getAuthHeader()).toEqual({});
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual(['skydash_token', 'skydash_user']);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout'), {
      method: 'POST', headers: { Authorization: 'Bearer old-token' },
    });
  });

  it('still invalidates a pending login when storage removal fails', async () => {
    let resolve;
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      removeItem: () => { throw new Error('Storage unavailable'); },
      setItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done; })));
    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    const pending = useAuthStore.getState().login('old', 'pw');
    useAuthStore.getState().logout();
    resolve({ status: 200, json: async () => ({
      success: true, data: { token: 'late-token', user: { username: 'old' } },
    }) });
    expect(await pending).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('auth initialization with blocked storage', () => {
  it('loads without a saved session when storage reads throw', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Denied'); } });
    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().getAuthHeader()).toEqual({});
  });

  it('loads when access to the storage property itself is denied', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => { throw new Error('Storage access denied'); },
      });
      vi.resetModules();
      const { useAuthStore } = await import('./authStore');
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(() => useAuthStore.getState().logout()).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else delete globalThis.localStorage;
    }
  });
});

describe('login with blocked storage writes', () => {
  it.each(['skydash_token', 'skydash_user'])('keeps a valid tab session when persisting %s fails', async (brokenKey) => {
    const saved = new Map([['skydash_token', 'old-token'], ['skydash_user', JSON.stringify({ username: 'old' })]]);
    const removeItem = vi.fn((key) => saved.delete(key));
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) || null,
      setItem: (key, value) => {
        if (key === brokenKey) throw new Error('Storage full');
        saved.set(key, value);
      },
      removeItem,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: async () => ({
      success: true, data: { token: 'new-token', user: { username: 'new' } },
    }) }));
    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    expect(await useAuthStore.getState().login('new', 'pw')).toBe(true);
    expect(useAuthStore.getState().token).toBe('new-token');
    expect(useAuthStore.getState().user.username).toBe('new');
    expect(useAuthStore.getState().error).toBeNull();
    expect(saved.size).toBe(0);
    expect(removeItem).toHaveBeenCalledTimes(2);
  });
});
