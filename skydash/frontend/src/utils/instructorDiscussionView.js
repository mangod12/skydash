const filters = new Set(['all', 'open', 'questions', 'followups']);
// Markers have already passed the instructor-sidecar validator. Keep that exact
// sorted order and object identity, including separate equal-time annotations.
export function instructorDiscussionView(markers, filter = 'all', page = 0) {
  const chosen = filters.has(filter) ? filter : 'all';
  const questions = markers.filter(item => !item.discussed && item.kind === 'Question').length;
  const followups = markers.filter(item => !item.discussed && item.kind === 'Follow-up').length;
  const matches = markers.filter(item => chosen === 'all' || (!item.discussed && (chosen === 'questions' ? item.kind === 'Question' : chosen === 'followups' ? item.kind === 'Follow-up' : item.kind === 'Question' || item.kind === 'Follow-up')));
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  const current = Math.min(pages - 1, Math.max(0, Number.isInteger(page) ? page : 0));
  return { questions, followups, total: matches.length, pages, page: current, items: matches.slice(current * 10, current * 10 + 10) };
}
