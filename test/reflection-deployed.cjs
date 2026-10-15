// Post-release verification: public static assets and synthetic browser storage only.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),site='https://strikequests.com',prior='6987d86a380faade5ef050808be8e857de29fdf7';
const expected=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mime=p=>({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(p)]||'text/plain';
const fresh=new Map(),old=new Map(),headers=[];
const seed={sq_next_session:JSON.stringify({mode:'manual',ticker:'AAPL',period:'2y',correction:10,price:'100',perf:'20',divisor:'1.5',increment:'1'}),sq_badges_v1011:JSON.stringify({version:1,earned:{first:{at:'2026-10-01T00:00:00Z',mode:'manual',origin:'fixture'}},horizons:[]}),splab_history:JSON.stringify([{id:'upgrade-fixture',ticker:'AAPL',p:'2y',price:100,perf:20,c:10,divisor:1.5,increment:1,at:'2026-10-01T00:00:00Z',inputMode:'manual',reason:'Synthetic private fixture: retain this saved research.'}]),sq_research_checkins_v1:JSON.stringify({version:1,entries:[]}),'sq_journey_v1:guest:revisit':JSON.stringify({version:1,at:'2026-10-01T00:00:00Z',mode:'manual'})};
async function get(p){
 const res=await fetch(site+'/'+p,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});
 assert.equal(res.status,200,p+' HTTP status');
 const bytes=Buffer.from(await res.arrayBuffer());headers.push({path:p,cacheControl:res.headers.get('cache-control'),age:res.headers.get('age'),etag:res.headers.get('etag'),type:res.headers.get('content-type')});
 return bytes;
}
async function seedContext(context){
 await context.addInitScript(seed=>{
  if(!sessionStorage.getItem('upgrade-seeded')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('upgrade-seeded','1');}
  sessionStorage.setItem('strikequests_v9_splash_seen','1');
 },seed);
}
async function snapshot(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(seed));}
async function protect(context,allowedOrigin,paths){
 const bad=[];
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==allowedOrigin||!(paths.has(u.pathname)||u.pathname==='/favicon.ico')||route.request().method()!=='GET'){bad.push(u.href);return route.abort();}return route.continue();});
 await context.routeWebSocket('**/*',s=>{bad.push(s.url());s.close();});
 return bad;
}
async function ready(page,version){await page.waitForSelector('body[data-release="'+version+'"]');await page.waitForSelector('body[data-quest-renewal="'+version+'"]');}
async function swReady(page){
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
}
async function cacheReport(page){
 return page.evaluate(async()=>{const names=await caches.keys(),entries={};for(const name of names){const cache=await caches.open(name);entries[name]=(await cache.keys()).map(r=>new URL(r.url).pathname);}return {names,entries,controlled:!!navigator.serviceWorker.controller};});
}
async function exactCache(page,cacheName){
 return page.evaluate(async({cacheName,paths})=>{
  const cache=await caches.open(cacheName),result={};
  for(const p of paths){const response=await cache.match(new URL(p,location.href));if(!response){result[p]=null;continue;}
   const buffer=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',buffer);
   result[p]=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }return result;
 },{cacheName,paths:['./studio.js','./sw.js','./public-preview.js','./']});
}
async function main(){
 assert.equal(expected.version,'10.3.2');
 const manifest=await get('release-manifest.json');assert.deepEqual(JSON.parse(manifest),expected,'Public manifest must match the reviewed release');
 fresh.set('/release-manifest.json',manifest);
 for(const file of expected.files){
  const bytes=await get(file.path);assert.equal(bytes.length,file.bytes,file.path+' bytes');assert.equal(hash(bytes),file.sha256,file.path+' public SHA-256');fresh.set('/'+file.path,bytes);
  old.set('/'+file.path,execFileSync('git',['show',prior+':'+file.path],{maxBuffer:10*1024*1024}));
 }
 fresh.set('/',fresh.get('/index.html'));old.set('/',old.get('/index.html'));
 const newCache=fresh.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1],oldCache=old.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1];
 assert.notEqual(newCache,oldCache);
 assert.equal(hash(fresh.get('/studio.js')),hash(fs.readFileSync(path.join(root,'studio.js'))));
 console.log('PUBLIC_ASSET_PASS: manifest version 10.3.2 and all '+expected.files.length+' deployed asset bytes/hashes match the reviewed release');
 console.log('PUBLIC_CACHE_HEADERS '+JSON.stringify(headers.filter(x=>['studio.js','sw.js','public-preview.js','release-manifest.json'].includes(x.path))));
 let assets=old;
 const requests=[];
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;requests.push(p);const bytes=assets.get(p);if(!bytes){res.writeHead(404,{'Content-Type':'text/plain'});res.end('');return;}res.writeHead(200,{'Content-Type':mime(p==='/'?'index.html':p),'Cache-Control':'no-store'});res.end(bytes);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const local='http://127.0.0.1:'+server.address().port;
 try{
  for(const [engine,type] of Object.entries({chromium,webkit})){
   const browser=await type.launch();
   try{
    // Use real public hosting with a disposable seeded Manual workspace and real SW.
    const live=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    await seedContext(live);const liveBad=await protect(live,site,new Set(fresh.keys())),liveErrors=[];
    const p=await live.newPage();p.on('pageerror',e=>liveErrors.push(e.message));await p.goto(site+'/');await ready(p,'10.3.2');await swReady(p);
    await p.locator('[data-view="saved"]').click();assert.equal(await p.locator('#questCheckinRewardButton').isDisabled(),true);
    assert.equal(await p.locator('#questCheckinRewardButton').innerText(),'Thoughtful Return earned');
    const baseline=await snapshot(p),report=await cacheReport(p);
    assert.equal(report.controlled,true);assert.ok(report.names.includes(newCache));
    const cached=await exactCache(p,newCache);
    for(const key of ['./studio.js','./public-preview.js','./'])assert.equal(cached[key],hash(fresh.get(key==='./'?'/':'/'+key.slice(2))),'Live cached '+key);
    await live.setOffline(true);await p.reload();await ready(p,'10.3.2');assert.deepEqual(await snapshot(p),baseline);assert.equal(await p.evaluate(()=>sqResearchXp()),150);
    assert.deepEqual(liveBad,[]);assert.deepEqual(liveErrors,[]);
    console.log('PUBLIC_BROWSER_PASS '+engine+': public 10.3.2, real controlling service worker '+newCache+', reviewed assets cached, offline reload and fixture records retained');
    await live.close();
    // Real SW transition using the exact previous commit and byte-verified public files.
    assets=old;
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
    await seedContext(context);const bad=await protect(context,local,new Set(fresh.keys())),errors=[];
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(local+'/');await ready(page,'10.3.1');await swReady(page);
    await page.waitForFunction(async oldCache=>(await caches.keys()).includes(oldCache),oldCache);
    const before=await snapshot(page);assert.equal(await page.evaluate(()=>sqResearchXp()),150);
    assets=fresh;
    await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await page.waitForFunction(async({oldCache,newCache})=>{const names=await caches.keys();return names.includes(newCache)&&!names.includes(oldCache);},{oldCache,newCache});
    await page.reload();await ready(page,'10.3.2');assert.deepEqual(await snapshot(page),before);
    const after=await cacheReport(page);assert.deepEqual(after.names,[newCache]);assert.equal(after.controlled,true);
    const upgraded=await exactCache(page,newCache);
    for(const key of ['./studio.js','./public-preview.js','./'])assert.equal(upgraded[key],hash(fresh.get(key==='./'?'/':'/'+key.slice(2))),'Upgraded cached '+key);
    await context.setOffline(true);await page.reload();await ready(page,'10.3.2');assert.deepEqual(await snapshot(page),before);assert.equal(await page.evaluate(()=>sqResearchXp()),150);
    assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);
    console.log('CACHE_UPGRADE_PASS '+engine+': actual 10.3.1 worker replaced by deployed 10.3.2 bytes; old cache removed; new shell works offline; saved analyses, journal, XP and inputs unchanged');
    await context.close();
   }finally{await browser.close();}
  }
  const allowed=new Set([...fresh.keys(),'/favicon.ico']);assert.ok(requests.every(p=>allowed.has(p)),'Local fixture requested only static app-shell assets');
  console.log('DEPLOYMENT_VERIFIED: zero provider requests, no real accounts or user records, shared Chrome untouched; live EOD was not tested');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
