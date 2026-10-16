'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const site='https://strikequests.com';
const log=(label,value)=>console.log(label+' '+JSON.stringify(value));
async function get(url){try{const r=await fetch(url,{headers:{Accept:'application/json',Origin:site},signal:AbortSignal.timeout(20000)});const text=await r.text();let body=null;try{body=JSON.parse(text)}catch{}return {status:r.status,body,bytes:Buffer.byteLength(text),hash:crypto.createHash('sha256').update(text).digest('hex'),cors:r.headers.get('access-control-allow-origin')};}catch(e){return {status:null,error:e.cause?.code||e.name};}}
(async()=>{
 const local=JSON.parse(fs.readFileSync('config.json','utf8')),live=await get(site+'/config.json'),manifest=await get(site+'/release-manifest.json');
 log('PUBLIC_CONFIG',{status:live.status,marketDataApi:live.body?.marketDataApi,marketDataMode:live.body?.marketDataMode,matchesSource:JSON.stringify(live.body)===JSON.stringify(local),sha256:live.hash,publicVersion:manifest.body?.version});
 assert.equal(live.status,200);assert.deepEqual(live.body,local);
 const base=String(local.marketDataApi).replace(/\/+$/,'');assert.equal(base,'https://strikequests-market-data.strikequests.workers.dev');
 const health=await get(base+'/health'),h=health.body||{},b=h.dailyProviderBudget||{};
 log('HEALTH',{status:health.status,networkError:health.error,cors:health.cors,ok:h.ok,version:h.version,cacheConfigured:h.cacheConfigured,providerConfigured:h.providerConfigured,dailyProviderBudget:{used:b.used,max:b.max,dateKeyUTC:b.dateKeyUTC},keys:Object.keys(h)});
 if(health.status!==200||h.ok!==true||h.cacheConfigured!==true||h.providerConfigured!==true){log('BLOCKED',{reason:'Health cannot establish the configured shared service. No market request made.'});return;}
 if(!Number.isFinite(b.used)||!Number.isFinite(b.max)||b.max-b.used<3){log('BLOCKED',{reason:'Fewer than 3 known provider budget units remain. No market request made.'});return;}
 const market=await get(base+'/v1/market?symbol=AAPL'),m=market.body||{};
 const safeCode=v=>typeof v==='string'&&/^[A-Za-z0-9_ .:-]{1,100}$/.test(v)?v:undefined;
 log('MARKET',{status:market.status,networkError:market.error,cors:market.cors,ok:m.ok,symbol:m.symbol,code:safeCode(m.code),providerHint:safeCode(m.providerHint),providerStage:safeCode(m.providerStage),providerStatus:m.providerStatus,cache:m.cache,source:m.source,fetchedAt:m.fetchedAt,keys:Object.keys(m)});
 if(market.status!==200||m.ok!==true){log('BLOCKED',{reason:'Single bounded existing-endpoint check failed. No retry or configuration changes.'});return;}
 for(const name of ['daily','weekly','monthly']){const a=m[name];assert.ok(Array.isArray(a)&&a.length>0,name);const sorted=[...a].sort((a,b)=>String(a.date).localeCompare(String(b.date)));const invalid=a.filter(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Number(r.close))||Number(r.close)<=0);log('HISTORY',{name,rows:a.length,firstDate:sorted[0].date,lastDate:sorted.at(-1).date,invalid:invalid.length});assert.equal(invalid.length,0);}
 assert.equal(m.symbol,'AAPL');log('READ_ONLY_PROBE_COMPLETE',{note:'One public AAPL request only. Success does not establish redistribution permission, app consumption, <=15-minute data, or full release readiness.'});
})().catch(e=>{console.error('PROBE_ERROR '+e.message);process.exitCode=1;});
