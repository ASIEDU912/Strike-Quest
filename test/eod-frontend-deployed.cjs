// Isolated browser verification: local suggestions, original-release diagnosis and preserved state.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),base='e064c08f154de8a2c516f96ac2eb8fa28aef1f6c',origin='https://eod-connection.fixture.test';
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
  await p.goto(host+'/#research');await ready(p,'10.3.4');await p.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  await p.waitForLoadState('networkidle');const before=await retained(p),inputs=await p.evaluate(()=>localStorage.getItem('sq_next_session'));files=current;
  await p.evaluate(async()=>{const previous=navigator.serviceWorker.controller,r=await navigator.serviceWorker.getRegistration();await r.update();if(navigator.serviceWorker.controller===previous)await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Worker handover timed out')),20000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});});});
  await p.reload();await ready(p);await p.waitForLoadState('networkidle');const key=current.get('/sw.js').toString().match(/const CACHE='([^']+)'/)[1];assert.deepEqual(await p.evaluate(()=>caches.keys()),[key]);assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_next_session')),inputs);
  await stop();assert.equal((await p.reload()).fromServiceWorker(),true);await ready(p);assert.deepEqual(await retained(p),before);
  await p.locator('#ticker').fill('aap');await p.locator('[role="option"][data-symbol="AAPL"]').waitFor();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.equal(await p.locator('#ticker').inputValue(),'AAPL');assert.equal(await p.evaluate(()=>sqResearchXp()),150);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('EOD_CACHE_UPGRADE_PASS '+engine+': 10.3.4 to '+version+'; old cache removed, nonempty saved/journal data and XP retained; local suggestions work with server stopped. Physical Safari offline not verified.');
 }finally{await c.close();await stop();}
}

const site='https://strikequests.com',service='https://strikequests-market-data.strikequests.workers.dev';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function publicGet(file){const r=await fetch(site+'/'+file,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,file);return Buffer.from(await r.arrayBuffer());}
async function productionFlow(browser,engine){
 const c=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});await seedContext(c);
 const external=[],errors=[],calls={health:0,market:0};let healthy=false;
 await c.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.origin===service&&u.pathname==='/health'){calls.health++;return r.fulfill({status:healthy?200:503,json:{ok:true,cacheConfigured:true,providerConfigured:true}});}
  if(u.origin===service&&u.pathname==='/v1/market'){calls.market++;return r.fulfill({status:502,json:{ok:false,code:'PROVIDER',providerHint:'UNKNOWN',providerStage:'daily',providerStatus:200}});}
  if(u.origin===site&&r.request().method()==='GET'&&(current.has(u.pathname)||u.pathname==='/favicon.ico'))return r.continue();
  external.push(u.origin+u.pathname);return r.abort();
 });
 await c.routeWebSocket('**/*',s=>{external.push(s.url());s.close()});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(site+'/#research');await ready(p);const before=await retained(p),inputs=await p.evaluate(()=>localStorage.getItem('sq_next_session'));
  assert.equal(await p.locator('#correction').inputValue(),'10');assert.equal(await p.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');
  await p.locator('#studioResearchLumi').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'companionSummary');assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_next_session')),inputs);
  await p.locator('[data-private-mode="auto_eod"]').click();
  await p.waitForFunction(()=>document.getElementById('status').textContent.includes('connection check (HTTP 503)'));
  assert.equal(calls.health,1);assert.equal(calls.market,0);
  healthy=true;await p.locator('#refreshBtn').focus();await p.keyboard.press('Enter');
  await p.waitForFunction(()=>document.getElementById('status').textContent.includes('provider could not supply daily history'));
  assert.equal(calls.health,2);assert.equal(calls.market,1);assert.equal(await p.evaluate(()=>state.sharedApiReady),true);
  assert.equal(await p.locator('#price').inputValue(),'');assert.equal(await p.locator('#perf').inputValue(),'');
  assert.equal(await p.locator('#refreshBtn').getAttribute('aria-busy'),'false');assert.equal(await p.locator('#status').getAttribute('role'),'status');
  assert.deepEqual(await retained(p),before);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.waitForTimeout(200);assert.equal(calls.market,1);
  if(engine==='chromium'){await p.locator('#status').scrollIntoViewIfNeeded();await image(p,'public-eod-10.3.5-390.jpg');}
  await p.locator('[data-private-mode="manual"]').click();const frozen=JSON.stringify(calls);await p.locator('#refreshBtn').click();assert.equal(JSON.stringify(calls),frozen);assert.deepEqual(await retained(p),before);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PUBLIC_EOD_UI_PASS '+JSON.stringify({engine,version,checks:'actual deployed site/assets, intercepted health failure then recovery and observed-shape provider error, keyboard Refresh, no fake quote, no repeated market requests, private mode, saved research/journal/XP and defaults preserved',liveProviderRequests:0}));
 }finally{await c.close();}
}
(async()=>{
 assert.equal(version,'10.3.5');assert.equal(manifest.rollbackCommit,base);
 assert.deepEqual(JSON.parse(await publicGet('release-manifest.json')),manifest);
 for(const f of manifest.files){const b=await publicGet(f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(digest(b),f.sha256,f.path);current.set('/'+f.path,b);}
 current.set('/',current.get('/index.html'));
 console.log('PUBLIC_ASSET_PASS: live 10.3.5 manifest and all '+manifest.files.length+' lengths/SHA-256 hashes match tested source; rollback '+base);
 for(const [engine,type]of Object.entries({chromium,webkit})){const browser=await type.launch();try{await productionFlow(browser,engine);await cacheUpgrade(browser,engine);}finally{await browser.close();}}
 console.log('PUBLIC_FRONTEND_VERIFIED: 10.3.5 UI and preservation verified; provider responses were intercepted fixtures, zero live health/market/provider calls. Backend restoration and intraday delivery are NOT claimed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
