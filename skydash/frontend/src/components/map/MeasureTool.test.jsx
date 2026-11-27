// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let handlers = {};
vi.mock('react-leaflet', () => ({
  useMapEvents: (h) => { handlers = h; return {}; },
  Polyline: (p) => <div data-testid="line" data-n={p.positions.length} />,
  CircleMarker: () => <div data-testid="pt" />,
}));

import MeasureTool, { MeasureOverlay } from './MeasureTool';

afterEach(cleanup);

const A = { lat: 0, lng: 0 };
const B = { lat: 0, lng: 0.001 };
const C = { lat: 0, lng: 1 };

describe('MeasureTool', () => {
  it('renders nothing when inactive or empty', () => {
    const { container, rerender } = render(<MeasureTool active={false} points={[A]} onAddPoint={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    rerender(<MeasureTool active points={[]} onAddPoint={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('draws a marker per point and a line from two points', () => {
    render(<MeasureTool active points={[A]} onAddPoint={vi.fn()} />);
    expect(screen.queryByTestId('line')).toBeNull();
    cleanup();
    render(<MeasureTool active points={[A, B, C]} onAddPoint={vi.fn()} />);
    expect(screen.getAllByTestId('pt').length).toBe(3);
    expect(screen.getByTestId('line').dataset.n).toBe('3');
  });

  it('adds a point on map click only while active', () => {
    const add = vi.fn();
    render(<MeasureTool active points={[]} onAddPoint={add} />);
    handlers.click({ latlng: { lat: 1.5, lng: 2.5 } });
    expect(add).toHaveBeenCalledWith({ lat: 1.5, lng: 2.5 });
    cleanup();
    const add2 = vi.fn();
    render(<MeasureTool active={false} points={[]} onAddPoint={add2} />);
    handlers.click({ latlng: { lat: 1, lng: 1 } });
    expect(add2).not.toHaveBeenCalled();
  });
});

describe('MeasureOverlay', () => {
  it('needs two points and an active tool', () => {
    const { container, rerender } = render(<MeasureOverlay active points={[A]} />);
    expect(container.firstChild).toBeNull();
    rerender(<MeasureOverlay active={false} points={[A, B]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows short distances in metres', () => {
    render(<MeasureOverlay active points={[A, B]} />);
    expect(screen.getByText(/^\d+\.\d m$/)).toBeTruthy();
    expect(screen.getByText('2 points')).toBeTruthy();
  });

  it('shows long distances in kilometres', () => {
    render(<MeasureOverlay active points={[A, C]} />);
    expect(screen.getByText(/^\d+\.\d{3} km$/)).toBeTruthy();
  });

  it('sums across segments', () => {
    const { unmount } = render(<MeasureOverlay active points={[A, C]} />);
    const one = parseFloat(screen.getByText(/km$/).textContent);
    unmount();
    render(<MeasureOverlay active points={[A, { lat: 0, lng: 0.5 }, C]} />);
    expect(parseFloat(screen.getByText(/km$/).textContent)).toBeCloseTo(one, 1);
    expect(screen.getByText('3 points')).toBeTruthy();
  });
});
