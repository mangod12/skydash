// Offline report entry only. Recompute from current validators and original embedded sources.
import { readReviewCase } from './reviewCase';
import { readPairedReviewBundle } from './pairedReviewBundle';
import { flightAfterAction } from './flightLog';
import { sourceEvidenceReport } from './sourceEvidence';
import { instructorReport } from './instructorDebrief';
import { envelopeReport } from './trainingEnvelope';
import { comparisonReport } from './flightComparison';
export async function readPrivateDebrief(kind, text) {
  if (!['case', 'paired'].includes(kind)) throw Error('Explicit supported original kind required.');
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
