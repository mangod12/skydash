// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import EntityComparison from './EntityComparison';
import { useIntelStore } from '../../stores/intelStore';

const ents = [
  { id: 'a', name: 'Alpha', type: 'vehicle', threatLevel: 'high', confidence: 80, tags: ['red', 'night'], properties: { color: 'blue', size: 'L' }, firstSeen: 1, lastSeen: 10, coordinates: [12.9, 77.6] },
  { id: 'b', name: 'Bravo', type: 'vehicle', threatLevel: 'low', confidence: 55, tags: ['night'], properties: { color: 'blue', size: 'S' }, firstSeen: 5, lastSeen: 20, coordinates: [12.9, 77.601] },
  { id: 'c', name: 'Charlie', type: 'person', threatLevel: 'low', confidence: 40, tags: [], properties: {}, firstSeen: 100, lastSeen: 200 },
];
const rels = [
  { from: 'a', to: 'c', type: 'seen_with', confidence: 70 },
  { from: 'b', to: 'c', type: 'near', confidence: 60 },
];

beforeEach(() => {
  useIntelStore.setState({ entities: ents, relationships: rels, comparedEntities: [null, null] });
});
afterEach(cleanup);

describe('EntityComparison', () => {
  it('shows empty columns until entities are chosen', () => {
    render(<EntityComparison />);
    expect(screen.getAllByText('NO ENTITY SELECTED')).toHaveLength(2);
    expect(screen.queryByText('COMMON ELEMENTS')).toBeNull();
  });

  it('selectors are labelled and update the compared pair', () => {
    render(<EntityComparison />);
    fireEvent.change(screen.getByLabelText('SELECT ENTITY A'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('SELECT ENTITY B'), { target: { value: 'b' } });
    expect(useIntelStore.getState().comparedEntities).toEqual(['a', 'b']);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Bravo').length).toBeGreaterThan(1);
    expect(screen.getByText('80% conf')).toBeTruthy();
  });

  it('lists common elements: type, shared relation, tag, proximity, overlap', () => {
    useIntelStore.setState({ comparedEntities: ['a', 'b'] });
    render(<EntityComparison />);
    expect(screen.getByText('COMMON ELEMENTS')).toBeTruthy();
    expect(screen.getByText(/Same type/)).toBeTruthy();
    expect(screen.getByText('Both connected to: Charlie')).toBeTruthy();
    expect(screen.getByText('Both tagged: night')).toBeTruthy();
    expect(screen.queryByText('Both tagged: red')).toBeNull();
    expect(screen.getByText(/Proximity: \d+m apart/)).toBeTruthy();
    expect(screen.getByText('Temporal overlap confirmed')).toBeTruthy();
  });

  it('shows a property row for every key from either entity and relationship counts', () => {
    useIntelStore.setState({ comparedEntities: ['a', 'b'] });
    render(<EntityComparison />);
    expect(screen.getAllByText('color')).toHaveLength(2);
    expect(screen.getAllByText('size')).toHaveLength(2);
    expect(screen.getAllByText(/RELATIONSHIPS \(1\)/)).toHaveLength(2);
    expect(screen.getByText('seen with')).toBeTruthy();
  });

  it('no common block for unrelated entities with no overlap', () => {
    useIntelStore.setState({ entities: [ents[0], { ...ents[2], tags: [] }], comparedEntities: ['a', 'c'] });
    render(<EntityComparison />);
    expect(screen.queryByText(/Same type/)).toBeNull();
    expect(screen.queryByText('Temporal overlap confirmed')).toBeNull();
    expect(screen.queryByText(/Proximity/)).toBeNull();
  });

  it('close clears the comparison', () => {
    useIntelStore.setState({ comparedEntities: ['a', 'b'] });
    render(<EntityComparison />);
    fireEvent.click(screen.getByTitle('Close comparison'));
    expect(useIntelStore.getState().comparedEntities).toEqual([null, null]);
  });
});
