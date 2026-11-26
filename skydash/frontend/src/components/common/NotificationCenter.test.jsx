// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import NotificationCenter from './NotificationCenter';
import useNotificationStore from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';
import { useAuditStore } from '../../stores/auditStore';

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const strip = ({ initial, animate, exit, transition, layout, ...rest }) => rest; // eslint-disable-line no-unused-vars
  return {
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: (_, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...strip(props), ref })) }),
  };
});

const seed = (items) => {
  useNotificationStore.setState({
    notifications: items.map((n, i) => ({ id: `n${i}`, read: false, status: 'new', timestamp: new Date(), ...n })),
    unreadCount: items.length,
  });
};

beforeEach(() => {
  useAuditStore.getState().clear();
  useAuthStore.setState({ user: { username: 'cmdr.lee' } });
});
afterEach(() => { cleanup(); useAuthStore.setState({ user: null }); });

describe('NotificationCenter alert workflow', () => {
  it('opens on the attention queue and shows only unresolved critical or warning alerts', () => {
    seed([
      { type: 'alert', severity: 'critical', title: 'Geofence breach', message: 'm' },
      { type: 'alert', severity: 'info', title: 'Info alert', message: 'm' },
      { type: 'system', severity: 'info', title: 'Feed up', message: 'm' },
    ]);
    render(<NotificationCenter isOpen onClose={() => {}} />);
    expect(screen.getByText('ATTENTION (1)')).toBeTruthy();
    expect(screen.getByText('Geofence breach')).toBeTruthy();
    expect(screen.queryByText('Feed up')).toBeNull();
    fireEvent.click(screen.getByText('ALL'));
    expect(screen.getByText('Feed up')).toBeTruthy();
  });

  it('acknowledging records the actor, clears the attention queue and writes an audit entry', () => {
    seed([{ type: 'alert', severity: 'critical', title: 'Geofence breach', message: 'm' }]);
    render(<NotificationCenter isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('Acknowledge Geofence breach'));
    expect(screen.getByText('Nothing needs attention')).toBeTruthy();
    fireEvent.click(screen.getByText('ALL'));
    expect(screen.getByText(/acknowledged · cmdr\.lee · \d\d:\d\dZ/i)).toBeTruthy();
    expect(screen.queryByLabelText('Acknowledge Geofence breach')).toBeNull();
    expect(useAuditStore.getState().entries[0]).toMatchObject({ action: 'acknowledge', category: 'alert' });
  });

  it('escalating keeps the alert in the queue, marks it escalated and removes the escalate button', () => {
    seed([{ type: 'alert', severity: 'warning', title: 'Low battery', message: 'm' }]);
    render(<NotificationCenter isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('Escalate Low battery'));
    expect(screen.getByText('ATTENTION (1)')).toBeTruthy();
    expect(screen.getByText(/escalated · cmdr\.lee/i)).toBeTruthy();
    expect(screen.queryByLabelText('Escalate Low battery')).toBeNull();
    expect(screen.getByLabelText('Acknowledge Low battery')).toBeTruthy();
  });

  it('tags demo samples and not live alerts', () => {
    seed([
      { type: 'alert', severity: 'critical', title: 'Seeded', message: 'm', sample: true },
      { type: 'alert', severity: 'critical', title: 'Live', message: 'm' },
    ]);
    render(<NotificationCenter isOpen onClose={() => {}} />);
    expect(screen.getAllByText('SAMPLE')).toHaveLength(1);
  });

  it('closes on Escape and renders nothing when closed', () => {
    seed([]);
    const onClose = vi.fn();
    const { container, rerender } = render(<NotificationCenter isOpen onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    rerender(<NotificationCenter isOpen={false} onClose={onClose} />);
    expect(container.textContent).toBe('');
  });
});
