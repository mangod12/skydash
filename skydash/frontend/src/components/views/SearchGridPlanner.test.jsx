// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchGridPlanner from './SearchGridPlanner';
const map = { fitBounds: vi.fn() };
let mapEvents;
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="grid-map">{children}</div>,
  TileLayer: () => null, Polygon: () => null, Polyline: () => null, CircleMarker: () => null, Tooltip: () => null,
  useMap: () => map, useMapEvents: events => { mapEvents = events; },
}));
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:grid'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const generate = () => fireEvent.click(screen.getByText('Generate search grid'));

describe('search grid planner workflow', () => {
  it('requires generation and shows bounded geometric metrics with honest exclusions', () => {
    render(<SearchGridPlanner />); expect(screen.queryByText('Export concept GeoJSON')).toBeNull();
    expect(screen.getByText(/not an executable aircraft mission/)).toBeTruthy();
    generate(); expect(screen.getByText('2.90km')).toBeTruthy(); expect(screen.getByText('100.0m')).toBeTruthy();
    expect(map.fitBounds).toHaveBeenCalled(); expect(screen.getByText('Export concept GeoJSON').disabled).toBe(false);
    fireEvent.click(screen.getByText('Export concept GeoJSON')); expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toContain('cannot be uploaded as an aircraft mission');
  });
  it('blocks export when inputs change until explicitly regenerated', () => {
    render(<SearchGridPlanner />); generate();
    fireEvent.change(screen.getByLabelText('East-west width (m)'), { target: { value: '600' } });
    expect(screen.getByRole('alert').textContent).toContain('last generated sketch');
    expect(screen.getByText('Export concept GeoJSON').disabled).toBe(true);
    generate(); expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('3.40km')).toBeTruthy();
  });
  it('does not turn blank inputs into genuine zero coordinates', () => {
    render(<SearchGridPlanner />); fireEvent.change(screen.getByLabelText('Center latitude'), { target: { value: '' } }); generate();
    expect(screen.getByRole('alert').textContent).toContain('finite number'); expect(screen.queryByText('Export concept GeoJSON')).toBeNull();
  });
  it('keeps failed changes separate from the last good preview', () => {
    render(<SearchGridPlanner />); generate();
    fireEvent.change(screen.getByLabelText('North-south height (m)'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('Maximum lane spacing (m)'), { target: { value: '10' } }); generate();
    expect(screen.getAllByRole('alert').some(item => item.textContent.includes('200 lanes'))).toBe(true);
    expect(screen.getByText('2.90km')).toBeTruthy(); expect(screen.getByText('Export concept GeoJSON').disabled).toBe(true);
  });
  it('sets center from an actual map event without silently regenerating or exporting', () => {
    render(<SearchGridPlanner />); generate();
    act(() => mapEvents.click({ latlng: { lat: 28.614, lng: 77.209 } }));
    expect(screen.getByLabelText('Center latitude').value).toBe('28.614000');
    expect(screen.getByLabelText('Center longitude').value).toBe('77.209000');
    expect(typeof mapEvents.click).toBe('function');
    expect(screen.getByText('Export concept GeoJSON').disabled).toBe(true);
  });
  it('returns to the lab and reports export failure honestly', () => {
    const onBack = vi.fn(); render(<SearchGridPlanner onBack={onBack} />); generate();
    URL.createObjectURL.mockImplementationOnce(() => { throw new Error('blocked'); }); fireEvent.click(screen.getByText('Export concept GeoJSON'));
    expect(screen.getByRole('alert').textContent).toContain('Export could not start');
    fireEvent.click(screen.getByText('Back to Scenario Lab')); expect(onBack).toHaveBeenCalledOnce();
  });
});
