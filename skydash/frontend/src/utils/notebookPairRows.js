import {compareNotebookCopies,COPY_COMPARISON_SCOPE} from './notebookCopyComparison';
export const PAIR_ROWS_VERSION='skydash-notebook-pair-row-ledger-v1';
export const PAIR_ROW_FILTERS=[{key:'union',label:'Either saved copy'},{key:'overlap',label:'Both saved copies'},{key:'a_only',label:'A only'},{key:'b_only',label:'B only'}];
export function notebookPairRows(log,entries,aId,bId,filter='union'){
 if(!PAIR_ROW_FILTERS.some(item=>item.key===filter))throw new Error('Unsupported saved-copy row membership filter.');
 const pair=compareNotebookCopies(log,entries,aId,bId),rows=[];
 for(let number=Math.min(pair.a.entry.first_row,pair.b.entry.first_row);number<=Math.max(pair.a.entry.last_row,pair.b.entry.last_row);number++){
  const inA=number>=pair.a.entry.first_row&&number<=pair.a.entry.last_row,inB=number>=pair.b.entry.first_row&&number<=pair.b.entry.last_row;
  if(!inA&&!inB)continue;
  const membership=inA&&inB?'overlap':inA?'a_only':'b_only';
  if(filter!=='union'&&filter!==membership)continue;
  rows.push({number,sample:log.samples[number-1],membership,previousOriginalSpacing:number===1?null:log.samples[number-1].time_s-log.samples[number-2].time_s});
 }
 return{pair,rows,filter};
}
export function notebookPairRowsReport(log,entries,aId,bId,filter='union'){
 const data=notebookPairRows(log,entries,aId,bId,filter),name=PAIR_ROW_FILTERS.find(item=>item.key===filter).label,show=value=>value===null?'unknown':String(value);
 return['SKYDASH / SAVED-COPY ORIGINAL ROW MEMBERSHIP',PAIR_ROWS_VERSION,COPY_COMPARISON_SCOPE,`Exact source SHA-256 ${log.sha256}; A notebook position ${data.pair.a.ordinal}, original rows ${data.pair.a.entry.first_row} through ${data.pair.a.entry.last_row}; B notebook position ${data.pair.b.ordinal}, original rows ${data.pair.b.entry.first_row} through ${data.pair.b.entry.last_row}.`,`Filter ${name} (${filter}); ${data.rows.length}/${data.pair.distinct} distinct union rows; every matching row below, not only visible page. No outside-union rows. One original row per line, including overlap only once here. Pair comparison report separately repeats overlaps by side.`,'Original spacing is from immediately preceding original CSV row, even outside either copy/filter. Not spacing between filtered/known rows. All intervals remain unsampled; over5s is a source-gap flag, not outage duration.','original_data_row,original_time_s,membership,altitude_m,ground_speed_m_s,battery_pct,previous_original_spacing_s',...data.rows.map(({number,sample,membership,previousOriginalSpacing})=>[number,sample.time_s,membership,show(sample.altitude_m),show(sample.ground_speed_m_s),show(sample.battery_pct),previousOriginalSpacing===null?'none':previousOriginalSpacing].join(',')),...(!data.rows.length?['(no matching original rows, not proof of coverage or completed review)']:[]),'Source altitude datum unverified, ground speed not airspeed, battery percentage not energy/endurance. Contains source fingerprint/times/membership/channel readings, no coordinates, filenames, IDs, labels or private notes. Keep exact source CSV, exact notebook JSON/order, selected positions and filter to reproduce. Human-readable, not reopenable/authenticated or tamper-evident. Derived session view, excluded from existing saved formats. No source edits, storage/upload/sharing/backend writes or aircraft commands.'].join('\n');
}
