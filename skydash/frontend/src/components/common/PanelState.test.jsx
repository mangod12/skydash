// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PanelState from './PanelState';

afterEach(cleanup);

describe('PanelState', () => {
  it('renders an alert with a working retry for errors', () => {
    const onAction = vi.fn();
    render(<PanelState kind="error" title="Could not load" actionLabel="RETRY" onAction={onAction} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByText('RETRY'));
    expect(onAction).toHaveBeenCalled();
  });
  it('marks loading as busy', () => {
    render(<PanelState kind="loading" title="Loading" />);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
  });
});
