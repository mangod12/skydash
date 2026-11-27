// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ThreatGaugeCard from './ThreatGaugeCard';

afterEach(cleanup);

const fills = (c) => [...c.querySelectorAll('[role="meter"] > div > div')].map((d) => d.style.width);

describe('ThreatGaugeCard', () => {
  it('shows an empty state when nothing is tracked', () => {
    render(<ThreatGaugeCard score={0} highCount={0} critCount={0} total={0} />);
    expect(screen.getByText('No tracked entities yet.')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('exposes the score as a meter with counts', () => {
    render(<ThreatGaugeCard score={72} highCount={3} critCount={1} total={9} />);
    const m = screen.getByRole('meter', { name: 'Threat score' });
    expect(m.getAttribute('aria-valuenow')).toBe('72');
    expect(screen.getByText('/ 100 · HIGH')).toBeTruthy();
    expect(screen.getByText('3 HIGH · 1 CRITICAL')).toBeTruthy();
  });

  it('picks the band label at the boundaries', () => {
    for (const [score, label] of [[0, 'LOW'], [29, 'LOW'], [30, 'MED'], [59, 'MED'], [60, 'HIGH'], [84, 'HIGH'], [85, 'CRIT'], [100, 'CRIT']]) {
      const { unmount } = render(<ThreatGaugeCard score={score} highCount={0} critCount={0} />);
      expect(screen.getByText(`/ 100 · ${label}`)).toBeTruthy();
      unmount();
    }
  });

  it('clamps out-of-range scores', () => {
    const { container, unmount } = render(<ThreatGaugeCard score={140} highCount={0} critCount={0} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('100');
    expect(fills(container)).toEqual(['100%', '100%', '100%', '100%']);
    unmount();
    render(<ThreatGaugeCard score={-5} highCount={0} critCount={0} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
  });

  it('fills bands in sequence', () => {
    const { container } = render(<ThreatGaugeCard score={45} highCount={0} critCount={0} />);
    expect(fills(container)).toEqual(['100%', '50%', '0%', '0%']);
  });
});
