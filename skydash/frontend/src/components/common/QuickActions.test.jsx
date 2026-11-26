// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const toast = vi.hoisted(() => vi.fn());
vi.mock('./Toast', () => ({ toast }));

import QuickActions from './QuickActions';
import { useUIStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';
import useNotificationStore from '../../stores/notificationStore';

beforeEach(() => {
  toast.mockClear();
  useUIStore.setState({
    isMobile: false, activeView: 'dashboard', consoleOpen: false, commandPaletteOpen: false,
    entityCreateOpen: false, missionCreateOpen: false,
  });
  useMapStore.setState({ annotationMode: null });
  useNotificationStore.setState({ unreadCount: 0 });
});
afterEach(cleanup);

const openFab = () => fireEvent.click(screen.getByLabelText('Quick actions'));

describe('QuickActions', () => {
  it('renders nothing on mobile', () => {
    useUIStore.setState({ isMobile: true });
    render(<QuickActions />);
    expect(screen.queryByLabelText('Quick actions')).toBeNull();
  });

  it('opens and closes from the button and exposes aria-expanded', () => {
    render(<QuickActions />);
    const fab = screen.getByLabelText('Quick actions');
    expect(fab.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Create Entity')).toBeNull();
    fireEvent.click(fab);
    expect(fab.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Create Entity')).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBe(8);
  });

  it('closes on Escape', () => {
    render(<QuickActions />);
    openFab();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByLabelText('Quick actions').getAttribute('aria-expanded')).toBe('false');
  });

  it('Create Entity opens the intel view with the create dialog', () => {
    render(<QuickActions />);
    openFab();
    fireEvent.click(screen.getByLabelText('Create Entity'));
    expect(useUIStore.getState().activeView).toBe('intel');
    expect(useUIStore.getState().entityCreateOpen).toBe(true);
  });

  it('New Mission opens the missions view with the create dialog', () => {
    render(<QuickActions />);
    openFab();
    fireEvent.click(screen.getByLabelText('New Mission'));
    expect(useUIStore.getState().activeView).toBe('missions');
    expect(useUIStore.getState().missionCreateOpen).toBe(true);
  });

  it('Open Console, Quick Search and Drop Pin drive their stores', () => {
    render(<QuickActions />);
    openFab();
    fireEvent.click(screen.getByLabelText('Open Console'));
    expect(useUIStore.getState().consoleOpen).toBe(true);
    openFab();
    fireEvent.click(screen.getByLabelText('Quick Search'));
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    openFab();
    fireEvent.click(screen.getByLabelText('Drop Pin'));
    expect(useUIStore.getState().activeView).toBe('map');
    expect(useMapStore.getState().annotationMode).toBe('pin');
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Pin tool armed'), 'info');
  });

  it('warns instead of failing when there is no map to capture', () => {
    render(<QuickActions />);
    openFab();
    fireEvent.click(screen.getByLabelText('Take Screenshot'));
    expect(toast).toHaveBeenCalledWith('Open a map view before taking a screenshot', 'warning');
  });

  it('shows the unread dot only while closed', () => {
    useNotificationStore.setState({ unreadCount: 3 });
    const { container } = render(<QuickActions />);
    expect(container.querySelector('span.bg-red-500')).toBeTruthy();
    openFab();
    expect(container.querySelector('span.bg-red-500')).toBeNull();
  });
});
