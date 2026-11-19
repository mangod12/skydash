export const REVIEW_FOCUS_GROUPS = [
  { key: 'all', label: 'All review panels', detail: 'Every evidence, interval and debrief panel is visible.' },
  { key: 'source', label: 'Source evidence panels', detail: 'Recorded channel plot, original row ledger, source inventory, joint cells, row blocks, known-cell ranks and adjacent changes.' },
  { key: 'interval', label: 'Interval and criteria panels', detail: 'Selected sample windows/notebook, reference circle and training envelope.' },
  { key: 'debrief', label: 'Debrief and follow-up panels', detail: 'Instructor timeline, follow-up packet/local shelf, action register and discussion checklist.' },
];
export const REVIEW_SECTIONS = [
  { id: 'selected-sample-window', label: 'Selected window and notebook', group: 'interval' },
  { id: 'source-row-ledger', label: 'Source row ledger', group: 'source' },
  { id: 'recorded-channel-chart', label: 'Channel evidence plot', group: 'source' },
  { id: 'reference-circle-review', label: 'Reference circle review', group: 'interval' },
  { id: 'source-evidence', label: 'Source evidence', group: 'source' },
  { id: 'joint-channel-evidence', label: 'Joint channel cells', group: 'source' },
  { id: 'recorded-row-blocks', label: 'Row block ledger', group: 'source' },
  { id: 'recorded-channel-ranks', label: 'Known-cell ranks', group: 'source' },
  { id: 'adjacent-channel-changes', label: 'Adjacent changes', group: 'source' },
  { id: 'training-envelope', label: 'Training envelope', group: 'interval' },
  { id: 'instructor-debrief', label: 'Instructor debrief', group: 'debrief' },
  { id: 'debrief-action-register', label: 'Debrief actions', group: 'debrief' },
  { id: 'debrief-followup-packet', label: 'Follow-up packet', group: 'debrief' },
  { id: 'debrief-checklist', label: 'Discussion checklist', group: 'debrief' },
  { id: 'flight-comparison', label: 'Compare two flights', group: null },
];
export function reviewPanelVisible(focus, group) {
  if (!REVIEW_FOCUS_GROUPS.some(item => item.key === focus) || !['source', 'interval', 'debrief'].includes(group)) throw new Error('Unsupported review focus or panel group.');
  return focus === 'all' || focus === group;
}
