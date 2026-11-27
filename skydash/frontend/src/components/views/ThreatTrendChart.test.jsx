// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const areas = [];
vi.mock('recharts', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    AreaChart: ({ data, children }) => <div data-testid="chart" data-points={data.length}>{children}</div>,
    Area: (p) => { areas.push(p); return null; },
    ResponsiveContainer: Pass,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});
const bucket = vi.fn();
vi.mock('../../utils/eventBuckets', () => ({ bucketEvents: (e) => bucket(e) }));

import ThreatTrendChart from './ThreatTrendChart';

afterEach(() => { cleanup(); areas.length = 0; bucket.mockReset(); });

describe('ThreatTrendChart', () => {
  it('shows the empty state when there are no buckets', () => {
    bucket.mockReturnValue([]);
    render(<ThreatTrendChart events={[]} />);
    expect(screen.getByText('NO EVENT DATA')).toBeTruthy();
    expect(screen.queryByTestId('chart')).toBeNull();
  });

  it('renders a stacked area per threat level, critical first', () => {
    bucket.mockReturnValue([{ label: '10:00', low: 1, medium: 0, high: 0, critical: 2 }]);
    render(<ThreatTrendChart events={[{}]} />);
    expect(screen.getByTestId('chart').getAttribute('data-points')).toBe('1');
    expect(areas.map((a) => a.dataKey)).toEqual(['critical', 'high', 'medium', 'low']);
    expect(new Set(areas.map((a) => a.stackId)).size).toBe(1);
  });

  it('passes events to the bucketing function', () => {
    bucket.mockReturnValue([]);
    const events = [{ id: 1 }];
    render(<ThreatTrendChart events={events} />);
    expect(bucket).toHaveBeenCalledWith(events);
  });
});
