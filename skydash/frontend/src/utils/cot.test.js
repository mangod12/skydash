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
