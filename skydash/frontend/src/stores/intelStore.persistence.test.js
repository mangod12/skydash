// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntelStore } from './intelStore';
import { apiFetch } from '../utils/api';

vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));
const entity = { id: 'sync-contact', name: 'Original', type: 'vehicle', confidence: 25 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('MODE', 'development');
  useIntelStore.setState({ entities: [{ ...entity }], syncError: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('entity update persistence errors', () => {
  it.each([403, 422, 500])('reports HTTP %s instead of silently claiming sync', async (status) => {
    apiFetch.mockResolvedValue({ ok: false, status });
    await useIntelStore.getState().updateEntity(entity.id, { confidence: 80 });
    expect(useIntelStore.getState().syncError).toBe(`Entity update failed (HTTP ${status})`);
  });

  it.each([{ success: false, error: 'failure' }, { success: true }])(
    'rejects unsuccessful or incomplete success bodies', async (body) => {
      apiFetch.mockResolvedValue({ ok: true, json: async () => body });
      await useIntelStore.getState().updateEntity(entity.id, { confidence: 80 });
      expect(useIntelStore.getState().syncError).toBe('Entity update was not saved');
    },
  );

  it('accepts the canonical server record and clears a prior error', async () => {
    useIntelStore.setState({ syncError: 'Prior failure' });
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { ...entity, confidence: 75 } }) });
    await useIntelStore.getState().updateEntity(entity.id, { confidence: 80 });
    expect(useIntelStore.getState().entities[0].confidence).toBe(75);
    expect(useIntelStore.getState().syncError).toBeNull();
  });

  it('continues reporting network errors', async () => {
    apiFetch.mockRejectedValue(new Error('Network unavailable'));
    await useIntelStore.getState().updateEntity(entity.id, { confidence: 80 });
    expect(useIntelStore.getState().syncError).toBe('Network unavailable');
  });
});
