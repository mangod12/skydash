export const ENVELOPE_GROUP_VERSION = 'skydash-envelope-match-row-groups-v1';
export const ENVELOPE_GROUP_SCOPE = 'CONSECUTIVE MATCHING ROW GROUPS, NOT CONTINUOUS BREACH EVENTS. Group only adjacent original rows matching this one reviewed strict criterion, splitting at missing/nonmatching cells or timestamp spacing over 5s. Exactly 5s stays in one group, but every interval is unsampled. Each matching row belongs to exactly one group for this criterion. Groups across criteria may overlap. Timestamp span is not event duration, exposure, onset, recovery, compliance or a pilot grade.';
export function envelopeMatchGroups(samples, rule) {
  if (rule.state === 'disabled') return [];
  const matching = new Set(rule.matches.map(item => item.index)), groups = [];
  const boundary = (index, neighbor) => {
    if (neighbor < 0 || neighbor >= samples.length) return { row: null, reason: neighbor < 0 ? 'source start' : 'source end' };
    const sample = samples[neighbor], spacing = Math.abs(sample.time_s - samples[index].time_s);
    return { row: neighbor + 1, time: sample.time_s, value: sample[rule.field], spacing, reason: `${sample[rule.field] === null ? 'unknown cell' : matching.has(neighbor) ? 'matching cell across gap' : 'nonmatching cell'}${spacing > 5 ? '; gap over 5s' : ''}` };
  };
  for (const match of rule.matches) {
    const previous = groups.at(-1), row = match.index + 1;
    if (!previous || previous.last !== row - 1 || match.time_s - previous.end > 5) groups.push({ number: groups.length + 1, first: row, last: row, start: match.time_s, end: match.time_s, count: 1, firstValue: match.value, lastValue: match.value });
    else { previous.last = row; previous.end = match.time_s; previous.count++; previous.lastValue = match.value; }
  }
  return groups.map(group => ({ ...group, span: group.end - group.start, before: boundary(group.first - 1, group.first - 2), after: boundary(group.last - 1, group.last) }));
}
export function envelopeGroupBoundaryText(boundary, unit) {
  return boundary.row === null ? boundary.reason : `original row ${boundary.row} at ${boundary.time}s, ${boundary.value === null ? 'unknown' : `${boundary.value}${unit}`}; spacing ${boundary.spacing}s; ${boundary.reason}`;
}
export function envelopeMatchGroupLines(samples, rule) {
  const groups = envelopeMatchGroups(samples, rule);
  return [`${rule.label}: ${rule.state === 'disabled' ? 'disabled, no group review' : `strictly ${rule.direction} ${rule.threshold}${rule.unit}; ${groups.length} groups containing ${rule.matches.length} matching rows`}.`, ...groups.flatMap(group => [`Group ${group.number}: original rows ${group.first} through ${group.last}; ${group.count} matching ${group.count === 1 ? 'row' : 'rows'}; ${group.start}s to ${group.end}s; timestamp span ${group.span}s, not event duration; endpoint values ${group.firstValue}${rule.unit} to ${group.lastValue}${rule.unit}.`, `Before: ${envelopeGroupBoundaryText(group.before, rule.unit)}. After: ${envelopeGroupBoundaryText(group.after, rule.unit)}.`]), ...(!groups.length && rule.state !== 'disabled' ? ['No matching row groups, not proof of continuous compliance.'] : [])];
}
