// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const toast = vi.fn();
vi.mock('../common/Toast', () => ({ toast: (...a) => toast(...a) }));

import MissionBriefingTab from './MissionBriefingTab';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';

const mission = { id: 'm1', name: 'Night Watch', description: 'd', entityIds: [], status: 'active' };

beforeEach(() => {
  toast.mockClear();
  useIntelStore.setState({ entities: [] });
  useTelemetryStore.setState({ data: null, fleet: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('MissionBriefingTab', () => {
  it('renders the briefing text for the mission', () => {
    const { container } = render(<MissionBriefingTab mission={mission} />);
    expect(container.querySelector('pre').textContent).toContain('Night Watch');
  });

  it('copies the briefing and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = render(<MissionBriefingTab mission={mission} />);
    fireEvent.click(screen.getByText('COPY'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Briefing copied to clipboard', 'success'));
    expect(writeText).toHaveBeenCalledWith(container.querySelector('pre').textContent);
  });

  it('warns instead of failing silently when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    render(<MissionBriefingTab mission={mission} />);
    fireEvent.click(screen.getByText('COPY'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Could not copy. Use DOWNLOAD instead.', 'warning'));
  });

  it('downloads a slugged text file', () => {
    const created = vi.fn(() => 'blob:x');
    const revoked = vi.fn();
    URL.createObjectURL = created;
    URL.revokeObjectURL = revoked;
    let name;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { name = this.download; });
    render(<MissionBriefingTab mission={mission} />);
    fireEvent.click(screen.getByText('DOWNLOAD'));
    expect(name).toMatch(/^briefing-night-watch-\d+\.txt$/);
    expect(revoked).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });
});
