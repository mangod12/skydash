// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../telemetry/TelemetryPanel', () => ({ default: () => <div>telemetry-panel</div> }));
vi.mock('../telemetry/DroneCommandPanel', () => ({ default: () => { throw new Error('boom'); } }));
vi.mock('../map/MapView', () => ({ default: ({ variant }) => <div>map-{variant}</div> }));
vi.mock('../telemetry/AlertBar', () => ({ default: () => <div>alert-bar</div> }));
vi.mock('../telemetry/ReplayBar', () => ({ default: () => <div>replay-bar</div> }));

import TelemetryView from './TelemetryView';

afterEach(cleanup);

describe('TelemetryView', () => {
  it('composes the panels and contains a failing one instead of blanking the view', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e) => e.preventDefault();
    window.addEventListener('error', swallow);
    render(<TelemetryView />);
    window.removeEventListener('error', swallow);
    expect(screen.getByText('map-telemetry')).toBeTruthy();
    expect(screen.getByText('telemetry-panel')).toBeTruthy();
    expect(screen.getByText('replay-bar')).toBeTruthy();
    expect(screen.getByText('alert-bar')).toBeTruthy();
  });
});
