// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingComparisonPrint from './TrainingComparisonPrint';
import { browserTrainingComparison } from '../utils/browserTrainingComparison';
vi.mock('../utils/browserTrainingComparison', () => ({ browserTrainingComparison: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const check = () => screen.getByRole('button', { name: 'Check both packages for comparison' }), download = () => screen.getByRole('button', { name: 'Download package comparison HTML' });
const select = side => { fireEvent.change(screen.getByLabelText(side+' comparison original manifest'), { target: { files: [new File(['{}'], 'PRIVATE.json')] } }); fireEvent.change(screen.getByLabelText(side+' comparison original files'), { target: { files: [new File(['{}'], 'case.json')] } }); };
it('requires both sides and explicitly downloads fixed generic filename without automatic HTML insertion/open/download', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}), create = vi.fn(() => 'blob:local'); vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: vi.fn() })); browserTrainingComparison.mockResolvedValue({ html: '<PRIVATE>', leftDigest: 'a'.repeat(64), rightDigest: 'b'.repeat(64) });
  render(<TrainingComparisonPrint />); select('Left'); expect(check().disabled).toBe(true); select('Right'); expect(check().disabled).toBe(false); fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); expect(click).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(screen.queryByText('<PRIVATE>')).toBeNull(); fireEvent.click(download()); expect(click).toHaveBeenCalledTimes(1); expect(click.mock.instances[0].download).toBe('skydash-package-comparison.html');
});
it('edits on either side stale results even when reverted and clear resets only comparison print selections', async () => {
  browserTrainingComparison.mockResolvedValue({ html: 'PRIVATE', leftDigest: 'a'.repeat(64), rightDigest: 'b'.repeat(64) }); render(<TrainingComparisonPrint />); select('Left'); select('Right');
  for (const side of ['Left','Right']) { fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); const pin = screen.getByLabelText(side+' comparison expected manifest SHA-256'); fireEvent.change(pin, { target: { value: 'a'.repeat(64) } }); expect(download().disabled).toBe(true); fireEvent.change(pin, { target: { value: '' } }); expect(download().disabled).toBe(true); }
  fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); select('Right'); expect(download().disabled).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Clear comparison print selections' })); expect(check().disabled).toBe(true); expect(screen.getByRole('status').textContent).toContain('Active replay workspace unchanged');
});
it('locks both fieldsets during check and handles late failures without private diagnostics or partial output', async () => {
  let reject; browserTrainingComparison.mockImplementation(() => new Promise((_yes,no) => { reject=no; })); render(<TrainingComparisonPrint />); select('Left'); select('Right'); fireEvent.click(check()); for (const side of ['Left','Right']) expect(screen.getByLabelText(side+' comparison original files').closest('fieldset').disabled).toBe(true); expect(screen.getByRole('button', { name: 'Clear comparison print selections' }).disabled).toBe(true); reject(Error('PRIVATE path')); await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Package comparison refused')); expect(download().disabled).toBe(true); expect(screen.queryByText('PRIVATE path')).toBeNull();
});
