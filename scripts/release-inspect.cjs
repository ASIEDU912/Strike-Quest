/* Read-only release configuration and public SEC-source verification. No provider keys. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo='ASIEDU912/Strike-Quest',out=path.resolve('release-inspection');fs.mkdirSync(out,{recursive:true});
async function api(pathname){const r=await fetch('https://api.github.com/repos/'+repo+pathname,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'}});if(!r.ok)return {error:'HTTP_'+r.status};return r.json();}
(async()=>{
 if(process.env.GITHUB_REPOSITORY!==repo||process.env.GITHUB_REF!=='refs/heads/feat/research-studio')throw Error('Review-only inspection context required');
 const metadata=await api(''),main=await api('/git/ref/heads/main'),rollback=await api('/git/ref/heads/rollback/pre-evidence-release-2026-10-14'),pages=await api('/pages');
 const report={source:process.env.GITHUB_SHA,private:metadata.private,main:main.object?.sha,rollback:rollback.object?.sha,pages:{error:pages.error||null,status:pages.status||null,buildType:pages.build_type||null,source:pages.source||null,url:pages.html_url||null,cname:pages.cname||null,httpsEnforced:pages.https_enforced??null},publishedFiles:[],sec:[]};
 if(metadata.private!==false)throw Error('Free standard-runner public-repository check failed');
 if(!/^https:\/\/(strikequests\.com|asiedu912\.github\.io\/Strike-Quest)\/?$/i.test(pages.html_url||''))throw Error('Unexpected or unavailable Pages URL; no site guessed');
 for(const file of ['index.html','sw.js','config.json']){const r=await fetch(new URL(file,pages.html_url.endsWith('/')?pages.html_url:pages.html_url+'/'),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});const text=await r.text();report.publishedFiles.push({file,status:r.status,sha256:crypto.createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)});}
 // A SEC declared-bot contact is needed for fair access. Reuse only the owner-author
 // contact already in this authorized commit event, never output or publish it.
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const contact=event.sender?.login==='ASIEDU912'?event.head_commit?.author?.email:'';
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(contact||''))report.sec.push({status:'CONTACT_SETUP_REQUIRED'});
 else {
  const service=require('./sec-research.cjs').createSecService({userAgent:'StrikeQuests public research ('+contact+')'});
  const dir=path.join(out,'sec');fs.mkdirSync(dir,{recursive:true});
  for(const symbol of ['AAPL','MSFT','NVDA','AMZN','GOOGL','TSLA']){try{const data=await service.load(symbol);if(!data.model.period)throw Error('ANNUAL_FACTS_UNAVAILABLE');const bytes=JSON.stringify({...data,delivery:'dated-public-snapshot',releaseSource:process.env.GITHUB_SHA});fs.writeFileSync(path.join(dir,symbol+'.json'),bytes);report.sec.push({symbol,status:'verified',entity:data.model.entityName,cik:data.model.cik,period:data.model.period,source:data.source,bytes:Buffer.byteLength(bytes),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}catch(e){report.sec.push({symbol,status:String(e.message).replace(/[^A-Z0-9_]/g,'').slice(0,80)});if(['SEC_ACCESS_LIMITED','SEC_RATE_LIMITED'].includes(e.message))break;}}
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('RELEASE_INSPECTION '+JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
