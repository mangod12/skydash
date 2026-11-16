// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import StatusBadge from './StatusBadge';

afterEach(cleanup);

describe('StatusBadge', () => {
  it('shows the label with the status color', () => {
    const { container } = render(<StatusBadge status="connected" label="Online" />);
    expect(screen.getByText('Online').className).toContain('text-emerald-400');
    expect(container.querySelector('.bg-emerald-500')).not.toBeNull();
  });

  it('falls back to idle for an unknown status and pulses on request', () => {
    const { container } = render(<StatusBadge status="bogus" label="?" pulse />);
    expect(screen.getByText('?').className).toContain('text-zinc-400');
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });
});
