// Offline report entry only. Recompute from current validators and original embedded sources.
import { readNotebookSourceBundle } from './notebookSourceBundle';
import { notebookReferenceReport } from './notebookRowReferences';
import { reviewWindowReport } from './reviewWindow';
import { readReviewCase } from './reviewCase';
import { readPairedReviewBundle } from './pairedReviewBundle';
import { flightAfterAction } from './flightLog';
import { sourceEvidenceReport } from './sourceEvidence';
import { instructorReport } from './instructorDebrief';
import { envelopeReport } from './trainingEnvelope';
import { comparisonReport } from './flightComparison';
export async function readPrivateDebrief(kind, text) {
  if (!['case', 'paired', 'notebook'].includes(kind)) throw Error('Explicit supported original kind required.');
  if (kind === 'notebook') {
    const { log, data } = await readNotebookSourceBundle(text), windows = data.notebook.windows;
    return { kind, sources: [{ role: 'Notebook source', sha256: log.sha256, samples: log.samples.length, start_s: log.samples[0].time_s, end_s: log.samples.at(-1).time_s }], sections: [
      { heading: 'Saved-copy index, not chronology or completion', text: ['Every applied saved copy in original notebook order. Numbers are positions, not flight/student identities, phases, priority or review completion. Private labels/notes and all selected original observations appear in individual copy chapters. Copies can overlap or repeat; never add spans, distances, samples or outcomes across copies. Outside rows and boundary-crossing intervals are excluded from individual copy chapters. All intervals remain unsampled. Source filename is omitted from copy text; labels/notes/coordinates still identify private work.', ...windows.map((entry, i) => `Copy ${i + 1}: original rows ${entry.first_row} through ${entry.last_row}; label as unverified JSON string ${JSON.stringify(entry.label)}`)].join('\n\n') },
      { heading: 'Original row references, all groups', text: notebookReferenceReport(log, windows, 'all') },
      ...windows.map((entry, i) => ({ heading: `Saved copy ${i + 1} / original selected observations and private notes`, text: reviewWindowReport({ ...log, filename: '(excluded from private notebook print)' }, entry.first_row - 1, entry.last_row - 1, entry.label, entry.notes) })),
    ] };
  }
  const pair = kind === 'paired' ? await readPairedReviewBundle(text) : null;
  const primary = pair ? pair.primary : await readReviewCase(text), { log, data } = primary;
  const sections = [
    { heading: 'Primary A / analyst review and recorded summary', text: flightAfterAction(log) },
    { heading: 'Primary A / recorded source availability', text: sourceEvidenceReport(log) },
    { heading: 'Primary A / instructor discussion', text: instructorReport(log, data.debrief.markers, data.debrief.notes) },
    { compact: !data.envelope, heading: 'Primary A / included evaluated envelope review', text: data.envelope ? envelopeReport(log, data.envelope.profile, data.envelope.notes) : 'No evaluated envelope profile is included in this original. No result inferred.' },
  ];
  if (pair) sections.push({ heading: 'Ordered A / B comparison, notes and applied anchors', text: comparisonReport(log, pair.comparison.baseline, pair.comparison.notes, pair.comparison.alignment) });
  const source = (value, role) => ({ role, sha256: value.sha256, samples: value.samples.length, start_s: value.samples[0].time_s, end_s: value.samples.at(-1).time_s });
  return { kind, sources: [source(log, 'Primary A'), ...(pair ? [source(pair.comparison.baseline, 'Baseline B')] : [])], sections };
}
