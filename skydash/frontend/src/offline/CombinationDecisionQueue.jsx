import {useState} from 'react';
const field='mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2',button='rounded border border-zinc-700 px-3 py-2 disabled:opacity-40',size=10;
export default function CombinationDecisionQueue({label,listLabel,rows,choices,children}){
 const[mode,setMode]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const matching=rows.map((row,index)=>({row,index})).filter(({row})=>{
  const choice=choices.get(row.id);
  return row.id.includes(query)&&(mode==='all'||mode==='unresolved'&&!choice||mode==='changed'&&(row.conflict??row.kind==='changed')||mode==='selected'&&(choice==='left'||choice==='right')||mode==='omitted'&&choice==='omit');
 });
 const pages=Math.max(1,Math.ceil(matching.length/size)),current=Math.min(page,pages-1),start=current*size;
 return <section aria-label={label+' decision queue'} className="mt-3 rounded border border-cyan-800 p-3">
  <h4 className="font-semibold text-cyan-200">Focus decision rows</h4>
  <p className="mt-2">View only. Hidden IDs still require decisions; the whole title or summary remains separate. Filters and pages do not change choices, private consent or a prepared candidate. Counts are not completion or agreement. Bulk selection above still covers all IDs, not this view.</p>
  <div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Decision view<select aria-label={label+' decision view'} value={mode} className={field} onChange={e=>{setMode(e.target.value);setPage(0);}}><option value="all">All IDs</option><option value="unresolved">Unresolved IDs</option><option value="changed">Same-ID field disagreements</option><option value="selected">Chosen left or right</option><option value="omitted">Explicitly omitted IDs</option></select></label><label>Find ID, case-sensitive substring<input type="search" aria-label={label+' decision ID filter'} value={query} maxLength={80} autoComplete="off" spellCheck={false} className={field} onChange={e=>{setQuery(e.target.value);setPage(0);}} /></label></div>
  <p aria-live="polite" className="mt-3">Showing {matching.length?start+1:0}-{Math.min(start+size,matching.length)} of {matching.length} matching IDs; {rows.length} total IDs. Page {current+1} of {pages}. Existing row labels and comparison order retained.</p>
  <div className="mt-2 flex flex-wrap gap-2"><button type="button" aria-label={label+' previous decision page'} className={button} disabled={current===0} onClick={()=>setPage(current-1)}>Previous10</button><button type="button" aria-label={label+' next decision page'} className={button} disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next10</button><button type="button" className={button} onClick={()=>{setMode('all');setQuery('');setPage(0);}}>Reset decision view</button></div>
  {matching.length===0&&<p className="mt-3">No IDs match this view. Hidden choices and unresolved IDs elsewhere are unchanged. This is not evidence of agreement or completion.</p>}
  <ol key={mode+'-'+query+'-'+current} aria-label={listLabel} className="mt-3 max-h-[65svh] space-y-3 overflow-y-auto">{matching.slice(start,start+size).map(({row,index})=>children(row,index))}</ol>
 </section>;
}
