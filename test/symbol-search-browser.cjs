// Isolated browser verification: local suggestions, original-release diagnosis and preserved state.
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
async function fixture(browser,width,baseline=false){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,serviceWorkers:'block'}),errors=[],external=[];
 await seedContext(context);await context.route('**/*',r=>{const u=new URL(r.request().url()),map=baseline?prior:current;if(u.origin!==origin){external.push(u.href);return r.abort();}const b=map.get(u.pathname);return r.fulfill({status:b?200:404,body:b||'',contentType:mime(u.pathname)});});
 await context.routeWebSocket('**/*',s=>{external.push(s.url());s.close();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/#research');await ready(page,baseline?'10.3.3':version);
 return {page,context,async close(){assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();}};
}
async function visibleOption(p){assert.equal(await p.locator('.suggest-row').first().evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&!!document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.suggest-row');}),true,'Dropdown is visible and hit-testable');}
async function geometry(p){return p.evaluate(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};};return {ticker:box('ticker'),picks:box('quickPicks'),lumi:box('studioResearchLumi'),scenario:box('scenarioSection'),guide:box('companionPanel'),evidence:box('researchContext'),quality:box('dataQuality'),inside:document.getElementById('studioInstrument').contains(document.getElementById('quickPicks')),overflow:document.documentElement.scrollWidth>innerWidth+1};});}
let imageBytes=0;
async function image(p,name){const b=await p.screenshot({type:'jpeg',quality:58,animations:'disabled'});imageBytes+=b.length;assert.ok(imageBytes<700000);console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}));const s=b.toString('base64');for(let i=0;i<s.length;i+=160)console.log('SQ_IMAGE_DATA '+s.slice(i,i+160));console.log('SQ_IMAGE_END '+name);}
async function originalDiagnosis(browser,engine){
 const f=await fixture(browser,390,true),p=f.page,g=await geometry(p);
 await p.locator('#ticker').fill('aap');await p.locator('.suggest-row[data-symbol="AAPL"]').waitFor();await visibleOption(p);
 const role=await p.locator('#ticker').getAttribute('role');await p.keyboard.press('Escape');
 assert.equal(await p.locator('#tickerSuggestions').evaluate(e=>e.classList.contains('show')),false);
 assert.ok(await p.locator('.suggest-row').count()>0,'Original Escape retains hidden options');
 await p.locator('#ticker').fill('microsoft');await p.locator('.suggest-row[data-symbol="MSFT"]').waitFor();
 assert.ok(g.picks.top>g.quality.top);assert.equal(g.inside,false);assert.equal(role,null);
 console.log('SEARCH_BASELINE '+JSON.stringify({engine,version:'10.3.3',symbolAndCompanySuggestionsWork:true,dropdownVisible:true,comboboxRole:role,escapeRetainsHiddenOptions:true,quickPicksAfterQuality:true,geometry:g}));
 if(engine==='chromium'){await p.locator('#ticker').fill('aap');await p.locator('.suggest-row[data-symbol="AAPL"]').waitFor();await image(p,'before-search-390.jpg');}
 const labels=await p.locator('#quickPicks button').evaluateAll(es=>es.map(e=>({symbol:e.dataset.quick,label:e.getAttribute('aria-label'),art:e.querySelector('.company-icon').innerHTML,provider:e.querySelector('.provider-label')?.textContent||''})));
 await f.close();return labels;
}
async function providerFlow(browser,engine){
 const f=await fixture(browser,390),p=f.page,records=await retained(p);
 await p.evaluate(()=>{state.mode='auto_eod';state.sharedApiReady=true;state.sharedApiBase='https://synthetic-api.fixture.test';localStorage.setItem('sq_provider_pref','shared');localStorage.setItem('splab_barchart_key','SYNTHETIC_TEST_ONLY');window.pending=[];window.fetch=url=>new Promise(resolve=>pending.push({url:String(url),resolve}));window.release=(i,fail=false)=>{const symbol=new URL(pending[i].url).searchParams.get('symbol'),raw=sqSynthetic(symbol);pending[i].resolve({ok:!fail,status:fail?502:200,json:async()=>fail?{ok:false,error:'Synthetic unavailable'}:{ok:true,symbol,daily:raw.daily,weekly:raw.weekly,monthly:raw.monthly,source:'Synthetic test fixture',cache:'hit',fetchedAt:Date.now()}});};});
 await p.locator('#ticker').fill('aap');assert.equal(await p.evaluate(()=>pending.length),0,'Typing with even a stored fixture key is local');
 await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForFunction(()=>pending.length===1);
 assert.equal(await p.locator('#price').inputValue(),'');assert.match(await p.locator('#status').innerText(),/Loading.*AAPL/);
 await p.locator('#ticker').fill('micro');assert.equal(await p.evaluate(()=>pending.length),1);assert.equal(await p.locator('#selectedInstrument').innerText(),'');
 await p.locator('[role="option"][data-symbol="MSFT"]').tap();await p.waitForFunction(()=>pending.length===2);
 await p.evaluate(()=>release(1));await p.waitForFunction(()=>document.getElementById('price').value==='320.00');
 await p.evaluate(()=>release(0));await p.waitForTimeout(60);assert.equal(await p.locator('#price').inputValue(),'320.00');assert.equal(await p.locator('#ticker').inputValue(),'MSFT');
 await p.locator('#ticker').fill('nvidia');assert.equal(await p.locator('#price').inputValue(),'');assert.equal(await p.locator('#perf').inputValue(),'');
 await p.locator('[role="option"][data-symbol="NVDA"]').tap();await p.waitForFunction(()=>pending.length===3);await p.evaluate(()=>release(2,true));
 await p.waitForFunction(()=>!document.getElementById('fetchBtn').disabled);assert.match(await p.locator('#status').innerText(),/could not be verified or loaded/);assert.equal(await p.locator('#price').inputValue(),'');
 await p.locator('#ticker').fill('spdr');assert.ok(await p.locator('[role="option"]').count()>0);assert.equal(await p.evaluate(()=>pending.length),3);
 // Existing provider caches may change; saved records, journal and earned XP must not.
 const end=await retained(p);assert.equal(end.xp,records.xp);for(const k of ['splab_history','sq_research_checkins_v1','sq_journey_v1:guest:revisit'])assert.equal(end.storage[k],records.storage[k]);
 console.log('SEARCH_PROVIDER_PASS '+engine+': no requests while typing; one synthetic request per committed selection; pending/latest/error states; old response ignored; saved data and XP retained');await f.close();
}
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
(async()=>{
 // Establish actual deployed baseline bytes before diagnosing its rendered behavior.
 const response=await fetch('https://strikequests.com/release-manifest.json',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);const live=await response.json(),expected=JSON.parse(execFileSync('git',['show',base+':release-manifest.json'],{cwd:root}));
 assert.deepEqual(live,expected);for(const file of ['index.html','studio.js','studio.css']){const r=await fetch('https://strikequests.com/'+file,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());assert.equal(crypto.createHash('sha256').update(b).digest('hex'),expected.files.find(x=>x.path===file).sha256);}
 console.log('SEARCH_LIVE_BASELINE_PASS: public 10.3.3 manifest/index/studio JS/CSS match released 8686df40; no provider requests.');
 for(const [engine,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch();try{
   const labels=await originalDiagnosis(browser,engine);
   for(const width of [320,390,768,1440]){
    const f=await fixture(browser,width),p=f.page,records=await retained(p),g=await geometry(p);
    assert.equal(g.inside,true);assert.equal(g.overflow,false);assert.ok(g.picks.top<g.scenario.top&&g.scenario.top<g.guide.top&&g.guide.top<g.evidence.top);assert.ok(g.lumi.bottom<(await p.locator('.bottom-nav').boundingBox()).y,'Compact Lumi stays above first-screen navigation');
    assert.deepEqual(await p.locator('#quickPicks button').evaluateAll(es=>es.map(e=>({symbol:e.dataset.quick,label:e.getAttribute('aria-label'),art:e.querySelector('.company-icon').innerHTML,provider:e.querySelector('.provider-label')?.textContent||''}))),labels);
    assert.equal(await p.locator('#ticker').getAttribute('role'),'combobox');assert.equal(await p.locator('#ticker').getAttribute('aria-controls'),'tickerSuggestions');
    for(const [query,symbol]of [['aap','AAPL'],['Apple','AAPL'],['microsoft','MSFT'],['invesco','QQQ'],['semiconductor','SMH']]){
     await p.locator('#ticker').fill(query);await p.locator('[role="option"][data-symbol="'+symbol+'"]').waitFor();assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'true');
    }
    await p.locator('#ticker').fill('aap');await visibleOption(p);assert.equal(await p.locator('#tickerSuggestions .suggest-mark svg').count(),1);
    if(engine==='chromium'&&width===390)await image(p,'after-search-390.jpg');
    await p.keyboard.press('ArrowDown');const active=await p.locator('#ticker').getAttribute('aria-activedescendant');assert.equal(await p.locator('#'+active).getAttribute('aria-selected'),'true');
    await p.keyboard.press('Enter');assert.equal(await p.locator('#ticker').inputValue(),'AAPL');assert.match(await p.locator('#selectedInstrument').innerText(),/Apple/);assert.equal(await p.locator('[role="option"]').count(),0);assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'false');
    await p.locator('#ticker').fill('micro');await p.keyboard.press('ArrowDown');await p.keyboard.press('Escape');await p.keyboard.press('Enter');assert.equal(await p.locator('#ticker').inputValue(),'micro');assert.equal(await p.locator('[role="option"]').count(),0);assert.equal(await p.locator('#ticker').getAttribute('aria-activedescendant'),null);
    await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');assert.equal(await p.locator('#ticker').inputValue(),'AMD','Arrow Up reopens at the last matching option');
    await p.locator('#ticker').fill('sp');await p.keyboard.press('Tab');assert.equal(await p.locator('[role="option"]').count(),0);
    await p.locator('#ticker').fill('no-company-xyz');assert.match(await p.locator('#tickerSearchHelp').innerText(),/No local match/);assert.doesNotMatch(await p.locator('#tickerSearchHelp').innerText(),/key|Barchart/);assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'false');
    await p.locator('#ticker').fill('');assert.equal(await p.locator('#selectedInstrument').innerText(),'');assert.equal(await p.locator('[role="option"]').count(),0);assert.equal(await p.locator('#price').inputValue(),'');
    await p.locator('#ticker').evaluate(e=>{e.value='aap';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});assert.equal(await p.locator('[role="option"]').count(),0);
    await p.locator('#ticker').dispatchEvent('compositionend');await p.locator('[role="option"][data-symbol="AAPL"]').tap();assert.equal(await p.locator('#ticker').inputValue(),'AAPL');assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'false');
    await p.locator('#quickPicks [data-quick="XLK"]').tap();assert.equal(await p.locator('#ticker').inputValue(),'XLK');assert.equal(await p.locator('#ticker').getAttribute('aria-expanded'),'false');
    assert.equal(await p.locator('#correction').inputValue(),'10');assert.equal(await p.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');assert.deepEqual(await retained(p),records);
    await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#studioResearchLumi').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'companionSummary');assert.equal(await p.locator('#studioResearchLumiArt .sq-mascot__head').evaluate(e=>getComputedStyle(e).animationName),'none');
    if(engine==='chromium'&&[390,1440].includes(width)){await p.locator('[data-view="research"]').click();await image(p,'after-picks-'+width+'.jpg');}
    console.log('SEARCH_BROWSER_PASS '+JSON.stringify({engine,width,geometry:g,checks:'symbol/company/ETF; keyboard/touch/composition; Escape/Tab/clear; no key prompt or network; original logos/provider labels; Lumi/scenario order; 2y/10%; preserved saved/journal/XP; reduced motion'}));await f.close();
   }
   await providerFlow(browser,engine);await cacheUpgrade(browser,engine);
  }finally{await browser.close();}
 }
 console.log('SEARCH_VERIFIED: local catalog only; no new provider/backend/account/credential/data schema changes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
