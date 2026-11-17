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

  it.each([[], 'invalid', {}, { id: 'wrong-contact', confidence: 1 }])(
    'does not replace a contact with an invalid canonical record: %j', async (data) => {
      apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data }) });
      await useIntelStore.getState().updateEntity(entity.id, { confidence: 80 });
      expect(useIntelStore.getState().syncError).toBe('Entity update was not saved');
      expect(useIntelStore.getState().entities[0]).toMatchObject({ id: entity.id, name: 'Original', confidence: 80 });
    },
  );

  it('requires a boolean success acknowledgement even with a matching identity', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: 'false', data: { ...entity, confidence: 1 } }) });
    await useIntelStore.getState().updateEntity(entity.id, { confidence: 80 });
    expect(useIntelStore.getState().syncError).toBe('Entity update was not saved');
    expect(useIntelStore.getState().entities[0].confidence).toBe(80);
  });

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


describe('entity update response ordering', () => {
  it.each(['success', 'error'])('ignores old %s after a newer edit is saved', async (outcome) => {
    let finish;
    apiFetch.mockReturnValueOnce(new Promise((resolve, reject) => { finish = outcome === 'error' ? reject : resolve; }));
    const older = useIntelStore.getState().updateEntity(entity.id, { confidence: 40 });
    apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { ...entity, confidence: 90 } }) });
    await useIntelStore.getState().updateEntity(entity.id, { confidence: 90 });
    if (outcome === 'error') finish(new Error('old failure'));
    else finish({ ok: true, json: async () => ({ success: true, data: { ...entity, confidence: 40 } }) });
    await older;
    expect(useIntelStore.getState().entities[0].confidence).toBe(90);
    expect(useIntelStore.getState().syncError).toBeNull();
  });
});


describe('independent entity update lifecycles', () => {
  it('does not suppress a different contact update', async () => {
    const other = { ...entity, id: 'other' };
    useIntelStore.setState({ entities: [{ ...entity }, other] });
    const finish = [];
    apiFetch.mockImplementation(() => new Promise((resolve) => finish.push(resolve)));
    const first = useIntelStore.getState().updateEntity(entity.id, { confidence: 40 });
    const second = useIntelStore.getState().updateEntity(other.id, { confidence: 80 });
    finish[1]({ ok: true, json: async () => ({ success: true, data: { ...other, confidence: 75 } }) });
    await second;
    finish[0]({ ok: true, json: async () => ({ success: true, data: { ...entity, confidence: 35 } }) });
    await first;
    expect(useIntelStore.getState().entities.map((e) => e.confidence)).toEqual([35, 75]);
  });

  it('does not clear a newer failure when an old save finishes', async () => {
    let finishOld;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
    const older = useIntelStore.getState().updateEntity(entity.id, { confidence: 40 });
    apiFetch.mockRejectedValueOnce(new Error('new failure'));
    await useIntelStore.getState().updateEntity(entity.id, { confidence: 90 });
    finishOld({ ok: true, json: async () => ({ success: true, data: { ...entity, confidence: 40 } }) });
    await older;
    expect(useIntelStore.getState().syncError).toBe('new failure');
    expect(useIntelStore.getState().entities[0].confidence).toBe(90);
  });

  it('invalidates pending edits when a contact is deleted and recreated', async () => {
    let finishOld;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
    const older = useIntelStore.getState().updateEntity(entity.id, { confidence: 40 });
    apiFetch.mockResolvedValueOnce({ ok: true });
    useIntelStore.getState().deleteEntity(entity.id);
    useIntelStore.getState().addEntity({ ...entity, name: 'Replacement', confidence: 70 });
    finishOld({ ok: true, json: async () => ({ success: true, data: { ...entity, confidence: 40 } }) });
    await older;
    expect(useIntelStore.getState().entities[0]).toMatchObject({ name: 'Replacement', confidence: 70 });
  });
});
