import { describe, expect, it } from 'vitest';
import { formatBriefingText, generateBriefing } from './briefingGenerator';

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
