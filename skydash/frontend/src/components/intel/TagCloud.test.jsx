// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TagCloud from './TagCloud';
import { useIntelStore } from '../../stores/intelStore';

beforeEach(() => useIntelStore.setState({ entities: [] }));
afterEach(cleanup);

const withTags = (...lists) => useIntelStore.setState({ entities: lists.map((tags, i) => ({ id: i, tags })) });

describe('TagCloud', () => {
  it('renders nothing when no entity has tags', () => {
    useIntelStore.setState({ entities: [{ id: 1 }, { id: 2, tags: [] }] });
    const { container } = render(<TagCloud />);
    expect(container.textContent).toBe('');
  });

  it('counts tags across entities and orders by count', () => {
    withTags(['air', 'sea'], ['air'], ['air', 'land'], ['sea']);
    render(<TagCloud />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['air(3)', 'sea(2)', 'land(1)']);
  });

  it('tolerates entities without a tags field', () => {
    useIntelStore.setState({ entities: [{ id: 1 }, { id: 2, tags: ['x'] }] });
    render(<TagCloud />);
    expect(screen.getByText('x(1)')).toBeTruthy();
  });

  it('sizes tags relative to the most common one', () => {
    withTags(['a', 'b', 'c'], ['a', 'b'], ['a'], ['a'], ['a']);
    render(<TagCloud />);
    expect(screen.getByText('a(5)').className).toContain('text-[11px]');
    expect(screen.getByText('b(2)').className).toContain('text-[10px]');
    expect(screen.getByText('c(1)').className).toContain('text-[9px]');
  });

  it('reports the clicked tag name', () => {
    withTags(['air']);
    const onTagClick = vi.fn();
    render(<TagCloud onTagClick={onTagClick} />);
    fireEvent.click(screen.getByText('air(1)'));
    expect(onTagClick).toHaveBeenCalledWith('air');
  });

  it('does not throw without a click handler', () => {
    withTags(['air']);
    render(<TagCloud />);
    expect(() => fireEvent.click(screen.getByText('air(1)'))).not.toThrow();
  });
});
