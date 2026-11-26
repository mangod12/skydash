// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import FeedItem from './FeedItem';

afterEach(cleanup);

const item = (over = {}) => ({
  id: 'f1', timestamp: new Date(2026, 0, 1, 9, 5, 7).getTime(), severity: 'warning', category: 'OSINT',
  title: 'New post', summary: 'Details here', location: 'Sector 4', entityId: 'e1', ...over,
});

describe('FeedItem', () => {
  it('shows time, category, location, title and summary', () => {
    render(<FeedItem item={item()} onEntityClick={() => {}} />);
    expect(screen.getByText('09:05:07')).toBeTruthy();
    expect(screen.getByText('OSINT')).toBeTruthy();
    expect(screen.getByText('Sector 4')).toBeTruthy();
    expect(screen.getByText('New post')).toBeTruthy();
    expect(screen.getByText('Details here')).toBeTruthy();
  });

  it('omits the location when there is none', () => {
    render(<FeedItem item={item({ location: undefined })} onEntityClick={() => {}} />);
    expect(screen.queryByText('Sector 4')).toBeNull();
  });

  it('exposes severity as text, not only color', () => {
    render(<FeedItem item={item({ severity: 'critical' })} onEntityClick={() => {}} />);
    expect(screen.getByRole('img', { name: 'critical severity' })).toBeTruthy();
  });

  it('is a button that opens its entity on click, Enter and Space', () => {
    const onEntityClick = vi.fn();
    render(<FeedItem item={item()} onEntityClick={onEntityClick} />);
    const btn = screen.getByRole('button');
    expect(btn.tabIndex).toBe(0);
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyDown(btn, { key: ' ' });
    fireEvent.keyDown(btn, { key: 'Tab' });
    expect(onEntityClick).toHaveBeenCalledTimes(3);
    expect(onEntityClick).toHaveBeenCalledWith('e1');
  });

  it('is inert without an entity', () => {
    const onEntityClick = vi.fn();
    render(<FeedItem item={item({ entityId: null })} onEntityClick={onEntityClick} />);
    expect(screen.queryByRole('button')).toBeNull();
    fireEvent.click(screen.getByText('New post'));
    fireEvent.keyDown(screen.getByText('New post'), { key: 'Enter' });
    expect(onEntityClick).not.toHaveBeenCalled();
  });
});
