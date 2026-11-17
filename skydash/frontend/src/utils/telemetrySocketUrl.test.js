import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import { telemetrySocketUrl } from './telemetrySocketUrl';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));
const socket = 'wss://example.test/ws/telemetry';
const api = 'https://example.test';
const token = 'synthetic-session&value';

beforeEach(() => vi.resetAllMocks());

describe('telemetrySocketUrl', () => {
  it('keeps auth-off connections unchanged', async () => {
    expect(await telemetrySocketUrl(socket, api, null)).toBe(socket);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('uses only the one-time ticket on modern servers', async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { ticket: 'once&only' } }) });
    const url = await telemetrySocketUrl(socket, api, token);
    expect(url).toBe(`${socket}?ticket=once%26only`);
    expect(url).not.toContain('session');
    expect(apiFetch).toHaveBeenCalledWith(`${api}/api/auth/ws-ticket`, { method: 'POST' });
  });

  it.each([404, 405])('supports a legacy server without the endpoint (%s)', async (status) => {
    apiFetch.mockResolvedValue({ ok: false, status });
    expect(await telemetrySocketUrl(socket, api, token)).toBe(`${socket}?token=synthetic-session%26value`);
  });

  it.each([401, 403, 429, 500, 503])('does not expose a session token after HTTP %s', async (status) => {
    apiFetch.mockResolvedValue({ ok: false, status });
    await expect(telemetrySocketUrl(socket, api, token)).rejects.toThrow('ticket request failed');
  });

  it('does not downgrade after a network failure', async () => {
    apiFetch.mockRejectedValue(new Error('Network unavailable'));
    await expect(telemetrySocketUrl(socket, api, token)).rejects.toThrow('Network unavailable');
  });

  it.each([{}, { data: {} }, { data: { ticket: 42 } }, { data: { ticket: '' } }])(
    'rejects malformed ticket responses', async (body) => {
      apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });
      await expect(telemetrySocketUrl(socket, api, token)).rejects.toThrow('Invalid WebSocket ticket');
    },
  );
});
