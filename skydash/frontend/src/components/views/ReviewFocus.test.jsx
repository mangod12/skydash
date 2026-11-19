// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import ReviewFocus from './ReviewFocus';
afterEach(cleanup);
describe('review focus navigation', () => {
  it('exposes honest scope and controlled selection without changing focus itself', () => {
    const onChange = vi.fn(); render(<ReviewFocus focus="all" onChange={onChange} onNavigate={vi.fn()} />);
    expect(screen.getByText(/Presentation only, not a completed-review checklist/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Visible review panel group'), { target: { value: 'debrief' } });
    expect(onChange).toHaveBeenCalledWith('debrief');
    expect(screen.getByLabelText('Visible review panel group').value).toBe('all');
  });
  it('routes exact group/section and offers explicit restoration', () => {
    const onNavigate = vi.fn(), onChange = vi.fn(); render(<ReviewFocus focus="debrief" onChange={onChange} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Selected window and notebook')); expect(onNavigate).toHaveBeenCalledWith('selected-sample-window', 'interval');
    fireEvent.click(screen.getByText('Compare two flights')); expect(onNavigate).toHaveBeenCalledWith('flight-comparison', null);
    fireEvent.click(screen.getByText('Show all review panels')); expect(onChange).toHaveBeenCalledWith('all');
  });
  it('disables all focus and jump controls during a workspace operation', () => {
    render(<ReviewFocus focus="source" disabled onChange={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByLabelText('Visible review panel group').disabled).toBe(true);
    for (const button of screen.getAllByRole('button')) expect(button.disabled).toBe(true);
  });
});
