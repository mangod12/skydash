// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const src = resolve(__dirname, '..');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// A <button> whose only content is an icon component needs an accessible name.
function iconOnlyButtons(source) {
  const found = [];
  for (const m of source.matchAll(/<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g)) {
    const [, attrs, body] = m;
    if (/aria-label|title=|aria-labelledby/.test(attrs)) continue;
    // Tags go first; any leftover text or {expression} counts as a visible label.
    const text = body.replace(/<[A-Z]\w*\s[^>]*\/>/g, '').replace(/<\/?[a-z][^>]*>/g, '').trim();
    if (!text && /<[A-Z]\w*\s/.test(body)) {
      found.push(source.slice(0, m.index).split('\n').length);
    }
  }
  return found;
}

describe('icon-only buttons', () => {
  it('detects an unlabelled icon button', () => {
    expect(iconOnlyButtons('<button onClick={f}>\n  <X size={14} />\n</button>')).toEqual([1]);
    expect(iconOnlyButtons('<button aria-label="Close"><X size={14} /></button>')).toEqual([]);
    expect(iconOnlyButtons('<button><X size={14} /> CLOSE</button>')).toEqual([]);
  });

  it('every icon-only button in the app has an accessible name', () => {
    const offenders = walk(src)
      .filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
      .flatMap((f) => iconOnlyButtons(readFileSync(f, 'utf8')).map((line) => `${f.replace(src, 'src')}:${line}`));
    expect(offenders).toEqual([]);
  });
});
