// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AccountChip from './AccountChip';
import { useAuthStore } from '../../stores/authStore';

afterEach(() => { cleanup(); useAuthStore.setState({ authEnabled: null, token: null, user: null }); });

describe('AccountChip', () => {
  it('renders nothing when auth is off', () => {
    useAuthStore.setState({ authEnabled: false, token: null, user: null });
    const { container } = render(<AccountChip />);
    expect(container.firstChild).toBeNull();
  });
  it('shows user and role and signs out', () => {
    useAuthStore.setState({ authEnabled: true, token: 't', user: { username: 'jdoe', role: 'operator' } });
    render(<AccountChip />);
    expect(screen.getByText('jdoe')).toBeTruthy();
    expect(screen.getByText('OPERATOR')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Sign out'));
    expect(useAuthStore.getState().token).toBeNull();
  });
});
