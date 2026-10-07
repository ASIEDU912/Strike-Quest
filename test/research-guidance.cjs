// Focused behavior checks. The DOM adapter does not establish browser layout/accessibility.
// Fixtures are local; any unmocked network request throws in dom-harness.cjs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const create = require('./dom-harness.cjs');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const at = '2026-10-07T12:00:00.000Z';
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0, failed = 0;
function harness(items = {}) {
  const pre = `const RealDate=Date;Date=class extends RealDate{constructor(...args){super(...(args.length?args:[${JSON.stringify(at)}]))}static now(){return RealDate.parse(${JSON.stringify(at)})}};` +
    Object.entries(items).map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(value))});`).join('');
  return create(html.replace('<script>', '<script>' + pre + '</script><script>'));
}
async function test(name, fn) {
  try { await fn(harness()); passed++; console.log('PASS', name); }
  catch (error) { failed++; console.error('FAIL', name, '\n ', error.stack); }
}
async function provider(p) {
  await p.evaluate(() => {
    setMode('auto_eod');
    setPeriod('1y'); // Provider fixtures intentionally use the 1Y baseline.
    const raw = sqSynthetic('AAPL'); raw.synthetic = false; raw.savedAt = Date.now();
    applyAlphaRaw('AAPL', raw, 'Fixture provider');
    sqBadgeSave({version:1, earned:{}, horizons:[]});
    window.networkCalls = 0;
    window.fetch = () => { networkCalls++; throw new Error('No live traffic allowed'); };
  });
}
async function routeSpy(p) {
  await p.evaluate(() => {
    window.routes = []; window.focused = []; window.scrolled = []; window.networkCalls = 0;
    const oldView = setView; setView = view => { routes.push(view); oldView(view); };
    window.fetch = () => { networkCalls++; throw new Error('No live traffic allowed'); };
    for (const id of ['analyzeBtn','price','dataModes','reviewTrendsBtn','reviewRangeBtn','reviewSampleBtn','researchReason','periodTabs','watchCurrentBtn','watchlist','completeResearchBtn','history','quickPicks']) {
      const e = $(id); e.tagName = /Btn$/.test(id) ? 'BUTTON' : id === 'price' ? 'INPUT' : id === 'researchReason' ? 'TEXTAREA' : 'DIV';
      e.attributes = {}; e.setAttribute = (name, value) => { e.attributes[name] = value; };
      e.focus = options => focused.push({id, options}); e.scrollIntoView = options => scrolled.push({id, options});
    }
  });
}
(async () => {
  for (const field of ['price', 'perf']) await test(`editing Automatic ${field} detaches once, preserves both exact inputs and cancels requests`, async p => {
    await provider(p);
    const x = plain(await p.evaluate(field => {
      state.loadedResearchId = 'prior-note'; state.savedOrigin = 'auto_eod';
      $('price').value = '250.125'; $('perf').value = '-17.375'; $('divisor').value = '3.5'; $('increment').value = '0.5'; sqSetCorrection(12);
      const controller = new AbortController(); sqControllers.add(controller); const serial = marketRequestSerial;
      $(field).dispatch('input', {target: $(field)});
      const firstSerial = marketRequestSerial; $(field).dispatch('input', {target: $(field)});
      return {mode:state.mode, price:$('price').value, perf:$('perf').value, divisor:$('divisor').value, increment:$('increment').value, correction:state.correction,
        period:state.period, extra:state.extra, meta:state.dataMeta, origin:state.savedOrigin, loaded:state.loadedResearchId,
        aborted:controller.signal.aborted, controllers:sqControllers.size, invalidated:firstSerial>serial, stable:marketRequestSerial===firstSerial,
        saved:sqJSON('sq_next_session',{}), calls:networkCalls, earned:sqBadges().earned};
    }, field));
    assert.equal(x.mode, 'manual'); assert.equal(x.price, '250.125'); assert.equal(x.perf, '-17.375');
    assert.equal(x.divisor, '3.5'); assert.equal(x.increment, '0.5'); assert.equal(x.correction, 12); assert.equal(x.period, '1y');
    assert.deepEqual(x.extra, {}); assert.equal(x.meta, null); assert.equal(x.origin, null); assert.equal(x.loaded, null);
    assert.ok(x.aborted && x.invalidated && x.stable); assert.equal(x.controllers, 0); assert.equal(x.calls, 0); assert.deepEqual(x.earned, {});
    assert.equal(x.saved.mode, 'manual'); assert.equal(x.saved.price, x.price); assert.equal(x.saved.perf, x.perf);
  });
  await test('clearing an Automatic input hides old targets and cannot restore cached quotes', async p => {
    await provider(p);
    const x = await p.evaluate(() => { $('price').value = ''; sqInputChanged('price'); return {mode:state.mode,result:calc(),low:$('low').textContent,price:$('price').value,cache:loadCachedEod(),label:$('sourceBadge').textContent}; });
    assert.equal(x.mode, 'manual'); assert.equal(x.result, null); assert.equal(x.low, '—'); assert.equal(x.price, ''); assert.equal(x.cache, false); assert.match(x.label, /Manual/);
  });
  await test('divisor, increment and 0/10/30 corrections retain Automatic provenance without fetch or awards', async p => {
    await provider(p);
    const x = await p.evaluate(() => {
      const original = JSON.stringify(state.dataMeta), serial = marketRequestSerial, high = calc().high, values = {};
      for (const correction of [0,10,30,10,0,30]) { sqSetCorrection(correction); const r=calc(); (values[correction] ||= []).push([r.low,r.mid,r.high]); }
      $('divisor').value = '3.5'; sqInputChanged('divisor'); $('increment').value = '0.5'; sqInputChanged('increment');
      return {mode:state.mode, sameMeta:JSON.stringify(state.dataMeta)===original, serial:marketRequestSerial===serial, values, high, calls:networkCalls, earned:sqBadges().earned};
    });
    assert.equal(x.mode, 'auto_eod'); assert.ok(x.sameMeta && x.serial); assert.equal(x.calls, 0); assert.deepEqual(plain(x.earned), {});
    for (const rows of Object.values(x.values)) { assert.deepEqual(plain(rows[0]), plain(rows[1])); assert.equal(rows[0][2], x.high); }
    assert.equal(x.values[0][0][0], x.high); assert.notEqual(x.values[30][0][0], x.high);
  });
  await test('late shared response after editing cannot overwrite Manual data, caches, watchlist or progress', async p => {
    await provider(p);
    const x = plain(await p.evaluate(async () => {
      state.sharedApiReady = true; state.sharedApiBase = 'https://fixture.invalid';
      localStorage.removeItem('sq_alpha_raw_cache'); localStorage.removeItem('strikequest_eod_cache');
      setWatchlist([{symbol:'AAPL',snapshot:{price:111,low:100,mid:110,high:120}}]);
      let release; window.fetch = () => { networkCalls++; return new Promise(resolve => {release=resolve;}); };
      const request = sqAnalyze(); $('price').value = '123.45'; $('perf').value = '6.75'; sqInputChanged('price');
      const raw = sqSynthetic('AAPL'); release({ok:true,json:async()=>({...raw,ok:true,source:'Delayed fixture',cache:'hit',fetchedAt:Date.now()})}); await request;
      return {mode:state.mode,price:$('price').value,perf:$('perf').value,meta:state.dataMeta,raw:localStorage.getItem('sq_alpha_raw_cache'),cache:readEodCache(),watch:getWatchlist()[0].snapshot.price,badges:sqBadges(),calls:networkCalls};
    }));
    assert.equal(x.mode, 'manual'); assert.equal(x.price, '123.45'); assert.equal(x.perf, '6.75'); assert.equal(x.meta, null); assert.equal(x.raw, null); assert.deepEqual(x.cache, {}); assert.equal(x.watch,111); assert.deepEqual(x.badges.earned,{}); assert.deepEqual(x.badges.horizons,[]); assert.equal(x.calls,1);
  });
  await test('manual horizon change removes its old change and never revives provider context', async p => {
    await provider(p); const x=await p.evaluate(()=>{$('price').value='125';sqInputChanged('price');setPeriod('3m');return {mode:state.mode,price:$('price').value,perf:$('perf').value,meta:state.dataMeta,result:calc(),calls:networkCalls}});
    assert.equal(x.mode,'manual');assert.equal(x.price,'125');assert.equal(x.perf,'');assert.equal(x.meta,null);assert.equal(x.result,null);assert.equal(x.calls,0);
  });
  await test('provenance makes an independent metadata snapshot', async p => {
    await provider(p); const x=await p.evaluate(()=>{const s=makeSnapshot('AAPL');state.dataMeta.source='Changed';state.dataMeta.coverage.fullRange=false;return {source:s.sourceContext.source,full:s.sourceContext.coverage.fullRange,mode:s.inputMode}});
    assert.deepEqual(plain(x),{source:'Fixture provider',full:true,mode:'auto_eod'});
  });
  await test('source classification distinguishes synthetic, Manual, valid EOD, stale, future and unknown', async p => {
    const x=await p.evaluate(()=>[
      {inputMode:'demo'},{inputMode:'manual',savedOrigin:'demo'},{inputMode:'auto_eod',sourceContext:{synthetic:true}},{inputMode:'manual'},
      {inputMode:'auto_eod',sourceContext:{session:'2026-10-07'}},{inputMode:'auto_eod',sourceContext:{session:'2026-10-03'}},
      {inputMode:'auto_eod',sourceContext:{session:'2026-10-02'}},{inputMode:'auto_eod',sourceContext:{session:'2026-10-08'}},
      {inputMode:'auto_eod',sourceContext:{session:'2026-10-07',stale:true}}, {}, {inputMode:'auto_eod'},
      ...['2026-02-30','not-a-date','2026-10-7',123,null].map(session=>({inputMode:'auto_eod',sourceContext:{session}}))
    ].map(x=>sqSourceInfo(x).kind));
    assert.deepEqual(plain(x),['synthetic','synthetic','synthetic','manual','eod','eod','stale','stale','stale','unknown','unknown','unknown','unknown','unknown','unknown','unknown']);
  });
  await test('aged provider labels agree in live context, snapshot and share summary', async p => {
    await provider(p);const x=await p.evaluate(()=>({badge:$('sourceBadge').textContent,quality:$('qualityBadge').textContent,target:$('targetContext').textContent,summary:resultSummary(),snapshot:sqSnapshotSource(makeSnapshot('AAPL'))}));
    assert.match(x.badge,/Stale/);assert.match(x.quality,/Stale/);assert.match(x.target,/STALE SNAPSHOT/);assert.match(x.summary,/Not a current quote/);assert.match(x.snapshot,/Stale EOD snapshot/);
  });
  await test('invalid provider session stays visibly unverified rather than claiming EOD', async p => {
    await provider(p);const x=await p.evaluate(()=>{state.dataMeta={source:'Fixture',session:'2026-02-30'};render();return {badge:$('sourceBadge').textContent,quality:$('qualityBadge').textContent,target:$('targetContext').textContent,snapshot:sqSnapshotSource(makeSnapshot('AAPL'))}});
    assert.equal(x.badge,'No verified quote');assert.equal(x.quality,'Unavailable');assert.match(x.target,/SOURCE UNVERIFIED/);assert.match(x.snapshot,/Source unknown/);
  });
  await test('malformed fetched timestamp cannot crash rendering a usable numeric scenario', async p => {
    await provider(p);const x=await p.evaluate(()=>{state.dataMeta.fetchedAt='not-a-date';render();return {valid:!!calc(),quality:$('qualitySummary').textContent}});
    assert.equal(x.valid,true);assert.match(x.quality,/unknown|unavailable|unverified/i);
  });
  await test('future session warnings agree in quality explanation and snapshot', async p => {
    await provider(p);const x=await p.evaluate(()=>{state.dataMeta.session='2026-10-08';render();return {quality:$('qualitySummary').textContent,snapshot:sqSnapshotSource(makeSnapshot('AAPL'))}});
    assert.match(x.snapshot,/Not a current quote/);assert.match(x.quality,/not a current quote|unverified|future/i);
  });
  await test('source markup escapes provider text in saved, watchlist and compare contexts', async p => {
    await provider(p);const x=await p.evaluate(()=>{state.dataMeta.source='<img src=x onerror="alert(1)"> & \'quoted\'';saveCurrent();addToWatchlist('AAPL');const snap=makeSnapshot('MSFT');setWatchlist([...getWatchlist(),{symbol:'MSFT',name:'Microsoft',snapshot:snap}]);setCompareSelection(['AAPL','MSFT']);renderWatchlist();renderComparePanel();return [$('history').innerHTML,$('watchlist').innerHTML,$('comparePanel').innerHTML]});
    for(const markup of x){assert.ok(!markup.includes('<img'));assert.match(markup,/&lt;img/);assert.match(markup,/&amp;/);assert.match(markup,/&#039;quoted&#039;/)}
  });
  await test('saved provider provenance appears immediately and remains independent of later edits', async p => {
    await provider(p);const x=await p.evaluate(()=>{saveCurrent();const before=$('history').innerHTML;$('price').value='199';sqInputChanged('price');renderHistory();const saved=sqJSON('splab_history',[])[0];return {before,after:$('history').innerHTML,mode:saved.inputMode,source:saved.sourceContext.source,price:saved.price}});
    assert.match(x.before,/Fixture provider/);assert.match(x.after,/Fixture provider/);assert.equal(x.mode,'auto_eod');assert.equal(x.source,'Fixture provider');assert.equal(x.price,200);
  });
  await test('synthetic origin survives three save/load cycles, watch sync and compare fallback', async p => {
    const x=await p.evaluate(()=>{const modes=[];for(let i=0;i<3;i++){saveCurrent();loadSaved(sqJSON('splab_history',[])[0].id);modes.push(state.mode)}saveCurrent();addToWatchlist('AAPL');syncWatchSnapshot('AAPL');return {modes,saved:sqJSON('splab_history',[])[0],watch:getWatchlist()[0].snapshot,fallback:latestSavedSnapshot('AAPL'),summary:resultSummary(),quality:$('qualitySummary').textContent}});
    assert.deepEqual(plain(x.modes),['manual','manual','manual']);for(const item of [x.saved,x.watch,x.fallback]){assert.equal(item.inputMode,'manual');assert.equal(item.savedOrigin,'demo')}
    assert.match(x.summary,/SYNTHETIC EXAMPLE/);assert.match(x.quality,/Saved synthetic example/);
  });
  await test('synthetic origin and correction survive a fresh initialization from the saved private session', async p => {
    const items=plain(await p.evaluate(()=>{sqSetCorrection(30);saveCurrent();loadSaved(sqJSON('splab_history',[])[0].id);saveCurrent();return {sq_next_session:sqJSON('sq_next_session',{}),splab_history:sqJSON('splab_history',[]),sq_badges_v1011:sqBadges()}}));
    const reloaded=harness(items),x=await reloaded.evaluate(()=>{saveCurrent();return {mode:state.mode,correction:state.correction,origin:state.savedOrigin,source:sqSourceInfo(sqJSON('splab_history',[])[0]).kind,summary:resultSummary()}});
    assert.equal(x.mode,'manual');assert.equal(x.correction,30);assert.equal(x.origin,'demo');assert.equal(x.source,'synthetic');assert.match(x.summary,/SYNTHETIC EXAMPLE/);
  });
  await test('provider snapshot loads privately while old history keeps its source and a new save is Manual', async p => {
    await provider(p);const x=await p.evaluate(()=>{saveCurrent();const id=sqJSON('splab_history',[])[0].id;loadSaved(id);saveCurrent();const rows=sqJSON('splab_history',[]);return {mode:state.mode,meta:state.dataMeta,newKind:sqSourceInfo(rows[0]).kind,oldKind:sqSourceInfo(rows.find(x=>x.id===id)).kind,calls:networkCalls}});
    assert.equal(x.mode,'manual');assert.equal(x.meta,null);assert.equal(x.newKind,'manual');assert.equal(x.oldKind,'stale');assert.equal(x.calls,0);
  });
  await test('older snapshots with no provenance remain unknown in history, watchlist and comparison', async p => {
    const x=await p.evaluate(()=>{const old={id:'old',ticker:'AAPL',p:'6m',price:100,perf:10,low:90,mid:100,high:110,correction:12,at:'2026-10-01T12:00:00Z'};localStorage.setItem('splab_history',JSON.stringify([old]));setWatchlist([{symbol:'AAPL'},{symbol:'MSFT',snapshot:{...old,period:'2y'}}]);setCompareSelection(['AAPL','MSFT']);renderHistory();renderWatchlist();return {history:$('history').innerHTML,watch:$('watchlist').innerHTML,compare:$('comparePanel').innerHTML,old:sqJSON('splab_history',[])[0]}});
    for(const markup of [x.history,x.watch,x.compare])assert.match(markup,/Source unknown/);assert.equal(x.old.inputMode,undefined);assert.equal(x.old.sourceContext,undefined);
  });
  await test('mixed synthetic, Manual and stale snapshots show their individual horizons and corrections', async p => {
    const x=await p.evaluate(()=>{const base={price:100,perf:10,low:90,mid:100,high:110,updatedAt:'2026-10-01T12:00:00Z'};setWatchlist([
      {symbol:'AAPL',snapshot:{...base,inputMode:'demo',period:'3m',correction:0}},
      {symbol:'MSFT',snapshot:{...base,inputMode:'manual',period:'2y',correction:12}},
      {symbol:'NVDA',snapshot:{...base,inputMode:'auto_eod',period:'1y',correction:30,sourceContext:{source:'Fixture',session:'2026-09-30'}}}
    ]);setCompareSelection(['AAPL','MSFT','NVDA']);renderWatchlist();return {watch:$('watchlist').innerHTML,compare:$('comparePanel').innerHTML,awards:sqBadges().earned}});
    for(const markup of [x.watch,x.compare])for(const text of ['Synthetic example','Manual · unverified','Stale EOD snapshot','3-Month','2-Year','1-Year','0%','12%','30%'])assert.ok(markup.includes(text),text);
    assert.deepEqual(plain(x.awards),{});
  });
  await test('raw application records each supported horizon once without awarding a milestone', async p => {
    await provider(p);const x=await p.evaluate(()=>{const raw=sqSynthetic('AAPL');raw.synthetic=false;for(const period of ['3m','6m','3m','2y']){setPeriod(period);applyAlphaRaw('AAPL',raw,'Fixture')}return sqBadges()});
    assert.deepEqual(plain(x.horizons),['3m','6m','2y']);assert.deepEqual(plain(x.earned),{});
  });
  await test('approximate baseline, invalid raw history and unsupported Manual horizons do not count', async p => {
    await provider(p);const x=await p.evaluate(()=>{const raw=sqSynthetic('AAPL');raw.synthetic=false;raw.weekly=raw.weekly.filter(x=>x.date<'2025-01-01'||x.date>'2026-01-01');applyAlphaRaw('AAPL',raw,'Sparse fixture');const offset=state.dataMeta.baselineOffset;setPeriod('2y');try{applyAlphaRaw('AAPL',{...raw,daily:[]},'Invalid fixture')}catch{}setMode('manual');$('price').value='100';$('perf').value='10';sqVisitHorizon();return {offset,horizons:sqBadges().horizons,earned:sqBadges().earned}});
    assert.ok(x.offset>10);assert.deepEqual(plain(x.horizons),[]);assert.deepEqual(plain(x.earned),{});
  });
  await test('provider completion records the current Barchart horizon with fixture-only traffic', async p => {
    await provider(p);const x=await p.evaluate(async()=>{setPeriod('6m');localStorage.setItem('sq_provider_pref','barchart');localStorage.setItem('splab_barchart_key','TEST_ONLY');const raw=sqSynthetic('AAPL'),records=raw.weekly.map(x=>({...x,tradingDay:x.date}));window.fetch=async url=>{networkCalls++;return {ok:true,json:async()=>({status:{code:200},results:String(url).includes('getQuote')?[{symbol:'AAPL',date:'2026-09-30',close:200}]:records})}};await fetchData();return {horizons:sqBadges().horizons,earned:sqBadges().earned,calls:networkCalls,baseline:state.extra.baselineDate}});
    assert.deepEqual(plain(x.horizons),['6m']);assert.deepEqual(plain(x.earned),{});assert.equal(x.calls,2);assert.ok(x.baseline);
  });
  await test('late successful provider response cannot record the abandoned horizon', async p => {
    await provider(p);const x=await p.evaluate(async()=>{state.sharedApiReady=true;state.sharedApiBase='https://fixture.invalid';let release;window.fetch=()=>new Promise(resolve=>{release=resolve});const task=fetchData();setPeriod('3m');release({ok:true,json:async()=>({...sqSynthetic('AAPL'),ok:true,source:'Fixture',cache:'hit'})});await task;return sqBadges()});
    assert.deepEqual(plain(x.horizons),[]);assert.deepEqual(plain(x.earned),{});
  });
  await test('initial guidance navigates and focuses without analyzing, earning or changing mode', async p => {
    await routeSpy(p);const x=await p.evaluate(()=>{const before=JSON.stringify(sqBadges()),mode=state.mode;for(let i=0;i<4;i++)$('missionNextAction').dispatch('click');return {mission:sqNextMission().target,before,after:JSON.stringify(sqBadges()),mode,sameMode:mode===state.mode,routes,focused,scrolled,calls:networkCalls}});
    assert.equal(x.mission,'analyzeBtn');assert.equal(x.before,x.after);assert.ok(x.sameMode);assert.equal(x.calls,0);assert.deepEqual(plain(x.routes),Array(4).fill('research'));assert.ok(x.focused.every(v=>v.id==='analyzeBtn'&&v.options.preventScroll));assert.ok(x.scrolled.every(v=>v.options.block==='center'));
  });
  await test('invalid Manual first step targets its price input without changing mode', async p => {
    await routeSpy(p);const x=await p.evaluate(()=>{setMode('manual');sqGoToMission();return {target:sqNextMission().target,mode:state.mode,focused:focused.at(-1).id,earned:sqBadges().earned,calls:networkCalls}});
    assert.equal(x.target,'price');assert.equal(x.focused,'price');assert.equal(x.mode,'manual');assert.deepEqual(plain(x.earned),{});assert.equal(x.calls,0);
  });
  for(const [badge,target] of [['trend','reviewTrendsBtn'],['range','reviewRangeBtn'],['season','reviewSampleBtn']])await test(`${badge} guidance exposes evidence and focuses its explicit review control`,async p=>{
    await routeSpy(p);const x=await p.evaluate(({badge,target})=>{const beforeIds=['first','trend','range','season'].slice(0,['first','trend','range','season'].indexOf(badge));for(const id of beforeIds)sqEarn(id);const before=JSON.stringify(sqBadges().earned);$('nextBadgeAction').dispatch('click');return {target:sqNextMission().target,open:$('qualityDetails').open,focus:focused.at(-1).id,tab:$ (target).attributes.tabindex,unchanged:before===JSON.stringify(sqBadges().earned),calls:networkCalls,evidence:badge==='trend'?$('reviewTrendEvidence').textContent:badge==='range'?$('reviewRangeEvidence').textContent:$('sampleCount').textContent}}, {badge,target});
    assert.equal(x.target,target);assert.equal(x.focus,target);assert.equal(x.open,true);assert.equal(x.tab,'0');assert.ok(x.unchanged);assert.equal(x.calls,0);assert.ok(x.evidence.length>10);
  });
  await test('Manual guidance skips unavailable historical evidence and offers a research note',async p=>{
    await routeSpy(p);const x=await p.evaluate(async()=>{setMode('manual');$('price').value='125';$('perf').value='20';await sqAnalyze();sqGoToMission();return {badge:sqNextMission().badge.id,target:sqNextMission().target,focus:focused.at(-1).id,trend:$('reviewTrendsBtn').disabled,range:$('reviewRangeBtn').disabled,season:$('reviewSampleBtn').disabled,calls:networkCalls}});
    assert.equal(x.badge,'saved');assert.equal(x.target,'researchReason');assert.equal(x.focus,'researchReason');assert.ok(x.trend&&x.range&&x.season);assert.equal(x.calls,0);
  });
  await test('after attainable Manual steps, blocked history directs to modes without silently switching',async p=>{
    await routeSpy(p);const x=await p.evaluate(()=>{setMode('manual');$('price').value='125';$('perf').value='20';for(const id of ['first','saved','watch','compare'])sqEarn(id);sqGoToMission();return {target:sqNextMission().target,text:sqNextMission().text,mode:state.mode,focus:focused.at(-1).id,calls:networkCalls}});
    assert.equal(x.target,'dataModes');assert.equal(x.mode,'manual');assert.equal(x.focus,'dataModes');assert.match(x.text,/historical context/);assert.equal(x.calls,0);
  });
  await test('one supported horizon routes to horizon controls, two route to a takeaway without awards',async p=>{
    await routeSpy(p);const x=await p.evaluate(()=>{for(const id of ['first','trend','range','season'])sqEarn(id);const before=sqNextMission().target;sqGoToMission();const first=focused.at(-1).id;setPeriod('3m');const after=sqNextMission().target;sqGoToMission();return {before,after,first,second:focused.at(-1).id,multi:!!sqBadges().earned.multi,calls:networkCalls}});
    assert.equal(x.before,'periodTabs');assert.equal(x.first,'periodTabs');assert.equal(x.after,'researchReason');assert.equal(x.second,'researchReason');assert.equal(x.multi,false);assert.equal(x.calls,0);
  });
  await test('comparison guidance changes view and focus but cannot earn the comparison badge',async p=>{
    await routeSpy(p);const x=await p.evaluate(()=>{for(const id of ['first','trend','range','season','multi','saved','watch'])sqEarn(id);const s=makeSnapshot('AAPL');setWatchlist([{symbol:'AAPL',snapshot:s},{symbol:'MSFT',snapshot:{...s,symbol:'MSFT'}}]);setCompareSelection(['AAPL','MSFT']);sqGoToMission();return {route:routes.at(-1),focus:focused.at(-1).id,compare:!!sqBadges().earned.compare,calls:networkCalls}});
    assert.equal(x.route,'watchlist');assert.equal(x.focus,'watchlist');assert.equal(x.compare,false);assert.equal(x.calls,0);
  });
  await test('without a second instrument comparison guidance routes to Quick Picks',async p=>{
    await routeSpy(p);const x=await p.evaluate(()=>{for(const id of ['first','trend','range','season','multi','saved','watch'])sqEarn(id);addToWatchlist('AAPL');sqGoToMission();return {target:sqNextMission().target,route:routes.at(-1),focus:focused.at(-1).id,compare:!!sqBadges().earned.compare}});
    assert.equal(x.target,'quickPicks');assert.equal(x.route,'research');assert.equal(x.focus,'quickPicks');assert.equal(x.compare,false);
  });
  await test('comparison guidance requires two distinct valid snapshots rather than two watchlist records',async p=>{
    await routeSpy(p);const x=await p.evaluate(()=>{for(const id of ['first','trend','range','season','multi','saved','watch'])sqEarn(id);const valid=makeSnapshot('AAPL');setWatchlist([{symbol:'AAPL',snapshot:valid},{symbol:'MSFT',snapshot:{...valid,low:null}}]);const invalid=sqNextMission().target;sqGoToMission();const invalidFocus=focused.at(-1).id;setWatchlist([{symbol:'AAPL',snapshot:valid},{symbol:'AAPL',snapshot:valid}]);const duplicate=sqNextMission().target;setWatchlist([{symbol:'AAPL',snapshot:valid},{symbol:'MSFT',snapshot:{...valid,symbol:'MSFT'}}]);return {invalid,invalidFocus,duplicate,valid:sqNextMission().target}});
    assert.deepEqual(plain(x),{invalid:'quickPicks',invalidFocus:'quickPicks',duplicate:'quickPicks',valid:'watchlist'});
  });
  await test('rewatching an invalid old zero-target snapshot with blank Manual inputs earns no watch badge',async p=>{
    const x=await p.evaluate(()=>{setMode('manual');const snapshot={price:100,perf:10,low:0,mid:0,high:0};setWatchlist([{symbol:'AAPL',snapshot}]);addToWatchlist('AAPL');return {earned:!!sqBadges().earned.watch,raw:getWatchlist()[0].snapshot,visible:$('watchlist').innerHTML}});
    assert.equal(x.earned,false);assert.equal(x.raw.low,0);assert.match(x.visible,/No analysis snapshot yet/);assert.ok(!x.visible.includes('watch-snapshot'));
  });
  await test('completion remains explicit and revisiting saved research remains a navigation-only action',async p=>{
    await routeSpy(p);const x=await p.evaluate(()=>{for(const id of ['first','trend','range','season','multi','saved','watch','compare'])sqEarn(id);sqGoToMission();const before={target:sqNextMission().target,route:routes.at(-1),focus:focused.at(-1).id,complete:!!sqBadges().earned.complete};$('completeResearchBtn').dispatch('click');const stamp=sqBadges().earned.complete.at;sqGoToMission();$('completeResearchBtn').dispatch('click');return {before,after:{target:sqNextMission().target,route:routes.at(-1),focus:focused.at(-1).id},same:stamp===sqBadges().earned.complete.at,reflection:!!sqBadges().earned.review,calls:networkCalls}});
    assert.deepEqual(plain(x.before),{target:'completeResearchBtn',route:'quests',focus:'completeResearchBtn',complete:false});assert.deepEqual(plain(x.after),{target:'history',route:'saved',focus:'history'});assert.ok(x.same);assert.equal(x.reflection,false);assert.equal(x.calls,0);
  });
  await test('reflection requires a loaded saved note, is explicit, and editing inputs invalidates its context',async p=>{
    const x=await p.evaluate(()=>{$('researchReason').value='A complete saved hypothesis';saveCurrent();const id=sqJSON('splab_history',[])[0].id;const before=$('reviewHypothesisBtn').disabled;loadSaved(id);const loaded={enabled:!$('reviewHypothesisBtn').disabled,earned:!!sqBadges().earned.review};$('price').value='201';sqInputChanged('price');const edited=$('reviewHypothesisBtn').disabled;$('reviewHypothesisBtn').dispatch('click');const premature=!!sqBadges().earned.review;loadSaved(id);$('reviewHypothesisBtn').dispatch('click');return {before,loaded,edited,premature,earned:!!sqBadges().earned.review}});
    assert.equal(x.before,true);assert.deepEqual(plain(x.loaded),{enabled:true,earned:false});assert.equal(x.edited,true);assert.equal(x.premature,false);assert.equal(x.earned,true);
  });
  for(const change of ['correction','settingsIncrement','note','ticker','horizon','mode'])await test(`changing ${change} invalidates loaded reflection while preserving earned progress`,async p=>{
    const x=await p.evaluate(async change=>{
      $('researchReason').value='A saved hypothesis with enough detail';saveCurrent();const id=sqJSON('splab_history',[])[0].id;loadSaved(id);
      const earned=JSON.stringify(sqBadges().earned);
      if(change==='correction'){$('targetCorrection').value='30';await $('targetCorrection').dispatch('input',{target:$('targetCorrection')})}
      if(change==='settingsIncrement'){$('settingsIncrement').value='0.5';await $('settingsIncrement').dispatch('change',{target:$('settingsIncrement')})}
      if(change==='note'){$('researchReason').value='A different hypothesis with enough detail';await $('researchReason').dispatch('input',{target:$('researchReason')})}
      if(change==='ticker'){$('ticker').value='MSFT';await $('ticker').dispatch('input',{target:$('ticker')})}
      if(change==='horizon')setPeriod('3m');
      if(change==='mode')setMode('demo');
      await $('reviewHypothesisBtn').dispatch('click');
      return {id:state.loadedResearchId,disabled:$('reviewHypothesisBtn').disabled,unchanged:earned===JSON.stringify(sqBadges().earned),price:$('price').value,perf:$('perf').value};
    },change);
    assert.equal(x.id,null);assert.equal(x.disabled,true);assert.equal(x.unchanged,true);
    if(change==='ticker'){assert.equal(x.price,'');assert.equal(x.perf,'')}
  });
  await test('same correction value does not invalidate an unchanged loaded note',async p=>{
    const x=await p.evaluate(()=>{$('researchReason').value='A saved hypothesis with enough detail';sqSetCorrection(12);saveCurrent();const id=sqJSON('splab_history',[])[0].id;loadSaved(id);sqSetCorrection(12);return {id:state.loadedResearchId,expected:id,disabled:$('reviewHypothesisBtn').disabled}});
    assert.equal(x.id,x.expected);assert.equal(x.disabled,false);
  });
  await test('malformed numeric saved reason neither crashes rendering nor qualifies for reflection',async p=>{
    const x=await p.evaluate(()=>{localStorage.setItem('splab_history',JSON.stringify([{id:'numeric-note',ticker:'AAPL',price:125,perf:20,p:'1y',reason:12345678901234567890}]));loadSaved('numeric-note');$('reviewHypothesisBtn').dispatch('click');return {disabled:$('reviewHypothesisBtn').disabled,earned:!!sqBadges().earned.review,valid:!!calc()}});
    assert.equal(x.disabled,true);assert.equal(x.earned,false);assert.equal(x.valid,true);
  });
  await test('invalid same-ticker saved price or change clears prior Manual values rather than reusing them',async p=>{
    const x=await p.evaluate(()=>{setMode('manual');const rows=[];for(const [price,perf] of [[null,20],[125,null],['bad',20],[125,'bad'],['',20],[125,'']]){
      $('price').value='125';$('perf').value='20';localStorage.setItem('splab_history',JSON.stringify([{id:'bad',ticker:'AAPL',price,perf,p:'1y',reason:'Previously saved valid-looking note'}]));loadSaved('bad');rows.push({valid:!!calc(),price:$('price').value,perf:$('perf').value,loaded:state.loadedResearchId,disabled:$('reviewHypothesisBtn').disabled})}return rows});
    for(const [i,row] of x.entries()){assert.equal(row.valid,false);assert.equal(row.loaded,null);assert.equal(row.disabled,true);assert.equal(i%2?row.perf:row.price,'')}
  });
  await test('legacy valid numeric strings restore with period divisor and default increment',async p=>{
    const x=await p.evaluate(()=>{setMode('manual');$('increment').value='5';localStorage.setItem('splab_history',JSON.stringify([{id:'legacy',ticker:'AAPL',p:'2y',price:'125',perf:'20',low:'110',mid:'120',high:'140'}]));loadSaved('legacy');return {price:$('price').value,perf:$('perf').value,divisor:Number($('divisor').value),increment:$('increment').value,kind:sqSourceInfo(latestSavedSnapshot('AAPL')).kind,valid:!!calc()}});
    assert.deepEqual(plain(x),{price:'125.00',perf:'20.00',divisor:1.5,increment:'1',kind:'unknown',valid:true});
  });
  await test('missing, null or nonnumeric persisted targets never qualify comparison or display as valid snapshots',async p=>{
    const x=await p.evaluate(()=>{const history=[{id:'null-target',ticker:'AAPL',price:100,perf:10,low:null,mid:100,high:110,at:'2026-10-01'}, {id:'missing-target',ticker:'MSFT',price:200,perf:20,mid:200,high:220,at:'2026-10-01'}];localStorage.setItem('splab_history',JSON.stringify(history));setWatchlist([{symbol:'AAPL'},{symbol:'MSFT'},{symbol:'NVDA',snapshot:{price:140,perf:10,low:'bad',mid:140,high:150}}]);setCompareSelection(['AAPL','MSFT','NVDA']);renderWatchlist();toggleCompare('NVDA');return {eligible:sqCompareSnapshots(),earned:!!sqBadges().earned.compare,watch:$('watchlist').innerHTML,compare:$('comparePanel').innerHTML,history:sqJSON('splab_history',[]),raw:getWatchlist()[2].snapshot.low}});
    assert.deepEqual(plain(x.eligible),[]);assert.equal(x.earned,false);assert.match(x.watch,/No analysis snapshot yet/);assert.match(x.compare,/No snapshot yet/);assert.ok(!x.watch.includes('watch-snapshot'));assert.equal(x.history[0].low,null);assert.equal(x.history[1].low,undefined);assert.equal(x.raw,'bad');
  });
  await test('legacy awards migrate unchanged while repeated guidance cannot manufacture progress',async()=>{
    const legacy={earned:{first:{at:'2026-09-01T12:00:00Z'},trend:{at:'2026-09-02T12:00:00Z'}},stats:{analyses:999}},previous={earned:{note:{at:'2026-09-03T12:00:00Z'}},horizons:['3m']};
    const p=harness({sq_progress:legacy,sq_badges_next:previous});await routeSpy(p);const x=await p.evaluate(()=>{const before=JSON.stringify(sqBadges());for(let i=0;i<5;i++)sqGoToMission();return {before,after:JSON.stringify(sqBadges()),legacy:sqJSON('sq_progress',{}),previous:sqJSON('sq_badges_next',{}),ids:Object.keys(sqBadges().earned).sort()}});
    assert.equal(x.before,x.after);assert.deepEqual(plain(x.legacy),legacy);assert.deepEqual(plain(x.previous),previous);assert.deepEqual(plain(x.ids),['first','saved','trend']);
  });
  console.log(`${passed} research guidance checks passed; ${failed} failed. Browser geometry is not exercised by this suite.`);
  if(failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
