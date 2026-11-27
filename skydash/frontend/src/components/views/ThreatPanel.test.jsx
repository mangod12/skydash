// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThreatPanel } from './ThreatPanel';
import { useIntelStore } from '../../stores/intelStore';

afterEach(cleanup);

const draw = (entities, events = []) => {
  useIntelStore.setState({ entities, events });
  return render(<ThreatPanel />);
};
const ent = (id, threatLevel) => ({ id, threatLevel });

describe('ThreatPanel', () => {
  it('says NO DATA instead of LOW when nothing is tracked', () => {
    draw([]);
    expect(screen.getByText('NO DATA')).toBeTruthy();
    expect(screen.queryByText('LOW')).toBeNull();
  });

  it('reports the highest level present with counts', () => {
    draw([ent(1, 'low'), ent(2, 'high'), ent(3, 'high'), ent(4, 'medium')]);
    expect(screen.getByText('HIGH')).toBeTruthy();
    expect(screen.getByText('0C / 2H / 1M / 1L')).toBeTruthy();
  });

  it('critical wins and unknown levels are not counted', () => {
    draw([ent(1, 'critical'), ent(2, 'high'), ent(3, 'none')]);
    expect(screen.getByText('CRITICAL')).toBeTruthy();
    expect(screen.getByText('1C / 1H / 0M / 0L')).toBeTruthy();
  });

  it('is LOW when only low threats exist', () => {
    draw([ent(1, 'low')]);
    expect(screen.getByText('LOW')).toBeTruthy();
  });

  it('lists the 8 newest events with labelled severity', () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      id: i, description: `ev${i}`, severity: i === 9 ? 'critical' : 'info', time: new Date(2026, 0, 1, 0, i),
    }));
    draw([ent(1, 'low')], events);
    expect(screen.queryByText('ev0')).toBeNull();
    expect(screen.queryByText('ev1')).toBeNull();
    expect(screen.getByText('ev9')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /^Severity:/ }).length).toBe(8);
    expect(screen.getByLabelText('Severity: critical')).toBeTruthy();
  });
});
