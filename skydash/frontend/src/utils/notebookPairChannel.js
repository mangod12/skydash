import {compareNotebookCopies} from './notebookCopyComparison';
import {selectedWindowChannelReport} from './selectedWindowChannelChart';
export function notebookPairChannelReport(log,entries,aId,bId,channel){
 const pair=compareNotebookCopies(log,entries,aId,bId);
 return ['SKYDASH / TWO SAVED-COPY CHANNEL EVIDENCE','Two independently bounded selections from the same exact CSV, not independent flights, synchronized events or paired measurements. Each uses its own original seconds and selected-only axes. Do not compare plot shapes/scales as improvement, grades or readiness. Overlap rows repeat in both sides. No combined duration or totals.',...[["A",pair.a],["B",pair.b]].flatMap(([name,side])=>[`SIDE ${name} / notebook position ${side.ordinal}`,selectedWindowChannelReport(log,side.entry.first_row-1,side.entry.last_row-1,channel),''])].join('\n');
}
