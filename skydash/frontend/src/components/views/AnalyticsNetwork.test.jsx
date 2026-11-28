// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AnalyticsNetwork from './AnalyticsNetwork';

afterEach(cleanup);
const summary = (over = {}) => ({ nodeCount: 5, edgeCount: 7, networkDensity: 0.35, communityCount: 2, hubEntities: [], keyFindings: [], ...over });

describe('AnalyticsNetwork', () => {
  it('shows network figures with density as a percentage', () => {
    render(<AnalyticsNetwork networkSummary={summary()} topEntities={[]} fleet={[]} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('35%')).toBeTruthy();
    expect(screen.getByText('NO ACTIVITY')).toBeTruthy();
    expect(screen.getByText('NO LIVE FLEET')).toBeTruthy();
  });

  it('shows a dash instead of NaN% for non-finite density', () => {
    render(<AnalyticsNetwork networkSummary={summary({ networkDensity: NaN })} topEntities={[]} fleet={[]} />);
    expect(screen.getByText('\u2014%')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('lists hubs and findings when present', () => {
    render(<AnalyticsNetwork networkSummary={summary({ hubEntities: [{ id: 1, name: 'Hub A', connections: 4 }], keyFindings: ['Cluster found'] })} topEntities={[]} fleet={[]} />);
    expect(screen.getByText('Hub A')).toBeTruthy();
    expect(screen.getByText('4 links')).toBeTruthy();
    expect(screen.getByText('Cluster found')).toBeTruthy();
  });

  it('scales activity bars against the top entity and never produces NaN widths', () => {
    const { container, rerender } = render(<AnalyticsNetwork networkSummary={summary()} topEntities={[{ name: 'A', count: 4 }, { name: 'B', count: 2 }]} fleet={[]} />);
    const widths = () => [...container.querySelectorAll('.bg-indigo-500\\/60')].map((n) => n.style.width);
    expect(widths()).toEqual(['100%', '50%']);
    rerender(<AnalyticsNetwork networkSummary={summary()} topEntities={[{ name: 'A', count: 0 }]} fleet={[]} />);
    expect(widths()).toEqual(['0%']);
  });

  it('renders fleet rows with safe figures', () => {
    render(<AnalyticsNetwork networkSummary={summary()} topEntities={[]} fleet={[{ drone_id: 'D1', flight_mode: 'AUTO', altitude: 120.4, battery_voltage: 15.26, signal_strength: 80 }, { drone_id: 'D2', altitude: NaN }]} />);
    expect(screen.getByText('120m')).toBeTruthy();
    expect(screen.getByText('15.3V')).toBeTruthy();
    expect(screen.getByText('\u2014m')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
  });
});
