// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import QuickActionButton from './QuickActionButton';

afterEach(cleanup);

const Icon = (props) => <svg data-testid="icon" className={props.className} />;
const action = { id: 'scan', label: 'Run scan', color: 'text-cyan-400' };
const ui = (o = {}) => {
  const p = { action, Icon, x: 0, y: -60, index: 0, hovered: false, onHover: vi.fn(), onClick: vi.fn(), ...o };
  render(<QuickActionButton {...p} />);
  return p;
};

describe('QuickActionButton', () => {
  it('is labelled by the action and reports clicks with its id', () => {
    const p = ui();
    fireEvent.click(screen.getByRole('button', { name: 'Run scan' }));
    expect(p.onClick).toHaveBeenCalledWith('scan');
    expect(screen.getByTestId('icon').getAttribute('class')).toContain('text-cyan-400');
  });

  it('reports hover enter and leave', () => {
    const p = ui();
    const b = screen.getByRole('button', { name: 'Run scan' });
    fireEvent.mouseEnter(b);
    expect(p.onHover).toHaveBeenCalledWith('scan');
    fireEvent.mouseLeave(b);
    expect(p.onHover).toHaveBeenLastCalledWith(null);
  });

  it('shows the uppercase tooltip only when hovered', () => {
    cleanup();
    ui({ hovered: true });
    expect(screen.getByText('RUN SCAN')).toBeTruthy();
    cleanup();
    ui({ hovered: false });
    expect(screen.queryByText('RUN SCAN')).toBeNull();
  });
});
