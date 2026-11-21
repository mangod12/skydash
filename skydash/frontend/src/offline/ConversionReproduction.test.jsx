// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversionReproduction from './ConversionReproduction';
import { browserConversionReproduction } from '../utils/browserConversionReproduction';
vi.mock('../utils/browserConversionReproduction', () => ({ browserConversionReproduction: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const check = () => screen.getByRole('button', { name: 'Check exact conversion reproduction' }), download = () => screen.getByRole('button', { name: 'Download conversion check receipt' }), ack = () => screen.getByLabelText('Fresh original WGS84 confirmation');
const select = role => fireEvent.change(screen.getByLabelText('Conversion '+role+' file'), { target: { files: [new File(['{}'], 'PRIVATE')] } });
const ready = () => { for (const role of ['original','recipe','converted']) select(role); fireEvent.click(ack()); };
const receipt = { converted_samples: 2, exact_original_sha256: 'a'.repeat(64), exact_recipe_sha256: 'b'.repeat(64), exact_converted_sha256: 'c'.repeat(64), expected_raw_digests_matched: { original: false, recipe: false, converted: false } };
it('requires all3 files and fresh confirmation, consumes confirmation each run, prepares without automatic download or private insertion', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}), create = vi.fn(() => 'blob:local'); vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: vi.fn() })); browserConversionReproduction.mockResolvedValue(receipt);
  render(<ConversionReproduction />); expect(check().disabled).toBe(true); ready(); expect(check().disabled).toBe(false); fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); expect(ack().checked).toBe(false); expect(check().disabled).toBe(true); expect(browserConversionReproduction.mock.calls[0][1].confirmedWGS84).toBe(true); expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled(); fireEvent.click(download()); expect(click).toHaveBeenCalledTimes(1); expect(click.mock.instances[0].download).toBe('skydash-conversion-check.json');
});
it('file/digest edits reset confirmation and stale old success even on revert, clear releases only conversion selections', async () => {
  browserConversionReproduction.mockResolvedValue(receipt); render(<ConversionReproduction />); ready(); fireEvent.click(check()); await waitFor(() => expect(download().disabled).toBe(false)); const pin = screen.getByLabelText('Conversion original expected SHA-256'); fireEvent.change(pin, { target: { value: 'a'.repeat(64) } }); expect(download().disabled).toBe(true); expect(ack().checked).toBe(false); fireEvent.change(pin, { target: { value: '' } }); expect(download().disabled).toBe(true); expect(check().disabled).toBe(true); fireEvent.click(ack()); select('recipe'); expect(ack().checked).toBe(false); fireEvent.click(screen.getByRole('button', { name: 'Clear conversion check selections' })); expect(check().disabled).toBe(true); expect(screen.getByRole('status').textContent).toContain('Active replay workspace unchanged');
});
it('locks all inputs while checking and never issues private diagnostics or partial receipt on failure', async () => {
  let reject; browserConversionReproduction.mockImplementation(() => new Promise((_yes,no) => { reject=no; })); render(<ConversionReproduction />); ready(); fireEvent.click(check()); for (const role of ['original','recipe','converted']) expect(screen.getByLabelText('Conversion '+role+' file').closest('fieldset').disabled).toBe(true); expect(ack().disabled).toBe(true); expect(screen.getByRole('button', { name: 'Clear conversion check selections' }).disabled).toBe(true); reject(Error('PRIVATE path')); await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Conversion reproduction refused')); expect(download().disabled).toBe(true); expect(screen.queryByText('PRIVATE path')).toBeNull(); expect(ack().checked).toBe(false);
});
