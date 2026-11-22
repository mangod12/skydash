import {MAX_LOG_BYTES,LOG_VERSION,parseFlightCSV,flightCSVHash,summarizeFlight} from '../utils/flightLog';
export const MAX_QUEUE_FILES=8,MAX_QUEUE_BYTES=4*1024*1024;
function capture(files){
 if(!Array.isArray(files)||files.length<1||files.length>MAX_QUEUE_FILES)throw Error('Choose one to eight CSV files.');
 let total=0;
 const selected=files.map((file,index)=>{
  const size=file?.size,method=file?.arrayBuffer,name=file?.name;
  if(!Number.isSafeInteger(size)||size<1||size>MAX_LOG_BYTES||typeof method!=='function')throw Error('Each selected CSV must be nonempty and at most 1MiB.');
  total+=size;
  return {slot:index+1,size,filename:typeof name==='string'?name.slice(0,120):'unnamed.csv',read:method.bind(file)};
 });
 if(total>MAX_QUEUE_BYTES)throw Error('The complete selected batch must be at most 4MiB.');
 return {selected,total};
}
export function describeRecordedCSVQueueSelection(files){const{selected,total}=capture(files);return {files:selected.length,bytes:total};}
export async function checkRecordedCSVQueue(files){
 // Capture every file, method, byte claim and displayed name before the first await.
 const{selected,total}=capture(files),entries=[];
 for(const item of selected){
  try{
   const received=new Uint8Array(await item.read());if(received.byteLength!==item.size||received.byteLength>MAX_LOG_BYTES)throw Error('Selected CSV byte count changed.');
   const owned=new Uint8Array(received),csv_text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(owned),samples=parseFlightCSV(csv_text),sha256=await flightCSVHash(csv_text),summary=summarizeFlight(samples);
   entries.push({slot:item.slot,filename:item.filename,status:'ready',bytes:owned.byteLength,csv_text,sha256,model_version:LOG_VERSION,sample_count:summary.count,source_span_s:summary.durationS,gaps_over_5s:summary.gapCount,largest_source_interval_s:summary.largestGapS,missing_cells:{altitude_m:summary.count-summary.altitudeCount,ground_speed_m_s:summary.count-summary.speedCount,battery_pct:summary.count-summary.batteryCount}});
  }catch{entries.push({slot:item.slot,filename:item.filename,status:'not-prepared'});}
 }
 for(const entry of entries)if(entry.status==='ready')entry.same_bytes_as_slots=entries.filter(other=>other.status==='ready'&&other.slot!==entry.slot&&other.sha256===entry.sha256).map(other=>other.slot);
 return {format:'skydash-session-csv-review-queue-v1',selected_files:entries.length,selected_bytes:total,ready_files:entries.filter(entry=>entry.status==='ready').length,entries};
}
