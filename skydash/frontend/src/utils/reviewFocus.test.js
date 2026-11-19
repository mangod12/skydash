import { describe, it, expect } from 'vitest';
import { REVIEW_FOCUS_GROUPS, REVIEW_SECTIONS, reviewPanelVisible } from './reviewFocus';
describe('review presentation groups', () => {
  it('maps every evidence, interval and follow-up section without duplicated destinations', () => {
    expect(new Set(REVIEW_SECTIONS.map(item => item.id)).size).toBe(REVIEW_SECTIONS.length);
    expect(REVIEW_SECTIONS).toHaveLength(15);
    for (const section of REVIEW_SECTIONS) expect(section.group === null || REVIEW_FOCUS_GROUPS.some(group => group.key === section.group)).toBe(true);
    expect(REVIEW_SECTIONS.filter(item => item.group === null).map(item => item.id)).toEqual(['flight-comparison']);
  });
  it('all shows every group; a focus shows only the exact group', () => {
    for (const focus of REVIEW_FOCUS_GROUPS) for (const group of ['source', 'interval', 'debrief']) expect(reviewPanelVisible(focus.key, group)).toBe(focus.key === 'all' || focus.key === group);
  });
  it('rejects unknown presentation keys instead of silently hiding work', () => {
    expect(() => reviewPanelVisible('unknown', 'source')).toThrow();
    expect(() => reviewPanelVisible('all', 'unknown')).toThrow();
  });
});
