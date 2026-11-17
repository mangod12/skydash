// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import MapHUD from './MapHUD';
import CompassRose from './CompassRose';
import { useTelemetryStore } from '../../stores/telemetryStore';

afterEach(cleanup);
it('names the actual drone and shows unknown map readings without fabricated north or null labels', () => {
  useTelemetryStore.getState().updateTelemetry({ drone_id: 'BRAVO-2', attitude: { yaw: 'north' }, altitude: 'unknown' }, 0);
  const { container } = render(<><MapHUD data={useTelemetryStore.getState().data} /><CompassRose /></>);
  expect(screen.getByText('BRAVO-2')).toBeTruthy();
  expect(container.textContent).not.toContain('DRONE-01');
  for (const bad of ['undefined', 'null', 'NaN', '000°']) expect(container.textContent).not.toContain(bad);
});

it('keeps zero readings and normalizes heading around north', () => {
  useTelemetryStore.getState().updateTelemetry({ drone_id: 'one', timestamp: 0, altitude: 0, battery_voltage: 0,
    ground_speed: 0, signal_strength: 0, attitude: { yaw: -90 } }, 0);
  const { container } = render(<><MapHUD data={useTelemetryStore.getState().data} /><CompassRose /></>);
  expect(container.textContent).toContain('T+00:00');
  expect(container.textContent).toContain('270°');
  expect(container.textContent).not.toContain('undefined');
  expect(container.textContent).not.toContain('-90');
});
