// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SourceReliability from './SourceReliability';

afterEach(cleanup);

describe('SourceReliability', () => {
  it('maps scores to tier labels at the boundaries', () => {
    const cases = [[100, 'VERIFIED'], [80, 'VERIFIED'], [79, 'RELIABLE'], [60, 'RELIABLE'], [59, 'MODERATE'], [40, 'MODERATE'], [39, 'UNCERTAIN'], [20, 'UNCERTAIN'], [19, 'UNVERIFIED'], [0, 'UNVERIFIED']];
    for (const [score, label] of cases) {
      const { unmount } = render(<SourceReliability score={score} />);
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it('clamps and rounds the score and sets bar width', () => {
    const { container, unmount } = render(<SourceReliability score={140} />);
    expect(screen.getByText('100')).toBeTruthy();
    expect(container.querySelector('.h-full').style.width).toBe('100%');
    unmount();
    const r = render(<SourceReliability score={-5} />);
    expect(screen.getByText('0')).toBeTruthy();
    r.unmount();
    render(<SourceReliability score={64.6} />);
    expect(screen.getByText('65')).toBeTruthy();
  });

  it('shows the optional label', () => {
    render(<SourceReliability score={50} label="SOURCE" />);
    expect(screen.getByText('SOURCE')).toBeTruthy();
  });
});
