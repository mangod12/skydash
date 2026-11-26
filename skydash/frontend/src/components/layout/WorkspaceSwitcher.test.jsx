// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { useUIStore } from '../../stores/uiStore';

beforeEach(() => useUIStore.setState({ workspace: 'operator' }));
afterEach(cleanup);

describe('WorkspaceSwitcher', () => {
  it('marks the current workspace as pressed', () => {
    render(<WorkspaceSwitcher />);
    expect(screen.getByText('OPERATOR').closest('button').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('ANALYST').closest('button').getAttribute('aria-pressed')).toBe('false');
  });

  it('switches workspace on click', () => {
    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByText('COMMANDER'));
    expect(useUIStore.getState().workspace).toBe('commander');
    expect(screen.getByText('COMMANDER').closest('button').getAttribute('aria-pressed')).toBe('true');
  });
});
