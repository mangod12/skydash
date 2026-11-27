// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CoordinateDisplay from './CoordinateDisplay';

afterEach(cleanup);

describe('CoordinateDisplay', () => {
  it('renders nothing without a position', () => {
    const { container, rerender } = render(<CoordinateDisplay lat={null} lng={77} />);
    expect(container.firstChild).toBeNull();
    rerender(<CoordinateDisplay lat={12} lng={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('starts in decimal degrees and cycles DD, DMS, UTM, MGRS and back', () => {
    render(<CoordinateDisplay lat={28.6139} lng={77.209} />);
    const btn = screen.getByRole('button');
    const seen = [];
    for (let i = 0; i < 5; i++) {
      seen.push(btn.getAttribute('aria-label').split(' ')[2].replace(':', ''));
      fireEvent.click(btn);
    }
    expect(seen).toEqual(['DD', 'DMS', 'UTM', 'MGRS', 'DD']);
  });

  it('puts the formatted value in the accessible name', () => {
    render(<CoordinateDisplay lat={28.6139} lng={77.209} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/^Coordinate format DD: .*28\.61/);
  });

  it('shows N/A for an invalid coordinate', () => {
    render(<CoordinateDisplay lat={120} lng={300} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Coordinate format DD: N/A');
  });
});
