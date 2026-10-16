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
async function privateRecords(p){return p.evaluate(()=>({xp:sqResearchXp(),saved:localStorage.getItem('splab_history'),journal:localStorage.getItem('sq_research_checkins_v1'),revisit:localStorage.getItem('sq_journey_v1:guest:revisit')}));}
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw Error('Fixture condition timeout');}
const api='https://eod-service.fixture.test';
const health={ok:true,cacheConfigured:true,providerConfigured:true};
function payload(symbol){const rows=[{date:'2020-01-01',close:100,high:110,low:90},{date:'2026-10-01',close:200,high:210,low:190}];return {ok:true,symbol,daily:rows,weekly:rows,monthly:rows,source:'Synthetic browser fixture',cache:'hit',fetchedAt:Date.now()};}
async function browserFlow(browser,engine,width){
 const c=await browser.newContext({viewport:{width,height:900},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});await seedContext(c);
 const errors=[],external=[],calls={config:0,health:0,market:[]},pendingHealth=[],pendingMarket=[];
 let healthGate=true,healthStatus=200,marketGate=false,marketMode='provider';
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.origin===api){
   if(u.pathname==='/health'){calls.health++;if(healthGate){pendingHealth.push(r);return;}return r.fulfill({status:healthStatus,json:health});}
   if(u.pathname==='/v1/market'){
    const symbol=u.searchParams.get('symbol');calls.market.push(symbol);
    if(marketGate){pendingMarket.push({r,symbol});return;}
    if(marketMode==='provider')return r.fulfill({status:502,json:{ok:false,code:'PROVIDER',providerHint:'UNKNOWN',providerStage:'daily',providerStatus:200,error:'PRIVATE_ERROR_MUST_NOT_APPEAR'}});
    if(marketMode==='quota')return r.fulfill({status:429,json:{ok:false}});
    if(marketMode==='invalid')return r.fulfill({status:200,json:payload('WRONG')});
    return r.fulfill({status:200,json:payload(symbol)});
   }
  }
  if(u.origin===origin&&u.pathname==='/config.json'){calls.config++;return r.fulfill({json:{marketDataApi:api}});}
  if(u.origin!==origin){external.push(u.origin+u.pathname);return r.abort();}
  const b=current.get(u.pathname);if(!b&&u.pathname!=='/favicon.ico')external.push(u.pathname);return r.fulfill({status:b?200:404,contentType:mime(u.pathname),body:b||''});
 });
 await c.routeWebSocket('**/*',s=>{external.push(s.url());s.close();});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(origin+'/#research');await ready(p);const original=await privateRecords(p);
  assert.equal(await p.locator('#correction').inputValue(),'10');assert.equal(await p.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');
  await p.locator('[data-private-mode="auto_eod"]').click();await until(()=>pendingHealth.length===1);
  await p.locator('#ticker').fill('microsoft');await p.locator('[role="option"][data-symbol="MSFT"]').tap();
  await p.locator('[data-p="3m"]').click();await p.waitForTimeout(50);
  assert.equal(calls.config,1);assert.equal(calls.health,1);assert.equal(calls.market.length,0);
  assert.equal(await p.locator('#fetchBtn').getAttribute('aria-busy'),'true');
  await pendingHealth.shift().fulfill({json:health});
  await p.waitForFunction(()=>document.getElementById('status').textContent.includes('provider could not supply daily history'));
  assert.deepEqual(calls.market,['MSFT']);assert.equal(await p.evaluate(()=>state.sharedApiReady),true);assert.equal(await p.locator('#price').inputValue(),'');assert.doesNotMatch(await p.locator('#status').innerText(),/PRIVATE_ERROR|not connected/);
  assert.equal(await p.locator('#status').getAttribute('role'),'status');assert.equal(await p.locator('#status').getAttribute('aria-live'),'polite');
  assert.deepEqual(await privateRecords(p),original);
  await p.locator('#fetchBtn').focus();await p.keyboard.press('Enter');await until(()=>calls.market.length===2);await p.waitForFunction(()=>!document.getElementById('fetchBtn').disabled);await p.waitForTimeout(150);assert.equal(calls.market.length,2);
  if(engine==='chromium'&&width===390){await p.locator('#status').scrollIntoViewIfNeeded();await image(p,'eod-provider-failure-390.jpg');}
  // A new Automatic session has its own connection generation.
  await p.locator('[data-private-mode="manual"]').click();healthGate=false;healthStatus=503;
  await p.locator('[data-private-mode="auto_eod"]').click();
  await p.waitForFunction(()=>document.getElementById('status').textContent.includes('connection check (HTTP 503)'));assert.equal(calls.market.length,2);
  if(engine==='chromium'&&width===390){await p.locator('#status').scrollIntoViewIfNeeded();await image(p,'eod-connection-failure-390.jpg');}
  healthStatus=200;marketMode='valid';await p.locator('#fetchBtn').focus();await p.keyboard.press('Enter');
  await p.waitForFunction(()=>document.getElementById('price').value==='200.00');assert.equal(calls.market.length,3);assert.equal(await p.evaluate(()=>state.sharedApiReady),true);assert.equal(await p.locator('#fetchBtn').getAttribute('aria-busy'),'false');
  marketMode='quota';await p.locator('#fetchBtn').click();await p.waitForFunction(()=>document.getElementById('status').textContent.includes('request limit reached'));
  assert.equal(await p.locator('#price').inputValue(),'200.00');assert.equal(await p.evaluate(()=>state.dataMeta.stale),true);assert.match(await p.locator('#status').innerText(),/last cached EOD snapshot/);
  marketMode='invalid';await p.locator('#fetchBtn').click();await p.waitForFunction(()=>document.getElementById('status').textContent.includes('could not be verified'));assert.equal(await p.locator('#price').inputValue(),'200.00');
  // Saved research switches to Manual and rejects the old automatic request.
  marketGate=true;await p.locator('#fetchBtn').click();await until(()=>pendingMarket.length===1);
  await p.evaluate(()=>loadSaved('search-idea'));const savedStatus=await p.locator('#status').innerText();
  const waiting=pendingMarket.shift();await waiting.r.fulfill({json:payload(waiting.symbol)}).catch(()=>{});
  await p.waitForTimeout(80);assert.equal(await p.locator('#price').inputValue(),'190.43');assert.equal(await p.evaluate(()=>state.mode),'manual');assert.equal(await p.locator('#status').innerText(),savedStatus);
  assert.deepEqual(await privateRecords(p),original);assert.equal(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('EOD_BROWSER_PASS '+JSON.stringify({engine,width,checks:'health/ticker/horizon race; one shared connection; keyboard Refresh reconnect; provider/connection/quota/invalid-data distinction; bounded requests; stale fallback; saved journal and XP retained; private cancellation; reduced motion; no overflow; no live provider requests'}));
 }finally{await c.close();}
}
(async()=>{
 for(const [engine,type]of Object.entries({chromium,webkit})){const browser=await type.launch();try{for(const width of [320,390,768,1440])await browserFlow(browser,engine,width);await cacheUpgrade(browser,engine);}finally{await browser.close();}}
 console.log('EOD_FRONTEND_VERIFIED: fixture behavior and migration only; no backend-restoration claim or intraday polling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
