// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AuditLog from './AuditLog';
import { useAuditStore, audit } from '../../stores/auditStore';
import { useAuthStore } from '../../stores/authStore';

beforeEach(() => {
  useAuditStore.getState().clear();
  useAuthStore.setState({ authEnabled: false, user: null });
});
afterEach(cleanup);

describe('AuditLog', () => {
  it('shows an empty state and a count', () => {
    render(<AuditLog />);
    expect(screen.getByText('NO AUDIT ENTRIES')).toBeTruthy();
    expect(screen.getByText('0 / 0 entries')).toBeTruthy();
  });

  it('filters by category, including the alert category', () => {
    audit('acknowledge', 'alert', 'Acknowledged "Geofence breach" (critical) as cmdr.lee');
    audit('create', 'entity', 'Created "Depot"');
    render(<AuditLog />);
    expect(screen.getByText('2 / 2 entries')).toBeTruthy();
    fireEvent.click(screen.getAllByText('ALERT')[0]);
    expect(screen.getByText(/Acknowledged "Geofence breach"/)).toBeTruthy();
    expect(screen.queryByText('Created "Depot"')).toBeNull();
    expect(screen.getByText('1 / 2 entries')).toBeTruthy();
  });

  it('colors escalate and acknowledge distinctly from plain views', () => {
    audit('escalate', 'alert', 'Escalated "X"');
    audit('acknowledge', 'alert', 'Acknowledged "X"');
    render(<AuditLog />);
    expect(screen.getByText('ESCALATE').className).toContain('text-red-400');
    expect(screen.getByText('ACKNOWLEDGE').className).toContain('text-emerald-400');
  });

  it('clear needs a second click to confirm', () => {
    audit('create', 'entity', 'Created "Depot"');
    render(<AuditLog />);
    fireEvent.click(screen.getByText('CLEAR'));
    expect(useAuditStore.getState().entries).toHaveLength(1);
    fireEvent.click(screen.getByText('CONFIRM'));
    expect(useAuditStore.getState().entries).toHaveLength(0);
  });

  it('offers the server export only to a commander with auth on', () => {
    const { rerender } = render(<AuditLog />);
    expect(screen.queryByText('SERVER CSV')).toBeNull();
    useAuthStore.setState({ authEnabled: true, user: { role: 'analyst' } });
    rerender(<AuditLog />);
    expect(screen.queryByText('SERVER CSV')).toBeNull();
    useAuthStore.setState({ authEnabled: true, user: { role: 'commander' } });
    rerender(<AuditLog />);
    expect(screen.getByText('SERVER CSV')).toBeTruthy();
  });
});
