// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('recharts', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  const Null = () => null;
  return {
    ResponsiveContainer: Pass, PieChart: Pass, Pie: Pass, Cell: Null, BarChart: Pass, Bar: Pass,
    AreaChart: Pass, Area: Null, XAxis: Null, YAxis: Null, Tooltip: Null, CartesianGrid: Null,
  };
});

import { EntityDistributionChart, ThreatBreakdownChart, AltitudeTrendChart } from './AnalyticsCharts';

afterEach(cleanup);

describe('EntityDistributionChart', () => {
  it('shows NO DATA when empty', () => {
    render(<EntityDistributionChart typeData={[]} />);
    expect(screen.getByText('NO DATA')).toBeTruthy();
  });
  it('renders a legend entry per type', () => {
    render(<EntityDistributionChart typeData={[{ name: 'person', value: 3 }, { name: 'vehicle', value: 1 }]} />);
    expect(screen.getByText('person')).toBeTruthy();
    expect(screen.getByText('vehicle')).toBeTruthy();
  });
});

describe('ThreatBreakdownChart', () => {
  it('has a text alternative for data and for empty', () => {
    render(<ThreatBreakdownChart threatData={[{ name: 'high', value: 2 }, { name: 'low', value: 5 }]} />);
    expect(screen.getByRole('img', { name: 'Threat breakdown: high 2, low 5' })).toBeTruthy();
    cleanup();
    render(<ThreatBreakdownChart threatData={[]} />);
    expect(screen.getByRole('img', { name: 'Threat breakdown: no data' })).toBeTruthy();
    expect(screen.getByText('NO DATA')).toBeTruthy();
  });
});

describe('AltitudeTrendChart', () => {
  it('awaits data with fewer than two points', () => {
    render(<AltitudeTrendChart history={[{ altitude: 10 }]} />);
    expect(screen.getByText('AWAITING DATA')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Altitude trend: awaiting data' })).toBeTruthy();
  });
  it('summarises latest value and range, ignoring non-finite samples', () => {
    render(<AltitudeTrendChart history={[{ altitude: 100 }, { altitude: NaN }, { altitude: 140.4 }, { altitude: 120 }]} />);
    expect(screen.getByRole('img', { name: 'Altitude trend over 3 samples, latest 120 m, range 100 to 140 m' })).toBeTruthy();
  });
});
