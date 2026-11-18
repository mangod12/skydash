// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CSVColumnMapping from './CSVColumnMapping';
const csv = 'clock,lat,lon,height,speed,battery,extra\n1000,28.6,77.2,100,36,95,other\n3000,28.61,77.21,,18,,ignored\n';
const onOpen = vi.fn(), onPause = vi.fn();
const select = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const load = text => fireEvent.change(screen.getByLabelText('Choose CSV for mapping'), { target: { files: [{ name: 'export.csv', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer }] } });
const map = async () => {
  load(csv); await screen.findByLabelText('Map time_s'); for (const [field, index] of [['time_s', 0], ['latitude', 1], ['longitude', 2], ['altitude_m', 3], ['ground_speed_m_s', 4], ['battery_pct', 5]]) select(`Map ${field}`, String(index)); select('Input time unit', 'ms'); select('Input time origin', 'subtract-first'); select('Input altitude unit', 'ft'); select('Input ground speed unit', 'km/h'); fireEvent.click(screen.getByLabelText('Confirm WGS84 decimal-degree source coordinates')); fireEvent.click(screen.getByText('Preview mapped conversion')); await screen.findByLabelText('Mapped conversion preview');
};
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn(() => 'blob:conversion'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('explicit CSV conversion workflow', () => {
  it('does not infer mappings or replace current source on file read', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); load(csv); await screen.findByLabelText('Map time_s'); expect(screen.getByLabelText('Map time_s').value).toBe(''); expect(screen.getByLabelText('Map battery_pct').value).toBe(''); fireEvent.click(screen.getByText('Preview mapped conversion')); await screen.findByRole('alert'); expect(onOpen).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Mapped conversion preview')).toBeNull();
  });
  it('converts explicitly, previews before confirmation and can cancel source replacement', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); await map(); expect(screen.getByLabelText('Mapped conversion preview').textContent).toContain('30.48'); expect(onOpen).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Review before opening mapped CSV')); fireEvent.click(screen.getByText('Keep current replay')); expect(onOpen).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Review before opening mapped CSV')); fireEvent.click(screen.getByText('Confirm open mapped CSV')); expect(onOpen).toHaveBeenCalledOnce(); expect(onOpen.mock.calls[0][0].samples[1].time_s).toBe(2); expect(onPause).toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('invalidates preview/download/open controls after any mapping change', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); await map(); select('Input time unit', 's'); expect(screen.queryByLabelText('Mapped conversion preview')).toBeNull(); expect(screen.queryByText('Download mapped CSV')).toBeNull(); expect(screen.queryByText('Confirm open mapped CSV')).toBeNull();
  });
  it('downloads validated target CSV and original-to-converted conversion record', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); await map(); fireEvent.click(screen.getByText('Download mapped CSV')); const target = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(target).toContain('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct'); expect(target).toContain('0,28.6,77.2,30.48,10,95'); expect(target).not.toContain('ignored'); fireEvent.click(screen.getByText('Download conversion record')); const record = await blobText(URL.createObjectURL.mock.calls[1][0]); expect(record).toContain('Original exact UTF-8 SHA-256'); expect(record).toContain('Converted exact UTF-8 SHA-256'); expect(record).toContain('source column 4 (height)'); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('rejects malformed/oversized files while retaining a previous valid preview', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); await map(); load('bad'); await screen.findByRole('alert'); expect(screen.getByLabelText('Mapped conversion preview')).toBeTruthy(); const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Choose CSV for mapping'), { target: { files: [{ size: 1048577, arrayBuffer }] } }); await screen.findByText(/at most 1MiB/); expect(arrayBuffer).not.toHaveBeenCalled(); expect(onOpen).not.toHaveBeenCalled();
  });
  it('replaces previous conversion only after valid new file structure, clearing stale map fields', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); await map(); load('t,y,x\n0,0,0\n1,1,1\n'); await screen.findByText(/3 columns/); expect(screen.queryByLabelText('Mapped conversion preview')).toBeNull(); expect(screen.getByLabelText('Map time_s').value).toBe('');
  });
  it('does not treat imported header text as HTML', async () => {
    render(<CSVColumnMapping onOpen={onOpen} onPause={onPause} />); load('t,y,<img src=x onerror=alert(1)>\n0,0,0\n1,1,1\n'); await screen.findByLabelText('Map time_s'); expect(within(screen.getByLabelText('Map time_s')).getByText('3. <img src=x onerror=alert(1)>')).toBeTruthy(); expect(document.querySelector('img')).toBeNull();
  });
});
