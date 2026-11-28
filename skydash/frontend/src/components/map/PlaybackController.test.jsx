// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  motion: { div: ({ children, className, style }) => <div className={className} style={style}>{children}</div> },
}));

import PlaybackController from './PlaybackController';
import { usePlaybackStore } from '../../stores/playbackStore';

const A = { play: vi.fn(), pause: vi.fn(), stop: vi.fn(), setSpeed: vi.fn(), seek: vi.fn() };
const set = (s = {}) => usePlaybackStore.setState({
  active: true, isPlaying: false, speed: 1, startTime: 1_000_000, endTime: 1_100_000, currentTime: 1_025_000, ...A, ...s,
});

beforeEach(() => { Object.values(A).forEach((f) => f.mockClear()); set(); });
afterEach(cleanup);

describe('PlaybackController', () => {
  it('renders nothing while inactive', () => {
    set({ active: false });
    render(<PlaybackController />);
    expect(screen.queryByText('PLAYBACK')).toBeNull();
  });

  it('shows elapsed over total duration', () => {
    render(<PlaybackController />);
    expect(screen.getByText('00:25 / 01:40')).toBeTruthy();
    expect(Number(screen.getByLabelText('Playback timeline').value)).toBe(25);
  });

  it('uses placeholders and zero progress when there is no range', () => {
    set({ startTime: 0, endTime: 0, currentTime: 0 });
    render(<PlaybackController />);
    expect(screen.getAllByText(/--:--:--/).length).toBeGreaterThan(0);
    expect(screen.getByText('00:00 / 00:00')).toBeTruthy();
    expect(Number(screen.getByLabelText('Playback timeline').value)).toBe(0);
  });

  it('play and pause toggle by state', () => {
    const { rerender } = render(<PlaybackController />);
    fireEvent.click(screen.getByLabelText('Play'));
    expect(A.play).toHaveBeenCalled();
    set({ isPlaying: true });
    rerender(<PlaybackController />);
    expect(screen.getByLabelText('Pause').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByLabelText('Pause'));
    expect(A.pause).toHaveBeenCalled();
  });

  it('skips 10 seconds either way and stops', () => {
    render(<PlaybackController />);
    fireEvent.click(screen.getByLabelText('Back 10s'));
    expect(A.seek).toHaveBeenLastCalledWith(1_015_000);
    fireEvent.click(screen.getByLabelText('Forward 10s'));
    expect(A.seek).toHaveBeenLastCalledWith(1_035_000);
    fireEvent.click(screen.getByLabelText('Stop'));
    expect(A.stop).toHaveBeenCalled();
  });

  it('scrubbing maps the percentage onto the time range', () => {
    render(<PlaybackController />);
    fireEvent.change(screen.getByLabelText('Playback timeline'), { target: { value: '50' } });
    expect(A.seek).toHaveBeenCalledWith(1_050_000);
  });

  it('cycles speed 1, 2, 4, 8 and wraps', () => {
    const { rerender } = render(<PlaybackController />);
    const next = [[1, 2], [2, 4], [4, 8], [8, 1]];
    next.forEach(([from, to]) => {
      set({ speed: from });
      rerender(<PlaybackController />);
      fireEvent.click(screen.getByLabelText('Change playback speed'));
      expect(A.setSpeed).toHaveBeenLastCalledWith(to);
    });
  });
});
