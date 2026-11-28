// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DetectionDebriefTab from './DetectionDebriefTab';
import { useMissionStore } from '../../stores/missionStore';

const run = (over = {}) => ({
  id: 'd1', source_name: 'frame1.jpg', model: 'rtdetr-l.pt', created_at: '2026-11-20T10:00:00Z',
  summary: { total: 3, labels: { car: 2, person: 1 } },
  detections: [{ label: 'car', confidence: 0.912 }],
  ...over,
});

let actions;
beforeEach(() => {
  actions = {
    fetchVisionStatus: vi.fn(), analyzeMissionImage: vi.fn(), monitorSampleVideo: vi.fn(),
    deleteDetection: vi.fn(), addNote: vi.fn(),
  };
  useMissionStore.setState({ visionStatus: { available: true, model: 'rtdetr-l.pt' }, ...actions });
});
afterEach(cleanup);

describe('DetectionDebriefTab', () => {
  it('shows empty state and fetches vision status', () => {
    render(<DetectionDebriefTab mission={{ id: 'm1' }} />);
    expect(actions.fetchVisionStatus).toHaveBeenCalled();
    expect(screen.getByText('NO FRAME ANALYSIS YET')).toBeTruthy();
    expect(screen.getByText('0 ANALYSIS RUNS')).toBeTruthy();
  });

  it('renders a run with counts, labels and rounded confidence', () => {
    render(<DetectionDebriefTab mission={{ id: 'm1', detections: [run()] }} />);
    expect(screen.getByText('frame1.jpg')).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.getAllByText('2 car / 1 person').length).toBeGreaterThan(0);
  });

  it('does not crash on an invalid timestamp', () => {
    render(<DetectionDebriefTab mission={{ id: 'm1', detections: [run({ created_at: 'not-a-date' })] }} />);
    expect(screen.getByText(/rtdetr-l\.pt \| recent/)).toBeTruthy();
  });

  it('delete button is labelled and calls deleteDetection', () => {
    render(<DetectionDebriefTab mission={{ id: 'm1', detections: [run()] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete analysis frame1.jpg' }));
    expect(actions.deleteDetection).toHaveBeenCalledWith('m1', 'd1');
  });

  it('NOTE adds a summary note', async () => {
    render(<DetectionDebriefTab mission={{ id: 'm1', detections: [run()] }} />);
    fireEvent.click(screen.getByText('NOTE'));
    expect(actions.addNote).toHaveBeenCalledWith('m1', expect.stringContaining('3 object(s) detected - 2 car, 1 person'));
  });

  it('disables analyze and monitor when vision is unavailable', () => {
    useMissionStore.setState({ visionStatus: { available: false, error: 'no torch' } });
    render(<DetectionDebriefTab mission={{ id: 'm1' }} />);
    expect(screen.getByText('no torch')).toBeTruthy();
    expect(screen.getByText('ANALYZE').closest('button').disabled).toBe(true);
    expect(screen.getByText('MONITOR SAMPLE').closest('button').disabled).toBe(true);
    expect(screen.getByText('OPTIONAL')).toBeTruthy();
  });
});
