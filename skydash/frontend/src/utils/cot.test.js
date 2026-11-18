// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generateCoT, parseCoT, cotTypeFor, affiliationFor } from './cot';

const ent = (o) => ({
  id: 'ent-1', type: 'vehicle', name: 'SUV <4892>', coordinates: [37.778, -122.416],
  threatLevel: 'high', confidence: 82, source: 'ALPHA-1', tags: ['a', 'b'], ...o,
});

describe('cot', () => {
  it('maps threat to affiliation and type', () => {
    expect(affiliationFor('critical')).toBe('h');
    expect(affiliationFor('medium')).toBe('u');
    expect(affiliationFor('none')).toBe('n');
    expect(cotTypeFor(ent())).toBe('a-h-G-E-V');
    expect(cotTypeFor(ent({ type: 'person', threatLevel: 'low' }))).toBe('a-n-G-U-C');
  });

  it('exports well-formed XML, escaping text and skipping entities without coordinates', () => {
    const xml = generateCoT([ent(), ent({ id: 'ent-2', coordinates: undefined })], 0);
    expect(xml.match(/<event /g)).toHaveLength(1);
    expect(xml).toContain('uid="ent-1"');
    expect(xml).toContain('callsign="SUV &lt;4892&gt;"');
    expect(xml).toContain('lat="37.778" lon="-122.416"');
    expect(xml).toContain('stale="1970-01-01T00:15:00.000Z"');
    expect(() => parseCoT(xml)).not.toThrow();
  });

  it('round-trips an entity', () => {
    const { entities, skipped } = parseCoT(generateCoT([ent()]));
    expect(skipped).toBe(0);
    expect(entities[0]).toMatchObject({
      id: 'cot-ent-1', type: 'vehicle', name: 'SUV <4892>', coordinates: [37.778, -122.416],
      threatLevel: 'high', confidence: 82,
    });
  });

  it('imports foreign ATAK events and skips bad ones', () => {
    const xml = `<event version="2.0" uid="ANDROID-abc" type="a-f-G-U-C" time="2026-01-01T00:00:00Z" start="x" stale="y" how="m-g">
      <point lat="12.5" lon="77.5" hae="0" ce="1" le="1"/><detail><contact callsign="ALPHA-6"/></detail></event>`;
    const { entities } = parseCoT(xml);
    expect(entities[0]).toMatchObject({ name: 'ALPHA-6', type: 'person', threatLevel: 'low', coordinates: [12.5, 77.5] });

    const bad = `<events>
      <event uid="t" type="t-x-c-t" ><point lat="1" lon="1"/></event>
      <event uid="b" type="a-h-G"><point lat="95" lon="1"/></event>
      <event uid="n" type="a-h-G"/>
      <event uid="ok" type="a-h-A"><point lat="1" lon="2"/></event></events>`;
    const r = parseCoT(bad);
    expect(r.entities).toHaveLength(1);
    expect(r.entities[0].threatLevel).toBe('high');
    expect(r.skipped).toBe(3);
  });

  it('rejects malformed XML', () => {
    expect(() => parseCoT('<events><event></events>')).toThrow('Invalid CoT XML');
  });
});

describe('CoT coordinate text integrity', () => {
  const xml = (lat, lon) => `<event uid="test" type="a-f-G"><point lat="${lat}" lon="${lon}"/></event>`;
  it.each(['12junk', '12.5N', '0x10', '1,2', '', '   ', 'NaN', 'Infinity'])('skips invalid latitude or longitude text %j', value => {
    for (const document of [xml(value, '0'), xml('0', value)]) {
      expect(parseCoT(document)).toEqual({ entities: [], skipped: 1 });
    }
  });
  it.each([['0', '-0', [0, -0]], [' +12.5 ', '7.75e1', [12.5, 77.5]], ['-90', '180', [-90, 180]]])('preserves complete numeric coordinate text %s,%s', (lat, lon, expected) => {
    const result = parseCoT(xml(lat, lon));
    expect(result.skipped).toBe(0);
    expect(result.entities[0].coordinates).toEqual(expected);
  });
});

describe('CoT confidence integrity', () => {
  const xml = confidence => `<event uid="test" type="a-h-G"><point lat="0" lon="0"/><detail><skydash confidence="${confidence}"/></detail></event>`;
  it.each(['90junk', '0x10', '-1', '101', 'NaN', 'Infinity', '', '   '])('uses the existing unknown default for invalid confidence %j', value => {
    const { entities } = parseCoT(xml(value));
    expect(entities[0].confidence).toBe(50);
  });
  it.each([['0', 0], ['100', 100], [' 82.5 ', 82.5], ['5e1', 50]])('preserves valid confidence %s', (value, expected) => {
    expect(parseCoT(xml(value)).entities[0].confidence).toBe(expected);
  });
});
