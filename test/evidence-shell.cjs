'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {reviewHtml,reviewWorker,packageReview,assets,sourceAssets}=require('../scripts/evidence-shell.cjs');
const root=path.resolve(__dirname,'..');let n=0;const test=(label,fn)=>{fn();n++;console.log('PASS evidence shell:',label);};
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('full account-enabled source gains each review entry exactly once',()=>{const out=reviewHtml(html);for(const name of assets.filter(x=>x.endsWith('.js')))assert.equal(out.split(`src="./${name}"`).length-1,1);assert.ok(out.indexOf('src="./research-evidence-entry.js"')>out.indexOf('src="./account.js"'));assert.equal(out.replace(/<script src="\.\/research-evidence[^\n]+<\/script>\n/g,''),html);});
test('invalid or doubled integration anchors fail closed',()=>{assert.throws(()=>reviewHtml('hello'));assert.throws(()=>reviewHtml(reviewHtml(html)));});
test('review cache includes new local assets, not data routes or external widgets',()=>{const out=reviewWorker(worker);for(const a of assets)assert.ok(out.includes(JSON.stringify('./'+a)));assert.ok(!out.includes('research-data/sec'));assert.ok(!out.includes('tradingview.com'));assert.ok(out.includes('-evidence-1'));});
test('existing production shell, backend configuration and source remain untouched',()=>{assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),html);assert.equal(fs.readFileSync(path.join(root,'sw.js'),'utf8'),worker);});
test('package has no repository internals, credentials or user records',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sq-evidence-')),out=path.join(dir,'review');try{packageReview(out);for(const x of ['.env','.git','account-config.json','research-data','node_modules'])assert.ok(!fs.existsSync(path.join(out,x)));assert.ok(fs.readFileSync(path.join(out,'index.html'),'utf8').includes('research-evidence-entry.js'));assert.ok(sourceAssets.every(x=>fs.existsSync(path.join(out,x))));assert.throws(()=>packageReview(out));}finally{fs.rmSync(dir,{recursive:true,force:true});}});
(async()=>{
 let pending=[];const handlers={},reads=[];
 vm.runInNewContext(reviewWorker(worker),{URL,Set,Promise,self:{location:{href:'https://review.fixture.test/sw.js'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting(){},clients:{claim:async()=>{}}},fetch:async()=>{throw Error('offline')},caches:{open:async()=>({addAll:async()=>{},put:async()=>{}}),match:async x=>{reads.push(x);return {cached:true}},keys:async()=>[],delete:async()=>{}}});
 for(const a of assets){let promise;handlers.fetch({request:{url:'https://review.fixture.test/'+a,method:'GET'},respondWith:p=>promise=p,waitUntil:p=>pending.push(p)});assert.equal((await promise).cached,true);n++;}
 for(const url of ['https://review.fixture.test/research-data/sec?symbol=AAPL','https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js','https://review.fixture.test/research-evidence.js?apikey=TEST_ONLY']){let intercepted=false;handlers.fetch({request:{url,method:'GET'},respondWith(){intercepted=true},waitUntil(){}});assert.equal(intercepted,false);n++;}
 console.log(`${n} review-shell and offline-allowlist checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
