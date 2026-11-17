import { apiFetch } from './api';

/** Only legacy servers without a ticket endpoint may use the token URL. */
export async function telemetrySocketUrl(wsUrl, apiBase, token) {
  if (!token) return wsUrl;
  const response = await apiFetch(`${apiBase}/api/auth/ws-ticket`, { method: 'POST' });
  if (response.status === 404 || response.status === 405) {
    return `${wsUrl}?token=${encodeURIComponent(token)}`;
  }
  if (!response.ok) throw new Error('WebSocket ticket request failed');
  const ticket = (await response.json())?.data?.ticket;
  if (typeof ticket !== 'string' || !ticket) throw new Error('Invalid WebSocket ticket response');
  return `${wsUrl}?ticket=${encodeURIComponent(ticket)}`;
}
