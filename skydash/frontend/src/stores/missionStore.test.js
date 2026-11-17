import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../components/common/Toast', () => ({ toast: vi.fn() }));
vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));

import { useMissionStore } from './missionStore';
import { apiFetch } from '../utils/api';
import { toast } from '../components/common/Toast';

const reply = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
const mission = (id, extra = {}) => ({ id, name: `M${id}`, status: 'planned', ...extra });

describe('missionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useMissionStore.setState({ missions: [], activeMissionId: null, loading: false, fetchError: false, visionStatus: null });
  });

  it('fetchMissions selects the active mission, else the first', async () => {
    apiFetch.mockReturnValueOnce(reply({ success: true, data: [mission(1), mission(2, { status: 'active' })] }));
    await useMissionStore.getState().fetchMissions();
    expect(useMissionStore.getState().activeMissionId).toBe(2);
    expect(useMissionStore.getState().loading).toBe(false);

    useMissionStore.setState({ activeMissionId: null });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: [mission(5), mission(6)] }));
    await useMissionStore.getState().fetchMissions();
    expect(useMissionStore.getState().activeMissionId).toBe(5);
  });

  it('fetchMissions keeps a still-valid active mission and toasts on failure', async () => {
    useMissionStore.setState({ activeMissionId: 1 });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: [mission(1), mission(2, { status: 'active' })] }));
    await useMissionStore.getState().fetchMissions();
    expect(useMissionStore.getState().activeMissionId).toBe(1);

    apiFetch.mockRejectedValueOnce(new Error('down'));
    await useMissionStore.getState().fetchMissions();
    expect(toast).toHaveBeenCalledWith('Failed to load missions', 'error');
    expect(useMissionStore.getState().loading).toBe(false);
  });

  it.each([
    [{ success: false, error: 'Unavailable' }, true],
    [{ success: true, data: [] }, false],
    [{ success: true }, true],
    [{ success: true, data: {} }, true],
    [null, true],
  ])('preserves missions and exposes failed list responses (%j, %s)', async (body, ok) => {
    const original = [mission(1)];
    useMissionStore.setState({ missions: original, activeMissionId: 1 });
    apiFetch.mockReturnValueOnce(reply(body, ok));
    await useMissionStore.getState().fetchMissions();
    expect(useMissionStore.getState().missions).toEqual(original);
    expect(useMissionStore.getState().activeMissionId).toBe(1);
    expect(useMissionStore.getState().fetchError).toBe(true);
    expect(useMissionStore.getState().loading).toBe(false);
    expect(toast).toHaveBeenCalledWith('Failed to load missions', 'error');

    apiFetch.mockReturnValueOnce(reply({ success: true, data: [] }));
    await useMissionStore.getState().fetchMissions();
    expect(useMissionStore.getState().fetchError).toBe(false);
    expect(useMissionStore.getState().missions).toEqual([]);
    expect(useMissionStore.getState().activeMissionId).toBeNull();
  });

  it('createMission prepends, updateMission merges, deleteMission clears active', async () => {
    useMissionStore.setState({ missions: [mission(1)], activeMissionId: 1 });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: mission(2) }));
    expect((await useMissionStore.getState().createMission({ name: 'x' })).id).toBe(2);
    expect(useMissionStore.getState().missions.map((m) => m.id)).toEqual([2, 1]);

    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 1, name: 'renamed' } }));
    await useMissionStore.getState().updateMission(1, { name: 'renamed' });
    expect(useMissionStore.getState().missions.find((m) => m.id === 1)).toMatchObject({ name: 'renamed', status: 'planned' });

    apiFetch.mockReturnValueOnce(reply({ success: true }));
    expect(await useMissionStore.getState().deleteMission(1)).toBe(true);
    expect(useMissionStore.getState().activeMissionId).toBeNull();
    expect(useMissionStore.getState().missions.map((m) => m.id)).toEqual([2]);
  });

  it.each([
    ['createMission', [{ name: 'New' }], 'Failed to create mission', null],
    ['updateMission', [1, { name: 'Changed' }], 'Failed to update mission', null],
    ['deleteMission', [1], 'Failed to delete mission', false],
  ])('reports %s failures and preserves existing state', async (action, args, message, result) => {
    const original = [mission(1)];
    useMissionStore.setState({ missions: original, activeMissionId: 1 });
    for (const [body, ok] of [
      [{ success: false, error: 'Rejected' }, true],
      [{ success: true, data: mission(2) }, false],
      [null, true],
    ]) {
      apiFetch.mockReturnValueOnce(reply(body, ok));
      expect(await useMissionStore.getState()[action](...args)).toBe(result);
      expect(useMissionStore.getState().missions).toEqual(original);
      expect(useMissionStore.getState().activeMissionId).toBe(1);
      expect(toast).toHaveBeenLastCalledWith(message, 'error');
    }
  });

  it.each(['createMission', 'updateMission'])('rejects incomplete %s acknowledgements', async (action) => {
    useMissionStore.setState({ missions: [mission(1)], activeMissionId: 1 });
    for (const data of [undefined, null, [], 'invalid']) {
      apiFetch.mockReturnValueOnce(reply({ success: true, data }));
      expect(await useMissionStore.getState()[action](1, {})).toBeNull();
      expect(useMissionStore.getState().missions).toEqual([mission(1)]);
      expect(useMissionStore.getState().activeMissionId).toBe(1);
    }
  });

  it('returns null or false when the API reports failure', async () => {
    apiFetch.mockReturnValue(reply({ success: false }));
    expect(await useMissionStore.getState().createMission({})).toBeNull();
    expect(await useMissionStore.getState().deleteMission(1)).toBe(false);
    expect(await useMissionStore.getState().addNote(1, 'n')).toBeNull();
  });

  it('adds and removes entities on a mission', async () => {
    useMissionStore.setState({ missions: [mission(1, { entityIds: ['a'] })] });
    apiFetch.mockReturnValueOnce(reply({ success: true }));
    await useMissionStore.getState().addEntityToMission(1, 'b');
    expect(useMissionStore.getState().missions[0].entityIds).toEqual(['a', 'b']);
    apiFetch.mockReturnValueOnce(reply({ success: true }));
    await useMissionStore.getState().removeEntityFromMission(1, 'a');
    expect(useMissionStore.getState().missions[0].entityIds).toEqual(['b']);
  });

  it('adds and deletes notes and detections', async () => {
    useMissionStore.setState({ missions: [mission(1)] });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 'n1', content: 'hi' } }));
    await useMissionStore.getState().addNote(1, 'hi');
    expect(useMissionStore.getState().missions[0].notes).toHaveLength(1);
    apiFetch.mockReturnValueOnce(reply({ success: true }));
    await useMissionStore.getState().deleteNote(1, 'n1');
    expect(useMissionStore.getState().missions[0].notes).toEqual([]);

    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 'd1' } }));
    await useMissionStore.getState().monitorSampleVideo(1);
    expect(useMissionStore.getState().missions[0].detections).toHaveLength(1);
    apiFetch.mockReturnValueOnce(reply({ success: true }));
    await useMissionStore.getState().deleteDetection(1, 'd1');
    expect(useMissionStore.getState().missions[0].detections).toEqual([]);
  });

  it('fetchMissionDetail merges detail and uses a correct error message', async () => {
    useMissionStore.setState({ missions: [mission(1)] });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { entities: ['a'], notes: [], detections: [] } }));
    await useMissionStore.getState().fetchMissionDetail(1);
    expect(useMissionStore.getState().missions[0].entityIds).toEqual(['a']);

    apiFetch.mockReturnValueOnce(reply({ success: false }, false));
    expect(await useMissionStore.getState().fetchMissionDetail(1)).toBe(false);
    expect(toast).toHaveBeenCalledWith('Failed to load mission', 'error');
  });

  it('stores vision status and resolves the active mission', async () => {
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { ready: true } }));
    await useMissionStore.getState().fetchVisionStatus();
    expect(useMissionStore.getState().visionStatus).toEqual({ ready: true });

    useMissionStore.setState({ missions: [mission(1), mission(2)] });
    useMissionStore.getState().setActiveMission(2);
    expect(useMissionStore.getState().getActiveMission().id).toBe(2);
    useMissionStore.getState().setActiveMission(99);
    expect(useMissionStore.getState().getActiveMission()).toBeNull();
  });
});
