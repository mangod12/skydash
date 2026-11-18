// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MissionReadinessTab from './MissionReadinessTab';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { apiFetch } from '../../utils/api';
vi.mock('../../utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../../utils/runtimeConfig', () => ({ API_BASE: 'https://example.test', API_CONFIGURED: true }));
const mission = { id: 'm1', name: 'Test training', status: 'active', description: 'Observe.', center_lat: 0, center_lng: 0, entityIds: ['e1'] };
const response = () => ({ ok: true, json: async () => ({ success: true, data: { opensky: { available: true }, shodan: { available: false, mode: 'mock' } } }) });
beforeEach(() => {
  vi.clearAllMocks();
  useIntelStore.setState({ entities: [{ id: 'e1' }] });
  useTelemetryStore.setState({ data: { drone_id: 'd1', gps: { latitude: 0, longitude: 0 }, battery_percentage: 80, signal_strength: 90 }, activeDroneId: 'd1', dataReceivedAt: Date.now(), isConnected: true });
  apiFetch.mockResolvedValue(response());
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('MissionReadinessTab', () => {
  it('shows training scope, evidence, mock status, and an explicit refresh', async () => {
    render(<MissionReadinessTab mission={mission} />);
    await screen.findByText(/OpenSky supported; Shodan mock/);
    expect(screen.getByText(/This is not clearance to fly/)).toBeTruthy();
    expect(screen.getByText(/No commands are sent/)).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Refresh source status'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  });
  it('shows unknown instead of silently passing failed status reads', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    render(<MissionReadinessTab mission={mission} />);
    await screen.findByText('Connector status unavailable or older than 60s.');
    expect(screen.getByText('Review required')).toBeTruthy();
  });
  it('captures a timestamped browser download without claiming team persistence', async () => {
    render(<MissionReadinessTab mission={mission} />);
    await screen.findByText(/OpenSky supported; Shodan mock/);
    fireEvent.click(screen.getByText('Save timestamped report'));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Report download requested at/).textContent).toContain('not shared with the team');
    expect(document.querySelector('a[download]')).toBeNull();
  });
  it('reports browser export errors and permits retry', async () => {
    render(<MissionReadinessTab mission={mission} />);
    await screen.findByText(/OpenSky supported; Shodan mock/);
    URL.createObjectURL.mockImplementationOnce(() => { throw new Error('blocked'); });
    fireEvent.click(screen.getByText('Save timestamped report'));
    expect(screen.getByRole('alert').textContent).toContain('could not start');
    fireEvent.click(screen.getByText('Save timestamped report'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('expires sample evidence without new telemetry and aborts hanging connector requests', async () => {
    vi.useFakeTimers();
    apiFetch.mockImplementation(() => new Promise(() => {}));
    render(<MissionReadinessTab mission={mission} />);
    expect(screen.getByText(/80% remaining/)).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(8001); });
    expect(screen.getByText(/No fresh battery percentage/)).toBeTruthy();
    expect(screen.getByText('Connector status unavailable or older than 60s.')).toBeTruthy();
    expect(apiFetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('aborts its request on unmount', () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    const view = render(<MissionReadinessTab mission={mission} />);
    const signal = apiFetch.mock.calls[0][1].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
