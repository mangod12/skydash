// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ErrorBoundary, { PanelBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('kaboom');
  return <div>all good</div>;
}

beforeEach(() => {
  shouldThrow = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    shouldThrow = false;
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeTruthy();
  });

  it('shows the error message when a child throws', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('kaboom')).toBeTruthy();
  });
});

describe('PanelBoundary', () => {
  it('shows a named inline error and recovers on retry', () => {
    render(<PanelBoundary name="Analytics"><Bomb /></PanelBoundary>);
    expect(screen.getByText('ANALYTICS ERROR')).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('all good')).toBeTruthy();
  });
});
