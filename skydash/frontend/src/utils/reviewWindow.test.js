import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, LOG_HEADER, parseFlightCSV } from './flightLog';
import { WINDOW_VERSION, reviewWindow, reviewWindowReport } from './reviewWindow';
const log = { filename:'source.csv', sha256:'a'.repeat(64), model_version:LOG_VERSION, samples:parseFlightCSV(SAMPLE_LOG) };
describe('inclusive recorded sample windows', () => {
  it('uses selected endpoint span, not absolute source end as duration', () => {
    const result = reviewWindow(log, 1, 4, 'Review interval'); expect(result.samples).toEqual(log.samples.slice(1,5)); expect(result.startS).toBe(2); expect(result.endS).toBe(14); expect(result.summary.durationS).toBe(12); expect(result.summary.count).toBe(4); expect(result.summary.gapCount).toBe(1); expect(result.summary.largestGapS).toBe(8);
  });
  it('excludes boundary-crossing gaps, distance and rows from selected statistics', () => {
    const result = reviewWindow(log, 3, 5, 'After gap'); expect(result.summary.gapCount).toBe(0); expect(result.summary.largestGapS).toBe(2); expect(result.summary.minBatteryPct).toBe(90); expect(result.summary.maxAltitudeM).toBe(35); expect(result.summary.altitudeCount).toBe(2);
  });
  it('allows a single row without inventing intervals/distance or missing optional values', () => {
    const result = reviewWindow(log, 3, 3, 'Single selected row'); expect(result.summary.durationS).toBe(0); expect(result.summary.distanceM).toBe(0); expect(result.summary.gapCount).toBe(0); expect(result.summary.largestGapS).toBe(0); expect(result.summary.maxAltitudeM).toBeNull(); expect(result.summary.minBatteryPct).toBeNull(); expect(result.summary.maxSpeedMps).toBe(5);
  });
  it('keeps genuine zero, unknowns and nonzero original timestamps unchanged', () => {
    const source = { ...log, samples:parseFlightCSV(`${LOG_HEADER}\n0,0,0,5,5,5\n2,0,0,0,0,0\n4,0,0,,,\n`) }; const result = reviewWindow(source,1,2,'Zeros'); expect(result.samples[0].time_s).toBe(2); expect(result.summary.maxAltitudeM).toBe(0); expect(result.summary.minBatteryPct).toBe(0); expect(result.summary.batteryCount).toBe(1);
  });
  it.each([[-1,2],[0,6],[3,2],[0.5,2],[0,1.5],[NaN,2],['0',2]])('rejects invalid inclusive row indices %s/%s', (first,last) => { expect(()=>reviewWindow(log,first,last,'label')).toThrow('inclusive existing data rows'); });
  it('validates source model and bounded reviewer text', () => {
    expect(()=>reviewWindow({...log,model_version:'future'},0,1,'x')).toThrow('supported source');
    for(const [label,notes] of [['',''],[' ',''],['x'.repeat(121),''],['x',null],['x','n'.repeat(4001)]]) expect(()=>reviewWindow(log,0,1,label,notes)).toThrow('Window label');
  });
  it('reports exact original rows, fingerprint, units and every selected observation only', () => {
    const report=reviewWindowReport(log,2,3,'Gap discussion','Unverified reviewer note'); for(const text of [WINDOW_VERSION,log.sha256,'Inclusive CSV data rows: 3 through 4','4s through 12s','8s, not observed continuous duration','2 of 6','Boundary-crossing intervals excluded','Unverified reviewer note','3,4,28.6141,77.2092,30,6,93','4,12,28.6142,77.2093,unknown,5,unknown']) expect(report).toContain(text); expect(report).not.toContain('1,0,28.6139'); expect(report).toContain('excluded from portable');
  });
  it('does not mutate source samples and is independent of live replay cursor', () => { const before=JSON.stringify(log); expect(reviewWindowReport({...log,time:0},0,2,'x')).toBe(reviewWindowReport({...log,time:10},0,2,'x')); expect(JSON.stringify(log)).toBe(before); });
});
