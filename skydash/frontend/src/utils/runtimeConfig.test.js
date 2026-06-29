import { describe, expect, it } from 'vitest';
import { deriveWsBase } from './runtimeConfig';

describe('deriveWsBase', () => {
  it('maps HTTPS API endpoints to secure WebSocket endpoints', () => {
    expect(deriveWsBase('https://skydash-api-38666.azurewebsites.net')).toBe(
      'wss://skydash-api-38666.azurewebsites.net',
    );
  });

  it('maps HTTP API endpoints to local WebSocket endpoints', () => {
    expect(deriveWsBase('http://localhost:8001')).toBe('ws://localhost:8001');
  });

  it('preserves non-HTTP bases and empty values', () => {
    expect(deriveWsBase('ws://localhost:8001')).toBe('ws://localhost:8001');
    expect(deriveWsBase('')).toBe('');
  });
});
