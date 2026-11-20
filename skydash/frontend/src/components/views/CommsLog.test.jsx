// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CommsLog from './CommsLog';
vi.mock('../common/GlassCard', () => ({ default: ({ children }) => <div>{children}</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('states missing communications evidence without invented reports, clearances or chronology', () => {
  render(<CommsLog />);
  const panel=screen.getByRole('region', { name: 'Communications log unavailable' });
  expect(panel.textContent).toContain('No communications source or received messages');
  expect(panel.textContent).toContain('does not mean radio silence');
  expect(panel.textContent).toContain('not a recorded-flight debrief');
  expect(panel.textContent).toContain('not a recorded-flight debrief or an aircraft command channel');
  for(const invented of ['CONTROL copies','new contact bearing','RTB clearance','elevated threat posture','COMMS LOG']) expect(panel.textContent).not.toContain(invented);
});
it('never generates or appends random time-stamped communication reports after mounting', () => {
  vi.useFakeTimers(); const random=vi.spyOn(Math,'random');
  render(<CommsLog />); const panel=screen.getByRole('region',{name:'Communications log unavailable'}), before=panel.textContent;
  const calls=random.mock.calls.length; vi.advanceTimersByTime(120000);
  expect(panel.textContent).toBe(before); expect(random.mock.calls.length).toBe(calls); expect(vi.getTimerCount()).toBe(0); expect(panel.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
});
