// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = {};
vi.mock('../../stores/missionStore', () => ({ useMissionStore: () => state }));
vi.mock('./MissionList', () => ({ default: ({ activeId }) => <div data-testid="list">{String(activeId)}</div> }));
vi.mock('./MissionDetail', () => ({ default: ({ mission }) => <div data-testid="detail">{mission.id}</div> }));

import MissionView from './MissionView';

afterEach(cleanup);
beforeEach(() => {
  Object.assign(state, {
    missions: [], activeMissionId: null, loading: false,
    fetchMissions: vi.fn(), setActiveMission: vi.fn(), fetchMissionDetail: vi.fn(),
  });
});

describe('MissionView', () => {
  it('fetches missions on mount and shows the empty prompt', () => {
    render(<MissionView />);
    expect(state.fetchMissions).toHaveBeenCalled();
    expect(screen.getByText(/SELECT OR CREATE A MISSION/)).toBeTruthy();
    expect(state.setActiveMission).not.toHaveBeenCalled();
  });

  it('auto-selects the first active mission', () => {
    state.missions = [{ id: 'a', status: 'closed' }, { id: 'b', status: 'active' }];
    render(<MissionView />);
    expect(state.setActiveMission).toHaveBeenCalledWith('b');
  });

  it('falls back to the first mission when none is active', () => {
    state.missions = [{ id: 'a', status: 'closed' }, { id: 'c', status: 'closed' }];
    render(<MissionView />);
    expect(state.setActiveMission).toHaveBeenCalledWith('a');
  });

  it('does not auto-select while loading', () => {
    state.missions = [{ id: 'a', status: 'active' }];
    state.loading = true;
    render(<MissionView />);
    expect(state.setActiveMission).not.toHaveBeenCalled();
  });

  it('renders detail and fetches it for the active mission', () => {
    state.missions = [{ id: 'a', status: 'active' }];
    state.activeMissionId = 'a';
    render(<MissionView />);
    expect(screen.getByTestId('detail').textContent).toBe('a');
    expect(state.fetchMissionDetail).toHaveBeenCalledWith('a');
    expect(state.setActiveMission).not.toHaveBeenCalled();
  });
});
