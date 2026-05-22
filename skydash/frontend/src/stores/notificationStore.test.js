import { describe, it, expect, beforeEach } from 'vitest';

// Ensure `window` exists for notificationStore's DEV guard
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {};
}

const { default: useNotificationStore, notify } = await import('./notificationStore');

const store = useNotificationStore;

// Snapshot initial seed state
const seedNotifications = store.getState().notifications.map((n) => ({ ...n }));
const seedUnread = store.getState().unreadCount;

beforeEach(() => {
  store.setState({
    notifications: seedNotifications.map((n) => ({ ...n })),
    unreadCount: seedUnread,
  });
});

describe('notificationStore', () => {
  it('has seed notifications', () => {
    expect(store.getState().notifications.length).toBeGreaterThan(0);
  });

  it('addNotification adds to front of array', () => {
    store.getState().addNotification({ type: 'alert', title: 'Test', message: 'msg', severity: 'info' });
    const first = store.getState().notifications[0];
    expect(first.title).toBe('Test');
    expect(first.read).toBe(false);
  });

  it('markRead sets read=true for specified notification', () => {
    const id = store.getState().notifications[0].id;
    store.getState().markRead(id);
    const n = store.getState().notifications.find((x) => x.id === id);
    expect(n.read).toBe(true);
  });

  it('markAllRead marks all notifications as read', () => {
    store.getState().markAllRead();
    const state = store.getState();
    state.notifications.forEach((n) => expect(n.read).toBe(true));
    expect(state.unreadCount).toBe(0);
  });

  it('dismiss removes notification', () => {
    const id = store.getState().notifications[0].id;
    const before = store.getState().notifications.length;
    store.getState().dismiss(id);
    expect(store.getState().notifications.length).toBe(before - 1);
    expect(store.getState().notifications.find((n) => n.id === id)).toBeUndefined();
  });

  it('enforces max 50 notifications', () => {
    // Add 55 notifications to go well over 50
    for (let i = 0; i < 55; i++) {
      store.getState().addNotification({ type: 'system', title: `N${i}`, message: 'x', severity: 'info' });
    }
    expect(store.getState().notifications.length).toBeLessThanOrEqual(50);
  });

  it('unreadCount is computed correctly after add and markRead', () => {
    // Mark all read first so we have a known baseline
    store.getState().markAllRead();
    expect(store.getState().unreadCount).toBe(0);

    // Add two unread notifications
    store.getState().addNotification({ type: 'alert', title: 'A', message: 'x', severity: 'info' });
    store.getState().addNotification({ type: 'alert', title: 'B', message: 'x', severity: 'info' });
    expect(store.getState().unreadCount).toBe(2);

    // Mark one as read
    const id = store.getState().notifications[0].id;
    store.getState().markRead(id);
    expect(store.getState().unreadCount).toBe(1);
  });

  it('notify() global helper adds a notification', () => {
    const before = store.getState().notifications.length;
    notify({ type: 'system', title: 'Global', message: 'test', severity: 'info' });
    expect(store.getState().notifications.length).toBe(before + 1);
    expect(store.getState().notifications[0].title).toBe('Global');
  });
});
