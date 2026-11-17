// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import UserAdmin from './UserAdmin';
import { useAuthStore } from '../../stores/authStore';

afterEach(() => { cleanup(); vi.restoreAllMocks(); useAuthStore.setState({ authEnabled: null, token: null, user: null }); });

const users = [
  { id: 'a1', username: 'boss', role: 'commander', disabled: false },
  { id: 'b2', username: 'lee', role: 'viewer', disabled: false },
];

describe('UserAdmin', () => {
  it('renders nothing for non-commanders', () => {
    useAuthStore.setState({ authEnabled: true, token: 't', user: { id: 'b2', role: 'analyst' } });
    const { container } = render(<UserAdmin />);
    expect(container.firstChild).toBeNull();
  });

  it('lists accounts, locks own row, and patches a role', async () => {
    useAuthStore.setState({ authEnabled: true, token: 't', user: { id: 'a1', role: 'commander' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: users }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'b2', role: 'operator', disabled: false } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<UserAdmin />);
    await screen.findByText('lee');
    expect(screen.getByLabelText('Role for boss').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Role for lee'), { target: { value: 'operator' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ role: 'operator' });
  });
});
