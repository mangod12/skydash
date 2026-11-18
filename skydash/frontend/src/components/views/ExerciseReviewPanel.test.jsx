// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExerciseReviewPanel from './ExerciseReviewPanel';
import { useScenarioStore } from '../../stores/scenarioStore';
import { EXERCISE_ARCHIVE_KEY, captureExerciseReview, writeExerciseArchive } from '../../utils/exerciseReview';
const prepare = () => { useScenarioStore.getState().start(); useScenarioStore.getState().tick(60); useScenarioStore.getState().pause(); };
const saveForm = (title = 'Baseline review') => { fireEvent.change(screen.getByLabelText('Review title'), { target: { value: title } }); fireEvent.change(screen.getByLabelText('Lessons and follow-up (self-reported)'), { target: { value: 'Test the link resilience next.' } }); fireEvent.click(screen.getByText('Save exercise review')); };
beforeEach(() => { localStorage.clear(); useScenarioStore.getState().resetLab(); URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('exercise review workflow', () => {
  it('requires pause/progress/title then persists immutable notes and can reopen after reload', () => {
    const view = render(<ExerciseReviewPanel />);
    expect(screen.getByText('Save exercise review').disabled).toBe(true);
    view.unmount(); prepare(); render(<ExerciseReviewPanel />); saveForm();
    expect(screen.getByRole('status').textContent).toContain('Review saved in this browser');
    expect(JSON.parse(localStorage.getItem(EXERCISE_ARCHIVE_KEY))[0].notes).toContain('link resilience');
    cleanup(); useScenarioStore.getState().resetLab(); render(<ExerciseReviewPanel />);
    fireEvent.change(screen.getByLabelText('Saved review'), { target: { value: JSON.parse(localStorage.getItem(EXERCISE_ARCHIVE_KEY))[0].id } });
    expect(screen.getByText('Test the link resilience next.')).toBeTruthy();
    expect(screen.getByText('Export review').disabled).toBe(false);
  });
  it('keeps the draft and does not claim persistence on quota failure', () => {
    prepare(); render(<ExerciseReviewPanel />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage quota exceeded'); });
    saveForm();
    expect(screen.getByRole('status').textContent).toContain('quota');
    expect(screen.getByLabelText('Review title').value).toBe('Baseline review');
    expect(screen.getByText('0/20 saved')).toBeTruthy();
  });
  it('does not overwrite unreadable storage and requires explicit clear', () => {
    localStorage.setItem(EXERCISE_ARCHIVE_KEY, '{bad'); prepare(); render(<ExerciseReviewPanel />);
    expect(screen.getByRole('alert').textContent).toContain('not been overwritten');
    expect(screen.getByText('Save exercise review').disabled).toBe(true);
    fireEvent.click(screen.getByText('Clear local exercise archive'));
    expect(localStorage.getItem(EXERCISE_ARCHIVE_KEY)).toBe('{bad');
    fireEvent.click(screen.getByText('Confirm clear archive'));
    expect(localStorage.getItem(EXERCISE_ARCHIVE_KEY)).toBe('[]');
  });
  it('requires confirmation before replacing the simulation and never resumes a loaded review', () => {
    prepare(); const review = captureExerciseReview(useScenarioStore.getState(), { id: 'baseline', title: 'Before load' });
    writeExerciseArchive(localStorage, [review]);
    useScenarioStore.getState().start(); useScenarioStore.getState().tick(90);
    render(<ExerciseReviewPanel />);
    fireEvent.change(screen.getByLabelText('Saved review'), { target: { value: review.id } });
    fireEvent.click(screen.getByText('Load saved exercise'));
    expect(useScenarioStore.getState().elapsedSeconds).toBe(150);
    fireEvent.click(screen.getByText('Cancel load'));
    expect(useScenarioStore.getState().elapsedSeconds).toBe(150);
    fireEvent.click(screen.getByText('Load saved exercise'));
    fireEvent.click(screen.getByText('Replace simulation'));
    expect(useScenarioStore.getState().elapsedSeconds).toBe(60);
    expect(useScenarioStore.getState().status).toBe('paused');
  });
  it('saves two reviews, compares, exports and deletes without affecting the exercise', () => {
    prepare(); render(<ExerciseReviewPanel />); saveForm('Baseline');
    const baseline = JSON.parse(localStorage.getItem(EXERCISE_ARCHIVE_KEY))[0];
    useScenarioStore.getState().injectEvent('signal-loss');
    saveForm('With link issue');
    fireEvent.change(screen.getByLabelText('Comparison baseline'), { target: { value: baseline.id } });
    expect(screen.getByText('Compared with Baseline')).toBeTruthy();
    fireEvent.click(screen.getByText('Export review'));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Delete selected'));
    expect(JSON.parse(localStorage.getItem(EXERCISE_ARCHIVE_KEY))).toHaveLength(1);
    expect(useScenarioStore.getState().elapsedSeconds).toBe(60);
  });
  it('detects another tab saving and refreshes without losing the draft', () => {
    prepare(); render(<ExerciseReviewPanel />);
    const review = captureExerciseReview(useScenarioStore.getState(), { id: 'other', title: 'Other tab' });
    writeExerciseArchive(localStorage, [review]); saveForm('Draft');
    expect(screen.getByRole('status').textContent).toContain('Archive changed');
    fireEvent.click(screen.getByText('Refresh archive'));
    expect(screen.getByLabelText('Review title').value).toBe('Draft');
    expect(screen.getByText('1/20 saved')).toBeTruthy();
    fireEvent.click(screen.getByText('Save exercise review'));
    expect(JSON.parse(localStorage.getItem(EXERCISE_ARCHIVE_KEY))).toHaveLength(2);
  });
});
