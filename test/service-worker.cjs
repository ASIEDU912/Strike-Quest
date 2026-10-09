const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
function worker({ok=true,offline=false}={}){
  const handlers={},writes=[],reads=[],pending=[];
  const response={ok,clone(){return this}};
  const cached={cached:true};
  vm.runInNewContext(code,{URL,Set,Promise,
    self:{location:{href:'https://strikequests.com/sw.js'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>{},clients:{claim:()=>Promise.resolve()}},
    caches:{open:async()=>({put:async(...args)=>writes.push(args),addAll:async()=>{}}),match:async key=>{reads.push(key);return cached},keys:async()=>[],delete:async()=>{}},
    fetch:async()=>{if(offline)throw Error('offline');return response;}
  });
  return {writes,reads,async request(url,method='GET'){
    let promise;handlers.fetch({request:{url,method},respondWith:p=>promise=p,waitUntil:p=>pending.push(p)});
    const result=await promise;await Promise.all(pending);return {intercepted:!!promise,result};
  }};
}
(async()=>{
  let count=0;
  for(const url of ['https://www.alphavantage.co/query?apikey=TEST_ONLY','https://ondemand.websol.barchart.com/getQuoteEod.json?apikey=TEST_ONLY','https://strikequests.com/index.html?apikey=TEST_ONLY','https://strikequests-market-data.strikequests.workers.dev/v1/market?symbol=AAPL','https://strikequests.com/config.json?ts=123']){
    const w=worker();assert.equal((await w.request(url)).intercepted,false);assert.equal(w.writes.length,0);count++;
  }
  let w=worker();assert.equal((await w.request('https://strikequests.com/index.html')).intercepted,true);assert.equal(w.writes.length,1);count++;
  w=worker({ok:false});await w.request('https://strikequests.com/index.html');assert.equal(w.writes.length,0);count++;
  w=worker({offline:true});assert.equal((await w.request('https://strikequests.com/index.html')).result.cached,true);count++;
  for(const url of ['https://strikequests.com/#research','https://strikequests.com/index.html#saved','https://strikequests.com/studio.js','https://strikequests.com/studio.css','https://strikequests.com/account-core.js','https://strikequests.com/account.js','https://strikequests.com/account.css','https://strikequests.com/vendor/supabase.js']){
    w=worker({offline:true});const r=await w.request(url);assert.equal(r.intercepted,true);assert.equal(r.result.cached,true);count++;
  }
  w=worker();await w.request('https://strikequests.com/index.html#research');assert.equal(w.writes[0][0],'https://strikequests.com/index.html');count++;
  w=worker();assert.equal((await w.request('https://strikequests.com/index.html?apikey=TEST_ONLY#research')).intercepted,false);assert.equal(w.writes.length,0);count++;
  w=worker();assert.equal((await w.request('https://strikequests.com/index.html','POST')).intercepted,false);count++;
  // Navigation fragments are view state, never additional cache keys. Keep query
  // strings intact when checking the allowlist so credentials cannot enter it.
  for(const page of ['','index.html'])for(const view of ['home','research','watchlist','saved','quests']){
    const key='https://strikequests.com/'+page,url=key+'#'+view;
    w=worker({offline:true});const result=await w.request(url);
    assert.equal(result.intercepted,true,'offline view '+url);assert.equal(result.result.cached,true);
    assert.deepEqual(w.reads,[key]);assert.equal(w.writes.length,0);count++;
    w=worker();assert.equal((await w.request(url)).intercepted,true);
    assert.equal(w.writes.length,1);assert.equal(w.writes[0][0],key);count++;
  }
  for(const url of ['https://strikequests.com/index.html?apikey=TEST_ONLY#research','https://strikequests.com/config.json?ts=123#home','https://strikequests.com/private.json#saved','https://other.fixture.test/index.html#home','https://strikequests-market-data.strikequests.workers.dev/v1/market?symbol=AAPL#research','https://strikequests.com/account-config.json','https://vjxroixeqhtswzgqfcpk.supabase.co/auth/v1/user','https://vjxroixeqhtswzgqfcpk.supabase.co/rest/v1/sq_sync_records','https://strikequests.com/?code=SYNTHETIC_AUTH_CODE']){
    w=worker({offline:true});assert.equal((await w.request(url)).intercepted,false);assert.deepEqual(w.writes,[]);assert.deepEqual(w.reads,[]);count++;
  }
  w=worker();assert.equal((await w.request('https://strikequests.com/#research','POST')).intercepted,false);count++;
  console.log(`${count} service-worker cache checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
