// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { escapeXml } from './sanitize';
import { generateKML, generateGeoJSON } from './exportGenerators';
import { generateCoT, cotTypeFor } from './cot';

const entity = { id: 'one', name: 'Contact', type: 'vehicle', coordinates: [0, 0], threatLevel: 'high' };
const parse = (xml) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
};

describe('XML export encoding', () => {
  it.each(['\x00', '\x01', '\x0b', '\x1f', '\ud800', '\udfff', '\ufffe', '\uffff'])(
    'replaces invalid XML characters in both geographic formats: %j', (char) => {
      const record = { ...entity, name: `Contact${char}` };
      const cot = parse(generateCoT([record]));
      expect(cot.querySelector('contact').getAttribute('callsign')).toBe('Contact\ufffd');
      const kml = parse(generateKML([record]));
      expect(kml.querySelector('Placemark > name').textContent).toBe('Contact\ufffd');
    },
  );

  it('preserves international text, emoji and markup as literal text', () => {
    const name = 'Café विमान 🚁 <A&B> "quoted"';
    expect(parse(generateCoT([{ ...entity, name }])).querySelector('contact').getAttribute('callsign')).toBe(name);
    expect(parse(generateKML([{ ...entity, name }])).querySelector('Placemark > name').textContent).toBe(name);
    expect(escapeXml('line\nnext\tcolumn\rreturn')).toBe('line\nnext\tcolumn\rreturn');
  });

  it('isolates null records and missing types without breaking geographic downloads', () => {
    const records = [null, { ...entity, type: null }, entity];
    expect(parse(generateKML(records)).querySelectorAll('Placemark')).toHaveLength(2);
    expect(JSON.parse(generateGeoJSON(records)).features).toHaveLength(2);
    expect(JSON.parse(generateGeoJSON(null)).features).toHaveLength(0);
  });

  it('does not interpret unknown threat data as KML markup', () => {
    const record = { ...entity, threatLevel: '</styleUrl><Injected>bad</Injected><styleUrl>' };
    const doc = parse(generateKML([record]));
    expect(doc.querySelector('Injected')).toBeNull();
    expect(doc.querySelector('styleUrl').textContent).toBe('#threat-none');
  });

  it('does not export impossible CoT positions or inherited type mappings', () => {
    const invalid = [null, { ...entity, coordinates: [91, 0] }, { ...entity, coordinates: [0, -181] }];
    expect(parse(generateCoT([...invalid, entity])).querySelectorAll('event')).toHaveLength(1);
    expect(cotTypeFor({ ...entity, type: '__proto__' })).toBe('a-h-G');
    expect(cotTypeFor({ ...entity, type: 'constructor' })).toBe('a-h-G');
  });
});
