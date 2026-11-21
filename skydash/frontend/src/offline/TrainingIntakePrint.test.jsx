// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingIntakePrint from './TrainingIntakePrint';
import { browserTrainingIntake } from '../utils/browserTrainingIntake';
vi.mock('../utils/browserTrainingIntake', () => ({ browserTrainingIntake: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const check = () => screen.getByRole('button', { name: 'Check originals for intake print' }), download = () => screen.getByRole('button', { name: 'Download privacy-reduced intake HTML' });
const select = () => { fireEvent.change(screen.getByLabelText('Intake print original manifest'), { target: { files: [new File(['{}'], 'PRIVATE.json')] } }); fireEvent.change(screen.getByLabelText('Intake print original files'), { target: { files: [new File(['{}'], 'case.json')] } }); };
it('requires originals, prepares without inserting HTML, auto opening or download and explicitly downloads fixed generic filename', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}), create = vi.fn(() => 'blob:local'); vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  browserTrainingIntake.mockResolvedValue({ html: '<PRIVATE>', digest: 'a'.repeat(64) }); render(<TrainingIntakePrint />); expect(check().disabled).toBe(true); select(); expect(check().disabled).toBe(false); fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); expect(click).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(screen.queryByText('<PRIVATE>')).toBeNull(); fireEvent.click(download()); expect(click).toHaveBeenCalledTimes(1); expect(click.mock.instances[0].download).toBe('skydash-training-intake.html');
});
it('all input edits stale old success even when reverted, clear resets only intake selection', async () => {
  browserTrainingIntake.mockResolvedValue({ html: 'PRIVATE', digest: 'a'.repeat(64) }); render(<TrainingIntakePrint />); select(); fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false));
  const pin = screen.getByLabelText('Intake print expected manifest SHA-256'); fireEvent.change(pin, { target: { value: 'a'.repeat(64) } }); expect(download().disabled).toBe(true); fireEvent.change(pin, { target: { value: '' } }); expect(download().disabled).toBe(true); fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); select(); expect(download().disabled).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Clear intake print selections' })); expect(check().disabled).toBe(true); expect(screen.getByRole('status').textContent).toContain('Active replay workspace unchanged');
});
it('locks mutable inputs while checking and never echoes private errors or issues partial success', async () => {
  let reject; browserTrainingIntake.mockImplementation(() => new Promise((_yes, no) => { reject = no; })); render(<TrainingIntakePrint />); select(); fireEvent.click(check());
  for (const name of ['Intake print original manifest', 'Intake print original files', 'Intake print expected manifest SHA-256']) expect(screen.getByLabelText(name).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Clear intake print selections' }).disabled).toBe(true); reject(Error('PRIVATE path'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Intake report refused')); expect(screen.queryByText('PRIVATE path')).toBeNull(); expect(download().disabled).toBe(true);
});
