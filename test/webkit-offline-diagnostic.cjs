// Focused diagnosis, not a Safari certification. No app files are changed.
// Run: node test/webkit-offline-diagnostic.cjs
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..');
const revisions={'10.3.1':'6987d86a380faade5ef050808be8e857de29fdf7','10.3.2':'086c82872db74373977b572aff7a48c64bc4dd59'};
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const bundles={};
for(const [version,revision] of Object.entries(revisions)){
 const manifest=JSON.parse(execFileSync('git',['show',revision+':release-manifest.json'],{encoding:'utf8'})),files=new Map();
 assert.equal(manifest.version,version);
 for(const f of manifest.files){const bytes=execFileSync('git',['show',revision+':'+f.path],{maxBuffer:10*1024*1024});assert.equal(bytes.length,f.bytes);assert.equal(digest(bytes),f.sha256);files.set('/'+f.path,bytes);}
 files.set('/',files.get('/index.html'));bundles[version]=files;
}
const probe='<!doctype html><meta charset="utf-8"><h1>Offline diagnostic probe</h1>';
function worker(kind){
 const install=kind==='cache-only'?"event.waitUntil(caches.open('probe-cache').then(cache=>cache.add('/probe')).then(()=>self.skipWaiting()))":"event.waitUntil(self.skipWaiting())";
 const response=kind==='literal'?"new Response("+JSON.stringify(probe)+",{headers:{'Content-Type':'text/html'}})":"caches.match(event.request)";
 return "self.addEventListener('install',event=>{"+install+"});self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>{if(new URL(event.request.url).pathname==='/probe')event.respondWith("+response+");});";
}
const seed={sq_next_session:JSON.stringify({mode:'manual',ticker:'AAPL',period:'2y',correction:10,price:'100',perf:'20',divisor:'1.5',increment:'1'}),sq_badges_v1011:JSON.stringify({version:1,earned:{first:{at:'2026-10-01T00:00:00Z',mode:'manual',origin:'fixture'}},horizons:[]}),splab_history:JSON.stringify([{id:'offline-fixture',ticker:'AAPL',p:'2y',price:100,perf:20,c:10,divisor:1.5,increment:1,at:'2026-10-01T00:00:00Z',inputMode:'manual',reason:'A synthetic assumption to preserve through the diagnosis.'}]),sq_research_checkins_v1:JSON.stringify({version:1,entries:[]}),'sq_journey_v1:guest:revisit':JSON.stringify({version:1,at:'2026-10-01T00:00:00Z',mode:'manual'})};
const mime=p=>({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(p)]||'text/plain';
async function data(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(seed));}
async function ready(page){await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});}
async function createOrigin(kind){
 let bundle=bundles[kind],count=0;
 const server=http.createServer((req,res)=>{
  count++;const p=new URL(req.url,'http://localhost').pathname;let bytes,type;
  if(bundle){bytes=bundle.get(p);type=mime(p==='/'?'index.html':p);}
  else if(p==='/probe-worker.js'){bytes=worker(kind);type='application/javascript';}
  else if(p==='/probe'){bytes=probe;type='text/html';}
  if(bytes===undefined){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return;}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(bytes);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 async function stop(){if(!server.listening)return;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
 return {origin,stop,get count(){return count;},get listening(){return server.listening;},swap(version){bundle=bundles[version];}};
}
async function setup(browser,kind,server){
 const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});context.setDefaultTimeout(10000);context.setDefaultNavigationTimeout(10000);
 if(bundles[kind])await context.addInitScript(seed=>{
  if(!sessionStorage.getItem('diagnostic-seeded')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('diagnostic-seeded','1');}
  sessionStorage.setItem('strikequests_v9_splash_seen','1');
 },seed);
 const external=[];await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==server.origin){external.push(u.href);return route.abort();}return route.continue();});
 await context.routeWebSocket('**/*',socket=>{external.push(socket.url());socket.close();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.origin+(bundles[kind]?'/':'/probe'));
 if(bundles[kind])await page.waitForSelector('body[data-release="'+kind+'"]');
 else if(kind!=='none')await page.evaluate(()=>navigator.serviceWorker.register('/probe-worker.js'));
 if(kind!=='none'){
  await ready(page);const controlled=await page.reload();assert.equal(controlled.status(),200);assert.equal(controlled.fromServiceWorker(),true,'Online controlled response must come from the worker');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);
 }
 return {context,page,external,errors};
}
async function diagnose(browser,engine,kind,disruption){
 const server=await createOrigin(kind),result={engine,kind,disruption},fixture=await setup(browser,kind,server),{page,context}=fixture;
 try{
  const before=bundles[kind]?await data(page):null;
  result.precondition=await page.evaluate(async()=>({controlled:!!navigator.serviceWorker.controller,cacheNames:await caches.keys()}));
  if(bundles[kind]){
   const cached=await page.evaluate(async()=>{const response=await caches.match('./');return response?await response.text():null;});
   assert.equal(digest(Buffer.from(cached)),digest(bundles[kind].get('/')),'The original page must already be cached');
  }
  if(disruption==='offline-flag')await context.setOffline(true);else await server.stop();
  result.originStillListening=server.listening;const beforeRequests=server.count;
  try{
   const response=await page.reload({waitUntil:'domcontentloaded'});
   if(bundles[kind]){await page.waitForSelector('body[data-release="'+kind+'"]');result.dataPreserved=JSON.stringify(await data(page))===JSON.stringify(before);result.xp=await page.evaluate(()=>sqResearchXp());assert.equal(result.dataPreserved,true);assert.equal(result.xp,150);}
   else assert.equal(await page.locator('h1').innerText(),'Offline diagnostic probe');
   result.navigation={ok:true,status:response.status(),fromServiceWorker:response.fromServiceWorker()};
  }catch(error){result.navigation={ok:false,error:error.message.split('\n')[0]};}
  result.originRequestsDuringDisruption=server.count-beforeRequests;
  assert.deepEqual(fixture.external,[],'No external or provider traffic');
  assert.deepEqual(fixture.errors,[],'No application script errors');
  console.log('OFFLINE_DIAGNOSTIC '+JSON.stringify(result));return result;
 }finally{await context.close();await server.stop();}
}
async function upgradeWithStoppedOrigin(browser,engine){
 const server=await createOrigin('10.3.1'),fixture=await setup(browser,'10.3.1',server),{page,context}=fixture;
 try{
  const before=await data(page);server.swap('10.3.2');
  await page.evaluate(async()=>{const before=navigator.serviceWorker.controller,reg=await navigator.serviceWorker.getRegistration();await reg.update();if(navigator.serviceWorker.controller===before)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker handover timed out')),10000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});});});
  await page.reload();await page.waitForSelector('body[data-release="10.3.2"]');await page.waitForLoadState('networkidle');
  const names=await page.evaluate(()=>caches.keys());assert.deepEqual(names,['strikequests-v10-3-2-research-reflection-20261015-1']);
  assert.deepEqual(await data(page),before);await server.stop();
  const response=await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('body[data-release="10.3.2"]');
  assert.equal(response.fromServiceWorker(),true);assert.equal(response.status(),200);assert.deepEqual(await data(page),before);assert.equal(await page.evaluate(()=>sqResearchXp()),150);
  assert.deepEqual(fixture.external,[]);assert.deepEqual(fixture.errors,[]);
  console.log('ORIGIN_STOPPED_UPGRADE_PASS '+engine+': exact 10.3.1 to 10.3.2 worker transition, old cache removed, new document loaded from worker after origin stopped; fixture data retained. This is server unavailability, not physical Safari offline verification.');
 }finally{await context.close();await server.stop();}
}
(async()=>{
 const results=[];
 console.log('DIAGNOSTIC_ENV '+JSON.stringify({node:process.version,platform:process.platform,playwright:require('playwright/package.json').version,revisions}));
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();console.log('DIAGNOSTIC_BROWSER '+engine+' '+browser.version());
  try{
   for(const disruption of ['offline-flag','origin-stopped'])for(const kind of ['10.3.1','10.3.2','literal','cache-only','none'])results.push(await diagnose(browser,engine,kind,disruption));
   await upgradeWithStoppedOrigin(browser,engine);
  }finally{await browser.close();}
 }
 // This exit status certifies a completed comparative diagnosis, not passing Safari offline behavior.
 assert.equal(results.length,20);
 for(const r of results){
  if(r.kind==='none'){assert.equal(r.navigation.ok,false,'Uncached no-worker negative control must fail');continue;}
  if(r.engine==='webkit'&&r.disruption==='offline-flag'){assert.equal(r.navigation.ok,false);assert.match(r.navigation.error,/WebKit encountered an internal error/);}
  else{assert.equal(r.navigation.ok,true,JSON.stringify(r));assert.equal(r.navigation.status,200);assert.equal(r.navigation.fromServiceWorker,true);}
 }
 for(const engine of ['chromium','webkit'])for(const disruption of ['offline-flag','origin-stopped']){
  const rows=results.filter(r=>r.engine===engine&&r.disruption===disruption&&bundles[r.kind]);assert.equal(rows[0].navigation.ok,rows[1].navigation.ok,'Prior and current release behavior must match');
 }
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results/webkit-offline-diagnostic.json'),JSON.stringify({scope:'comparative diagnosis, not Safari certification',results},null,2));
 console.log('DIAGNOSIS_CONFIRMED: both app releases and minimal literal/cache-only workers fail only under WebKit offline emulation; all worker cases pass when the origin is stopped; Chromium controls pass. No 10.3.2 app regression identified. Safari physical offline behavior remains unverified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
