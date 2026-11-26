// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const toast = vi.fn();
vi.mock('../common/Toast', () => ({ toast: (...a) => toast(...a) }));

import BulkActionsBar from './BulkActionsBar';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { useAuthStore } from '../../stores/authStore';

const updateEntity = vi.fn();
const deleteEntity = vi.fn();
const addEntityToMission = vi.fn();
const onClear = vi.fn();

beforeEach(() => {
  [toast, updateEntity, deleteEntity, addEntityToMission, onClear].forEach((f) => f.mockClear());
  useAuthStore.setState({ authEnabled: false, user: null });
  useIntelStore.setState({
    updateEntity, deleteEntity,
    entities: [{ id: 'a', tags: ['x'] }, { id: 'b' }],
  });
  useMissionStore.setState({ activeMissionId: null, addEntityToMission });
});
afterEach(cleanup);

const ui = () => render(<BulkActionsBar selectedIds={new Set(['a', 'b'])} onClear={onClear} />);

describe('BulkActionsBar', () => {
  it('shows the selection count', () => {
    ui();
    expect(screen.getByText('2 SELECTED')).toBeTruthy();
  });

  it('renders nothing for a viewer when auth is on', () => {
    useAuthStore.setState({ authEnabled: true, user: { role: 'viewer' } });
    const { container } = ui();
    expect(container.firstChild).toBeNull();
  });

  it('adds a tag to each entity without duplicating existing tags', () => {
    ui();
    fireEvent.click(screen.getByText('TAG'));
    const input = screen.getByPlaceholderText('Tag name...');
    fireEvent.change(input, { target: { value: ' x ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateEntity).toHaveBeenCalledWith('a', { tags: ['x'] });
    expect(updateEntity).toHaveBeenCalledWith('b', { tags: ['x'] });
    expect(onClear).toHaveBeenCalled();
  });

  it('ignores an empty tag', () => {
    ui();
    fireEvent.click(screen.getByText('TAG'));
    fireEvent.click(screen.getByText('ADD'));
    expect(updateEntity).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('sets threat level on every selected entity', () => {
    ui();
    fireEvent.click(screen.getByText('THREAT'));
    fireEvent.click(screen.getByText('high'));
    expect(updateEntity).toHaveBeenCalledWith('a', { threatLevel: 'high' });
    expect(updateEntity).toHaveBeenCalledWith('b', { threatLevel: 'high' });
    expect(toast).toHaveBeenCalledWith('Set 2 entities to HIGH threat', 'success');
  });

  it('warns when adding to a mission with none active', () => {
    ui();
    fireEvent.click(screen.getByText('MISSION'));
    expect(toast).toHaveBeenCalledWith('No active mission selected', 'warning');
    expect(addEntityToMission).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('adds entities to the active mission', () => {
    useMissionStore.setState({ activeMissionId: 'm1' });
    ui();
    fireEvent.click(screen.getByText('MISSION'));
    expect(addEntityToMission).toHaveBeenCalledWith('m1', 'a');
    expect(addEntityToMission).toHaveBeenCalledWith('m1', 'b');
    expect(onClear).toHaveBeenCalled();
  });

  it('requires confirmation before deleting', () => {
    ui();
    fireEvent.click(screen.getByText('DELETE'));
    expect(deleteEntity).not.toHaveBeenCalled();
    expect(screen.getByText('Delete 2 entities?')).toBeTruthy();
    fireEvent.click(screen.getByText('CANCEL'));
    expect(deleteEntity).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and the clear button is labelled', () => {
    ui();
    fireEvent.click(screen.getByText('DELETE'));
    fireEvent.click(screen.getAllByText('DELETE')[0]);
    expect(deleteEntity).toHaveBeenCalledWith('a');
    expect(deleteEntity).toHaveBeenCalledWith('b');
    expect(onClear).toHaveBeenCalled();
    onClear.mockClear();
    fireEvent.click(screen.getByLabelText('Clear selection'));
    expect(onClear).toHaveBeenCalled();
  });
});
