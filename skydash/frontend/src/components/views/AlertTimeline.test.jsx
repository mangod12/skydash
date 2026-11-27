// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AlertTimeline from './AlertTimeline';

afterEach(cleanup);

const evt = (id, severity, minsAgo, extra = {}) => ({
  id, severity, description: `event ${id}`, time: new Date(Date.now() - minsAgo * 60000), ...extra,
});

describe('AlertTimeline', () => {
  it('renders nothing without events', () => {
    const { container } = render(<AlertTimeline events={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('orders newest first and reports the count', () => {
    render(<AlertTimeline events={[evt(1, 'info', 30), evt(2, 'info', 5), evt(3, 'info', 60)]} />);
    const texts = screen.getAllByText(/^event \d$/).map((n) => n.textContent);
    expect(texts).toEqual(['event 2', 'event 1', 'event 3']);
    expect(screen.getByText('3 EVENTS')).toBeTruthy();
  });

  it('caps the list at 20 events', () => {
    const many = Array.from({ length: 25 }, (_, i) => evt(i, 'info', i + 1));
    render(<AlertTimeline events={many} />);
    expect(screen.getByText('20 EVENTS')).toBeTruthy();
    expect(screen.queryByText('event 24')).toBeNull();
  });

  it('labels severity with a fallback to info', () => {
    render(<AlertTimeline events={[evt(1, 'critical', 1), evt(2, 'warning', 2), evt(3, 'odd', 3)]} />);
    expect(screen.getByLabelText('Severity: critical')).toBeTruthy();
    expect(screen.getByLabelText('Severity: warning')).toBeTruthy();
    expect(screen.getByLabelText('Severity: info')).toBeTruthy();
  });

  it('shows the entity id when present and a keyboard-reachable region', () => {
    render(<AlertTimeline events={[evt(1, 'info', 1, { entityId: 'ENT-7' })]} />);
    expect(screen.getByText('ENT-7')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Alert timeline, scrollable' }).getAttribute('tabindex')).toBe('0');
  });
});
