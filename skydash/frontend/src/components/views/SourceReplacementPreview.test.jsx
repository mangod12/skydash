// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SourceReplacementPreview from './SourceReplacementPreview';
const current = { filename: 'old.csv', sha256: 'a'.repeat(64) };
const candidate = { filename: '<img src=x onerror=alert(1)>.csv', sha256: 'b'.repeat(64), model_version: 'skydash-flight-csv-v1', samples: [{ time_s: 0 }, { time_s: 12 }] };
afterEach(cleanup);
describe('recorded source replacement disclosure', () => {
  it('renders filenames as plain text, not markup, without copying private source readings or notes into the preview', () => {
    render(<SourceReplacementPreview current={current} candidate={{ ...candidate, notes: 'PRIVATE CANDIDATE NOTE', csv_text: 'PRIVATE CSV BYTES' }} />);
    const region = screen.getByLabelText('Recorded source replacement preview');
    expect(region.textContent).toContain(candidate.filename);
    expect(region.querySelector('img')).toBeNull();
    expect(region.textContent).not.toContain('PRIVATE CANDIDATE NOTE');
    expect(region.textContent).not.toContain('PRIVATE CSV BYTES');
    expect(region.textContent).toContain('2 original samples, original 0s through 12s');
    expect(region.textContent).toContain('not continuous observed duration');
  });
  it('blocks both decisions while checking and calls only the explicit decision when enabled', () => {
    const onConfirm = vi.fn(), onCancel = vi.fn();
    const view = render(<SourceReplacementPreview current={current} candidate={candidate} disabled onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Replace recorded workspace with checked source'));
    fireEvent.click(screen.getByText('Keep current recorded workspace'));
    expect(onConfirm).not.toHaveBeenCalled(); expect(onCancel).not.toHaveBeenCalled();
    view.rerender(<SourceReplacementPreview current={current} candidate={candidate} disabled={false} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Keep current recorded workspace'));
    expect(onCancel).toHaveBeenCalledOnce(); expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Replace recorded workspace with checked source'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it('does not show a replacement decision for the first source or without a proposal', () => {
    const view = render(<SourceReplacementPreview current={null} candidate={candidate} />);
    expect(screen.queryByLabelText('Recorded source replacement preview')).toBeNull();
    view.rerender(<SourceReplacementPreview current={current} candidate={null} />);
    expect(screen.queryByLabelText('Recorded source replacement preview')).toBeNull();
  });
});
