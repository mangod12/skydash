import {LOG_VERSION,parseFlightCSV} from './flightLog';
import {checklistReview} from './debriefChecklist';
import {prepareChecklistComparison} from './checklistReviewComparison';
// Reuse the checked private comparison. Capture exactly the one bounded source read,
// so current-model output validation uses those same bytes, not a second file read.
export async function prepareChecklistCombination(files,{allowPrivateReview=false,expected={}}={}){
 if(allowPrivateReview!==true||!files||Object.keys(files).sort().join(',')!=='left,right,source'||!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).some(key=>!['source','left','right'].includes(key)))throw Error('Explicit private acknowledgement and three original roles required.');
 let sourceBytes;const source={size:files.source?.size,arrayBuffer:async()=>{sourceBytes=new Uint8Array(await files.source.arrayBuffer()).slice();return sourceBytes;}};
 const pin=role=>Object.hasOwn(expected,role)?expected[role]:'';
 const comparison=await prepareChecklistComparison(source,files.left,files.right,{allowPrivateReview:true,expectedSourceSha256:pin('source'),expectedLeftSha256:pin('left'),expectedRightSha256:pin('right')});
 const log={model_version:LOG_VERSION,sha256:comparison.sourceDigest,samples:parseFlightCSV(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(sourceBytes))};
 return {...comparison,log};
}
export function combineChecklistReviews(snapshot,selections,titleChoice){
 if(!Array.isArray(selections)||selections.length!==snapshot.rows.length||!['left','right'].includes(titleChoice))throw Error('Resolve every exact-ID item and choose one whole title explicitly.');
 const chosen=new Map();for(const item of selections){if(!item||Object.keys(item).sort().join(',')!=='choice,id'||typeof item.id!=='string'||chosen.has(item.id)||!['left','right','omit'].includes(item.choice))throw Error('Invalid explicit whole-item decision.');chosen.set(item.id,item.choice);}
 const items=[];for(const row of snapshot.rows){const choice=chosen.get(row.id);if(!choice)throw Error('Item decision missing.');if(choice==='omit')continue;if(!row[choice])throw Error('Selected side absent.');items.push({...row[choice]});}
 // Whole validated item, including its human status, reason and exact row reference.
 // Left original order then right-only IDs, skipping omissions. No field blending,
 // status precedence, source remapping, title concatenation or claimed consensus.
 return checklistReview(snapshot.log,snapshot[titleChoice].title,items);
}
