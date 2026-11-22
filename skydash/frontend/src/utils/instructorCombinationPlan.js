const FORMAT='skydash-instructor-combination-plan-v1',MAX=32*1024,roles=['source','left','right'];
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function instructorCombinationPlan(snapshot,selections,summaryChoice){
 if(!snapshot||!Array.isArray(snapshot.rows)||snapshot.rows.length>200||!sameKeys(snapshot.digests,roles)||roles.some(role=>!/^[a-f0-9]{64}$/.test(snapshot.digests[role])))throw Error('Checked original snapshot required.');
 if(!Array.isArray(selections)||selections.length!==snapshot.rows.length||!['','left','right','empty'].includes(summaryChoice))throw Error('Invalid progress decisions.');
 const byId=new Map();for(const item of selections){if(!sameKeys(item,['id','choice'])||typeof item.id!=='string'||byId.has(item.id)||!['','left','right','omit'].includes(item.choice))throw Error('Invalid annotation decision.');byId.set(item.id,item.choice);}
 const choices=snapshot.rows.map(row=>{if(!byId.has(row.id))throw Error('Missing exact annotation ID.');const choice=byId.get(row.id);if(['left','right'].includes(choice)&&!row[choice])throw Error('Selected side is absent.');return {id:row.id,choice};});
 const plan={format:FORMAT,originals:{...snapshot.digests},choices,summary_choice:summaryChoice};if(new Blob([JSON.stringify(plan,null,2)]).size>MAX)throw Error('Decision plan exceeds32KiB.');return plan;
}
export function readInstructorCombinationPlan(text,snapshot){
 if(typeof text!=='string'||new Blob([text]).size>MAX)throw Error('Decision plan must be at most32KiB.');let plan;try{plan=JSON.parse(text);}catch{throw Error('Invalid decision JSON.');}
 if(!sameKeys(plan,['format','originals','choices','summary_choice'])||plan.format!==FORMAT||!sameKeys(plan.originals,roles)||roles.some(role=>plan.originals[role]!==snapshot.digests[role]))throw Error('Plan requires exact original source, left and right bytes in the same roles.');
 return instructorCombinationPlan(snapshot,plan.choices,plan.summary_choice);
}
