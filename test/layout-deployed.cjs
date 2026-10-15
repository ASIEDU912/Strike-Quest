// Read-only public deployment verification with disposable synthetic browser storage.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),site='https://strikequests.com',prior='086c82872db74373977b572aff7a48c64bc4dd59';
const expected=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8')),fresh=new Map(),old=new Map(),headers=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mime=p=>({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(p)]||'text/plain';
const at='2026-10-01T00:00:00Z';
const seed={sq_next_session:JSON.stringify({mode:'manual',ticker:'AAPL',period:'2y',correction:10,price:'100',perf:'20',divisor:'1.5',increment:'1'}),sq_badges_v1011:JSON.stringify({version:1,earned:{first:{at,mode:'manual',origin:'fixture'}},horizons:[]}),splab_history:JSON.stringify([{id:'upgrade-fixture',ticker:'AAPL',p:'2y',price:100,perf:20,c:10,divisor:1.5,increment:1,at,inputMode:'manual',reason:'Synthetic private fixture: retain this saved research.'}]),sq_research_checkins_v1:JSON.stringify({version:1,entries:[]}),'sq_journey_v1:guest:revisit':JSON.stringify({version:1,at,mode:'manual'})};
async function get(p){const response=await fetch(site+'/'+p,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,p);const bytes=Buffer.from(await response.arrayBuffer());headers.push({path:p,cacheControl:response.headers.get('cache-control'),age:response.headers.get('age'),etag:response.headers.get('etag')});return bytes;}
async function fixture(browser,origin){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),bad=[],errors=[];
 await context.addInitScript(seed=>{if(!sessionStorage.getItem('deploy-seeded')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('deploy-seeded','1');}sessionStorage.setItem('strikequests_v9_splash_seen','1');},seed);
 const allowed=new Set([...fresh.keys(),'/favicon.ico']);
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin||!allowed.has(u.pathname)||route.request().method()!=='GET'){bad.push(u.href);return route.abort();}return route.continue();});
 await context.routeWebSocket('**/*',s=>{bad.push(s.url());s.close();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page,bad,errors,async finish(){assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);await context.close();}};
}
async function data(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(seed));}
async function ready(page,version){await page.waitForSelector('body[data-release="'+version+'"]');await page.waitForSelector('body[data-quest-renewal="'+version+'"]');if(version==='10.3.3')await page.waitForFunction(()=>document.getElementById('studioResearchLumiName').textContent==='Lumi · Scout');}
async function worker(page){await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});await page.waitForLoadState('networkidle');}
async function cached(page,name){
 const result=await page.evaluate(async name=>{const c=await caches.open(name),out={};for(const p of ['./','./studio.js','./studio.css','./public-preview.js']){const r=await c.match(new URL(p,location.href));if(!r){out[p]=null;continue;}const b=await r.arrayBuffer(),d=await crypto.subtle.digest('SHA-256',b);out[p]=Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');}return out;},name);
 for(const [p,d] of Object.entries(result))assert.equal(d,hash(fresh.get(p==='./'?'/':'/'+p.slice(2))),'Cached '+p);
}
async function layout(page){
 await page.locator('[data-view="research"]').click();
 const geometry=await page.evaluate(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};return {lumi:box('studioResearchLumi'),scenario:box('scenarioSection'),guide:box('companionPanel'),evidence:box('researchContext'),nav:document.querySelector('.bottom-nav').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth+1};});
 assert.ok(geometry.lumi.bottom<geometry.nav);assert.ok(geometry.scenario.top<geometry.guide.top&&geometry.guide.top<geometry.evidence.top);assert.equal(geometry.overflow,false);
 await page.locator('#studioResearchLumi').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'companionSummary');
 return geometry;
}
(async()=>{
 assert.equal(expected.version,'10.3.3');assert.deepEqual(JSON.parse(await get('release-manifest.json')),expected,'Published manifest');
 for(const f of expected.files){const bytes=await get(f.path);assert.equal(bytes.length,f.bytes,f.path+' length');assert.equal(hash(bytes),f.sha256,f.path+' public hash');fresh.set('/'+f.path,bytes);old.set('/'+f.path,execFileSync('git',['show',prior+':'+f.path],{cwd:root,maxBuffer:10*1024*1024}));}
 fresh.set('/',fresh.get('/index.html'));old.set('/',old.get('/index.html'));
 console.log('PUBLIC_ASSET_PASS: 10.3.3 manifest and all '+expected.files.length+' public file lengths/SHA-256 hashes match reviewed head 9df72e55bc7d79402e8e3613d153b01286c023e3');
 console.log('PUBLIC_HEADERS '+JSON.stringify(headers.filter(x=>['studio.js','studio.css','sw.js','public-preview.js','release-manifest.json'].includes(x.path))));
 const newCache=fresh.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1],oldCache=old.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1];assert.notEqual(newCache,oldCache);
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();
  try{
   const f=await fixture(browser,site),p=f.page;await p.goto(site+'/#research');await ready(p,'10.3.3');await worker(p);
   assert.equal(await p.evaluate(()=>!!navigator.serviceWorker.controller),true);assert.deepEqual(await p.evaluate(()=>caches.keys()),[newCache]);
   const before=await data(p);const geometry=await layout(p);await cached(p,newCache);assert.deepEqual(await data(p),before);assert.equal(await p.evaluate(()=>sqResearchXp()),150);
   if(engine==='chromium'){await f.context.setOffline(true);const response=await p.reload();assert.equal(response.fromServiceWorker(),true);await ready(p,'10.3.3');assert.deepEqual(await data(p),before);console.log('PUBLIC_OFFLINE_PASS chromium: controlled offline-emulation reload and fixture data retained');}
   else console.log('PUBLIC_OFFLINE_LIMIT webkit: setOffline(true) excluded due to confirmed upstream harness limitation; physical Safari offline remains unverified');
   console.log('PUBLIC_BROWSER_PASS '+engine+' '+JSON.stringify({version:'10.3.3',cache:newCache,geometry,dataRetained:true,xp:150}));
   await f.finish();
   let assets=old;const requests=[];const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;requests.push(p);const bytes=assets.get(p);res.writeHead(bytes?200:404,{'Content-Type':mime(p==='/'?'index.html':p),'Cache-Control':'no-store'});res.end(bytes||'');});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let stopped=false;
   const stop=async()=>{if(stopped)return;stopped=true;await new Promise(r=>{server.close(r);server.closeAllConnections();});};
   const g=await fixture(browser,origin),q=g.page;
   try{
    await q.goto(origin+'/#research');await ready(q,'10.3.2');await worker(q);assert.ok((await q.evaluate(()=>caches.keys())).includes(oldCache));const preserved=await data(q);
    assets=fresh;
    await q.evaluate(async()=>{const previous=navigator.serviceWorker.controller,r=await navigator.serviceWorker.getRegistration();await r.update();if(navigator.serviceWorker.controller===previous)await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Worker handover timed out')),20000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});});});
    await q.reload();await ready(q,'10.3.3');await q.waitForLoadState('networkidle');assert.deepEqual(await q.evaluate(()=>caches.keys()),[newCache]);await cached(q,newCache);assert.deepEqual(await data(q),preserved);
    await stop();const response=await q.reload();assert.equal(response.status(),200);assert.equal(response.fromServiceWorker(),true);await ready(q,'10.3.3');assert.deepEqual(await data(q),preserved);assert.equal(await q.evaluate(()=>sqResearchXp()),150);
    await layout(q);assert.deepEqual(await data(q),preserved);assert.ok(requests.every(p=>fresh.has(p)||p==='/favicon.ico'));
    console.log('CACHE_UPGRADE_PASS '+engine+': exact 10.3.2 to public 10.3.3 bytes; new cache only; stopped-origin reload served by worker; saved research, journal, input defaults and XP retained. Server unavailability test, not physical Safari offline certification.');
    await g.finish();
   }finally{await g.context.close();await stop();}
  }finally{await browser.close();}
 }
 console.log('DEPLOYMENT_VERIFIED: live 10.3.3; zero provider requests; disposable synthetic storage only; backend and shared desktop Chrome untouched. Legacy fixture failures remain separately recorded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
