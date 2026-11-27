// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import TimelineSlider from './TimelineSlider';

afterEach(cleanup);

describe('TimelineSlider', () => {
  it('is labelled as a preview, not connected to recorded data', () => {
    render(<TimelineSlider />);
    const tag = screen.getByText('PREVIEW');
    expect(tag.getAttribute('title')).toMatch(/not connected to recorded data/i);
  });

  it('starts at -15m with the slider at 75', () => {
    render(<TimelineSlider />);
    expect(screen.getByText('-15m')).toBeTruthy();
    expect(screen.getByLabelText('Operational timeline').value).toBe('75');
  });

  it('toggles play with aria-pressed', () => {
    render(<TimelineSlider />);
    const play = screen.getByLabelText('Play timeline');
    expect(play.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(play);
    const pause = screen.getByLabelText('Pause timeline');
    expect(pause.getAttribute('aria-pressed')).toBe('true');
  });

  it('rewind and advance move by 10 and clamp to 0..100', () => {
    render(<TimelineSlider />);
    const slider = screen.getByLabelText('Operational timeline');
    fireEvent.click(screen.getByLabelText('Rewind timeline'));
    expect(slider.value).toBe('65');
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByLabelText('Advance timeline'));
    expect(slider.value).toBe('100');
    expect(screen.getByText('-0m')).toBeTruthy();
    fireEvent.change(slider, { target: { value: '0' } });
    fireEvent.click(screen.getByLabelText('Rewind timeline'));
    expect(slider.value).toBe('0');
    expect(screen.getByText('-60m')).toBeTruthy();
  });

  it('cycles speed 1x, 2x, 5x, 10x and back', () => {
    render(<TimelineSlider />);
    for (const next of ['2x', '5x', '10x', '1x']) {
      fireEvent.click(screen.getByRole('button', { name: /change timeline speed/ }));
      expect(screen.getByRole('button', { name: new RegExp(`^${next},`) })).toBeTruthy();
    }
  });
});
