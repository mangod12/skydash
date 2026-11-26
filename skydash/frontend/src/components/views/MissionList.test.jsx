// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import MissionList from './MissionList';
import { useMissionStore } from '../../stores/missionStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

const createMission = vi.fn();
const fetchMissions = vi.fn();
const onSelect = vi.fn();

beforeEach(() => {
  [createMission, fetchMissions, onSelect].forEach((f) => f.mockReset());
  useAuthStore.setState({ authEnabled: false, user: null });
  useUIStore.setState({ missionCreateOpen: false });
  useMissionStore.setState({ createMission, fetchMissions, fetchError: false });
});
afterEach(cleanup);

const ms = [
  { id: 'm1', name: 'Alpha', status: 'active', entityIds: ['a', 'b'] },
  { id: 'm2', name: 'Bravo', status: 'closed' },
];
const ui = (p = {}) => render(<MissionList missions={ms} activeId="m1" onSelect={onSelect} loading={false} {...p} />);

describe('MissionList', () => {
  it('lists missions with status and entity counts, marking the active one', () => {
    ui();
    expect(screen.getByText('2 entities')).toBeTruthy();
    expect(screen.getByText('0 entities')).toBeTruthy();
    expect(screen.getByText('CLOSED')).toBeTruthy();
    expect(screen.getByText('Alpha').closest('button').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Bravo').closest('button').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByText('Bravo'));
    expect(onSelect).toHaveBeenCalledWith('m2');
  });

  it('shows loading, error with retry, and empty states', () => {
    const { unmount } = ui({ missions: [], loading: true });
    expect(screen.getByText('Loading missions')).toBeTruthy();
    unmount();
    useMissionStore.setState({ fetchError: true });
    const r = ui({ missions: [] });
    expect(screen.getByRole('alert').textContent).toContain('Could not load missions');
    fireEvent.click(screen.getByText('RETRY'));
    expect(fetchMissions).toHaveBeenCalled();
    r.unmount();
    useMissionStore.setState({ fetchError: false });
    ui({ missions: [] });
    expect(screen.getByText('No missions yet')).toBeTruthy();
  });

  it('is read-only for a viewer when auth is on', () => {
    useAuthStore.setState({ authEnabled: true, user: { role: 'viewer' } });
    ui();
    expect(screen.queryByText('NEW MISSION')).toBeNull();
    expect(screen.getByText('READ-ONLY ACCESS')).toBeTruthy();
  });

  it('creates a mission, selects it and closes the form', async () => {
    createMission.mockResolvedValue({ id: 'm9' });
    ui();
    fireEvent.click(screen.getByText('NEW MISSION'));
    expect(screen.getByText('NEW MISSION').closest('button').getAttribute('aria-expanded')).toBe('true');
    const create = screen.getByText('CREATE');
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Mission name'), { target: { value: '  Delta ' } });
    fireEvent.change(screen.getByLabelText('Mission description'), { target: { value: ' d ' } });
    fireEvent.click(create);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('m9'));
    expect(createMission).toHaveBeenCalledWith({ name: 'Delta', description: 'd' });
    expect(screen.queryByLabelText('Mission name')).toBeNull();
  });

  it('keeps the form open when creation fails, and cancel closes it', async () => {
    createMission.mockResolvedValue(null);
    ui();
    fireEvent.click(screen.getByText('NEW MISSION'));
    fireEvent.change(screen.getByLabelText('Mission name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('CREATE'));
    await waitFor(() => expect(createMission).toHaveBeenCalled());
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Mission name')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cancel new mission'));
    expect(screen.queryByLabelText('Mission name')).toBeNull();
  });
});
