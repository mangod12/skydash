// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import BookmarkBar from './BookmarkBar';
import { useBookmarkStore } from '../../stores/bookmarkStore';

const mk = (id, name, type) => ({ id, name, type, config: {}, createdAt: 1 });

beforeEach(() => {
  useBookmarkStore.setState({
    bookmarks: [mk('a', 'Alpha', 'filter'), mk('b', 'Bravo', 'mapview')],
    activeBookmarkId: null,
  });
});
afterEach(cleanup);

describe('BookmarkBar', () => {
  it('lists all bookmarks, or only the given type', () => {
    const { unmount } = render(<BookmarkBar onApply={() => {}} />);
    expect(screen.getByText('ALPHA')).toBeTruthy();
    expect(screen.getByText('BRAVO')).toBeTruthy();
    unmount();
    render(<BookmarkBar type="filter" onApply={() => {}} />);
    expect(screen.getByText('ALPHA')).toBeTruthy();
    expect(screen.queryByText('BRAVO')).toBeNull();
  });

  it('applies a bookmark and marks it active', () => {
    const onApply = vi.fn();
    render(<BookmarkBar onApply={onApply} />);
    fireEvent.click(screen.getByText('ALPHA'));
    expect(onApply).toHaveBeenCalledWith('apply', expect.objectContaining({ id: 'a' }));
    expect(useBookmarkStore.getState().activeBookmarkId).toBe('a');
  });

  it('saves a trimmed name and ignores blank names', () => {
    const onApply = vi.fn();
    render(<BookmarkBar onApply={onApply} />);
    fireEvent.click(screen.getByText('SAVE CURRENT'));
    const input = screen.getByPlaceholderText('Bookmark name...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  Night ops ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith('save', 'Night ops');
    expect(screen.queryByPlaceholderText('Bookmark name...')).toBeNull();
  });

  it('cancels saving with Escape', () => {
    render(<BookmarkBar onApply={() => {}} />);
    fireEvent.click(screen.getByText('SAVE CURRENT'));
    fireEvent.keyDown(screen.getByPlaceholderText('Bookmark name...'), { key: 'Escape' });
    expect(screen.getByText('SAVE CURRENT')).toBeTruthy();
  });

  it('deletes through the context menu', () => {
    render(<BookmarkBar onApply={() => {}} />);
    fireEvent.contextMenu(screen.getByText('ALPHA'), { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByText('DELETE'));
    expect(useBookmarkStore.getState().bookmarks.map((b) => b.id)).toEqual(['b']);
  });

  it('renames through the context menu and rejects an empty name', () => {
    render(<BookmarkBar onApply={() => {}} />);
    fireEvent.contextMenu(screen.getByText('ALPHA'), { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByText('RENAME'));
    const input = screen.getByDisplayValue('Alpha');
    fireEvent.change(input, { target: { value: ' ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useBookmarkStore.getState().bookmarks[0].name).toBe('Alpha');
    fireEvent.contextMenu(screen.getByText('ALPHA'), { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByText('RENAME'));
    const input2 = screen.getByDisplayValue('Alpha');
    fireEvent.change(input2, { target: { value: 'Zulu' } });
    fireEvent.keyDown(input2, { key: 'Enter' });
    expect(useBookmarkStore.getState().bookmarks[0].name).toBe('Zulu');
  });
});
