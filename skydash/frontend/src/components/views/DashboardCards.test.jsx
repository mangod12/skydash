// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatCard, ActivityFeed } from './DashboardCards';

afterEach(cleanup);

describe('StatCard', () => {
  it('renders label, value, sub and freshness', () => {
    render(<StatCard label="ENTITIES" value="12" sub="3 new" freshness="2m ago" accent="cyan" />);
    expect(screen.getByText('ENTITIES')).toBeTruthy();
    expect(screen.getByText('12').className).toContain('text-cyan-400');
    expect(screen.getByText('3 new')).toBeTruthy();
    expect(screen.getByText('2m ago')).toBeTruthy();
  });

  it('shows a dash instead of the value when empty', () => {
    render(<StatCard label="X" value="99" empty />);
    expect(screen.queryByText('99')).toBeNull();
    expect(screen.getByText('\u2014')).toBeTruthy();
  });

  it('falls back to neutral colour for an unknown accent', () => {
    render(<StatCard label="X" value="5" accent="pink" />);
    expect(screen.getByText('5').className).toContain('text-zinc-200');
  });
});

describe('ActivityFeed', () => {
  it('shows the empty message for no items or a non-array', () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByText('NO RECENT ACTIVITY')).toBeTruthy();
    cleanup();
    render(<ActivityFeed items={null} />);
    expect(screen.getByText('NO RECENT ACTIVITY')).toBeTruthy();
  });

  it('renders items with a labelled severity marker', () => {
    render(<ActivityFeed items={[
      { id: 1, severity: 'critical', description: 'Link lost', timeLabel: '1m ago' },
      { id: 2, severity: 'weird', description: 'Odd', timeLabel: '2m ago' },
    ]} />);
    expect(screen.getByText('Link lost')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Severity: critical' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Severity: info' })).toBeTruthy();
  });
});
