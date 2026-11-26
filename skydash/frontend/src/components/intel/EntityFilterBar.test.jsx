// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, renderHook, act } from '@testing-library/react';
import EntityFilterBar, { useEntityFilters } from './EntityFilterBar';

afterEach(cleanup);

const ents = [
  { id: 1, name: 'Bravo', type: 'person', threatLevel: 'low', confidence: 90, lastSeen: '2026-01-01' },
  { id: 2, name: 'Alpha', type: 'vehicle', threatLevel: 'critical', confidence: 60, lastSeen: '2026-03-01' },
  { id: 3, name: 'Charlie', type: 'person', threatLevel: 'high', confidence: 20, lastSeen: '2026-02-01' },
];
const names = (r) => r.current.filtered.map((e) => e.name);

describe('useEntityFilters', () => {
  it('sorts by name by default and reports counts', () => {
    const { result } = renderHook(() => useEntityFilters(ents));
    expect(names(result)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(result.current.resultCount).toBe(3);
    expect(result.current.totalCount).toBe(3);
  });

  it('filters by type toggle, threat and confidence band', () => {
    const { result } = renderHook(() => useEntityFilters(ents));
    act(() => result.current.toggleType('person'));
    expect(names(result)).toEqual(['Bravo', 'Charlie']);
    act(() => result.current.toggleType('person'));
    expect(result.current.filtered.length).toBe(3);
    act(() => result.current.updateFilter('threat', 'critical'));
    expect(names(result)).toEqual(['Alpha']);
    act(() => result.current.updateFilter('threat', null));
    for (const [band, expected] of [['high', ['Bravo']], ['medium', ['Alpha']], ['low', ['Charlie']]]) {
      act(() => result.current.updateFilter('confidence', band));
      expect(names(result)).toEqual(expected);
    }
  });

  it('sorts by threat, confidence and recency', () => {
    const { result } = renderHook(() => useEntityFilters(ents));
    act(() => result.current.updateFilter('sort', 'threat'));
    expect(names(result)).toEqual(['Alpha', 'Charlie', 'Bravo']);
    act(() => result.current.updateFilter('sort', 'confidence'));
    expect(names(result)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    act(() => result.current.updateFilter('sort', 'recent'));
    expect(names(result)).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });
});

describe('EntityFilterBar', () => {
  const base = { types: [], threat: null, confidence: null, sort: 'name' };

  it('exposes active chips as pressed', () => {
    render(<EntityFilterBar filters={{ ...base, types: ['person'], threat: 'high', sort: 'threat' }} toggleType={vi.fn()} updateFilter={vi.fn()} />);
    expect(screen.getByText('PERSON').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('VEHICLE').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('HIGH').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'THREAT' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('NAME').getAttribute('aria-pressed')).toBe('false');
  });

  it('calls handlers and toggles a selected threat off', () => {
    const toggleType = vi.fn(); const updateFilter = vi.fn();
    render(<EntityFilterBar filters={{ ...base, threat: 'high' }} toggleType={toggleType} updateFilter={updateFilter} />);
    fireEvent.click(screen.getByText('VEHICLE'));
    expect(toggleType).toHaveBeenCalledWith('vehicle');
    fireEvent.click(screen.getByText('HIGH'));
    expect(updateFilter).toHaveBeenCalledWith('threat', null);
    fireEvent.click(screen.getByText('CRITICAL'));
    expect(updateFilter).toHaveBeenCalledWith('threat', 'critical');
    fireEvent.click(screen.getByText('RECENT'));
    expect(updateFilter).toHaveBeenCalledWith('sort', 'recent');
  });
});
