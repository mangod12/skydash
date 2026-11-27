// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const parse = vi.fn();
vi.mock('../../utils/nlqParser', () => ({ parseQuery: (q, e) => parse(q, e) }));

import NaturalLanguageQuery from './NaturalLanguageQuery';
import { useIntelStore } from '../../stores/intelStore';

const ent = (o = {}) => ({ id: 'e1', name: 'Truck 1', type: 'vehicle', confidence: 80, threatLevel: 'high', lastSeen: Date.now() - 60000, ...o });
const input = () => screen.getByLabelText('Intelligence query');

beforeEach(() => { parse.mockReset(); useIntelStore.setState({ entities: [ent()] }); });
afterEach(cleanup);

describe('NaturalLanguageQuery', () => {
  it('shows no results panel until a query runs, and ignores blank queries', () => {
    render(<NaturalLanguageQuery />);
    fireEvent.click(screen.getByText('QUERY'));
    expect(parse).not.toHaveBeenCalled();
    expect(screen.queryByText(/found/)).toBeNull();
  });

  it('runs the parser on click and on Enter, with the store entities', () => {
    parse.mockReturnValue([ent()]);
    render(<NaturalLanguageQuery />);
    fireEvent.change(input(), { target: { value: 'vehicles' } });
    fireEvent.click(screen.getByText('QUERY'));
    expect(parse).toHaveBeenCalledWith('vehicles', useIntelStore.getState().entities);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 result found')).toBeTruthy();
    expect(screen.getByText('Truck 1')).toBeTruthy();
    expect(screen.getByText('HIGH')).toBeTruthy();
  });

  it('pluralises and shows the empty message', () => {
    parse.mockReturnValue([]);
    render(<NaturalLanguageQuery />);
    fireEvent.change(input(), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('QUERY'));
    expect(screen.getByText('0 results found')).toBeTruthy();
    expect(screen.getByText('No matching entities')).toBeTruthy();
  });

  it('selects an entity when a result is clicked', () => {
    const selectEntity = vi.fn();
    useIntelStore.setState({ selectEntity });
    parse.mockReturnValue([ent()]);
    render(<NaturalLanguageQuery />);
    fireEvent.change(input(), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('QUERY'));
    fireEvent.click(screen.getByText('Truck 1'));
    expect(selectEntity).toHaveBeenCalledWith('e1');
  });

  it('does not crash on entities with missing type, confidence or an invalid lastSeen', () => {
    parse.mockReturnValue([ent({ type: undefined, confidence: undefined, lastSeen: 'garbage', threatLevel: undefined })]);
    const { container } = render(<NaturalLanguageQuery />);
    fireEvent.change(input(), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('QUERY'));
    expect(container.textContent).toContain('UNKNOWN | -- | unknown');
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });
});
