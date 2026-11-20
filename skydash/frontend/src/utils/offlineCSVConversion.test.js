import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { mkdtemp,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { createHash,webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { convertMappedCSV,readMappingCSV } from './csvColumnMapping';
import { exportMappingRecipe } from './mappingRecipe';
let dir,original,recipe,converted,raw,mapping,recipeText,result;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(...args)=>spawnSync(process.execPath,['scripts/verify-csv-conversion.mjs',...args],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',timeout:20000});
const check=()=>run(original,recipe,converted,'--confirm-wgs84');
const fail=r=>{expect(r.status).toBe(1);expect(r.stdout).toBe('');expect(r.stderr).not.toContain('PRIVATE');};
beforeEach(async()=>{
 vi.stubGlobal('crypto',webcrypto);dir=await mkdtemp(join(tmpdir(),'skydash-lineage-'));original=join(dir,'PRIVATE-original.csv');recipe=join(dir,'PRIVATE-recipe.json');converted=join(dir,'PRIVATE-converted.csv');raw='\ufeffclock,lat,lon,height,speed,battery,PRIVATE-extra\r\n1000,28.6,77.2,100,36,95,PRIVATE-value\r\n3000,28.61,77.21,,0,0,PRIVATE-second\r\n';mapping={columns:{time_s:0,latitude:1,longitude:2,altitude_m:3,ground_speed_m_s:4,battery_pct:5},timeUnit:'ms',timeOrigin:'subtract-first',altitudeUnit:'ft',speedUnit:'km/h',coordinateReference:'WGS84-decimal-degrees'};recipeText=exportMappingRecipe(readMappingCSV(raw).headers,mapping,'PRIVATE recipe label');result=await convertMappedCSV(raw,'PRIVATE-original.csv',mapping);await writeFile(original,raw);await writeFile(recipe,recipeText);await writeFile(converted,result.csv_text);
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});});
it('reproduces actual app conversion with BOM/CRLF/ms origin/feet/kmh/blanks/zeros and excludes every private value or write',async()=>{
 const files=await readdir(dir),r=check();expect(r.status,r.stderr).toBe(0);const data=JSON.parse(r.stdout);expect(data.exact_original_sha256).toBe(hash(Buffer.from(raw)));expect(data.exact_recipe_sha256).toBe(hash(Buffer.from(recipeText)));expect(data.exact_converted_sha256).toBe(result.sha256);expect(data.converted_samples).toBe(2);expect(data.source_coordinate_confirmation_supplied).toBe(true);for(const secret of ['PRIVATE','28.6','77.2','30.48'])expect(r.stdout).not.toContain(secret);expect(await readdir(dir)).toEqual(files);expect(await readFile(original,'utf8')).toBe(raw);expect(await readFile(converted,'utf8')).toBe(result.csv_text);
});
it.each(['changed-converted','formatting','bad-model','header-order','bad-recipe','invalid-original','invalid-utf8','oversize'])('rejects %s before a success receipt without private error echo',async kind=>{
 const cases={'changed-converted':[converted,result.csv_text.replace('30.48','30.49')],formatting:[converted,result.csv_text+'\n'],'bad-model':[recipe,recipeText.replace('skydash-csv-column-map-v1','future')],'header-order':[original,raw.replace('clock,lat,lon','clock,lon,lat')],'bad-recipe':[recipe,recipeText.replace('"timeUnit": "ms"','"timeUnit": "unknown"')],'invalid-original':[original,raw.replace('3000,28.61','1000,28.61')],'invalid-utf8':[original,Buffer.from([0xff])],oversize:[recipe,'x'.repeat(65537)]};await writeFile(...cases[kind]);fail(check());
});
it('requires fresh explicit coordinate confirmation, cannot import it from a recipe and rejects unknown/extra inputs',async()=>{
 expect(run('--help').status).toBe(0);for(const args of [[],[original,recipe,converted],[original,recipe,converted,'--trust-recipe'],[original,recipe,converted,'--confirm-wgs84','extra'],[dir,recipe,converted,'--confirm-wgs84']])fail(run(...args));const data=JSON.parse(recipeText);data.configuration.coordinateReference='WGS84-decimal-degrees';await writeFile(recipe,JSON.stringify(data));fail(check());
});
it('reproduces explicit unknown optional channels without filling them and binds recipe byte differences separately',async()=>{
 mapping.columns.altitude_m=null;mapping.columns.ground_speed_m_s=null;mapping.columns.battery_pct=null;result=await convertMappedCSV(raw,'source.csv',mapping);recipeText=exportMappingRecipe(readMappingCSV(raw).headers,mapping,'PRIVATE no channels');await writeFile(converted,result.csv_text);await writeFile(recipe,recipeText+'\n');const r=check();expect(r.status,r.stderr).toBe(0);const data=JSON.parse(r.stdout);expect(data.exact_recipe_sha256).toBe(hash(Buffer.from(recipeText+'\n')));expect(result.samples[0].altitude_m).toBeNull();expect(result.samples[0].ground_speed_m_s).toBeNull();expect(result.samples[0].battery_pct).toBeNull();
});
