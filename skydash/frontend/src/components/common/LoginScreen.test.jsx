// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';
import { useAuthStore } from '../../stores/authStore';

const setup = (login = vi.fn().mockResolvedValue(true), error = null) => {
  useAuthStore.setState({ login, error });
  render(<LoginScreen />);
  return login;
};
const type = (placeholder, value) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

beforeEach(() => useAuthStore.setState({ error: null }));
afterEach(cleanup);

describe('LoginScreen', () => {
  it('keeps LOGIN disabled until both fields have content', () => {
    setup();
    const button = screen.getByRole('button', { name: 'LOGIN' });
    expect(button.disabled).toBe(true);
    type('Enter username', '   ');
    type('Enter password', 'secret');
    expect(button.disabled).toBe(true);
    type('Enter username', 'analyst1');
    expect(button.disabled).toBe(false);
  });

  it('submits the trimmed username with the password as typed and shows progress', async () => {
    let resolve;
    const login = setup(vi.fn(() => new Promise((r) => { resolve = r; })));
    type('Enter username', '  analyst1  ');
    type('Enter password', ' pass word ');
    fireEvent.submit(screen.getByRole('button', { name: 'LOGIN' }).closest('form'));
    expect(login).toHaveBeenCalledWith('analyst1', ' pass word ');
    expect(screen.getByRole('button', { name: 'AUTHENTICATING...' }).disabled).toBe(true);
    await act(async () => { resolve(false); });
    expect(screen.getByRole('button', { name: 'LOGIN' })).toBeTruthy();
  });

  it('does not call login for an empty submit', () => {
    const login = setup();
    fireEvent.submit(screen.getByRole('button', { name: 'LOGIN' }).closest('form'));
    expect(login).not.toHaveBeenCalled();
  });

  it('shows the store error and masks the password field', () => {
    setup(undefined, 'Cannot reach server');
    expect(screen.getByText('Cannot reach server')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter password').type).toBe('password');
  });
});
