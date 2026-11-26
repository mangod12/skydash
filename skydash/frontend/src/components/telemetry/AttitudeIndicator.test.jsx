// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AttitudeIndicator from './AttitudeIndicator';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => useTelemetryStore.setState({ data: null }));
afterEach(cleanup);

const horizon = (c) => c.querySelector('g[clip-path]');

describe('AttitudeIndicator', () => {
  it('shows an unavailable state without attitude data', () => {
    const { container } = render(<AttitudeIndicator />);
    expect(screen.getByText('ATTITUDE UNAVAILABLE')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Attitude indicator: unavailable');
    expect(container.querySelector('svg').style.opacity).toBe('0.2');
  });

  it('requires both roll and pitch to be finite numbers', () => {
    useTelemetryStore.setState({ data: { attitude: { roll: 5, pitch: Number.NaN } } });
    render(<AttitudeIndicator />);
    expect(screen.getByText('ATTITUDE UNAVAILABLE')).toBeTruthy();
  });

  it('describes roll and pitch for assistive tech', () => {
    useTelemetryStore.setState({ data: { attitude: { roll: 12.4, pitch: -7.6 } } });
    render(<AttitudeIndicator />);
    expect(screen.queryByText('ATTITUDE UNAVAILABLE')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Attitude indicator: roll 12 degrees, pitch -8 degrees');
  });

  it('rotates the horizon against roll', () => {
    useTelemetryStore.setState({ data: { attitude: { roll: 30, pitch: 0 } } });
    const { container } = render(<AttitudeIndicator />);
    expect(horizon(container).getAttribute('transform')).toBe('rotate(-30, 100, 100)');
  });

  it('clamps displayed pitch to 30 degrees', () => {
    useTelemetryStore.setState({ data: { attitude: { roll: 0, pitch: 80 } } });
    const { container } = render(<AttitudeIndicator />);
    const line = [...container.querySelectorAll('g[clip-path] > line')].find((l) => l.getAttribute('x1') === '-100');
    expect(line.getAttribute('y1')).toBe('160');
  });

  it('wraps roll beyond a full turn', () => {
    useTelemetryStore.setState({ data: { attitude: { roll: 370, pitch: 0 } } });
    const { container } = render(<AttitudeIndicator />);
    expect(horizon(container).getAttribute('transform')).toBe('rotate(-10, 100, 100)');
  });
});
