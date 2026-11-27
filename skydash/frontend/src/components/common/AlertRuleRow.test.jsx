// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AlertRuleRow from './AlertRuleRow';
import { useTelemetryStore } from '../../stores/telemetryStore';

afterEach(cleanup);

const rule = (extra = {}) => ({
  id: 'custom-1',
  name: 'Low battery',
  type: 'battery_low',
  severity: 'warning',
  enabled: true,
  config: { threshold: 20 },
  ...extra,
});

const setup = (r = rule()) => {
  const handlers = { onToggle: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn() };
  render(<AlertRuleRow rule={r} {...handlers} />);
  return handlers;
};

describe('AlertRuleRow', () => {
  it('shows the rule name, type label and threshold', () => {
    setup();
    expect(screen.getByText('Low battery')).toBeTruthy();
    expect(screen.getByText('BATTERY')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('toggles and removes a custom rule', () => {
    const h = setup();
    fireEvent.click(screen.getByLabelText('Disable alert rule'));
    expect(h.onToggle).toHaveBeenCalledWith('custom-1');
    fireEvent.click(screen.getByLabelText('Remove alert rule Low battery'));
    expect(h.onRemove).toHaveBeenCalledWith('custom-1');
  });

  it('labels the toggle by state', () => {
    setup(rule({ enabled: false }));
    expect(screen.getByLabelText('Enable alert rule')).toBeTruthy();
  });

  it('edits the threshold and reports the new config', () => {
    const h = setup();
    fireEvent.click(screen.getByText('20%'));
    const input = screen.getByDisplayValue('20');
    fireEvent.change(input, { target: { value: '35' } });
    fireEvent.blur(input);
    expect(h.onUpdate).toHaveBeenCalledWith('custom-1', { config: { threshold: 35 } });
  });

  it('hides delete for a default rule and the editor for geofence rules', () => {
    setup(rule({ id: 'geo-any', type: 'geofence_breach', config: {} }));
    expect(screen.queryByLabelText(/Remove alert rule/)).toBeNull();
    expect(screen.getByText('GEOFENCE')).toBeTruthy();
  });
  it('dry-runs a rule against the current fleet without notifying', () => {
    useTelemetryStore.setState({
      data: null,
      fleet: [
        { drone_id: 'D1', battery_percentage: 12 },
        { drone_id: 'D2', battery_percentage: 80 },
      ],
    });
    setup();
    fireEvent.click(screen.getByLabelText('Test alert rule Low battery against current fleet'));
    const out = screen.getByRole('status').textContent;
    expect(out).toContain('would trigger on 1 of 2');
    expect(out).toContain('D1 battery at 12%');
  });

  it('says when a dry run would not trigger or there is no telemetry', () => {
    useTelemetryStore.setState({ data: null, fleet: [{ drone_id: 'D2', battery_percentage: 80 }] });
    setup(rule({ enabled: false }));
    fireEvent.click(screen.getByLabelText('Test alert rule Low battery against current fleet'));
    expect(screen.getByRole('status').textContent).toContain('would not trigger (1 drone checked)');
    expect(screen.getByRole('status').textContent).toContain('Rule is disabled');
    cleanup();
    useTelemetryStore.setState({ data: null, fleet: [] });
    setup();
    fireEvent.click(screen.getByLabelText('Test alert rule Low battery against current fleet'));
    expect(screen.getByRole('status').textContent).toContain('no telemetry yet');
  });

  it('labels the severity dot', () => {
    setup(rule({ severity: 'critical' }));
    expect(screen.getByLabelText('Severity: critical')).toBeTruthy();
  });
});
