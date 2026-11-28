// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, className, draggable, onDragStart, onDragOver, onDrop }) => (
    <div className={className} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>{children}</div>
  ) },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('./DashboardWidgets', () => ({
  default: ({ type }) => <div data-testid={'w-' + type} />,
  WIDGET_LABELS: { clock: 'CLOCK', feed: 'INTEL FEED' },
}));

import WidgetGrid from './WidgetGrid';
import { useWidgetStore } from '../../stores/widgetStore';

let actions;
const widgets = [
  { id: 'a', type: 'clock', x: 1, y: 1, w: 3, h: 2 },
  { id: 'b', type: 'feed', x: 4, y: 1, w: 3, h: 2 },
];
beforeEach(() => {
  actions = { removeWidget: vi.fn(), addWidget: vi.fn(), moveWidget: vi.fn(), resetLayout: vi.fn(), toggleEditMode: vi.fn() };
  useWidgetStore.setState({ widgets, editMode: false, widgetTypes: ['clock', 'feed'], ...actions });
});
afterEach(cleanup);

describe('WidgetGrid', () => {
  it('renders each widget with its label and no edit controls by default', () => {
    render(<WidgetGrid />);
    expect(screen.getByTestId('w-clock')).toBeTruthy();
    expect(screen.getByTestId('w-feed')).toBeTruthy();
    expect(screen.getByText('EDIT')).toBeTruthy();
    expect(screen.queryByText('RESET')).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('toggles edit mode', () => {
    render(<WidgetGrid />);
    fireEvent.click(screen.getByText('EDIT'));
    expect(actions.toggleEditMode).toHaveBeenCalled();
  });

  it('edit mode shows labelled remove buttons, resize handles, reset and add', () => {
    useWidgetStore.setState({ editMode: true });
    render(<WidgetGrid />);
    expect(screen.getByText('DONE')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove CLOCK widget' }));
    expect(actions.removeWidget).toHaveBeenCalledWith('a');
    expect(screen.getAllByRole('button', { name: /Resize widget/ })).toHaveLength(2);
    fireEvent.click(screen.getByText('RESET'));
    expect(actions.resetLayout).toHaveBeenCalled();
  });

  it('opens the picker from ADD and adds the chosen type', () => {
    useWidgetStore.setState({ editMode: true });
    render(<WidgetGrid />);
    fireEvent.click(screen.getByText('ADD'));
    fireEvent.click(screen.getByText('INTEL FEED', { selector: 'button' }));
    expect(actions.addWidget).toHaveBeenCalledWith('feed');
  });

  it('swaps positions when one widget is dropped on another', () => {
    useWidgetStore.setState({ editMode: true });
    const { container } = render(<WidgetGrid />);
    const cells = container.querySelectorAll('[draggable="true"]');
    const data = { 'text/plain': 'a' };
    fireEvent.drop(cells[1], { dataTransfer: { getData: (k) => data[k] } });
    expect(actions.moveWidget).toHaveBeenCalledWith('a', 4, 1);
    expect(actions.moveWidget).toHaveBeenCalledWith('b', 1, 1);
  });

  it('ignores drops in view mode and drops onto itself', () => {
    const { container } = render(<WidgetGrid />);
    const cell = container.querySelector('.group');
    fireEvent.drop(cell, { dataTransfer: { getData: () => 'b' } });
    expect(actions.moveWidget).not.toHaveBeenCalled();
    cleanup();
    useWidgetStore.setState({ editMode: true });
    const r = render(<WidgetGrid />);
    const cells = r.container.querySelectorAll('[draggable="true"]');
    fireEvent.drop(cells[0], { dataTransfer: { getData: () => 'a' } });
    expect(actions.moveWidget).not.toHaveBeenCalled();
  });
});
