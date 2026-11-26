// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GraphToolbar from './GraphToolbar';

afterEach(cleanup);

const props = (o = {}) => ({
  layout: 'force', onLayoutChange: vi.fn(), onZoomFit: vi.fn(), onExpandAll: vi.fn(),
  expanded: false, communities: false, onToggleCommunities: vi.fn(), focusedId: null, onClearFocus: vi.fn(), focusName: '', ...o,
});

describe('GraphToolbar', () => {
  it('marks only the current layout as pressed and switches layouts', () => {
    const p = props({ layout: 'radial' });
    render(<GraphToolbar {...p} />);
    expect(screen.getByTitle('RADIAL').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle('FORCE').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByTitle('GRID'));
    expect(p.onLayoutChange).toHaveBeenCalledWith('grid');
  });

  it('wires fit, expand and community buttons', () => {
    const p = props();
    render(<GraphToolbar {...p} />);
    fireEvent.click(screen.getByText('FIT'));
    fireEvent.click(screen.getByText('EXPAND'));
    fireEvent.click(screen.getByText('COMM'));
    expect(p.onZoomFit).toHaveBeenCalled();
    expect(p.onExpandAll).toHaveBeenCalled();
    expect(p.onToggleCommunities).toHaveBeenCalled();
  });

  it('exposes toggle state for expand and communities', () => {
    render(<GraphToolbar {...props({ expanded: true, communities: true })} />);
    expect(screen.getByText('COLLAPSE').closest('button').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle('Collapse')).toBeTruthy();
    expect(screen.getByText('COMM').closest('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the focus chip only when focused and clears on click', () => {
    const { rerender } = render(<GraphToolbar {...props()} />);
    expect(screen.queryByText(/FOCUSED/)).toBeNull();
    const p = props({ focusedId: 'e1', focusName: 'Alpha' });
    rerender(<GraphToolbar {...p} />);
    fireEvent.click(screen.getByText(/FOCUSED: Alpha/));
    expect(p.onClearFocus).toHaveBeenCalled();
  });
});
