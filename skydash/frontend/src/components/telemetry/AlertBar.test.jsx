// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AlertBar from './AlertBar';
import { useTelemetryStore } from '../../stores/telemetryStore';

const clearAlerts = vi.fn();
beforeEach(() => {
  clearAlerts.mockClear();
  useTelemetryStore.setState({ alerts: [], clearAlerts });
});
afterEach(cleanup);

describe('AlertBar', () => {
  it('renders nothing without alerts', () => {
    const { container } = render(<AlertBar />);
    expect(container.textContent).toBe('');
  });

  it('shows the first alert when none is critical, as a polite status', () => {
    useTelemetryStore.setState({ alerts: [{ severity: 'warning', message: 'Low battery' }, { severity: 'info', message: 'Ping' }] });
    render(<AlertBar />);
    expect(screen.getByText('Low battery')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('prefers a critical alert and announces it as an alert', () => {
    useTelemetryStore.setState({ alerts: [{ severity: 'warning', message: 'Low battery' }, { severity: 'critical', message: 'Link lost' }] });
    render(<AlertBar />);
    expect(screen.getByText('Link lost')).toBeTruthy();
    expect(screen.queryByText('Low battery')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('has a labelled dismiss button that clears alerts', () => {
    useTelemetryStore.setState({ alerts: [{ severity: 'info', message: 'Ping' }] });
    render(<AlertBar />);
    fireEvent.click(screen.getByLabelText('Dismiss alerts'));
    expect(clearAlerts).toHaveBeenCalledTimes(1);
  });
});
