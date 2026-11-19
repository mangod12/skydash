import { LOG_VERSION, sampleIndexAt } from './flightLog';
export const STEP_SCOPE = 'EXACT ORIGINAL-TIMESTAMP STEPPING. Previous selects the latest original timestamp strictly before cursor; Next selects the earliest strictly after it. Between rows, Previous selects the held earlier row and Next the later row. At an exact row, they select its neighbors. No interpolation, invented frames or gap observations. A step can cross an over5s gap, explicitly disclosed below. Stepping changes only primary cursor, not the source or reviewed selections.';
export function sourceStepTargets(log, time) {
  if (log?.model_version !== LOG_VERSION || !Array.isArray(log.samples) || log.samples.length < 2) throw new Error('Load a supported recorded CSV source.');
  const samples = log.samples;
  if (!Number.isFinite(time) || time < 0 || time > samples.at(-1).time_s) throw new Error('Cursor must be within original source time range.');
  const heldIndex = sampleIndexAt(samples, time), exact = samples[heldIndex].time_s === time;
  const point = index => index < 0 || index >= samples.length ? null : ({ row: index + 1, time: samples[index].time_s });
  const previous = point(exact ? heldIndex - 1 : heldIndex), next = point(heldIndex + 1), held = point(heldIndex);
  // A cursor inside a gap must disclose its enclosing ORIGINAL pair even if the
  // partial jump to an endpoint is under5s. At exact rows use the crossed pair.
  const boundary = direction => {
    const index = direction === 'previous' && exact ? heldIndex - 1 : heldIndex;
    if (index < 0 || index + 1 >= samples.length) return null;
    const first = point(index), last = point(index + 1), spacing = last.time - first.time;
    return { first, last, spacing, gap: spacing > 5 };
  };
  return { exact, held, previous, next, previousBoundary: previous ? boundary('previous') : null, nextBoundary: next ? boundary('next') : null };
}
