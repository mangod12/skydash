// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InstructorMarkerEvidence from './InstructorMarkerEvidence';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
const log={model_version:LOG_VERSION,sha256:'a'.repeat(64),samples:parseFlightCSV(SAMPLE_LOG)};
const marker={id:'saved',time_s:8,kind:'Question',text:'<b>Private annotation</b>',discussed:false};
afterEach(cleanup);
describe('instructor marker original context',()=>{
 it('shows previous held next original rows in a gap without interpolation, focuses heading and only seeks on explicit row jump',()=>{
  const onSeek=vi.fn(),onPause=vi.fn(),onClose=vi.fn();render(<InstructorMarkerEvidence {...{log,marker,onSeek,onPause,onClose}} disabled={false} />);
  const panel=within(screen.getByLabelText('Instructor marker source context')),rows=within(panel.getByLabelText('Marker context original rows')).getAllByRole('listitem');expect(rows).toHaveLength(3);expect(rows[0].textContent).toContain('CSV data row 2 / original 2s / previous');expect(rows[1].textContent).toContain('CSV data row 3 / original 4s / held');expect(rows[2].textContent).toContain('CSV data row 4 / original 12s / next');expect(panel.getByText(/DATA GAP over 5s/)).toBeTruthy();expect(panel.getByText('<b>Private annotation</b>')).toBeTruthy();expect(document.querySelector('b')).toBeNull();expect(document.activeElement).toBe(panel.getByRole('heading'));expect(onSeek).not.toHaveBeenCalled();
  fireEvent.click(panel.getByText('Jump to context row 4 at 12s'));expect(onPause).toHaveBeenCalledOnce();expect(onSeek).toHaveBeenCalledExactlyOnceWith(12);fireEvent.click(panel.getByText('Close marker source context'));expect(onClose).toHaveBeenCalledOnce();expect(onSeek).toHaveBeenCalledTimes(1);
 });
 it('keeps endpoint context within source, preserves unknowns and blocks jumps during other instructor work',()=>{
  const onSeek=vi.fn(),onPause=vi.fn(),onClose=vi.fn();const single={...log,samples:[{...log.samples[0],altitude_m:null,ground_speed_m_s:null,battery_pct:null}]};render(<InstructorMarkerEvidence log={single} marker={{...marker,time_s:0}} disabled={true} {...{onSeek,onPause,onClose}} />);expect(screen.getAllByRole('listitem')).toHaveLength(1);expect(screen.getByText(/exact recorded timestamp/)).toBeTruthy();expect(screen.getByText('Altitude unknown m / ground speed unknown m/s / battery unknown %.')).toBeTruthy();const jump=screen.getByText('Jump to context row 1 at 0s');expect(jump.disabled).toBe(true);fireEvent.click(jump);expect(onSeek).not.toHaveBeenCalled();
 });
 it('does not label a short held interval as an exact observation or manufacture an outside neighbor',()=>{
  const props={log,marker:{...marker,time_s:1},onSeek:vi.fn(),onPause:vi.fn(),onClose:vi.fn(),disabled:false};const view=render(<InstructorMarkerEvidence {...props} />);expect(screen.getByText(/between observations/).textContent).toContain('1s before');expect(screen.queryByText(/DATA GAP over 5s/)).toBeNull();expect(screen.getAllByRole('listitem')).toHaveLength(2);view.rerender(<InstructorMarkerEvidence {...props} marker={{...marker,id:'end',time_s:16}} />);expect(screen.getAllByRole('listitem')).toHaveLength(2);expect(screen.getByText(/CSV data row 6/).textContent).toContain('exact marker row');expect(document.activeElement).toBe(screen.getByRole('heading'));
 });
});
