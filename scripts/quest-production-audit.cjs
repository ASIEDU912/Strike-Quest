'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const main='c93002aeef7c352458ebce441bd630154fb33dd0',base='87784e445a84bf9a9cbf0bc63a35d6b03468f997';
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'});
const read=(ref,f)=>git('show',ref+':'+f);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const repo=process.env.GITHUB_REPOSITORY;
 if(repo!=='ASIEDU912/Strike-Quest'||process.env.GITHUB_REF!=='refs/heads/feat/research-studio')throw Error('Wrong context');
 console.log('AUDIT_REFS',JSON.stringify({main,review:git('rev-parse','HEAD').trim(),base}));
 const all=git('ls-tree','-r','--name-only','HEAD').trim().split('\n');
 console.log('BACKEND_PATHS',JSON.stringify(all.filter(x=>/worker|backend|public|production|release|verify/i.test(x))));
 for(const f of ['index.html','studio.js','mascot.js','mascot.css','studio.css','account.js','account-core.js','research-evidence.js','research-evidence-entry.js','sw.js']){
  const a=read(main,f),b=read(base,f);console.log('BASE_COMPARISON',JSON.stringify({f,same:a===b,mainBytes:Buffer.byteLength(a),baseBytes:Buffer.byteLength(b)}));
  if(a!==b){const lines=git('diff','--unified=3',base,main,'--',f).split('\n');console.log('MAIN_DELTA',f+'\n'+lines.slice(0,90).join('\n'));}
 }
 const h=read(main,'index.html');
 for(const name of ['sqFetch','loadPublicConfig','maybeAutoLoadEod','fetchSharedMarket','fetchData','providerPreference','sqInitNext']){
  const i=h.indexOf('function '+name+'(');if(i<0){console.log('FUNCTION_MISSING',name);continue;}
  const next=h.indexOf('\nfunction ',i+10),asyncNext=h.indexOf('\nasync function ',i+10);const end=Math.min(...[next,asyncNext,i+5000].filter(x=>x>i));console.log('AUDIT_FUNCTION',h.slice(i,end));
 }
 for(const [name,url]of [['public-index','https://strikequests.com/'],['public-config','https://strikequests.com/config.json'],['health','https://strikequests-market-data.strikequests.workers.dev/health']]){
  try{const r=await fetch(url,{headers:{Origin:'https://strikequests.com'},signal:AbortSignal.timeout(20000)});const text=await r.text();console.log('PUBLIC_HTTP',JSON.stringify({name,status:r.status,finalOrigin:new URL(r.url).origin,bytes:Buffer.byteLength(text),sha256:hash(text),...(name==='health'?{body:JSON.parse(text)}:{matchesMain:text===read(main,name==='public-index'?'index.html':'config.json')})}));}catch(e){console.log('PUBLIC_HTTP_ERROR',name,e.name);}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
