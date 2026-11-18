import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBriefingText, generateBriefing, getBriefingTimestamp } from './briefingGenerator';

describe('mission visual debrief briefing', () => {
  it('includes RT-DETR detection summaries in the mission briefing', () => {
    const mission = {
      id: 'mission-001',
      name: 'Drone Inspection Debrief',
      status: 'active',
      created_at: '2026-06-08T12:00:00Z',
      updated_at: '2026-06-08T12:10:00Z',
      entityIds: [],
      detections: [
        {
          id: 'det-001',
          source_name: 'north-gate-frame.jpg',
          model: 'rtdetr-l.pt',
          created_at: '2026-06-08T12:05:00Z',
          summary: {
            total: 3,
            labels: {
              person: 2,
              truck: 1,
            },
          },
          detections: [
            { label: 'person', confidence: 0.91 },
            { label: 'truck', confidence: 0.86 },
          ],
        },
      ],
    };

    const briefing = generateBriefing(mission, [], {});
    const text = formatBriefingText(briefing);

    expect(text).toContain('4. VISUAL DEBRIEF');
    expect(text).toContain('RT-DETR Analysis Runs: 1');
    expect(text).toContain('person: 2');
    expect(text).toContain('north-gate-frame.jpg [rtdetr-l.pt]');
    expect(text).toContain('truck (86%)');
  });
});


describe('briefing waypoint geometry', () => {
  it.each([null, [], [null, null], [false, false], ['0', '0'], [NaN, 0], [Infinity, 0], [91, 0], [0, -181], '00'].map(value => [value]))(
    'omits invalid waypoint coordinates without dropping the assigned entity: %j', coordinates => {
      const mission = { name: 'Map evidence', entityIds: ['one'] };
      const entities = [{ id: 'one', name: 'Linked', type: 'person', coordinates }];
      const briefing = generateBriefing(mission, entities, {});
      expect(briefing.execution.waypoints).toEqual([]);
      expect(briefing.execution.assignedEntities).toHaveLength(1);
      expect(formatBriefingText(briefing)).not.toContain('undefined, undefined');
    },
  );
  it('preserves zero and valid boundary positions in lat/lon order', () => {
    const entities = [{ id: 'one', name: 'Origin', coordinates: [0, 0] },
      { id: 'two', name: 'Boundary', coordinates: [-90, 180] }];
    const briefing = generateBriefing({ name: 'Valid', entityIds: ['one', 'two'] }, entities, {});
    expect(briefing.execution.waypoints).toEqual([
      { name: 'Origin', lat: '0.000000', lng: '0.000000' },
      { name: 'Boundary', lat: '-90.000000', lng: '180.000000' },
    ]);
  });
});

describe('briefing telemetry evidence', () => {
  const mission = { name: 'Evidence', entityIds: [] };
  it.each([false, true])('uses the real flight_mode and preserves zero readings with fleet=%j', fleet => {
    const drone = { drone_id: 'one', flight_mode: 'HOLD', battery_voltage: 0, signal_strength: 0 };
    const result = generateBriefing(mission, [], { data: drone, fleet: fleet ? [drone] : [] }).sustainment;
    expect(result.fleetStatus).toEqual([{ id: 'one', status: 'HOLD', battery: '0.0V', signal: '0%' }]);
    expect(result.overallBattery).toBe('RED');
    expect(result.overallSignal).toBe('RED');
  });
  it.each([undefined, null, NaN, Infinity, -1, '16', true])('does not invent readiness from invalid readings: %j', value => {
    const drone = { drone_id: 'one', battery_voltage: value, signal_strength: value };
    const result = generateBriefing(mission, [], { data: drone, fleet: [null, {}, drone] }).sustainment;
    expect(result.fleetStatus).toEqual([{ id: 'one', status: 'UNKNOWN', battery: 'N/A', signal: 'N/A' }]);
    expect(result.overallBattery).toBe('UNKNOWN');
    expect(result.overallSignal).toBe('UNKNOWN');
  });
  it('uses the same format for single records and fleets without adding units to unknown values', () => {
    const drone = { drone_id: 'one', flight_mode: 'RTL' };
    const single = generateBriefing(mission, [], { data: drone }).sustainment;
    const fleet = generateBriefing(mission, [], { data: drone, fleet: [drone] }).sustainment;
    expect(single).toEqual(fleet);
    expect(single.fleetStatus[0]).toMatchObject({ battery: 'N/A', signal: 'N/A', status: 'RTL' });
  });
  it('keeps valid readiness thresholds and rejects overrange signal', () => {
    const drone = { drone_id: 'one', flight_mode: 'ORBIT', battery_voltage: 16, signal_strength: 101 };
    const result = generateBriefing(mission, [], { data: drone }).sustainment;
    expect(result.overallBattery).toBe('GREEN');
    expect(result.overallSignal).toBe('UNKNOWN');
    expect(result.fleetStatus[0].signal).toBe('N/A');
  });
});

describe('briefing UTC time and geographic context', () => {
  afterEach(() => vi.useRealTimers());

  it('uses UTC fields for every Zulu date-time group, regardless of local timezone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T22:45:00Z'));
    expect(getBriefingTimestamp()).toBe('172245Z NOV 2026');
    const text = formatBriefingText(generateBriefing({
      name: 'UTC test', entityIds: [], created_at: '2026-11-17T23:45:00-05:00',
      updated_at: 'not a date', notes: [{ created_at: '2026-11-18T10:00:00+05:30', content: 'Observation' }],
    }, [], {}));
    expect(text).toContain('180445Z NOV 2026');
    expect(text).toContain('180430Z NOV 2026');
    expect(text).toContain('Last Updated: N/A');
  });

  it('uses correct southern/western hemispheres and preserves zero zoom', () => {
    const text = formatBriefingText(generateBriefing({
      name: 'Southern AO', entityIds: [], center_lat: -20.5, center_lng: -60.25, zoom_level: 0,
    }, [], {}));
    expect(text).toContain('20.5000S, 60.2500W');
    expect(text).toContain('Zoom level 0');
  });

  it.each([[0, null], [null, 0], ['20', 30], [91, 0], [0, Infinity]])(
    'does not invent area context from invalid coordinates: %j/%j', (center_lat, center_lng) => {
      const text = formatBriefingText(generateBriefing({ name: 'No AO', entityIds: [], center_lat, center_lng }, [], {}));
      expect(text).toContain('Area of operations not yet defined');
    },
  );
});
