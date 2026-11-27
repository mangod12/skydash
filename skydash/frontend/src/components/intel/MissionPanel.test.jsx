// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import MissionPanel from './MissionPanel';
import { useMissionStore } from '../../stores/missionStore';
import { useUIStore } from '../../stores/uiStore';

const addNote = vi.fn();
const missions = [
  { id: 'm1', name: 'Alpha', status: 'closed', entityIds: ['a', 'b'], notes: [{ content: 'Latest note' }, { content: 'Old' }] },
  { id: 'm2', name: 'Bravo', entityIds: [] },
];

beforeEach(() => {
  addNote.mockClear();
  useUIStore.setState({ activeView: 'dashboard' });
  useMissionStore.setState({ missions, activeMissionId: 'm2', addNote });
});
afterEach(cleanup);

describe('MissionPanel', () => {
  it('renders nothing when the mission is unknown', () => {
    const { container } = render(<MissionPanel missionId="nope" />);
    expect(container.firstChild).toBeNull();
  });

  it('falls back to the active mission with defaults', () => {
    render(<MissionPanel />);
    expect(screen.getByText('Bravo')).toBeTruthy();
    expect(screen.getByText('0 entities')).toBeTruthy();
    expect(screen.getByText('0 notes')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('shows counts, status and the latest note for a given mission', () => {
    render(<MissionPanel missionId="m1" />);
    expect(screen.getByText('2 entities')).toBeTruthy();
    expect(screen.getByText('2 notes')).toBeTruthy();
    expect(screen.getByText('CLOSED')).toBeTruthy();
    expect(screen.getByText('Latest note')).toBeTruthy();
    expect(screen.queryByText('Old')).toBeNull();
  });

  it('opens the missions view', () => {
    render(<MissionPanel missionId="m1" />);
    fireEvent.click(screen.getByText('View'));
    expect(useUIStore.getState().activeView).toBe('missions');
  });

  it('adds a trimmed note via button or Enter and clears the field', () => {
    render(<MissionPanel missionId="m1" />);
    const input = screen.getByLabelText('Quick note');
    fireEvent.change(input, { target: { value: '  hello ' } });
    fireEvent.click(screen.getByLabelText('Add note'));
    expect(addNote).toHaveBeenCalledWith('m1', 'hello');
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'again' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(addNote).toHaveBeenLastCalledWith('m1', 'again');
  });

  it('ignores blank notes', () => {
    render(<MissionPanel missionId="m1" />);
    fireEvent.change(screen.getByLabelText('Quick note'), { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText('Add note'));
    expect(addNote).not.toHaveBeenCalled();
  });
});
