/* Owner-authorized release composition. Creates an immutable candidate, never updates refs. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const MAIN='c93002aeef7c352458ebce441bd630154fb33dd0',REVIEW='f41e22927160ce53481b579fd9a53ea9af043593',BASE='87784e445a84bf9a9cbf0bc63a35d6b03468f997',REPO='ASIEDU912/Strike-Quest';
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}),bytes=(ref,file)=>cp.execFileSync('git',['show',ref+':'+file]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function once(s,a,b){assert.equal(s.split(a).length,2,'Unique release anchor: '+a.slice(0,80));return s.replace(a,b);}
const out=path.resolve('production-candidate');
(async()=>{
 assert.equal(process.env.GITHUB_REPOSITORY,REPO);assert.equal(process.env.GITHUB_REF,'refs/heads/feat/research-studio');
 async function api(endpoint,body){assert.ok(!body||['/git/blobs','/git/trees','/git/commits'].includes(endpoint));const r=await fetch('https://api.github.com/repos/'+REPO+endpoint,{method:body?'POST':'GET',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Repository request '+r.status);return r.json();}
 assert.equal((await api('')).private,false);assert.equal((await api('/git/ref/heads/main')).object.sha,MAIN);assert.equal((await api('/git/ref/heads/feat/research-studio')).object.sha,process.env.GITHUB_SHA);
 assert.equal(fs.existsSync(out),false);fs.mkdirSync(out);
 const manifest=JSON.parse(bytes(MAIN,'release-manifest.json'));
 for(const item of manifest.files){assert.ok(!item.path.includes('..')&&!path.isAbsolute(item.path));const b=bytes(MAIN,item.path);assert.equal(hash(b),item.sha256,'Verified public baseline '+item.path);const p=path.join(out,item.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);}
 for(const f of ['mascot.css','studio.css','account.js','account-core.js'])assert.ok(bytes(MAIN,f).equals(bytes(BASE,f)),f+' has concurrent production edits');
 const publicTail=['research-evidence-core.js','research-evidence.js','research-evidence-entry.js','public-preview.js'].map(f=>`<script src="./${f}"></script>\n`).join('');
 assert.equal(bytes(MAIN,'index.html').toString().replace(publicTail,''),bytes(REVIEW,'index.html').toString());
 fs.writeFileSync(path.join(out,'mascot.js'),bytes(REVIEW,'mascot.js'));
 let studio=bytes(REVIEW,'studio.js').toString();
 studio=studio.replaceAll('10.2.0-review.2','10.3.0').replaceAll('10.3.0-quest-review.1','10.3.0');
 studio=studio.replaceAll('REVIEW BUILD','GUEST RELEASE').replaceAll('Research Studio · Review','Quest Renewal · 10.3').replaceAll('REVIEW ·','RELEASED ·');
 studio=once(studio,'This is a review build, not a production release. Optional development accounts are under review.','This guest release includes Quest Renewal. Live account sign-in, recovery and cloud sync remain unavailable.');
 studio=once(studio,'You are exploring a review build. These changes are not published to the live site.','Quest Renewal is live: ten Lumi stages, research badges and quicker scenario tools. Accounts remain unavailable until real sign-in and recovery are verified.');
 studio=studio.replaceAll(' · review build · hypothetical scenarios',' · guest release · hypothetical scenarios');
 fs.writeFileSync(path.join(out,'studio.js'),studio);
 let html=bytes(MAIN,'index.html').toString();
 html=once(html,'let state={period:"2y",mode:"demo",correction:10','let state={period:"2y",mode:"auto_eod",correction:10');
 html=once(html,"state.mode=['demo','manual','auto_eod'].includes(saved?.mode)?saved.mode:'demo';","state.mode=['demo','manual','auto_eod'].includes(saved?.mode)?saved.mode:'auto_eod';");
 fs.writeFileSync(path.join(out,'index.html'),html);
 let sw=bytes(MAIN,'sw.js').toString();assert.match(sw,/^const CACHE='[^']+';/);sw=sw.replace(/^const CACHE='[^']+';/,"const CACHE='strikequests-v10-3-quest-renewal-20261015-1';");fs.writeFileSync(path.join(out,'sw.js'),sw);
 let pub=bytes(MAIN,'public-preview.js').toString().replaceAll('10.2.0-preview.2','10.3.0').replaceAll('Research Studio · Preview 10.2','Quest Renewal · 10.3').replace('Public preview: continue as guest.','Continue as guest.');fs.writeFileSync(path.join(out,'public-preview.js'),pub);
 const changed=['index.html','studio.js','mascot.js','sw.js','public-preview.js'];
 manifest.version='10.3.0';manifest.sourceCommit=REVIEW;manifest.preparationCommit=process.env.GITHUB_SHA;manifest.previousPublicCommit=MAIN;manifest.rollbackCommit=MAIN;manifest.rollbackBranch='rollback/pre-quest-renewal-2026-10-15';manifest.audience='public guest release';manifest.defaultDataMode='Automatic EOD on a new device; saved explicit Manual/Demo/EOD choices preserved';manifest.expeditionSync='new expedition badges remain device-local; not cloud-synced';manifest.physicalIphoneVerified=false;manifest.realAccountVerified=false;
 for(const item of manifest.files){const b=fs.readFileSync(path.join(out,item.path));item.bytes=b.length;item.sha256=hash(b);if(!changed.includes(item.path))assert.ok(b.equals(bytes(MAIN,item.path)),'Protected production asset '+item.path);}
 fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const current=await api('/git/commits/'+MAIN),tree=[];
 for(const f of [...changed,'release-manifest.json']){const blob=await api('/git/blobs',{content:fs.readFileSync(path.join(out,f),'utf8'),encoding:'utf-8'});tree.push({path:f,mode:'100644',type:'blob',sha:blob.sha});}
 const t=await api('/git/trees',{base_tree:current.tree.sha,tree});const c=await api('/git/commits',{message:'Release Quest Renewal 10.3 with verified Automatic EOD default',tree:t.sha,parents:[MAIN]});
 const result={candidate:c.sha,tree:t.sha,main:MAIN,review:REVIEW,preparation:process.env.GITHUB_SHA,changed:[...changed,'release-manifest.json'],published:false};
 fs.writeFileSync('production-candidate.json',JSON.stringify(result));console.log('PRODUCTION_CANDIDATE '+JSON.stringify(result));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'candidate='+c.sha+'\n');
 try{const r=await fetch('https://strikequests-market-data.strikequests.workers.dev/',{signal:AbortSignal.timeout(15000)});const text=await r.text();console.log('BACKEND_ROOT',JSON.stringify({status:r.status,body:text.slice(0,2000)}));}catch(e){console.log('BACKEND_ROOT_UNAVAILABLE',e.name);}
})().catch(e=>{console.error(e.message);process.exitCode=1});
