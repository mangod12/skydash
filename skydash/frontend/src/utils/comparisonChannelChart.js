import { LOG_VERSION } from './flightLog';
import { CHART_CHANNELS, channelChart } from './channelChart';
import { ALIGNMENT_VERSION, comparisonAlignment, mappedComparisonSourceTime, recordedObservation } from './flightComparison';
export const COMPARISON_CHART_VERSION = 'skydash-comparison-channel-plots-v1';
export const COMPARISON_CHART_SCOPE = 'TWO INDEPENDENT RECORDED CHANNEL PLOTS, NOT SYNCHRONIZED TELEMETRY. Stacked A/B plots share one automatic value axis and review-clock axis for the selected source unit. Review clock = original source time minus its applied anchor, not verified simultaneous events or equivalent flight phases. Every known source point retained. Thin guides join only adjacent known original rows at most 5s apart; missing rows and gaps over 5s break guides. All intervals remain unsampled. No interpolation, resampling, smoothing, paired measurements, significance, skill, improvement or readiness claim.';
export function comparisonChannelChart(primary, baseline, key, alignment = null) {
  const channel = CHART_CHANNELS.find(item => item.key === key); if (!channel) throw new Error('Select a supported comparison channel.');
  const anchor = comparisonAlignment(primary, baseline, alignment);
  const sources = [{ key:'A', log:primary, origin:anchor.primaryS }, { key:'B', log:baseline, origin:anchor.baselineS }].map(source => ({...source, chart:channelChart(source.log,key)}));
  const known = sources.filter(source => source.chart.count), min = known.length ? Math.min(...known.map(source => source.chart.min)) : null, max = known.length ? Math.max(...known.map(source => source.chart.max)) : null;
  const padding = min === max ? Math.max(Math.abs(min) * .05, 1) : 0, low = min === null ? 0 : min - padding, high = max === null ? 1 : max + padding;
  const start = Math.min(-anchor.primaryS,-anchor.baselineS) || 0, end = Math.max(primary.samples.at(-1).time_s-anchor.primaryS,baseline.samples.at(-1).time_s-anchor.baselineS);
  const x = time => 55+(time-start)/(end-start)*730, y = value => 225-(value-low)/(high-low)*190;
  return {channel,anchor,start,end,min,max,low,high,x,y,sources:sources.map(source => ({...source, start:-source.origin || 0,end:source.log.samples.at(-1).time_s-source.origin,
    linePath:source.chart.segments.filter(segment=>segment.length>1).map(segment=>segment.map((point,index)=>`${index?'L':'M'}${x(point.time-source.origin)},${y(point.value)}`).join(' ')).join(' '),
    pointPath:source.chart.segments.flat().map(point=>`M${x(point.time-source.origin)-1.5},${y(point.value)}h3`).join(' ')}))};
}
export function comparisonChartObservation(source,time,key) {
  const observation = recordedObservation(source.log.samples,mappedComparisonSourceTime(source.log.samples,source.origin,time));
  return {...observation,value:observation.sample?.[key]??null,reviewTime:observation.sample ? observation.sample.time_s-source.origin : null};
}
export function nearestComparisonChartRow(source,time) {
  if (!Number.isFinite(time)) throw new Error('Chart selection must be finite.');
  const samples=source.log.samples;let low=0,high=samples.length-1;
  while(low<high){const mid=Math.floor((low+high)/2);if(samples[mid].time_s-source.origin<time)low=mid+1;else high=mid;}
  if(low&&time-(samples[low-1].time_s-source.origin)<=(samples[low].time_s-source.origin)-time)low--;
  return {row:low+1,time:samples[low].time_s,reviewTime:samples[low].time_s-source.origin};
}
export function comparisonChannelChartReport(primary,baseline,key,alignment=null) {
  const data=comparisonChannelChart(primary,baseline,key,alignment);
  return ['SKYDASH / TWO INDEPENDENT RECORDED CHANNEL PLOTS',COMPARISON_CHART_VERSION,COMPARISON_CHART_SCOPE,data.channel.caveat,`Replay model ${LOG_VERSION}; channel ${data.channel.label} (${data.channel.unit})`, `Full review-clock range ${data.start}s to ${data.end}s; shared automatic value axis ${data.low} to ${data.high}, not safe limits.`, `Applied clock model ${ALIGNMENT_VERSION}; ${data.anchor.manual?'manual sample anchors':'CSV starts'}: A original row ${data.anchor.primaryIndex+1} at ${data.anchor.primaryS}s; B original row ${data.anchor.baselineIndex+1} at ${data.anchor.baselineS}s. No anchor label/private annotations included.`,...data.sources.flatMap(source=>['',`SOURCE ${source.key} FULL ORIGINAL ROWS INCLUDING UNKNOWN`, `Exact source SHA-256 ${source.log.sha256}; known ${source.chart.count}/${source.log.samples.length}; missing ${source.chart.missing}. Original range 0s to ${source.log.samples.at(-1).time_s}s; review range ${source.start}s to ${source.end}s.`, 'data_row,original_time_s,review_clock_s,value,previous_original_spacing_s (unknown = missing, none = no prior row)',...source.log.samples.map((sample,index)=>[index+1,sample.time_s,sample.time_s-source.origin,sample[key]??'unknown',index?sample.time_s-source.log.samples[index-1].time_s:'none'].join(','))]),'', 'Every source row is listed independently, not paired on shared times. Missing cells never zero-filled. Shared axes are visual aids, no physical-time or datum normalization. Dense points can overlap on screen; exact original-row navigation and complete report retain evidence. Contains fingerprints/times/channel readings; no coordinates, filenames, raw CSV, private notes or anchor labels. Keep both exact CSVs/channel/applied anchor rows/models to reproduce. Editable, not authenticated or tamper-evident. Derived session view only, not stored in cases/packets/library. No source edits, new persistent state, upload/sharing/backend writes or aircraft commands.'].join('\n');
}
