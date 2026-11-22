const FORMAT='skydash-checklist-combination-plan-v1',MAX=32*1024,roles=['source','left','right'];
const digests=snapshot=>Object.fromEntries(roles.map(role=>[role,snapshot?.[role+'Digest']]));
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function checklistCombinationPlan(snapshot,selections,titleChoice){
 if(!snapshot||!Array.isArray(snapshot.rows)||snapshot.rows.length>60||new Set(snapshot.rows.map(row=>row.id)).size!==snapshot.rows.length||snapshot.rows.some(row=>typeof row.id!=='string'||row.id.length>80||!(/^[a-zA-Z0-9_-]+$/).test(row.id)||(!row.left&&!row.right))||!sameKeys(digests(snapshot),roles)||roles.some(role=>!/^[a-f0-9]{64}$/.test(digests(snapshot)[role])))throw Error('Checked original snapshot required.');
 if(!Array.isArray(selections)||selections.length!==snapshot.rows.length||!['','left','right'].includes(titleChoice))throw Error('Invalid progress decisions.');
 const byId=new Map();for(const item of selections){if(!sameKeys(item,['id','choice'])||typeof item.id!=='string'||byId.has(item.id)||!['','left','right','omit'].includes(item.choice))throw Error('Invalid item decision.');byId.set(item.id,item.choice);}
 const choices=snapshot.rows.map(row=>{if(!byId.has(row.id))throw Error('Missing exact item ID.');const choice=byId.get(row.id);if(['left','right'].includes(choice)&&!row[choice])throw Error('Selected side is absent.');return {id:row.id,choice};});
 const plan={format:FORMAT,originals:{...digests(snapshot)},choices,title_choice:titleChoice};if(new Blob([JSON.stringify(plan,null,2)]).size>MAX)throw Error('Decision plan exceeds32KiB.');return plan;
}
export function readChecklistCombinationPlan(text,snapshot){
 if(typeof text!=='string'||new Blob([text]).size>MAX)throw Error('Decision plan must be at most32KiB.');let plan;try{plan=JSON.parse(text);}catch{throw Error('Invalid decision JSON.');}
 if(!sameKeys(plan,['format','originals','choices','title_choice'])||plan.format!==FORMAT||!sameKeys(plan.originals,roles)||roles.some(role=>plan.originals[role]!==digests(snapshot)[role]))throw Error('Plan requires exact original source, left and right bytes in the same roles.');
 return checklistCombinationPlan(snapshot,plan.choices,plan.title_choice);
}
