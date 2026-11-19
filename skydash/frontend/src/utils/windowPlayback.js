import { reviewWindow } from './reviewWindow';
export const WINDOW_PLAYBACK_VERSION='skydash-window-playback-v1';
export function windowPlaybackRange(log,first,last,label,repeat=false){
 if(typeof repeat!=='boolean')throw new Error('Choose explicit one-pass or repeat playback.');
 const reviewed=reviewWindow(log,first,last,label,'');
 if(reviewed.endS<=reviewed.startS)throw new Error('Window playback needs at least two different original sample timestamps. Single-row windows can still be inspected and reported.');
 return {first,last,label:reviewed.label,start:reviewed.startS,end:reviewed.endS,repeat};
}
export function advanceWindowPlayback(time,delta,range){
 if(!Number.isFinite(time)||!Number.isFinite(delta)||delta<0||!range||!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.end<=range.start||typeof range.repeat!=='boolean')throw new Error('Invalid bounded replay clock.');
 // Show the original last endpoint for one timer tick before an explicit repeat.
 // Never skip over the endpoint or change the source timestamps.
 if(time>=range.end)return range.repeat?range.start:range.end;
 return Math.min(range.end,Math.max(range.start,time)+delta);
}
