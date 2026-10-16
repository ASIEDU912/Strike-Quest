// Report existing legacy fixture failures without treating them as layout regressions.
// These suites execute index.html only. Compare the same tests against released and proposed code.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),ref='8686df40b6f84fde919ed544c4f0a65af4b82971';
const files=['index.html','test/dom-harness.cjs','test/data-integrity.cjs','test/research-guidance.cjs'],temp=fs.mkdtempSync(path.join(os.tmpdir(),'sq-legacy-baseline-'));
try{
 for(const file of files){const before=execFileSync('git',['show',ref+':'+file],{cwd:root}),after=fs.readFileSync(path.join(root,file));if(files.slice(2).includes(file))assert.ok(before.equals(after),file+' test cases must remain unchanged');fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.writeFileSync(path.join(temp,file),before);}
 for(const file of files.slice(2)){
  const a=spawnSync(process.execPath,[file],{cwd:temp,encoding:'utf8'}),b=spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8'});
  const signature=r=>(r.stdout+'\n'+r.stderr).split('\n').filter(x=>/^(FAIL |TypeError:|AssertionError|[0-9]+ .*failed)/.test(x));
  assert.equal(b.status,a.status,file+' baseline exit');assert.deepEqual(signature(b),signature(a),file+' baseline failure names');
  console.log('KNOWN_BASELINE_FAILURE '+JSON.stringify({file,baseline:ref,status:b.status,signature:signature(b)}));
 }
 console.log('LEGACY_BASELINE_COMPARISON_COMPLETE: unchanged test cases and identical pre-existing fixture failures; this is not a passing legacy-suite claim.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

