const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const createHarness=require('./dom-harness.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const equal=(actual,expected)=>assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
let passed=0;
async function test(name,fn){
  const page=createHarness(html);
  // Let the deliberately blocked startup config request finish before fixtures.
  await page.evaluate(async()=>{await Promise.resolve();await Promise.resolve();state.mode='auto_eod';state.extra={};state.demoRaw=null;state.dataMeta=null;setPeriod('1y');});
  await fn(page);passed++;console.log('PASS',name);
}
async function fixture(page){await page.evaluate(()=>{
  state.sharedApiReady=true;state.sharedApiBase='https://api.test';
  window.pending=[];window.fetch=url=>new Promise(resolve=>pending.push({url:String(url),resolve}));
  window.release=(index,price,{cache='hit',fail=false}={})=>{
    const rows=[{date:'2020-01-01',close:price-30,high:price-20,low:price-40},{date:'2026-10-01',close:price,high:price+1,low:price-1}];
    pending[index].resolve({ok:!fail,status:fail?502:200,json:async()=>fail?{ok:false,error:'Synthetic provider unavailable'}:{ok:true,symbol:new URL(pending[index].url).searchParams.get('symbol'),daily:rows,weekly:rows,monthly:rows,source:'Fixture',cache,fetchedAt:Date.now()}});
  };
})}
(async()=>{
 await test('Automatic mode selects shared service without browser keys',async p=>{
   await fixture(p);const x=await p.evaluate(()=>({pref:providerPreference(),provider:activeProvider(),key:localStorage.getItem('sq_alpha_key')}));
   equal(x,{pref:'shared',provider:'shared',key:null});
 });
 await test('shared Quick Pick initiates a market request without a key',async p=>{
   await fixture(p);assert.equal(await p.evaluate(()=>{applySymbol('AAPL');return pending.length}),1);
 });
 await test('shared response race preserves newest ticker, raw cache and snapshot',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{
     document.getElementById('ticker').value='AAPL';const old=fetchData();
     document.getElementById('ticker').value='MSFT';const current=fetchData();
     release(1,400);await current;release(0,200);await old;
     return {price:document.getElementById('price').value,oldRaw:getAlphaRaw('AAPL'),newRaw:getAlphaRaw('MSFT').daily.at(-1).close,cache:readEodCache()['MSFT|1y'].price};
   });equal(x,{price:'400.00',oldRaw:null,newRaw:400,cache:400});
 });
 await test('shared repeated ticker request keeps newest data',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{
     document.getElementById('ticker').value='AAPL';const old=fetchData(),current=fetchData();release(1,400);await current;release(0,200);await old;
     return {price:document.getElementById('price').value,raw:getAlphaRaw('AAPL').daily.at(-1).close};
   });equal(x,{price:'400.00',raw:400});
 });
 await test('late shared errors do not overwrite status or start owner fallback',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{
     localStorage.setItem('sq_provider_pref','auto');localStorage.setItem('sq_alpha_key','TEST_ONLY');
     document.getElementById('ticker').value='AAPL';const old=fetchData();
     document.getElementById('ticker').value='MSFT';const current=fetchData();release(1,400);await current;
     const currentStatus=document.getElementById('status').textContent;release(0,0,{fail:true});await old;
     return {same:currentStatus===document.getElementById('status').textContent,calls:pending.length};
   });equal(x,{same:true,calls:2});
 });
 await test('saved/manual values survive pending shared success',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{
     const old=fetchData();localStorage.setItem('splab_history',JSON.stringify([{id:'saved',ticker:'AAPL',p:'2y',price:125,perf:20,divisor:3.5,correction:12}]));loadSaved('saved');release(0,400);await old;
     return {mode:state.mode,price:document.getElementById('price').value,divisor:Number(document.getElementById('divisor').value),raw:getAlphaRaw('AAPL')};
   });equal(x,{mode:'manual',price:'125.00',divisor:3.5,raw:null});
 });
 await test('shared horizon change prevents old data/cache writes',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{document.getElementById('price').value='123';const old=fetchData();setPeriod('3m');release(0,400);await old;return {price:document.getElementById('price').value,cache:Object.keys(readEodCache()).length};});
   equal(x,{price:'123',cache:0});
 });
 await test('explicit provider change invalidates pending shared result',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{document.getElementById('price').value='123';const old=fetchData();localStorage.setItem('sq_provider_pref','alpha');release(0,400);await old;return document.getElementById('price').value});assert.equal(x,'123');
 });
 await test('shared provider errors retain saved snapshot with visible warning',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{const first=fetchData();release(0,222);await first;const second=fetchData();release(1,0,{fail:true});await second;return {price:document.getElementById('price').value,status:document.getElementById('status').textContent};});
   assert.equal(x.price,'222.00');assert.match(x.status,/last cached EOD snapshot/);
 });
 await test('stale shared snapshots remain visibly marked',async p=>{
   await fixture(p);const x=await p.evaluate(async()=>{const first=fetchData();release(0,222,{cache:'stale'});await first;return {status:document.getElementById('status').textContent,className:document.getElementById('status').className}});
   assert.match(x.status,/stale-safe/);assert.match(x.className,/warn/);
 });
 await test('health requires actual cache and provider configuration',async p=>{
   const x=await p.evaluate(async()=>{window.fetch=async u=>({ok:true,json:async()=>String(u).includes('config.json')?{marketDataApi:'https://api.test'}:{ok:true,cacheConfigured:true,providerConfigured:false}});await loadPublicConfig();return state.sharedApiReady});assert.equal(x,false);
 });
 await test('configured health connects shared service',async p=>{
   const x=await p.evaluate(async()=>{window.fetch=async u=>({ok:true,json:async()=>String(u).includes('config.json')?{marketDataApi:'https://api.test'}:{ok:true,cacheConfigured:true,providerConfigured:true}});await loadPublicConfig();return state.sharedApiReady});assert.equal(x,true);
 });
 console.log(`${passed} shared-service checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
