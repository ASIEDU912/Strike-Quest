const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
function worker({ok=true,offline=false}={}){
  const handlers={},writes=[],pending=[];
  const response={ok,clone(){return this}};
  const cached={cached:true};
  vm.runInNewContext(code,{URL,Set,Promise,
    self:{location:{href:'https://strikequests.com/sw.js'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>{},clients:{claim:()=>Promise.resolve()}},
    caches:{open:async()=>({put:async(...args)=>writes.push(args),addAll:async()=>{}}),match:async()=>cached,keys:async()=>[],delete:async()=>{}},
    fetch:async()=>{if(offline)throw Error('offline');return response;}
  });
  return {writes,async request(url,method='GET'){
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
  w=worker();assert.equal((await w.request('https://strikequests.com/index.html','POST')).intercepted,false);count++;
  console.log(`${count} service-worker cache checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
