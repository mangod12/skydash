// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const nav = vi.hoisted(() => ({ flyToEntity: vi.fn() }));
vi.mock('../../hooks/useEntityNavigation', () => ({ useEntityNavigation: () => nav }));
vi.mock('../common/VirtualList', () => ({
  default: ({ items, renderItem }) => <div>{items.map((i) => renderItem(i))}</div>,
}));
vi.mock('./TimelineCorrelation', () => ({ default: () => <div>CORRELATION VIEW</div> }));

import TimelineView from './TimelineView';
import { useIntelStore } from '../../stores/intelStore';

const now = Date.now();
const selectEntity = vi.fn();

beforeEach(() => {
  nav.flyToEntity.mockClear();
  selectEntity.mockClear();
  useIntelStore.setState({
    selectEntity,
    entities: [
      { id: 'geo', name: 'Geo Entity', coordinates: [1, 2] },
      { id: 'nogeo', name: 'Plain Entity' },
    ],
    events: [
      { id: 'a', description: 'Older event', severity: 'info', time: now - 60000, entityId: 'nogeo' },
      { id: 'b', description: 'Newest event', severity: 'critical', time: now - 1000, entityId: 'geo' },
      { id: 'c', description: 'Orphan event', severity: 'warning', time: now - 30000 },
    ],
  });
});
afterEach(cleanup);

describe('TimelineView', () => {
  it('lists events newest first with a count and severity labels', () => {
    render(<TimelineView />);
    expect(screen.getByText('3 events recorded')).toBeTruthy();
    const text = document.body.textContent;
    expect(text.indexOf('Newest event')).toBeLessThan(text.indexOf('Orphan event'));
    expect(text.indexOf('Orphan event')).toBeLessThan(text.indexOf('Older event'));
    expect(screen.getByText('CRITICAL')).toBeTruthy();
  });

  it('flies to an entity with coordinates and selects one without', () => {
    render(<TimelineView />);
    fireEvent.click(screen.getByText('Newest event'));
    expect(nav.flyToEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'geo' }));
    fireEvent.click(screen.getByText('Older event'));
    expect(selectEntity).toHaveBeenCalledWith('nogeo');
  });

  it('opens an event from the keyboard when it has an entity', () => {
    render(<TimelineView />);
    const row = screen.getByText('Older event').closest('[role="button"]');
    expect(row.tabIndex).toBe(0);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    fireEvent.keyDown(row, { key: 'Tab' });
    expect(selectEntity).toHaveBeenCalledTimes(2);
  });

  it('keeps events without an entity out of the tab order and inert', () => {
    render(<TimelineView />);
    expect(screen.getAllByRole('button', { name: /./ }).some((b) => b.textContent.includes('Orphan'))).toBe(false);
    fireEvent.click(screen.getByText('Orphan event'));
    expect(selectEntity).not.toHaveBeenCalled();
    expect(nav.flyToEntity).not.toHaveBeenCalled();
  });

  it('switches to correlation mode and back', () => {
    render(<TimelineView />);
    fireEvent.click(screen.getByText('CORRELATION'));
    expect(screen.getByText('CORRELATION VIEW')).toBeTruthy();
    fireEvent.click(screen.getByText('EXIT CORRELATION'));
    expect(screen.getByText('EVENT TIMELINE')).toBeTruthy();
  });
});
