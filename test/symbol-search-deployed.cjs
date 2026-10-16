// Read-only production verification in disposable synthetic browser contexts.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),base='8686df40b6f84fde919ed544c4f0a65af4b82971',origin='https://symbol-search.fixture.test';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8')),version=manifest.version;
const prior=new Map(),current=new Map();
for(const f of manifest.files){
 const b=fs.readFileSync(path.join(root,f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256,f.path);
 current.set('/'+f.path,b);prior.set('/'+f.path,execFileSync('git',['show',base+':'+f.path],{cwd:root,maxBuffer:10*1024*1024}));
}
current.set('/',current.get('/index.html'));prior.set('/',prior.get('/index.html'));
const mime=p=>({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(p==='/'?'index.html':p)]||'text/plain';
const at='2026-10-01T12:00:00Z',idea={id:'search-idea',ticker:'XLK',p:'2y',price:190.43,perf:76.93,c:10,divisor:1.5,increment:1,at,inputMode:'manual',reason:'Synthetic private research for symbol discovery verification.'};
const entry={id:'search-checkin',originalId:idea.id,original:{...idea,period:'2y',correction:10},current:{...idea,period:'2y',correction:10},reason:'Synthetic private reflection: retain the original research.',thinking:'uncertain',evidence:'assumptions',observation:'',createdAt:at};
const seed={sq_next_session:JSON.stringify({mode:'manual',ticker:'XLK',period:'2y',correction:10,price:'190.43',perf:'76.93',divisor:'1.5',increment:'1'}),splab_history:JSON.stringify([idea]),sq_research_checkins_v1:JSON.stringify({version:1,entries:[entry]}),sq_badges_v1011:JSON.stringify({version:1,earned:{first:{at,mode:'manual',origin:'fixture'}},horizons:[]}),sq_progress:JSON.stringify({earned:{first:{at}}}),'sq_journey_v1:guest:revisit':JSON.stringify({version:1,at,mode:'manual'})};
async function retained(page){return page.evaluate(keys=>({xp:sqResearchXp(),storage:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))}),Object.keys(seed).filter(k=>k!=='sq_next_session'));}
async function seedContext(context){await context.addInitScript(seed=>{if(!sessionStorage.getItem('search-seeded')){for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('search-seeded','1');}sessionStorage.setItem('strikequests_v9_splash_seen','1');},seed);}
async function ready(p,v=version){await p.waitForSelector('body[data-quest-renewal="'+v+'"]');await p.waitForFunction(()=>document.getElementById('studioResearchLumiName').textContent==='Lumi · Scout');}
async function geometry(p){return p.evaluate(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};};return {ticker:box('ticker'),picks:box('quickPicks'),lumi:box('studioResearchLumi'),scenario:box('scenarioSection'),guide:box('companionPanel'),evidence:box('researchContext'),quality:box('dataQuality'),inside:document.getElementById('studioInstrument').contains(document.getElementById('quickPicks')),overflow:document.documentElement.scrollWidth>innerWidth+1};});}
let imageBytes=0;
async function image(p,name){const b=await p.screenshot({type:'jpeg',quality:58,animations:'disabled'});imageBytes+=b.length;assert.ok(imageBytes<700000);console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}));const s=b.toString('base64');for(let i=0;i<s.length;i+=160)console.log('SQ_IMAGE_DATA '+s.slice(i,i+160));console.log('SQ_IMAGE_END '+name);}
async function cacheUpgrade(browser,engine){
 let files=prior,stopped=false;const unexpected=[],server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,b=files.get(p);if(!b&&p!=='/favicon.ico')unexpected.push(p);res.writeHead(b?200:404,{'Content-Type':mime(p),'Cache-Control':'no-store'});res.end(b||'');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const host='http://127.0.0.1:'+server.address().port;
 const stop=async()=>{if(stopped)return;stopped=true;await new Promise(r=>{server.close(r);server.closeAllConnections();});};
 const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});await seedContext(c);
 await c.route('**/*',r=>new URL(r.request().url()).origin===host?r.continue():(unexpected.push(r.request().url()),r.abort()));await c.routeWebSocket('**/*',s=>{unexpected.push(s.url());s.close();});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(host+'/#research');await ready(p,'10.3.3');await p.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  await p.waitForLoadState('networkidle');const before=await retained(p),inputs=await p.evaluate(()=>localStorage.getItem('sq_next_session'));files=current;
  await p.evaluate(async()=>{const previous=navigator.serviceWorker.controller,r=await navigator.serviceWorker.getRegistration();await r.update();if(navigator.serviceWorker.controller===previous)await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Worker handover timed out')),20000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});});});
  await p.reload();await ready(p);await p.waitForLoadState('networkidle');const key=current.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1];assert.deepEqual(await p.evaluate(()=>caches.keys()),[key]);assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_next_session')),inputs);
  await stop();assert.equal((await p.reload()).fromServiceWorker(),true);await ready(p);assert.deepEqual(await retained(p),before);
  await p.locator('#ticker').fill('aap');await p.locator('[role="option"][data-symbol="AAPL"]').waitFor();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.equal(await p.locator('#ticker').inputValue(),'AAPL');assert.equal(await p.evaluate(()=>sqResearchXp()),150);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('SEARCH_CACHE_UPGRADE_PASS '+engine+': 10.3.3 to '+version+'; old cache removed, nonempty saved/journal data and XP retained; local suggestions work with server stopped. Physical Safari offline not verified.');
 }finally{await c.close();await stop();}
}
const site='https://strikequests.com',sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
async function publicGet(file){
 const r=await fetch(site+'/'+file,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,file);return Buffer.from(await r.arrayBuffer());
}
async function verifyWorker(page){
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 await page.waitForLoadState('networkidle');
 const key=current.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1];
 assert.deepEqual(await page.evaluate(()=>caches.keys()),[key]);
 const cached=await page.evaluate(async key=>{const c=await caches.open(key),out={};for(const file of ['./','./studio.js','./studio.css','./public-preview.js']){const r=await c.match(new URL(file,location.href));if(!r){out[file]=null;continue;}const bytes=await r.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);out[file]=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}return out;},key);
 for(const [file,digest]of Object.entries(cached))assert.equal(digest,sha256(current.get(file==='./'?'/':'/'+file.slice(2))),file+' cached public bytes');
 return key;
}
async function publicBrowser(browser,engine){
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'allow'}),blocked=[],errors=[];
 await seedContext(c);
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==site||(!current.has(u.pathname)&&u.pathname!=='/favicon.ico')||r.request().method()!=='GET'){blocked.push(u.href);return r.abort();}return r.continue();});
 await c.routeWebSocket('**/*',s=>{blocked.push(s.url());s.close();});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(site+'/#research');await ready(p);const key=await verifyWorker(p),before=await retained(p),inputs=await p.evaluate(()=>localStorage.getItem('sq_next_session')),g=await geometry(p);
  assert.equal(g.inside,true);assert.equal(g.overflow,false);assert.ok(g.picks.top<g.scenario.top&&g.scenario.top<g.guide.top&&g.guide.top<g.evidence.top);assert.ok(g.lumi.bottom<(await p.locator('.bottom-nav').boundingBox()).y);
  assert.equal(await p.locator('#ticker').getAttribute('role'),'combobox');assert.equal(await p.evaluate(()=>LOCAL_SYMBOLS.length),50);
  assert.equal(await p.locator('#correction').inputValue(),'10');assert.equal(await p.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');
  await p.locator('#studioResearchLumi').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'companionSummary');assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_next_session')),inputs);
  await p.locator('#ticker').fill('aap');await p.locator('[role="option"][data-symbol="AAPL"]').waitFor();assert.equal(await p.locator('#tickerSuggestions .suggest-mark svg').count(),1);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.equal(await p.locator('#ticker').inputValue(),'AAPL');
  await p.locator('#ticker').fill('microsoft');await p.locator('[role="option"][data-symbol="MSFT"]').tap();await p.waitForFunction(()=>document.getElementById('ticker').value==='MSFT',null,{timeout:3000});
  await p.locator('#ticker').fill('');await p.locator('#ticker').evaluate(e=>{e.value='aap';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});assert.equal(await p.locator('[role="option"]').count(),0);await p.locator('#ticker').dispatchEvent('compositionend');await p.locator('[role="option"][data-symbol="AAPL"]').tap();await p.waitForFunction(()=>document.getElementById('ticker').value==='AAPL',null,{timeout:3000});
  await p.locator('#ticker').fill('spdr');await p.keyboard.press('ArrowDown');await p.keyboard.press('Escape');assert.equal(await p.locator('[role="option"]').count(),0);assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'false');
  await p.locator('#ticker').fill('TESTX');assert.equal(await p.locator('[role="option"]').count(),0);assert.match(await p.locator('#tickerSearchHelp').innerText(),/No local match/);await p.locator('#price').fill('100');await p.locator('#perf').fill('20');await p.locator('#analyzeBtn').click();assert.equal(await p.locator('#ticker').inputValue(),'TESTX');assert.equal(await p.locator('#price').inputValue(),'100');
  await p.locator('#quickPicks [data-quick="XLK"]').tap();await p.waitForFunction(()=>document.getElementById('ticker').value==='XLK');assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'false');assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>sqResearchXp()),150);
  const working=await p.evaluate(()=>localStorage.getItem('sq_next_session'));
  if(engine==='chromium'){await c.setOffline(true);assert.equal((await p.reload()).fromServiceWorker(),true);await ready(p);assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_next_session')),working);console.log('PUBLIC_OFFLINE_PASS chromium: public worker reload retained working session, saved journal and XP');}
  else console.log('PUBLIC_OFFLINE_LIMIT webkit: pinned setOffline(true) limitation remains; physical Safari offline unverified');
  await p.locator('#ticker').fill('aap');await p.locator('[role="option"][data-symbol="AAPL"]').waitFor();if(engine==='chromium')await image(p,'public-search-10.3.4-390.jpg');
  assert.deepEqual(await retained(p),before);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  console.log('PUBLIC_SEARCH_PASS '+JSON.stringify({engine,version,cache:key,geometry:g,checks:'actual public layout, 50 local symbols, keyboard/touch/composition, Escape, direct Manual ticker Analyze, Quick Picks, 2y/10%, original saved research/nonempty journal/150 XP retained; zero provider requests'}));
 }finally{await c.close();}
}
(async()=>{
 assert.equal(version,'10.3.4');assert.equal(manifest.rollbackCommit,base);
 assert.deepEqual(JSON.parse(await publicGet('release-manifest.json')),manifest);
 for(const f of manifest.files){const b=await publicGet(f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(sha256(b),f.sha256,f.path);current.set('/'+f.path,b);}
 current.set('/',current.get('/index.html'));
 console.log('PUBLIC_ASSET_PASS: live 10.3.4 manifest and all '+manifest.files.length+' asset lengths/SHA-256 hashes match reviewed 6d4f2075a9938b54366fd5907d055e29e902da0c; rollback '+base);
 for(const [engine,type]of Object.entries({chromium,webkit})){const browser=await type.launch();try{await publicBrowser(browser,engine);await cacheUpgrade(browser,engine);}finally{await browser.close();}}
 console.log('PUBLIC_DEPLOYMENT_VERIFIED: live 10.3.4; actual public search and layout; upgrade from 10.3.3 using downloaded public bytes; synthetic browser records only, no backend changes or provider calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
