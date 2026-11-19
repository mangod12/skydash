import { LOG_VERSION } from './flightLog';
export const CIRCLE_VERSION='skydash-reference-circle-v1';
export const CIRCLE_SCOPE='REVIEWER-DEFINED REFERENCE CIRCLE, NOT AN OPERATIONAL GEOFENCE. Horizontal spherical great-circle distance at recorded source samples only. No continuous path, boundary-crossing time, dwell duration, containment, positional accuracy, altitude/terrain, airspace, permission, flight clearance, safety or training-grade claim. Gaps remain unobserved. A source sample outside the reference circle is a discussion point, not a violation or detected aircraft event. No aircraft commands.';
export const CIRCLE_FILTERS=['all','inside','outside'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function validateReferenceCircle(input){
 if(!exact(input,['latitude','longitude','radiusM','label','notes']))throw new Error('Unsupported reference circle fields.');
 for(const[key,min,max]of[['latitude',-85,85],['longitude',-180,180],['radiusM',1,1000000]])if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw new Error('Reference latitude must be -85 to 85 degrees, longitude -180 to 180 degrees, radius 1 to 1,000,000 metres, all finite numbers.');
 if(typeof input.label!=='string'||!input.label.trim()||input.label.length>120||typeof input.notes!=='string'||input.notes.length>4000)throw new Error('Circle label required, up to 120 characters; discussion notes up to 4,000 characters.');
 return {...input};
}
export function referenceDistanceM(a,b){
 const rad=value=>value*Math.PI/180;
 const h=Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function referenceCircleReview(log,input){
 if(log?.model_version!==LOG_VERSION||!Array.isArray(log.samples)||!log.samples.length)throw new Error('Load a supported recorded CSV source before reviewing a reference circle.');
 const criteria=validateReferenceCircle(input);
 const rows=log.samples.map((sample,index)=>{const distanceM=referenceDistanceM(criteria,sample),spacing=index?sample.time_s-log.samples[index-1].time_s:null;return {row:index+1,sample,distanceM,relation:distanceM<=criteria.radiusM?'inside':'outside',spacing};});
 let nearest=rows[0],farthest=rows[0];for(const row of rows){if(row.distanceM<nearest.distanceM)nearest=row;if(row.distanceM>farthest.distanceM)farthest=row;}
 const inside=rows.filter(row=>row.relation==='inside').length,outside=rows.length-inside,gaps=rows.filter(row=>row.spacing>5).length;
 // Changes are only adjacent sample classifications; do not infer a boundary crossing.
 const changes=rows.slice(1).filter((row,index)=>row.relation!==rows[index].relation).map(row=>({fromRow:row.row-1,toRow:row.row,fromTime:rows[row.row-2].sample.time_s,toTime:row.sample.time_s,gap:row.spacing>5}));
 return {criteria,rows,inside,outside,gaps,nearest,farthest,changes};
}
export function filterCircleRows(result,filter='all'){
 if(!CIRCLE_FILTERS.includes(filter))throw new Error('Unsupported reference circle row filter.');
 return filter==='all'?result.rows:result.rows.filter(row=>row.relation===filter);
}
export function referenceCircleReport(log,input,filter='all'){
 const result=referenceCircleReview(log,input),rows=filterCircleRows(result,filter),show=value=>value===null?'unknown':String(value);
 return ['SKYDASH / RECORDED REFERENCE CIRCLE REVIEW',CIRCLE_VERSION,CIRCLE_SCOPE,`Replay model: ${LOG_VERSION}`,`Source file: ${log.filename}; exact source SHA-256: ${log.sha256}`,'',`Reviewer label (unverified): ${input.label}`,`Reviewer reference point WGS84 decimal degrees: latitude ${input.latitude}, longitude ${input.longitude}; radius ${input.radiusM}m. User-asserted coordinate reference, not verified.`,`Distance model: haversine sphere radius 6371000m, horizontal only. Numerical <= radius is inside/on circle. No tolerance or accuracy allowance; rounded displays do not determine classification.`,`Recorded samples inside/on: ${result.inside}; outside: ${result.outside}; total: ${result.rows.length}. Sample counts are not time, duration, path containment or a completeness measure.`,`Nearest recorded sample: original row ${result.nearest.row}, ${result.nearest.sample.time_s}s, ${result.nearest.distanceM}m. Farthest recorded sample: original row ${result.farthest.row}, ${result.farthest.sample.time_s}s, ${result.farthest.distanceM}m. Equal-distance ties choose earlier original row.`,`Intervals over 5s: ${result.gaps}. Adjacent-row classification changes: ${result.changes.length}, including ${result.changes.filter(item=>item.gap).length} across gaps; no crossing time/location inferred.`,'','REVIEWER DISCUSSION NOTES, NOT SENSOR FACTS',input.notes||'(none)','','ADJACENT SOURCE ROW CLASSIFICATION CHANGES, NOT DETECTED CROSSINGS','from_row,to_row,from_time_s,to_time_s,gap_over_5s',...result.changes.map(item=>`${item.fromRow},${item.toRow},${item.fromTime},${item.toTime},${item.gap}`),'',`ALL MATCHING SOURCE ROWS: filter ${filter}, matching ${rows.length} of ${result.rows.length}; original row order, no downsampling.`,'data_row,time_s,latitude,longitude,source_altitude_m,ground_speed_m_s,battery_pct,distance_to_reference_m,sample_relation,previous_original_spacing_s',...rows.map(row=>[row.row,...['time_s','latitude','longitude','altitude_m','ground_speed_m_s','battery_pct'].map(key=>show(row.sample[key])),row.distanceM,row.relation,row.spacing===null?'none':row.spacing].join(',')),'','Keep exact source CSV and reference criteria/model to reproduce. Source coordinates and reference coordinates/notes are sensitive. Editable, not signed/authenticated/tamper-evident. No upload, backend writes, automatic sharing, aircraft commands or operational geofence changes. Session-only criteria/result excluded from portable cases/comparison/notebook/library; download separately.'].join('\n');
}
