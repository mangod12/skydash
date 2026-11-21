import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const script=fileURLToPath(new URL('../scripts/check-bundle-size.mjs',import.meta.url));
const folders=[];
function run(chunks,override){
 const cwd=mkdtempSync(join(tmpdir(),'skydash-size-guard-'));folders.push(cwd);mkdirSync(join(cwd,'dist/assets'),{recursive:true});
 for(const[name,bytes]of Object.entries(chunks))writeFileSync(join(cwd,'dist/assets',name),randomBytes(bytes));
 const env={...process.env};delete env.BUNDLE_BUDGET_KB;if(override!==undefined)env.BUNDLE_BUDGET_KB=String(override);
 return spawnSync(process.execPath,[script],{cwd,env,encoding:'utf8'});
}
afterEach(()=>{for(const path of folders.splice(0))rmSync(path,{recursive:true,force:true});});
describe('total JavaScript gzip guard',()=>{
 it('allows the narrow755KiB total cap rather than the historical750KiB',()=>{
  const result=run({'index.js':753*1024});expect(result.status).toBe(0);expect(result.stdout).toContain('budget 755 kB');
 });
 it('still counts every lazy JavaScript chunk and fails above the cap',()=>{
  const result=run({'index.js':400*1024,'ScenarioLabView.js':356*1024,'ignored.css':1000});expect(result.status).toBe(1);expect(result.stderr).toContain('Bundle size budget exceeded');expect(result.stdout).toContain('ScenarioLabView.js');
 });
 it('keeps an explicit smaller environment limit effective',()=>{
  const result=run({'index.js':2*1024},1);expect(result.status).toBe(1);expect(result.stdout).toContain('budget 1 kB');
 });
});
