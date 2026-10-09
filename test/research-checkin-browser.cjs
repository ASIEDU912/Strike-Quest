// Rendered Research Check-in regressions. Every request is local-fixture fulfilled or blocked.
// Run CHECKIN_BROWSERS=chromium,webkit (default); no provider keys or browser installs are used.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'https://strikequests.checkin.fixture.test';
const fixedNow = '2026-10-07T12:00:00.000Z';
const evidence = path.resolve(process.env.EVIDENCE_DIR || path.join(root,'test-results'));
const store = 'sq_research_checkins_v1';
const original = {
  id:'fixture-original',ticker:'AAPL',instrument:'Apple fixture • AAPL',p:'1y',correction:10,c:10,
  price:100,perf:20,divisor:2,increment:1,low:99,mid:105,high:110,at:'2026-10-01T12:00:00.000Z',
  reason:'ORIGINAL_PRIVATE_REASON stays on this device.',inputMode:'auto_eod',savedOrigin:null,
  sourceContext:{symbol:'AAPL',source:'Original fixture provider',session:'2026-09-30',stale:true}
};
const reports=[],allRequests=[];
let browser;
function pass(name){reports.push(name);console.log('SQ_CHECKIN_PASS '+name);}
async function settleJournal(page){await page.evaluate(async()=>{if(navigator.locks?.request)await navigator.locks.request('strikequests-checkin-journal',()=>{});});}
async function fixture(width,seed={},raw={}){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'});
  const errors=[],unexpected=[];
  await context.addInitScript(({fixedNow,seed,raw,original})=>{
    const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return RealDate.parse(fixedNow);}};
    if(!sessionStorage.getItem('checkin_fixture_seeded')){
      for(const [key,value] of Object.entries({splab_history:[original],...seed}))localStorage.setItem(key,JSON.stringify(value));
      for(const [key,value] of Object.entries(raw))localStorage.setItem(key,value);
      sessionStorage.setItem('checkin_fixture_seeded','1');
    }
    sessionStorage.setItem('strikequests_v9_splash_seen','1');
  },{fixedNow,seed,raw,original});
  const allowed=new Set(['/','/index.html','/mascot.js','/mascot.css','/studio.js','/studio.css','/account-core.js','/account.js','/account.css','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png','/favicon.ico']);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());allRequests.push({origin:url.origin,path:url.pathname});
    if(url.origin===base&&url.pathname==='/config.json')return route.fulfill({contentType:'application/json',body:JSON.stringify({marketDataApi:'https://blocked-provider.fixture.test'})});
    if(url.origin===base&&url.pathname==='/before')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local navigation fixture</title><p>Before research</p>'});
    if(url.origin!==base||!allowed.has(url.pathname)){unexpected.push(url.href);return route.abort('blockedbyclient');}
    const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
    if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
    return route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await context.routeWebSocket('**/*',socket=>{unexpected.push(socket.url());socket.close();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/before');await page.goto(base+'/#research');
  await page.waitForFunction(()=>typeof sqStartCheckin==='function'&&document.getElementById('appSplash').classList.contains('hide'));
  return {page,context,check(){assert.deepEqual(errors,[],'No uncaught browser errors');assert.deepEqual(unexpected,[],'No unexpected or provider requests');}};
}
async function prepare(page){
  await page.locator('[data-private-mode="manual"]').click();
  await page.locator('#price').fill('150');await page.locator('#perf').fill('18');
  await page.locator('#divisor').fill('3.5');await page.locator('#increment').selectOption('0.5');
  await page.locator('#researchReason').fill('CURRENT_PRIVATE_REASON stays separate from check-ins.');
  await page.evaluate(()=>{state.period='3m';sqSetCorrection(30);sqBadgeSave({version:1,earned:{first:{at:'2026-10-01T00:00:00Z',origin:'fixture',mode:'manual'}},horizons:['1y']});render();});
}
async function protectedState(page){return page.evaluate(()=>JSON.stringify({
  mode:state.mode,ticker:$('ticker').value,period:state.period,price:$('price').value,perf:$('perf').value,
  divisor:$('divisor').value,increment:$('increment').value,correction:state.correction,reason:$('researchReason').value,
  meta:state.dataMeta,origin:state.savedOrigin||null,loaded:state.loadedResearchId||null,
  history:localStorage.getItem('splab_history'),badges:localStorage.getItem('sq_badges_v1011'),
  watch:localStorage.getItem('sq_watchlist'),compare:localStorage.getItem('sq_compare'),
  session:localStorage.getItem('sq_next_session'),xp:sqResearchXp()
}));}
async function open(page,id='fixture-original'){
  await page.locator('[data-view="saved"]').click();
  await page.locator(`[data-checkin-id="${id}"]`).click();
  assert.equal(await page.locator('#researchCheckin').isVisible(),true);
}
async function reflect(page,reason='CHECKIN_PRIVATE_REASON: New evidence changed my original assumption.'){
  await page.locator('#checkinReason').fill(reason);
  await page.locator('#checkinThinking').selectOption('changed');
  await page.locator('#checkinEvidence').selectOption('assumptions');
}
async function saved(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('sq_research_checkins_v1')||'{"entries":[]}').entries);}
async function noOverflow(page,label){
  const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(sizes.scroll<=sizes.width+1,label+': '+JSON.stringify(sizes));
}
async function controls(page){
  for(const id of ['checkinReason','checkinThinking','checkinEvidence']){
    const label=page.locator(`label[for="${id}"]`);assert.equal(await label.count(),1);assert.ok((await label.textContent()).trim().length>3);
    await page.locator('#'+id).focus();assert.equal(await page.evaluate(()=>document.activeElement.id),id);
  }
  for(const id of ['captureCheckinBtn','cancelCheckinBtn','saveCheckinBtn']){
    const bounds=await page.locator('#'+id).boundingBox();assert.ok(bounds&&bounds.height>=44&&bounds.width>=44,`${id} is a mobile touch target`);
  }
  const live=await page.locator('#checkinStatus').getAttribute('aria-live');assert.ok(['polite','assertive'].includes(live),'Check-in status is announced');
}
async function happy(width,engine){
  const f=await fixture(width),{page}=f;await prepare(page);const before=await protectedState(page);
  await open(page);assert.equal(await protectedState(page),before);
  await page.locator('#saveCheckinBtn').click();await settleJournal(page);assert.deepEqual(await saved(page),[]);
  assert.match(await page.locator('#checkinStatus').textContent(),/12|choose|write/i);
  const text=await page.locator('#checkinComparison').textContent();
  for(const label of [/Original fixture provider/,/Manual/,/2026-09-30/,/1-Year/,/3-Month/,/30%/,/10%/,/Divisor/i,/Increment/i,/Reference/i,/Performance|historical change|dollar change/i,/Low/i,/Mid/i,/High/i])assert.match(text,label);
  await controls(page);await reflect(page);assert.equal(await page.locator('#saveCheckinBtn').isEnabled(),true);
  await noOverflow(page,`${engine}/${width} editor`);
  await page.locator('#researchCheckin').screenshot({path:path.join(evidence,`research-checkin-${engine}-${width}.png`),animations:'disabled'});
  // Two same-task calls emulate rapid/re-entrant activation; actual UI first save is keyboard-driven.
  await page.locator('#saveCheckinBtn').focus();await page.keyboard.press('Enter');await settleJournal(page);await page.evaluate(()=>{sqSaveCheckin();sqSaveCheckin();});
  const entries=await saved(page);assert.equal(entries.length,1);assert.equal(entries[0].originalId,original.id);
  assert.equal(entries[0].original.price,100);assert.equal(entries[0].current.price,150);assert.equal(entries[0].current.high,155.5);
  assert.equal(await protectedState(page),before);assert.equal(await page.evaluate(()=>sqResearchXp()),50);
  const privateText=await page.evaluate(async()=>{
    window.__copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>__copies.push(text)}});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>__copies.push(data.text)});
    await copyResult();await shareResult();return [resultSummary(),...__copies];
  });
  assert.equal(privateText.length,3);for(const text of privateText)for(const marker of ['CHECKIN_PRIVATE_REASON','ORIGINAL_PRIVATE_REASON','CURRENT_PRIVATE_REASON'])assert.ok(!text.includes(marker));
  await page.reload();await page.waitForFunction(()=>typeof sqStartCheckin==='function');await page.locator('[data-view="saved"]').click();
  assert.deepEqual(await saved(page),entries);assert.equal(await page.evaluate(()=>!!sqCheckinDraft),false);
  assert.match(await page.locator('#checkinJournal').textContent(),/New evidence changed my original assumption/);
  await noOverflow(page,`${engine}/${width} saved check-in`);f.check();await f.context.close();
  pass(`${engine}/${width}: mobile comparison, accessible controls, keyboard save, duplicate protection, private persistence, no XP or share leakage`);
}
async function interrupted(engine){
  const f=await fixture(390),{page}=f;await prepare(page);const before=await protectedState(page);
  for(const action of ['cancel','research','watchlist','quests']){
    await open(page);await reflect(page);
    if(action==='cancel')await page.locator('#cancelCheckinBtn').click();else await page.locator(`[data-view="${action}"]`).click();
    assert.equal(await page.evaluate(()=>!!sqCheckinDraft),false,action);assert.deepEqual(await saved(page),[]);
    assert.equal(await protectedState(page),before,action);
  }
  await open(page);await reflect(page);await page.goBack();assert.equal(new URL(page.url()).pathname,'/before');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sq_research_checkins_v1')),null);
  await page.goForward();await page.waitForFunction(()=>typeof sqStartCheckin==='function');
  assert.equal(await page.evaluate(()=>!!sqCheckinDraft),false);assert.deepEqual(await saved(page),[]);
  await open(page);await reflect(page);await page.reload();await page.waitForFunction(()=>typeof sqStartCheckin==='function');
  assert.equal(await page.evaluate(()=>!!sqCheckinDraft),false);assert.deepEqual(await saved(page),[]);
  f.check();await f.context.close();pass(`${engine}: Cancel, all newer app navigation, browser Back/Forward and reload discard unsaved drafts`);
}
async function mismatchAndStale(engine){
  const f=await fixture(390),{page}=f;await prepare(page);
  await page.locator('#ticker').fill('MSFT');const before=await protectedState(page);await open(page);await reflect(page);
  assert.equal(await page.locator('#saveCheckinBtn').isDisabled(),true);assert.match(await page.locator('#checkinStatus').textContent(),/AAPL|same instrument|same ticker/i);
  assert.equal(await protectedState(page),before);await page.evaluate(()=>sqSaveCheckin());assert.deepEqual(await saved(page),[]);
  await page.locator('#cancelCheckinBtn').click();await page.locator('[data-view="research"]').click();
  await page.locator('#ticker').fill('AAPL');await page.locator('#price').fill('150');await page.locator('#perf').fill('18');
  await open(page);await reflect(page);
  const frozen=await page.evaluate(()=>JSON.stringify(sqCheckinDraft.current));
  // A background state update during an open draft must require explicit recapture.
  await page.evaluate(()=>{$('price').value='160';sqInputChanged('price');});
  assert.equal(await page.evaluate(()=>JSON.stringify(sqCheckinDraft.current)),frozen);
  assert.equal(await page.locator('#saveCheckinBtn').isDisabled(),true);assert.match(await page.locator('#checkinStatus').textContent(),/changed|stale|capture/i);
  await page.evaluate(()=>sqSaveCheckin());assert.deepEqual(await saved(page),[]);
  await page.evaluate(()=>{$('price').value='150';sqInputChanged('price');});
  assert.equal(await page.locator('#saveCheckinBtn').isDisabled(),true,'Reverting values still requires explicit recapture');
  await page.evaluate(()=>{$('price').value='160';sqInputChanged('price');});
  await page.locator('#captureCheckinBtn').click();assert.equal(await page.evaluate(()=>sqCheckinDraft.current.price),160);
  await reflect(page);await page.locator('#saveCheckinBtn').click();await settleJournal(page);assert.equal((await saved(page)).length,1);
  f.check();await f.context.close();pass(`${engine}: mismatch never loads or changes research; stale frozen comparisons require explicit recapture`);
}
async function storageFailures(engine){
  for(const raw of ['{broken','{"version":2,"entries":[]}','{"version":1,"entries":[null]}']){
    const f=await fixture(320,{}, {[store]:raw}),{page}=f;await prepare(page);await open(page);await reflect(page);
    await page.evaluate(()=>sqSaveCheckin());assert.equal(await page.evaluate(()=>localStorage.getItem('sq_research_checkins_v1')),raw);
    assert.match(await page.locator('#checkinStatus').textContent(),/storage|read|preserv|unavailable|invalid|damaged/i);
    assert.equal(await page.locator('#researchCheckin').isVisible(),true);await noOverflow(page,'corrupt-store error');f.check();await f.context.close();
  }
  const f=await fixture(320),{page}=f;await prepare(page);await open(page);await reflect(page);
  await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sq_research_checkins_v1')throw new DOMException('Fixture full','QuotaExceededError');return write.call(this,key,value);};});
  await page.locator('#saveCheckinBtn').click();await settleJournal(page);assert.deepEqual(await saved(page),[]);assert.equal(await page.evaluate(()=>!!sqCheckinDraft),true);
  assert.match(await page.locator('#checkinReason').inputValue(),/CHECKIN_PRIVATE_REASON/);assert.match(await page.locator('#checkinStatus').textContent(),/could not|unable|failed|storage|not saved/i);
  await noOverflow(page,'quota error');f.check();await f.context.close();pass(`${engine}: corrupt/unsupported stores preserve exact bytes; quota failure preserves the reflection without a false success`);
}
async function legacyAndHostile(engine){
  const attack='<img src=x onerror="window.__checkinInjection=1"> & '+ 'VeryLongFixtureSource'.repeat(20);
  const legacy={id:'legacy',ticker:'AAPL',price:100,perf:20,low:99,mid:105,high:110,reason:'A legacy private reason with unknown assumptions.'};
  const hostile={...original,id:'hostile',instrument:attack,reason:attack,sourceContext:{...original.sourceContext,source:attack}};
  const f=await fixture(320,{splab_history:[legacy,hostile]}),{page}=f;await prepare(page);
  const before=await page.evaluate(()=>localStorage.getItem('splab_history'));await open(page,'legacy');
  assert.match(await page.locator('#checkinComparison').textContent(),/unknown|not recorded|unavailable/i);
  const captured=await page.evaluate(()=>sqCheckinDraft.original);for(const key of ['period','p','correction','divisor','increment','sourceContext','at'])assert.ok(captured[key]==null,key);
  await page.locator('#cancelCheckinBtn').click();await page.locator('[data-checkin-id="hostile"]').click();await reflect(page,attack);
  assert.equal(await page.locator('#checkinComparison img').count(),0);await noOverflow(page,'hostile original');
  await page.locator('#saveCheckinBtn').click();await settleJournal(page);assert.equal(await page.locator('#history img, #checkinJournal img').count(),0);
  assert.equal(await page.evaluate(()=>window.__checkinInjection),undefined);assert.equal(await page.evaluate(()=>localStorage.getItem('splab_history')),before);
  await noOverflow(page,'hostile saved check-in');f.check();await f.context.close();
  for(const raw of ['{broken','{}','[null,17,"bad"]']){
    const f=await fixture(320,{}, {splab_history:raw});await f.page.locator('[data-view="saved"]').click();
    assert.equal(await f.page.evaluate(()=>localStorage.getItem('splab_history')),raw);await noOverflow(f.page,'malformed-history state');f.check();await f.context.close();
  }
  pass(`${engine}: legacy unknowns stay unknown; malformed history survives; XSS payloads render as text without mobile overflow`);
}
async function observationsAndGuards(engine){
  const f=await fixture(390),{page}=f;await prepare(page);await open(page);await reflect(page);
  await page.locator('#checkinThinking').selectOption('uncertain');await page.locator('#checkinEvidence').selectOption('observation');
  assert.equal(await page.locator('#checkinObservationField').isVisible(),true);
  assert.equal(await page.locator('label[for="checkinObservation"]').count(),1);
  await page.locator('#saveCheckinBtn').click();await settleJournal(page);assert.deepEqual(await saved(page),[]);
  assert.match(await page.locator('#checkinStatus').textContent(),/source.*date|description/i);
  const observation='I saw the sample size change in a fixture report dated 6 October 2026.';
  await page.locator('#checkinObservation').fill(observation);await page.locator('#saveCheckinBtn').click();await settleJournal(page);
  assert.equal((await saved(page))[0].observation,observation);assert.equal((await saved(page))[0].thinking,'uncertain');
  assert.match(await page.locator('#checkinJournal').textContent(),/Self-reported observation, not independently verified/);
  await open(page);await reflect(page);
  await page.evaluate(()=>{const rows=JSON.parse(localStorage.getItem('splab_history'));rows[0].reason='Updated in another tab with a different assumption.';localStorage.setItem('splab_history',JSON.stringify(rows));window.dispatchEvent(new StorageEvent('storage',{key:'splab_history'}));});
  assert.equal(await page.locator('#saveCheckinBtn').isDisabled(),true);assert.match(await page.locator('#checkinStatus').textContent(),/changed|unavailable/i);
  await page.evaluate(()=>sqSaveCheckin());assert.equal((await saved(page)).length,1);
  await page.locator('#cancelCheckinBtn').click();await open(page);await reflect(page);
  await page.evaluate(()=>{localStorage.setItem('splab_history','[]');window.dispatchEvent(new StorageEvent('storage',{key:'splab_history'}));});
  assert.equal(await page.locator('#saveCheckinBtn').isDisabled(),true);await page.evaluate(()=>sqSaveCheckin());assert.equal((await saved(page)).length,1);
  f.check();await f.context.close();pass(`${engine}: uncertain self-reported evidence needs its description; changed/deleted originals block a stale draft`);
}
async function clearJournal(engine){
  const f=await fixture(390),{page}=f;await prepare(page);await open(page);await reflect(page);await page.locator('#saveCheckinBtn').click();await settleJournal(page);
  await open(page);await reflect(page);const before=await protectedState(page),journal=await saved(page),draft=await page.evaluate(()=>JSON.stringify(sqCheckinDraft));
  assert.match(await page.locator('#clearAllBtn').textContent(),/Clear saved ideas/i);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#clearCheckinsBtn').click();await settleJournal(page);
  assert.deepEqual(await saved(page),journal);assert.equal(await page.evaluate(()=>JSON.stringify(sqCheckinDraft)),draft);
  assert.equal(await protectedState(page),before);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#clearCheckinsBtn').click();await settleJournal(page);
  assert.deepEqual(await saved(page),[]);assert.equal(await page.evaluate(()=>!!sqCheckinDraft),false);assert.equal(await protectedState(page),before);
  assert.equal(await page.locator('#checkinJournalCard').isVisible(),false);assert.equal(await page.locator('#researchCheckin').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'history');
  await open(page);await reflect(page);await page.locator('#saveCheckinBtn').click();await settleJournal(page);assert.equal((await saved(page)).length,1);
  f.check();await f.context.close();pass(`${engine}: Clear check-ins requires native confirmation, preserves original research/XP and permits a new journal`);
}
async function provenance(engine){
  const f=await fixture(390),{page}=f;await prepare(page);
  for(const [mode,expected] of [['manual','manual'],['demo','synthetic'],['auto_eod','eod']]){
    await page.evaluate(mode=>{
      setView('research');state.mode=mode;state.savedOrigin=null;
      state.dataMeta=mode==='auto_eod'?{symbol:'AAPL',source:'Local provider fixture',session:'2026-10-06',coverage:{fullRange:true}}:mode==='demo'?{symbol:'AAPL',source:'Synthetic example',session:'2026-09-30',synthetic:true}:null;render();
    },mode);
    await open(page);await reflect(page);await page.locator('#saveCheckinBtn').click();await settleJournal(page);
    const entry=(await saved(page)).find(x=>x.current.inputMode===mode);assert.ok(entry,mode);
    assert.equal(await page.evaluate(current=>sqSourceInfo(current).kind,entry.current),expected);
  }
  assert.equal((await saved(page)).length,3);assert.equal(await page.evaluate(()=>sqResearchXp()),50);
  f.check();await f.context.close();pass(`${engine}: Manual, Demo and local provider fixtures persist distinct truthful provenance with zero provider traffic`);
}
(async()=>{
  fs.mkdirSync(evidence,{recursive:true});
  const engines=(process.env.CHECKIN_BROWSERS||'chromium,webkit').split(',').map(s=>s.trim());
  for(const engine of engines){
    assert.ok(['chromium','webkit'].includes(engine),'Unsupported browser: '+engine);
    browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    for(const width of [320,390])await happy(width,engine);
    await interrupted(engine);await mismatchAndStale(engine);await storageFailures(engine);await legacyAndHostile(engine);await observationsAndGuards(engine);await clearJournal(engine);await provenance(engine);
    await browser.close();browser=null;
  }
  fs.writeFileSync(path.join(evidence,'research-checkin-browser-results.json'),JSON.stringify({passed:reports.length,checks:reports,engines,viewports:[320,390],providerRequests:0,requests:allRequests},null,2));
  console.log(`${reports.length} Research Check-in browser checks passed; every request was intercepted.`);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();});
