import { LOG_VERSION } from '../utils/flightLog';
import { CHART_CHANNELS } from '../utils/channelChart';
export const INTERVAL_SCOPE = 'Selected original source interval only, not continuous telemetry. Every included known value is retained without smoothing or downsampling. Unknown rows and adjacent source intervals over 5s break connecting guides. No values are inferred at the chosen boundaries or between source rows. This is not a safety, grading, completeness or readiness assessment.';
export function sourceInterval(log, channel, startText, endText) {
  if (log?.model_version !== LOG_VERSION || !CHART_CHANNELS.some(item => item.key === channel) || !log.samples?.length) throw new Error('Unsupported source model or channel.');
  const decimal = value => typeof value === 'string' && value.length <= 40 && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
  if (!decimal(startText) || !decimal(endText)) throw new Error('Enter both bounds as nonnegative decimal source seconds, without spaces or exponent notation.');
  const start = Number(startText), end = Number(endText), duration = log.samples.at(-1).time_s;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > duration) throw new Error(`Choose 0 <= start <= end <= ${duration} original source seconds.`);
  const rows = [];
  log.samples.forEach((sample,index) => { if (sample.time_s >= start && sample.time_s <= end) rows.push({index,time:sample.time_s,value:sample[channel]}); });
  const known = rows.filter(row => row.value !== null), values = known.map(row => row.value);
  const min = values.length ? values.reduce((a,b) => Math.min(a,b)) : null, max = values.length ? values.reduce((a,b) => Math.max(a,b)) : null;
  const padding = min === max ? Math.max(Math.abs(min) * .05,1) : 0, low = min === null ? 0 : min-padding, high = max === null ? 1 : max+padding;
  const x = time => start === end ? 420 : 55+(time-start)/(end-start)*730, y = value => 225-(value-low)/(high-low)*190;
  const segments = []; let current = [];
  for (const row of rows) {
    if (row.value === null) { if (current.length) segments.push(current); current=[]; continue; }
    const previous = current.at(-1);
    if (previous && (row.index !== previous.index+1 || row.time-previous.time > 5)) { segments.push(current); current=[]; }
    current.push({...row,x:x(row.time),y:y(row.value)});
  }
  if (current.length) segments.push(current);
  return {channel,start,end,duration,rows,count:known.length,missing:rows.length-known.length,min,max,low,high,x,y,segments,
    linePath:segments.filter(segment=>segment.length>1).map(segment=>segment.map((row,index)=>`${index?'L':'M'}${row.x},${row.y}`).join(' ')).join(' '),
    pointPath:segments.flat().map(row=>`M${row.x-1.5},${row.y}h3`).join(' ')};
}
export function nearestIntervalRow(rows,time) {
  if (!Number.isFinite(time)) throw new Error('Selection time must be finite.');
  if (!rows.length) return null;
  return rows.reduce((best,row)=>Math.abs(row.time-time)<Math.abs(best.time-time)?row:best,rows[0]);
}
export function intervalEvidence(log,model) {
  const channel=CHART_CHANNELS.find(item=>item.key===model.channel);
  return ['SKYDASH / SELECTED ORIGINAL SOURCE INTERVAL','skydash-source-interval-v1',INTERVAL_SCOPE,channel.caveat,'',`Exact primary CSV SHA-256: ${log.sha256}`,`Channel: ${channel.label} (${channel.unit})`,`Inclusive chosen bounds: ${model.start}s to ${model.end}s; full source ends ${model.duration}s.`,`Included source rows: ${model.rows.length}/${log.samples.length}; known ${model.count}; unknown ${model.missing}.`,`Observed included minimum: ${model.min??'unknown'}; maximum: ${model.max??'unknown'}. Automatic axis, not safe limits.`,'','EVERY INCLUDED ORIGINAL SOURCE ROW, INCLUDING UNKNOWNS','original_data_row,original_time_s,value (unknown = missing)',...model.rows.map(row=>`${row.index+1},${row.time},${row.value??'unknown'}`),'','No rows or connecting guides outside these bounds are included. Empty intervals do not prove no activity; boundaries are not observations. Source hash, times and channel values can be sensitive. Coordinates, filenames, private notes and reviews are omitted. Editable text, not signed evidence or a saved review. Keep the exact original CSV separately. No source replacement, review mutation, automatic upload or storage.'].join('\n');
}
