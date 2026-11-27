// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CompassRose from './CompassRose';
import { useTelemetryStore } from '../../stores/telemetryStore';

const withYaw = (yaw) => useTelemetryStore.setState({ data: { attitude: { yaw } } });
beforeEach(() => useTelemetryStore.setState({ data: null }));
afterEach(cleanup);

describe('CompassRose', () => {
  it('shows -- and a dimmed ring with no heading', () => {
    const { container } = render(<CompassRose />);
    expect(screen.getByText(/^--/)).toBeTruthy();
    expect(container.querySelector('g[opacity="0.2"]')).toBeTruthy();
  });

  it('pads the heading to three digits', () => {
    withYaw(45);
    render(<CompassRose />);
    expect(screen.getByText(/^045/)).toBeTruthy();
  });

  it('wraps negative and over-360 headings', () => {
    withYaw(-90);
    const { unmount } = render(<CompassRose />);
    expect(screen.getByText(/^270/)).toBeTruthy();
    unmount();
    withYaw(725);
    render(<CompassRose />);
    expect(screen.getByText(/^005/)).toBeTruthy();
  });

  it('does not invent a heading for NaN', () => {
    withYaw(NaN);
    render(<CompassRose />);
    expect(screen.getByText(/^--/)).toBeTruthy();
  });

  it('rotates the ring opposite to the heading', () => {
    withYaw(90);
    const { container } = render(<CompassRose />);
    expect(container.querySelector('g[transform^="rotate(-90"]')).toBeTruthy();
  });
});
