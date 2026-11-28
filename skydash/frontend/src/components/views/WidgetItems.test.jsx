// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ThreatGaugeWidget, EntityListWidget, FeedWidget, ClockWidget, WeatherWidget } from './WidgetItems';
import { useIntelStore } from '../../stores/intelStore';
import { useFeedStore } from '../../stores/feedStore';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const ent = (id, name, threatLevel) => ({ id, name, threatLevel });

describe('ThreatGaugeWidget', () => {
  it('scores zero with no entities', () => {
    useIntelStore.setState({ entities: [] });
    render(<ThreatGaugeWidget />);
    expect(screen.getByRole('img', { name: 'Threat score 0 out of 100' })).toBeTruthy();
  });
  it('averages weighted threat levels, unknown counts as 0', () => {
    useIntelStore.setState({ entities: [ent(1, 'a', 'critical'), ent(2, 'b', 'high'), ent(3, 'c', 'bogus'), ent(4, 'd', 'medium')] });
    render(<ThreatGaugeWidget />);
    expect(screen.getByRole('img', { name: 'Threat score 46 out of 100' })).toBeTruthy();
  });
});

describe('EntityListWidget', () => {
  it('shows empty state', () => {
    useIntelStore.setState({ entities: [] });
    render(<EntityListWidget />);
    expect(screen.getByText('NO ENTITIES')).toBeTruthy();
  });
  it('sorts by risk and caps at five', () => {
    useIntelStore.setState({ entities: [
      ent(1, 'L1', 'low'), ent(2, 'C1', 'critical'), ent(3, 'M1', 'medium'), ent(4, 'H1', 'high'),
      ent(5, 'L2', 'low'), ent(6, 'L3', 'low'), ent(7, 'U1', undefined),
    ] });
    render(<EntityListWidget />);
    const names = screen.getAllByText(/^(L|C|M|H|U)\d$/).map((n) => n.textContent);
    expect(names.slice(0, 3)).toEqual(['C1', 'H1', 'M1']);
    expect(names).toHaveLength(5);
    expect(names).not.toContain('U1');
  });
});

describe('FeedWidget', () => {
  it('shows empty state', () => {
    useFeedStore.setState({ items: [] });
    render(<FeedWidget />);
    expect(screen.getByText('NO INTEL FEED')).toBeTruthy();
  });
  it('shows five newest with labelled severity', () => {
    useFeedStore.setState({ items: Array.from({ length: 7 }, (_, i) => ({ id: i, title: `T${i}`, category: 'OSINT', severity: i === 0 ? 'critical' : 'weird' })) });
    render(<FeedWidget />);
    expect(screen.getByText('T4')).toBeTruthy();
    expect(screen.queryByText('T5')).toBeNull();
    expect(screen.getByRole('img', { name: 'Severity: critical' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Severity: info' })).toHaveLength(4);
  });
});

describe('ClockWidget', () => {
  it('shows UTC time and date and ticks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T10:00:00Z'));
    render(<ClockWidget />);
    expect(screen.getAllByText('10:00:00')[0].className).toContain('text-cyan-400'); // UTC row; local row may match in a UTC runner
    expect(screen.getByText('2026-11-28')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getAllByText('10:00:01')[0].className).toContain('text-cyan-400');
  });
});

describe('WeatherWidget', () => {
  it('states weather is unavailable rather than inventing conditions', () => {
    render(<WeatherWidget />);
    expect(screen.getByText('WEATHER UNAVAILABLE')).toBeTruthy();
  });
});
