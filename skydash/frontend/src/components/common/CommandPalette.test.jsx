// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const reset = vi.hoisted(() => vi.fn());
vi.mock('./OnboardingTour', () => ({ startTour: vi.fn() }));
vi.mock('../../stores/scenarioStore', () => ({
  useScenarioStore: { getState: () => ({ reset }) },
}));

import CommandPalette from './CommandPalette';
import { useUIStore } from '../../stores/uiStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { useMapStore } from '../../stores/mapStore';
import { useAuditStore } from '../../stores/auditStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  reset.mockClear();
  useUIStore.setState({ commandPaletteOpen: true, activeView: 'dashboard' });
  useIntelStore.setState({
    entities: [{ id: 'e1', name: 'Falcon One', type: 'vehicle', threatLevel: 'high', confidence: 80, tags: ['air'] }],
    events: [{ id: 'v1', description: 'Link degraded near gate', severity: 'warning', time: Date.now() }],
    selectedEntityId: null,
  });
  useMissionStore.setState({ missions: [{ id: 'm1', name: 'Border sweep', description: 'night', status: 'active' }] });
  useMapStore.setState({ annotations: [] });
  useAuditStore.setState({ entries: [] });
  useBookmarkStore.setState({ bookmarks: [], activeBookmarkId: null });
});
afterEach(cleanup);

const search = (text) =>
  fireEvent.change(screen.getByPlaceholderText('Search everything...'), { target: { value: text } });

describe('CommandPalette', () => {
  it('renders nothing while closed', () => {
    useUIStore.setState({ commandPaletteOpen: false });
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText('Search everything...')).toBeNull();
  });

  it('shows at most five commands before a query is typed', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
    expect(screen.queryByText('Reset Simulation')).toBeNull();
  });

  it('filters commands, entities, missions and events by query', () => {
    render(<CommandPalette />);
    search('falcon');
    expect(screen.getByText('Falcon One')).toBeTruthy();
    expect(screen.queryByText('Border sweep')).toBeNull();
    search('border');
    expect(screen.getByText('Border sweep')).toBeTruthy();
    search('degraded');
    expect(screen.getByText('Link degraded near gate')).toBeTruthy();
    search('zzzz');
    expect(screen.getByText('No results found.')).toBeTruthy();
  });

  it('matches entities by tag', () => {
    render(<CommandPalette />);
    search('air');
    expect(screen.getByText('Falcon One')).toBeTruthy();
  });

  it('navigates and closes when a command runs', () => {
    render(<CommandPalette />);
    search('map');
    fireEvent.click(screen.getByText('Go to Map'));
    expect(useUIStore.getState().activeView).toBe('map');
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('runs the reset command against the scenario store', () => {
    render(<CommandPalette />);
    search('reset');
    fireEvent.click(screen.getByText('Reset Simulation'));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('selects an entity and opens Intel', () => {
    render(<CommandPalette />);
    search('falcon');
    fireEvent.click(screen.getByText('Falcon One'));
    expect(useUIStore.getState().activeView).toBe('intel');
    expect(useIntelStore.getState().selectedEntityId).toBe('e1');
  });

  it('applies a filter bookmark and opens Intel', () => {
    useBookmarkStore.setState({ bookmarks: [{ id: 'b1', name: 'Hot list', type: 'filter', config: {} }] });
    render(<CommandPalette />);
    search('hot');
    fireEvent.click(screen.getByText('Apply: Hot list'));
    expect(useBookmarkStore.getState().activeBookmarkId).toBe('b1');
    expect(useUIStore.getState().activeView).toBe('intel');
  });

  it('closes on Escape', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search everything...'), { key: 'Escape' });
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });
});
