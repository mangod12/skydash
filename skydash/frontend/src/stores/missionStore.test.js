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

  it.each(['success', 'error'])('ignores an older refresh resolving with %s after the newer refresh', async (outcome) => {
    let finishOld;
    apiFetch.mockReturnValueOnce(new Promise((resolve, reject) => { finishOld = outcome === 'error' ? reject : resolve; }));
    const oldRefresh = useMissionStore.getState().fetchMissions();
    apiFetch.mockReturnValueOnce(reply({ success: true, data: [mission(2)] }));
    await useMissionStore.getState().fetchMissions();
    if (outcome === 'error') finishOld(new Error('old request failed'));
    else finishOld(await reply({ success: true, data: [mission(1)] }));
    await oldRefresh;
    expect(useMissionStore.getState().missions.map((m) => m.id)).toEqual([2]);
    expect(useMissionStore.getState().activeMissionId).toBe(2);
    expect(useMissionStore.getState().fetchError).toBe(false);
    expect(useMissionStore.getState().loading).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps loading while the latest refresh remains unresolved', async () => {
    let finishOld;
    let finishNew;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
    const oldRefresh = useMissionStore.getState().fetchMissions();
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { finishNew = resolve; }));
    const newRefresh = useMissionStore.getState().fetchMissions();
    finishOld(await reply({ success: true, data: [mission(1)] }));
    await oldRefresh;
    expect(useMissionStore.getState().loading).toBe(true);
    finishNew(await reply({ success: true, data: [mission(2)] }));
    await newRefresh;
    expect(useMissionStore.getState().loading).toBe(false);
    expect(useMissionStore.getState().missions.map((m) => m.id)).toEqual([2]);
  });

  it.each([{}, { id: null }, { id: '' }, { id: {} }, null])('rejects list records without a usable mission identity: %j', async (bad) => {
    const original = [mission(1)];
    useMissionStore.setState({ missions: original, activeMissionId: 1 });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: [mission(2), bad] }));
    await useMissionStore.getState().fetchMissions();
    expect(useMissionStore.getState().missions).toEqual(original);
    expect(useMissionStore.getState().activeMissionId).toBe(1);
    expect(useMissionStore.getState().fetchError).toBe(true);
    expect(useMissionStore.getState().loading).toBe(false);
  });

  it('rejects a save acknowledgement for the wrong mission', async () => {
    useMissionStore.setState({ missions: [mission(1)] });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: mission(2) }));
    expect(await useMissionStore.getState().updateMission(1, { name: 'New' })).toBeNull();
    expect(useMissionStore.getState().missions).toEqual([mission(1)]);
  });

  it.each(['success', 'network failure'])('ignores older mission update %s after a newer save', async (outcome) => {
    useMissionStore.setState({ missions: [mission(1)] });
    let finishOld;
    apiFetch.mockReturnValueOnce(new Promise((resolve, reject) => { finishOld = outcome === 'success' ? resolve : reject; }));
    const older = useMissionStore.getState().updateMission(1, { name: 'Older' });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: mission(1, { name: 'Newer' }) }));
    await useMissionStore.getState().updateMission(1, { name: 'Newer' });
    if (outcome === 'success') finishOld(await reply({ success: true, data: mission(1, { name: 'Older' }) }));
    else finishOld(new Error('Old failure'));
    expect(await older).toBeNull();
    expect(useMissionStore.getState().missions[0].name).toBe('Newer');
    expect(toast).not.toHaveBeenCalled();
  });

  it('invalidates old updates when a mission is deleted and later recreated locally', async () => {
    useMissionStore.setState({ missions: [mission(1)] });
    let finish;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const older = useMissionStore.getState().updateMission(1, { name: 'Old' });
    apiFetch.mockReturnValueOnce(reply({ success: true }));
    await useMissionStore.getState().deleteMission(1);
    useMissionStore.setState({ missions: [mission(1, { name: 'Replacement' })] });
    finish(await reply({ success: true, data: mission(1, { name: 'Old' }) }));
    expect(await older).toBeNull();
    expect(useMissionStore.getState().missions[0].name).toBe('Replacement');
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

  it.each([
    ['addEntityToMission', [1, 'b'], false],
    ['removeEntityFromMission', [1, 'a'], false],
    ['addNote', [1, 'new note'], null],
    ['deleteNote', [1, 'n1'], false],
    ['analyzeMissionImage', [1, new Blob(['image'])], null],
    ['monitorSampleVideo', [1], null],
    ['deleteDetection', [1, 'd1'], false],
  ])('preserves child state for failed or malformed %s acknowledgements', async (action, args, failure) => {
    const original = [mission(1, { entityIds: ['a'], notes: [{ id: 'n1' }], detections: [{ id: 'd1' }] })];
    useMissionStore.setState({ missions: original, activeMissionId: 1 });
    for (const [body, ok] of [
      [{ success: true, data: { id: 'new' } }, false],
      [{ success: 'true', data: { id: 'new' } }, true],
      [{ success: false }, true], [null, true],
    ]) {
      apiFetch.mockReturnValueOnce(reply(body, ok));
      expect(await useMissionStore.getState()[action](...args)).toBe(failure);
      expect(useMissionStore.getState().missions).toEqual(original);
    }
  });

  it.each([
    ['addNote', [1, 'note']], ['analyzeMissionImage', [1, new Blob(['image'])]], ['monitorSampleVideo', [1]],
  ])('rejects unusable created child data from %s', async (action, args) => {
    const original = [mission(1)];
    useMissionStore.setState({ missions: original });
    for (const data of [undefined, null, {}, [], 'invalid']) {
      apiFetch.mockReturnValueOnce(reply({ success: true, data }));
      expect(await useMissionStore.getState()[action](...args)).toBeNull();
      expect(useMissionStore.getState().missions).toEqual(original);
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

  it.each([undefined, null, '', {}, 2, '1'])('rejects detail for an absent or different mission identity: %j', async (id) => {
    const original = [mission(1, { entityIds: ['original'], notes: [{ id: 'note' }], detections: [] })];
    useMissionStore.setState({ missions: original, activeMissionId: 1 });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id, entities: ['other'], notes: [], detections: [] } }));
    expect(await useMissionStore.getState().fetchMissionDetail(1)).toBe(false);
    expect(useMissionStore.getState().missions).toEqual(original);
    expect(useMissionStore.getState().activeMissionId).toBe(1);
    expect(toast).toHaveBeenCalledWith('Failed to load mission', 'error');
  });

  it('accepts a matching string mission identity from the backend', async () => {
    useMissionStore.setState({ missions: [mission('mission-one')] });
    const detail = { id: 'mission-one', entities: [], notes: [], detections: [] };
    apiFetch.mockReturnValueOnce(reply({ success: true, data: detail }));
    expect(await useMissionStore.getState().fetchMissionDetail('mission-one')).toEqual(detail);
    expect(useMissionStore.getState().missions[0].entityIds).toEqual([]);
  });

  it.each([
    ['addEntityToMission', [1, 'b']], ['removeEntityFromMission', [1, 'a']],
    ['addNote', [1, 'new']], ['deleteNote', [1, 'n1']],
    ['analyzeMissionImage', [1, new Blob(['image'])]], ['monitorSampleVideo', [1]],
    ['deleteDetection', [1, 'd1']],
  ])('does not let an older detail snapshot undo confirmed %s', async (action, args) => {
    useMissionStore.setState({ missions: [mission(1, { entityIds: ['a'], notes: [{ id: 'n1' }], detections: [{ id: 'd1' }] })] });
    let finish;
    apiFetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const older = useMissionStore.getState().fetchMissionDetail(1);
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 'new' } }));
    await useMissionStore.getState()[action](...args);
    const confirmed = useMissionStore.getState().missions;
    finish(await reply({ success: true, data: { id: 1, entities: ['a'], notes: [{ id: 'n1' }], detections: [{ id: 'd1' }] } }));
    expect(await older).toBeNull();
    expect(useMissionStore.getState().missions).toEqual(confirmed);
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 1, entities: ['fresh'], notes: [], detections: [] } }));
    await useMissionStore.getState().fetchMissionDetail(1);
    expect(useMissionStore.getState().missions[0].entityIds).toEqual(['fresh']);
  });

  it('keeps a pending detail valid after a rejected child write', async () => {
    useMissionStore.setState({ missions: [mission(1)] });
    let finish;
    apiFetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const detail = useMissionStore.getState().fetchMissionDetail(1);
    apiFetch.mockReturnValueOnce(reply({ success: false }, false));
    expect(await useMissionStore.getState().addNote(1, 'new')).toBeNull();
    finish(await reply({ success: true, data: { id: 1, entities: ['kept'], notes: [], detections: [] } }));
    expect(await detail).toMatchObject({ id: 1 });
    expect(useMissionStore.getState().missions[0].entityIds).toEqual(['kept']);
  });

  it('does not discard another mission detail when a child mutation succeeds', async () => {
    useMissionStore.setState({ missions: [mission(1), mission(2)] });
    let finish;
    apiFetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const detail = useMissionStore.getState().fetchMissionDetail(2);
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 'new-note' } }));
    await useMissionStore.getState().addNote(1, 'new');
    finish(await reply({ success: true, data: { id: 2, entities: ['two'], notes: [], detections: [] } }));
    expect(await detail).toMatchObject({ id: 2 });
    expect(useMissionStore.getState().missions[1].entityIds).toEqual(['two']);
  });

  it('fetchMissionDetail merges detail and uses a correct error message', async () => {
    useMissionStore.setState({ missions: [mission(1)] });
    apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 1, entities: ['a'], notes: [], detections: [] } }));
    await useMissionStore.getState().fetchMissionDetail(1);
    expect(useMissionStore.getState().missions[0].entityIds).toEqual(['a']);

    apiFetch.mockReturnValueOnce(reply({ success: false }, false));
    expect(await useMissionStore.getState().fetchMissionDetail(1)).toBe(false);
    expect(toast).toHaveBeenCalledWith('Failed to load mission', 'error');
  });

  it.each([null, {}, [], { entities: [], notes: [] }, { entities: {}, notes: [], detections: [] },
    { entities: [], notes: null, detections: [] }, { entities: [], notes: [], detections: 'bad' }])(
    'rejects incomplete detail without erasing mission children: %j', async (data) => {
      const original = [mission(1, { entityIds: ['a'], notes: [{ id: 'n' }], detections: [{ id: 'd' }] })];
      useMissionStore.setState({ missions: original });
      apiFetch.mockReturnValueOnce(reply({ success: true, data }));
      expect(await useMissionStore.getState().fetchMissionDetail(1)).toBe(false);
      expect(useMissionStore.getState().missions).toEqual(original);
      expect(toast).toHaveBeenCalledWith('Failed to load mission', 'error');
      apiFetch.mockReturnValueOnce(reply({ success: true, data: { id: 1, entities: [], notes: [], detections: [] } }));
      await useMissionStore.getState().fetchMissionDetail(1);
      expect(useMissionStore.getState().missions[0]).toMatchObject({ entityIds: [], notes: [], detections: [] });
    },
  );

  it.each(['success', 'http failure', 'network failure'])('ignores old mission detail %s after a newer detail response', async (outcome) => {
    useMissionStore.setState({ missions: [mission(1)] });
    let finishOld;
    apiFetch.mockReturnValueOnce(new Promise((resolve, reject) => {
      finishOld = outcome === 'network failure' ? reject : resolve;
    }));
    const older = useMissionStore.getState().fetchMissionDetail(1);
    const latest = { id: 1, entities: ['new'], notes: [{ id: 'new-note' }], detections: [] };
    apiFetch.mockReturnValueOnce(reply({ success: true, data: latest }));
    await useMissionStore.getState().fetchMissionDetail(1);
    if (outcome === 'network failure') finishOld(new Error('old failure'));
    else finishOld(await reply({ success: true, data: { id: 1, entities: ['old'], notes: [], detections: [] } }, outcome === 'success'));
    expect(await older).toBeNull();
    expect(useMissionStore.getState().missions[0]).toMatchObject({ entityIds: ['new'], notes: [{ id: 'new-note' }] });
    expect(toast).not.toHaveBeenCalled();
  });

  it('allows independent mission detail requests to finish in either order', async () => {
    useMissionStore.setState({ missions: [mission(1), mission(2)] });
    const finish = [];
    apiFetch.mockImplementation(() => new Promise((resolve) => finish.push(resolve)));
    const first = useMissionStore.getState().fetchMissionDetail(1);
    const second = useMissionStore.getState().fetchMissionDetail(2);
    finish[1](await reply({ success: true, data: { id: 2, entities: ['two'], notes: [], detections: [] } }));
    await second;
    finish[0](await reply({ success: true, data: { id: 1, entities: ['one'], notes: [], detections: [] } }));
    await first;
    expect(useMissionStore.getState().missions.map((m) => m.entityIds)).toEqual([['one'], ['two']]);
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
