// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AlertRulesConfig from './AlertRulesConfig';
import { useAlertRulesStore } from '../../stores/alertRulesStore';

const rules = [
  { id: 'r1', name: 'Rule One', type: 'battery_low', severity: 'warning', enabled: true, config: { threshold: 20 } },
  { id: 'r2', name: 'Rule Two', type: 'speed_limit', severity: 'info', enabled: false, config: { maxSpeed: 10 } },
];

beforeEach(() => useAlertRulesStore.setState({ rules }));
afterEach(cleanup);

describe('AlertRulesConfig', () => {
  it('lists rules and counts the enabled ones', () => {
    render(<AlertRulesConfig />);
    expect(screen.getByText('Rule One')).toBeTruthy();
    expect(screen.getByText('Rule Two')).toBeTruthy();
    expect(screen.getByText('1/2 ACTIVE')).toBeTruthy();
  });

  it('toggles a rule through the store and updates the count', () => {
    render(<AlertRulesConfig />);
    fireEvent.click(screen.getByLabelText('Enable alert rule'));
    expect(useAlertRulesStore.getState().rules.find((r) => r.id === 'r2').enabled).toBe(true);
    expect(screen.getByText('2/2 ACTIVE')).toBeTruthy();
  });

  it('removes a custom rule', () => {
    render(<AlertRulesConfig />);
    fireEvent.click(screen.getByLabelText('Remove alert rule Rule One'));
    expect(useAlertRulesStore.getState().rules.map((r) => r.id)).toEqual(['r2']);
    expect(screen.queryByText('Rule One')).toBeNull();
  });
});
