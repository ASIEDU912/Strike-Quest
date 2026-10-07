// Integration behavior under a small DOM adapter and a recorded mascot module.
// These checks do not establish rendered layout or browser accessibility.
// No provider requests are made; all unexpected requests are counted and rejected.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const create = require('./dom-harness.cjs');
const Mascot = require('../mascot.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const at = '2026-10-07T12:00:00.000Z';
const plain = value => JSON.parse(JSON.stringify(value));
const award = () => ({at, mode:'demo'});
let passed = 0, failed = 0;
function harness(seed = {}) {
  const setup = `
    window.networkCalls = 0;
    window.fetch = () => { networkCalls++; throw new Error('Unexpected network request'); };
    const OriginalDate = Date;
    Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [${JSON.stringify(at)}])); }
      static now() { return OriginalDate.parse(${JSON.stringify(at)}); }
    };
    window.mascotCalls = {mounts:[], updates:[], celebrations:[]};
    const mascotStages = ${JSON.stringify(Mascot.STAGES)};
    window.StrikeMascot = {
      stageForXp: xp => mascotStages.slice().reverse().find(stage => xp >= stage.minXp),
      mount: (host, xp, options) => {
        mascotCalls.mounts.push({host:host.id, xp, options});
        let current = xp, paused = options.static;
        host.addEventListener('click', event => {
          const button = event.target.closest?.('[data-mascot-motion]');
          if (button) { paused = !paused; button.setAttribute('aria-pressed',String(paused)); }
        });
        return {update:(next, updateOptions = {}) => {
          mascotCalls.updates.push({xp:next, options:updateOptions});
          if (next === current) return;
          if (next > current && updateOptions.celebrate !== false) mascotCalls.celebrations.push({before:current, xp:next});
          current = next;
        }};
      }
    };
  ` + Object.entries(seed).map(([key,value]) => `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(value))});`).join('');
  return create(html.replace('<script>', '<script>' + setup + '</script><script>'));
}
async function test(name, fn) {
  try { await fn(harness()); passed++; console.log('PASS', name); }
  catch(error) { failed++; console.error('FAIL', name, '\n ', error.stack); }
}
(async () => {
  await test('actual fresh startup selects 2Y, 10% correction and the 1.5 divisor without awards or requests', async p => {
    const x = plain(await p.evaluate(() => ({mode:state.mode,period:state.period,correction:state.correction,
      upper:Number($('correction').value),lower:Number($('targetCorrection').value),divisor:Number($('divisor').value),
      calc:calc(), label:$('coreScenarioLabel').textContent, saved:sqJSON('sq_next_session',{}),
      xp:sqResearchXp(), earned:sqBadges().earned, calls:networkCalls, mascot:mascotCalls})));
    assert.equal(x.mode,'demo'); assert.equal(x.period,'2y'); assert.equal(x.correction,10);
    assert.equal(x.upper,10); assert.equal(x.lower,10); assert.equal(x.divisor,1.5); assert.equal(x.calc.div,1.5);
    assert.match(x.label,/2-Year.*10%/); assert.equal(x.saved.period,'2y'); assert.equal(x.saved.correction,10);
    assert.equal(x.xp,0); assert.deepEqual(x.earned,{}); assert.equal(x.calls,0);
    assert.equal(x.mascot.mounts.length,1); assert.equal(x.mascot.mounts[0].xp,0); assert.deepEqual(x.mascot.celebrations,[]);
    assert.ok(x.mascot.updates.every(call => call.options.celebrate === false));
  });
  await test('saved 3M Manual session restores 20% correction, custom divisor and exact private inputs', async () => {
    const saved={mode:'manual',ticker:'MSFT',period:'3m',correction:20,price:'125.125',perf:'-6.375',divisor:'3.5',increment:'0.5',reason:'A saved private hypothesis.'};
    const p=harness({sq_next_session:saved}),x=plain(await p.evaluate(()=>({mode:state.mode,period:state.period,
      correction:state.correction,lower:Number($('targetCorrection').value),price:$('price').value,perf:$('perf').value,
      divisor:$('divisor').value,increment:$('increment').value,reason:$('researchReason').value,ticker:$('ticker').value,
      calc:calc(),calls:networkCalls,earned:sqBadges().earned,label:$('coreScenarioLabel').textContent})));
    for(const key of ['mode','period','correction','price','perf','divisor','increment','reason','ticker'])assert.equal(x[key],saved[key],key);
    assert.equal(x.lower,20); assert.equal(x.calc.div,3.5); assert.match(x.label,/3-Month.*20%/); assert.equal(x.calls,0); assert.deepEqual(x.earned,{});
  });
  await test('a saved Demo horizon and zero correction override the fresh defaults', async () => {
    const p=harness({sq_next_session:{mode:'demo',ticker:'AAPL',period:'6m',correction:0,divisor:'4.25',increment:'0.5'}});
    const x=await p.evaluate(()=>({period:state.period,correction:state.correction,divisor:Number($('divisor').value),low:calc().low,high:calc().high,calls:networkCalls}));
    assert.equal(x.period,'6m'); assert.equal(x.correction,0); assert.equal(x.divisor,4.25); assert.equal(x.low,x.high); assert.equal(x.calls,0);
  });
  await test('primary research tools are reachable focus targets with no mode, input, award or network changes', async p => {
    const x=plain(await p.evaluate(async()=>{
      window.focused=[];window.scrolled=[];
      for(const id of ['scenarioSection','analysisSeasonality']){$(id).focus=()=>focused.push(id);$(id).scrollIntoView=()=>scrolled.push(id)}
      const snapshot=()=>JSON.stringify({mode:state.mode,period:state.period,correction:state.correction,price:$('price').value,perf:$('perf').value,divisor:$('divisor').value,saved:sqJSON('sq_next_session',{}),earned:sqBadges().earned,xp:sqResearchXp()});
      const before=snapshot();for(let i=0;i<4;i++){await $('openTargetsBtn').dispatch('click');await $('openSeasonalityBtn').dispatch('click')}
      return {before,after:snapshot(),focused,scrolled,active:$('analysisSeasonality').classList.contains('active'),view:$('viewResearch').classList.contains('active'),calls:networkCalls,celebrations:mascotCalls.celebrations};
    }));
    assert.equal(x.before,x.after); assert.deepEqual(x.focused,Array(4).fill(['scenarioSection','analysisSeasonality']).flat());
    assert.deepEqual(x.scrolled,x.focused); assert.ok(x.active&&x.view); assert.equal(x.calls,0); assert.deepEqual(x.celebrations,[]);
    for(const id of ['scenarioSection','analysisSeasonality'])assert.match(html,new RegExp(`id="${id}"[^>]*tabindex="-1"`));
  });
  await test('Manual seasonality stays available to open and truthfully shows no invented sample', async p => {
    const x=plain(await p.evaluate(async()=>{setMode('manual');$('price').value='125';$('perf').value='20';render();await $('openSeasonalityBtn').dispatch('click');return {mode:state.mode,active:$('analysisSeasonality').classList.contains('active'),grid:$('seasonalityGrid').innerHTML,signal:$('seasonalitySignal').textContent,obs:$('seasonalityObs').textContent,avg:$('seasonalityAvg').textContent,earned:sqBadges().earned,calls:networkCalls}}));
    assert.equal(x.mode,'manual');assert.equal(x.active,true);assert.match(x.grid,/No complete monthly sample/);
    assert.equal(x.signal,'Unavailable');assert.equal(x.obs,'—');assert.equal(x.avg,'—');assert.deepEqual(x.earned,{});assert.equal(x.calls,0);
  });
  await test('Demo to empty Manual clears every stale seasonality claim when the tool is opened', async p => {
    const x=plain(await p.evaluate(async()=>{await $('openSeasonalityBtn').dispatch('click');const demo=$('seasonalityCurrentText').textContent;setMode('manual');await $('openSeasonalityBtn').dispatch('click');return {demo,price:$('price').value,perf:$('perf').value,current:$('seasonalityCurrentText').textContent,signal:$('seasonalitySignal').textContent,source:$('seasonalitySource').textContent,specific:$('seasonalitySpecificSource').textContent,hit:$('seasonalityHit').textContent,avg:$('seasonalityAvg').textContent,obs:$('seasonalityObs').textContent,extra:state.extra,earned:sqBadges().earned,calls:networkCalls}}));
    assert.match(x.demo,/Strongest average month/);assert.equal(x.price,'');assert.equal(x.perf,'');assert.match(x.current,/No complete monthly sample/);
    assert.equal(/Strongest|Weakest|Calendar range/.test(x.current),false);assert.equal(x.signal,'Unavailable');assert.equal(x.source,'No monthly history');assert.equal(x.specific,'No monthly history');
    for(const key of ['hit','avg','obs'])assert.equal(x[key],'—');assert.deepEqual(x.extra,{});assert.deepEqual(x.earned,{});assert.equal(x.calls,0);
  });
  for(const action of ['mode','price','ticker'])await test(`active seasonality clears stale statistics immediately after ${action} invalidation without reopening`,async p=>{
    const x=plain(await p.evaluate(async action=>{
      const query=document.querySelector;document.querySelector=selector=>selector==='#analysisSeasonality.active'?($('analysisSeasonality').classList.contains('active')?$('analysisSeasonality'):null):query(selector);
      if(action==='price'){setMode('auto_eod');const raw=sqSynthetic('AAPL');raw.synthetic=false;applyAlphaRaw('AAPL',raw,'Local test provider')}
      sqOpenResearchTool('seasonality');const before=$('seasonalityCurrentText').textContent;
      if(action==='mode')setMode('manual');
      if(action==='price'){$('price').value='125';sqInputChanged('price')}
      if(action==='ticker'){$('ticker').value='NVDA';await $('ticker').dispatch('input')}
      return {before,current:$('seasonalityCurrentText').textContent,grid:$('seasonalityGrid').innerHTML,signal:$('seasonalitySignal').textContent,source:$('seasonalitySource').textContent,hit:$('seasonalityHit').textContent,avg:$('seasonalityAvg').textContent,obs:$('seasonalityObs').textContent,visible:$('researchContext').style.display,earned:sqBadges().earned,calls:networkCalls};
    },action));
    assert.match(x.before,/Strongest average month/);assert.match(x.current,/No complete monthly sample/);assert.match(x.grid,/No complete monthly sample/);assert.equal(x.signal,'Unavailable');assert.equal(x.source,'No monthly history');
    for(const key of ['hit','avg','obs'])assert.equal(x[key],'—');assert.equal(x.visible,'');assert.deepEqual(x.earned,{});assert.equal(x.calls,0);
  });
  await test('mission progress mirrors the next-milestone indicator through an explicit research step', async p => {
    const values=plain(await p.evaluate(async()=>{const read=()=>({a:[$('missionNextProgress').max,$('missionNextProgress').value],b:[$('nextBadgeProgress').max,$('nextBadgeProgress').value],title:$('missionNextTitle').textContent});const before=read();await sqAnalyze();return {before,after:read()}}));
    assert.deepEqual(values.before.a,values.before.b);assert.deepEqual(values.after.a,values.after.b);assert.notEqual(values.before.title,values.after.title);
    assert.ok(values.before.a[1]<=values.before.a[0]&&values.after.a[1]<=values.after.a[0]);
  });
  await test('valid dated legacy core awards migrate into XP without trusting old XP or counters', async () => {
    const legacy={xp:999999,stats:{analyses:999,saved:999},earned:{first:award(),trend:award()}},previous={xp:999999,earned:{note:award()}};
    const p=harness({sq_progress:legacy,sq_badges_next:previous}),x=plain(await p.evaluate(()=>({xp:sqResearchXp(),legacy:sqJSON('sq_progress',{}),previous:sqJSON('sq_badges_next',{}),mount:mascotCalls.mounts[0],events:mascotCalls.celebrations})));
    assert.equal(x.xp,125);assert.equal(x.mount.xp,125);assert.deepEqual(x.events,[]);assert.deepEqual(x.legacy,legacy);assert.deepEqual(x.previous,previous);
  });
  await test('inflated historical counters and XP alone do not evolve Lumi', async () => {
    const p=harness({sq_progress:{xp:999999,earned:{},stats:{analyses:999,saved:999,watch:999,compare:999}},sq_badges_next:{xp:999999,earned:{},horizons:['3m','6m','1y','2y','3y']}});
    const x=await p.evaluate(()=>({xp:sqResearchXp(),summary:$('companionSummary').textContent,earned:sqBadges().earned}));
    assert.equal(x.xp,0);assert.match(x.summary,/Rookie.*0 XP/);assert.deepEqual(plain(x.earned),{});
  });
  await test('XP ignores malformed dated records, unknown awards and the reflection milestone', async () => {
    const earned={first:award(),trend:{at:'bad'},range:true,season:[],multi:{at:123},saved:{},watch:null,compare:{at:''},complete:'2026-10-07',review:award(),unknown:award()};
    const p=harness({sq_badges_v1011:{version:1,earned,horizons:[]}}),x=await p.evaluate(()=>({xp:sqResearchXp(),summary:$('companionSummary').textContent}));
    assert.equal(x.xp,50);assert.match(x.summary,/Signal Scout.*50 XP/);
  });
  await test('all nine valid core records give exactly 500 XP and reflection adds no XP', async p => {
    const x=await p.evaluate(()=>{const earned=Object.fromEntries(SQ_CORE.map(step=>[step.id,{at:new Date().toISOString()}]));sqBadgeSave({version:1,earned,horizons:[]});const before=sqResearchXp();earned.review={at:new Date().toISOString()};earned.unknown={at:new Date().toISOString()};sqBadgeSave({version:1,earned,horizons:[]});sqRenderCompanion(false);return {before,after:sqResearchXp(),summary:$('companionSummary').textContent,events:mascotCalls.celebrations}});
    assert.equal(x.before,500);assert.equal(x.after,500);assert.match(x.summary,/Insight Voyager.*500 XP/);assert.deepEqual(plain(x.events),[]);
  });
  await test('repeated rendering, guidance, correction and horizon changes cannot grant XP or celebrate', async p => {
    const x=plain(await p.evaluate(()=>{const before=JSON.stringify(sqBadges().earned);for(let i=0;i<5;i++){render();sqRenderBadges();sqRenderCompanion();sqGoToMission();sqOpenResearchTool('targets');sqOpenResearchTool('seasonality');sqSetCorrection(i%2?30:0);setPeriod(i%2?'3m':'2y')}return {before,after:JSON.stringify(sqBadges().earned),xp:sqResearchXp(),events:mascotCalls.celebrations,mounts:mascotCalls.mounts.length,calls:networkCalls}}));
    assert.equal(x.before,x.after);assert.equal(x.xp,0);assert.deepEqual(x.events,[]);assert.equal(x.mounts,1);assert.equal(x.calls,0);
  });
  await test('a repeated explicit analysis earns 50 XP once and leaves its timestamp unchanged', async p => {
    const x=plain(await p.evaluate(async()=>{await sqAnalyze();const first=JSON.stringify(sqBadges().earned.first);for(let i=0;i<5;i++){await sqAnalyze();render();sqRenderCompanion()}return {first,last:JSON.stringify(sqBadges().earned.first),xp:sqResearchXp(),events:mascotCalls.celebrations,trueUpdates:mascotCalls.updates.filter(x=>x.options.celebrate),calls:networkCalls}}));
    assert.equal(x.first,x.last);assert.equal(x.xp,50);assert.deepEqual(x.events,[{before:0,xp:50}]);assert.equal(x.trueUpdates.length,1);assert.equal(x.calls,0);
  });
  await test('the explicit nine-step research path reaches 500 XP once without paying XP for reflection', async p => {
    const x=plain(await p.evaluate(async()=>{
      await sqAnalyze();await $('reviewTrendsBtn').dispatch('click');await $('reviewRangeBtn').dispatch('click');await $('reviewSampleBtn').dispatch('click');
      setPeriod('3m');$('researchReason').value='I compared two synthetic horizons before saving this scenario.';sqSaveNote();
      addToWatchlist('AAPL');applySymbol('MSFT');addToWatchlist('MSFT');toggleCompare('AAPL');toggleCompare('MSFT');await $('completeResearchBtn').dispatch('click');
      const before=sqResearchXp(),events=mascotCalls.celebrations.length;loadSaved(sqJSON('splab_history',[])[0].id);await $('reviewHypothesisBtn').dispatch('click');
      for(let i=0;i<4;i++){sqEarn('complete');sqEarn('review');sqRenderBadges()}
      return {before,after:sqResearchXp(),events,afterEvents:mascotCalls.celebrations.length,ids:Object.keys(sqBadges().earned),summary:$('companionSummary').textContent,progress:[$('missionNextProgress').value,$('missionNextProgress').max],calls:networkCalls};
    }));
    assert.equal(x.before,500);assert.equal(x.after,500);assert.equal(x.events,9);assert.equal(x.afterEvents,9);assert.equal(x.ids.length,10);assert.ok(x.ids.includes('review'));assert.match(x.summary,/Insight Voyager/);assert.deepEqual(x.progress,[9,9]);assert.equal(x.calls,0);
  });
  await test('collapsed preference suppresses celebration, persists toggles and never awards research', async () => {
    const p=harness({sq_companion_collapsed:true});const x=plain(await p.evaluate(async()=>{const initial=$('companionPanel').open;await sqAnalyze();const whileClosed=mascotCalls.celebrations.length;$('companionPanel').open=true;await $('companionPanel').dispatch('toggle');await $('reviewTrendsBtn').dispatch('click');return {initial,whileClosed,pref:localStorage.getItem('sq_companion_collapsed'),xp:sqResearchXp(),events:mascotCalls.celebrations}}));
    assert.equal(x.initial,false);assert.equal(x.whileClosed,0);assert.equal(x.pref,'false');assert.equal(x.xp,100);assert.deepEqual(x.events,[{before:50,xp:100}]);
  });
  await test('pause state persists after synchronous module toggles and restores silently on reload', async p => {
    const saved=plain(await p.evaluate(async()=>{const button={attrs:{'aria-pressed':'false'},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},closest(){return this}};await $('companionHost').dispatch('click',{target:button});$('companionPanel').open=false;await $('companionPanel').dispatch('toggle');return {paused:JSON.parse(localStorage.getItem('sq_companion_paused')),collapsed:JSON.parse(localStorage.getItem('sq_companion_collapsed')),xp:sqResearchXp(),earned:sqBadges().earned}}));
    assert.equal(saved.paused,true);assert.equal(saved.collapsed,true);assert.equal(saved.xp,0);assert.deepEqual(saved.earned,{});
    const reload=harness({sq_companion_paused:saved.paused,sq_companion_collapsed:saved.collapsed}),x=plain(await reload.evaluate(()=>({open:$('companionPanel').open,mount:mascotCalls.mounts[0],events:mascotCalls.celebrations,xp:sqResearchXp()})));
    assert.equal(x.open,false);assert.equal(x.mount.options.static,true);assert.equal(x.xp,0);assert.deepEqual(x.events,[]);
  });
  await test('resuming animation clears only the pause preference and preserves earned XP', async () => {
    const p=harness({sq_companion_paused:true,sq_badges_v1011:{version:1,earned:{first:award()},horizons:[]}}),x=plain(await p.evaluate(async()=>{const button={attrs:{'aria-pressed':'true'},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},closest(){return this}};await $('companionHost').dispatch('click',{target:button});return {pref:localStorage.getItem('sq_companion_paused'),xp:sqResearchXp(),events:mascotCalls.celebrations,at:sqBadges().earned.first.at}}));
    assert.equal(x.pref,'false');assert.equal(x.xp,50);assert.equal(x.at,at);assert.deepEqual(x.events,[]);
  });
  console.log(`${passed} core-experience integration checks passed; ${failed} failed. Mascot module is stubbed; rendered browser behavior is not exercised.`);
  if(failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
