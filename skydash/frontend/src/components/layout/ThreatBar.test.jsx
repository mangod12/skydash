// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ThreatBar from './ThreatBar';
import { useIntelStore } from '../../stores/intelStore';

afterEach(cleanup);

const bar = (entities) => {
  useIntelStore.setState({ entities });
  return render(<ThreatBar />);
};

describe('ThreatBar', () => {
  it('reports no entities with a neutral bar', () => {
    bar([]);
    const el = screen.getByRole('img');
    expect(el.getAttribute('aria-label')).toBe('Threat level: no entities tracked');
    expect(el.style.backgroundColor).toBe('rgb(39, 39, 42)');
  });

  it('is steady when nothing is high or critical', () => {
    bar([{ id: 1, threatLevel: 'low' }]);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Threat level: no high or critical threats');
  });

  it('is high when a high threat exists', () => {
    bar([{ id: 1, threatLevel: 'low' }, { id: 2, threatLevel: 'high' }]);
    const el = screen.getByRole('img');
    expect(el.getAttribute('aria-label')).toBe('Threat level: high threat present');
    expect(el.className).not.toContain('animate-pulse');
  });

  it('critical wins over high and pulses', () => {
    bar([{ id: 1, threatLevel: 'high' }, { id: 2, threatLevel: 'critical' }]);
    const el = screen.getByRole('img');
    expect(el.getAttribute('aria-label')).toBe('Threat level: critical threat present');
    expect(el.className).toContain('animate-pulse');
  });
});
