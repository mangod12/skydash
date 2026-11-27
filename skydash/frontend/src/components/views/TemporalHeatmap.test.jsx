// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const grid = vi.fn();
vi.mock('../../utils/eventBuckets', () => ({ buildGrid: (e) => grid(e) }));

import TemporalHeatmap from './TemporalHeatmap';

afterEach(() => { cleanup(); grid.mockReset(); });

const data = (rows) => ({ grid: rows, colLabels: ['00', '01', '02'] });

describe('TemporalHeatmap', () => {
  it('renders a labelled row per severity and a cell per column', () => {
    grid.mockReturnValue(data([[0, 1, 2], [0, 0, 0], [3, 0, 0], [0, 0, 9]]));
    const { container } = render(<TemporalHeatmap events={[]} />);
    for (const l of ['CRITICAL', 'WARNING', 'INFO', 'DETECT']) expect(screen.getByText(l)).toBeTruthy();
    expect(container.querySelectorAll('[title*=" events"]')).toHaveLength(12);
  });

  it('gives each cell a title with its row, column and count', () => {
    grid.mockReturnValue(data([[0, 1, 2], [0, 0, 0], [0, 0, 0], [0, 0, 0]]));
    render(<TemporalHeatmap events={[]} />);
    expect(screen.getByTitle('CRITICAL @ 02: 2 events')).toBeTruthy();
  });

  it('colours cells by count band', () => {
    grid.mockReturnValue(data([[0, 1, 2], [3, 4, 5], [6, 7, 20], [0, 0, 0]]));
    render(<TemporalHeatmap events={[]} />);
    const cls = (t) => screen.getByTitle(t).className;
    expect(cls('CRITICAL @ 00: 0 events')).toContain('bg-zinc-800/40');
    expect(cls('CRITICAL @ 01: 1 events')).toContain('bg-cyan-900/30');
    expect(cls('CRITICAL @ 02: 2 events')).toContain('bg-cyan-700/40');
    expect(cls('WARNING @ 00: 3 events')).toContain('bg-amber-700/40');
    expect(cls('WARNING @ 02: 5 events')).toContain('bg-red-700/40');
    expect(cls('INFO @ 02: 20 events')).toContain('bg-red-500/50');
  });

  it('shows every other column label', () => {
    grid.mockReturnValue(data([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]));
    const { container } = render(<TemporalHeatmap events={[]} />);
    const heads = [...container.querySelectorAll('.text-\\[7px\\]')].map((n) => n.textContent);
    expect(heads).toEqual(['00', '', '02']);
  });
});
