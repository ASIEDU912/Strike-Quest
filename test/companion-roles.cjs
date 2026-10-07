// App-role behavior with recorded mascot controllers. These are not browser/layout
// assertions: geometry is supplied explicitly and every provider path is local.
const assert = require('node:assert/strict');
const {harness, plain} = require('./core-experience.cjs');
const contexts = ['research','quests','seasonality','saved','watchlist'];
const hostIds = {research:'companionHost',quests:'questsCompanionHost',seasonality:'seasonalityCompanionHost',saved:'savedCompanionHost',watchlist:'watchlistCompanionHost'};
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(harness()); passed++; console.log('PASS',name); }
  catch(error) { failed++; console.error('FAIL',name,'\n ',error.stack); }
}
async function fixture(p, setup) { if (setup) await p.evaluate(setup); }
async function inertAction(p, context, target, action) {
  const result=plain(await p.evaluate(async ({context,host,target}) => {
    window.providerCalls=[];
    for(const name of ['fetchData','loadPublicConfig','maybeAutoLoadEod','fetchAlphaData','fetchSharedData','fetchBarchartData','runPredictiveSearch']) {
      window[name]=()=>{providerCalls.push(name);throw new Error('Guide called provider path '+name);};
    }
    const snapshot=()=>JSON.stringify({state,calc:calc(),inputs:Object.fromEntries(['ticker','price','perf','divisor','increment','researchReason','correction','targetCorrection'].map(id=>[id,$(id).value])),xp:sqResearchXp(),badges:sqBadges(),storage:storageSnapshot(),requestSerial:marketRequestSerial});
    const before=snapshot(),guide=sqCompanionGuide(context),celebrations=mascotCalls.celebrations.length;
    window.focused=[];window.scrolled=[];
    for(const id of ['scenarioSection','price','analyzeBtn','dataModes','coverageSummary','seasonModeSwitch','researchReason','history','watchCurrentBtn','watchlist','comparePanel','reviewTrendsBtn','completeResearchBtn']) {
      $(id).focus=()=>{document.activeElement=$(id);focused.push(id);};
      $(id).scrollIntoView=()=>scrolled.push(id);
    }
    storageWrites.length=0;
    for(let i=0;i<3;i++) await $(host).dispatch('click',{target:{closest:selector=>selector==='[data-mascot-action]'?{}:null}});
    return {before,after:snapshot(),guide,focused,scrolled,view:sqCompanionView,details:$('qualityDetails').open,
      storageWrites,networkCalls,providerCalls,celebrations:mascotCalls.celebrations.length-celebrations,
      mountedGuide:mascotCalls.states[context].guide,targetFocused:document.activeElement?.id===target};
  },{context,host:hostIds[context],target}));
  assert.equal(result.guide.action,action);
  assert.equal(result.before,result.after,'guide navigation must preserve every input, calculation, request serial, data snapshot, award and storage value');
  assert.deepEqual(result.storageWrites,[],'navigation must not even rewrite unchanged persistent state');
  assert.deepEqual(result.providerCalls,[]);assert.equal(result.networkCalls,0);assert.equal(result.celebrations,0);
  assert.equal(result.focused.length>=3,true);assert.equal(result.focused.at(-1),target);assert.equal(result.scrolled.at(-1),target);assert.equal(result.targetFocused,true);
  return result;
}
const saveNote=()=>{$('researchReason').value='I will revisit the assumptions in this saved scenario.';saveCurrent();};
const loadNote=()=>{$('researchReason').value='I will revisit the assumptions in this saved scenario.';saveCurrent();loadSaved(sqJSON('splab_history',[])[0].id);};
const watchOne=()=>{const snapshot=makeSnapshot('AAPL');setWatchlist([{symbol:'AAPL',snapshot}]);renderWatchlist();};
const watchTwo=()=>{const snapshot=makeSnapshot('AAPL');setWatchlist([{symbol:'AAPL',snapshot},{symbol:'MSFT',snapshot:{...snapshot,symbol:'MSFT'}}]);setCompareSelection(['AAPL','MSFT']);renderWatchlist();renderComparePanel();};
async function seasonalFixture(p, source='synthetic') {
  await p.evaluate(source=>{
    const raw=sqSynthetic('AAPL');
    raw.monthly=[2023,2024,2025].flatMap(year=>[{date:year+'-09-30',close:100},{date:year+'-10-31',close:110},{date:year+'-11-30',close:105}]);
    // October 2026 is incomplete. It must never add an observation despite its large return.
    raw.monthly.push({date:'2026-09-30',close:150},{date:'2026-10-31',close:900});
    if(source==='synthetic')state.demoRaw=raw;
    else {setMode('auto_eod');raw.synthetic=false;raw.daily.at(-1).date=source==='fresh'?'2026-10-07':'2026-09-30';raw.savedAt=Date.now();}
    applyAlphaRaw('AAPL',raw,'Local fixture history');
    if(source==='unknown')state.dataMeta.session='invalid';
    render();renderSeasonality();
  },source);
}
(async()=>{
  await test('five contextual placements mount once, share XP and have distinct controller prefixes',async p=>{
    const x=plain(await p.evaluate(()=>({mounts:mascotCalls.mounts,states:mascotCalls.states,contexts:[...sqCompanions.keys()],events:mascotCalls.celebrations})));
    assert.deepEqual(x.contexts.slice().sort(),contexts.slice().sort());assert.equal(x.mounts.length,5);
    assert.equal(new Set(x.mounts.map(m=>m.host)).size,5);assert.equal(new Set(x.mounts.map(m=>m.options.idPrefix)).size,5);
    for(const mount of x.mounts){assert.equal(mount.xp,0);assert.equal(mount.hasPauseCallback,true);assert.equal(mount.options.announce,false,'only the central award toast may announce earned progress');assert.equal(mount.options.compact,mount.options.context!=='quests');assert.ok(mount.options.guide.title&&mount.options.guide.text&&mount.options.guide.label);}
    for(const [context,state] of Object.entries(x.states)){assert.equal(state.xp,0);assert.equal(state.active,context==='research');assert.equal(state.greetings,context==='research'?1:0);}
    assert.deepEqual(x.events,[]);
  });
  const navigationCases=[
    ['Research scenario','research',null,'scenarioSection','targets'],
    ['Research invalid inputs','research',()=>setMode('manual'),'price','inputs'],
    ['Research loaded note','research',loadNote,'researchReason','review'],
    ['Quests first milestone','quests',null,'analyzeBtn','mission'],
    ['Quests historical evidence','quests',()=>sqEarn('first'),'reviewTrendsBtn','mission'],
    ['Seasonality sample','seasonality',null,'coverageSummary','sample'],
    ['Seasonality unavailable history','seasonality',()=>setMode('manual'),'dataModes','modes'],
    ['Seasonality empty selection','seasonality',()=>{setSeasonalityMode('specific');saveSelectedSeasonYears([]);renderSeasonality();},'seasonModeSwitch','seasonControls'],
    ['Saved empty collection','saved',null,'researchReason','notes'],
    ['Saved existing record','saved',saveNote,'history','history'],
    ['Saved loaded note','saved',loadNote,'researchReason','review'],
    ['Watchlist empty valid scenario','watchlist',null,'watchCurrentBtn','watch'],
    ['Watchlist empty invalid scenario','watchlist',()=>setMode('manual'),'price','inputs'],
    ['Watchlist one usable snapshot','watchlist',watchOne,'watchlist','watchlist'],
    ['Watchlist two selected snapshots','watchlist',watchTwo,'comparePanel','compare']
  ];
  for(const [name,context,setup,target,action] of navigationCases) await test(`${name} helper is repeatable focus-only navigation`,async p=>{
    await fixture(p,setup);const x=await inertAction(p,context,target,action);
    assert.equal(x.view,['history','watchlist','compare'].includes(action)?action==='history'?'saved':'watchlist':'research');
    if(action==='sample')assert.equal(x.details,true);
  });
  for(const source of ['synthetic','fresh','stale','unknown']) await test(`Seasonality ${source} guide reports exact complete-month counts and source limits`,async p=>{
    await seasonalFixture(p,source);
    const x=plain(await p.evaluate(()=>({guide:sqCompanionGuide('seasonality'),mounted:mascotCalls.states.seasonality.guide,n:state.extra.seasonality.currentMonth.observations,total:state.extra.seasonality.totalMonths,display:$('seasonalityObs').textContent,xp:sqResearchXp(),calls:networkCalls})));
    assert.equal(x.n,3);assert.equal(x.total,6);assert.equal(x.display,'3');assert.match(x.guide.text,/3 Oct observation/);assert.match(x.guide.text,/small sample.*uncertain/i);assert.match(x.guide.text,/not forecasts/);
    assert.match(x.guide.text,source==='synthetic'?/Synthetic learning example/:source==='fresh'?/Historical end-of-day sample/:source==='stale'?/Stale historical snapshot.*Verify/:/Source is unverified/);
    assert.equal(x.guide.action,'sample');assert.deepEqual(x.mounted,x.guide);assert.equal(x.xp,0);assert.equal(x.calls,0);
    await inertAction(p,'seasonality','coverageSummary','sample');
  });
  await test('selected years update actual sample counts including singular and zero observations',async p=>{
    await seasonalFixture(p);
    const rows=plain(await p.evaluate(()=>{
      setSeasonalityMode('specific');const rows=[];
      for(const years of [[2024,2025],[2025],[]]){saveSelectedSeasonYears(years);renderSeasonality();rows.push({years,guide:sqCompanionGuide('seasonality'),mounted:mascotCalls.states.seasonality.guide,n:state.extra.seasonality.currentMonth.observations,display:$('seasonalityObs').textContent});}
      return rows;
    }));
    for(let i=0;i<rows.length;i++){const row=rows[i],n=2-i;assert.equal(row.n,n);assert.equal(row.display,String(n));assert.match(row.guide.text,new RegExp(`${n} Oct observation${n===1?' in':'s in'}`));assert.deepEqual(row.guide,row.mounted);}
    assert.match(rows[0].guide.text,/Selected years: 2024, 2025/);assert.match(rows[1].guide.text,/Selected years: 2025/);
    assert.equal(rows[2].guide.action,'seasonControls');assert.match(rows[2].guide.text,/Selected years: none/);assert.doesNotMatch(rows[2].guide.text,/small sample/);
    await inertAction(p,'seasonality','seasonModeSwitch','seasonControls');
  });
  for(const change of ['mode','price','perf','ticker']) await test(`${change} invalidation clears mounted seasonal claims without extra navigation`,async p=>{
    await seasonalFixture(p,'fresh');
    const x=plain(await p.evaluate(async change=>{
      sqOpenResearchTool('seasonality');const before=mascotCalls.states.seasonality.guide;
      if(change==='mode')setMode('manual');
      if(change==='price'||change==='perf'){$(change).value=change==='price'?'125.125':'-6.375';await $(change).dispatch('input',{target:$(change)});}
      if(change==='ticker'){$('ticker').value='MSFT';await $('ticker').dispatch('input',{target:$('ticker')});}
      return {before,guide:sqCompanionGuide('seasonality'),mounted:mascotCalls.states.seasonality.guide,extra:state.extra,meta:state.dataMeta,xp:sqResearchXp(),calls:networkCalls};
    },change));
    assert.match(x.before.text,/3 Oct observations/);assert.equal(x.guide.action,'modes');assert.match(x.guide.text,/No complete monthly history/);assert.doesNotMatch(x.guide.text,/3 Oct|end-of-day sample/);assert.deepEqual(x.guide,x.mounted);assert.deepEqual(x.extra,{});assert.equal(x.meta,null);assert.equal(x.xp,0);assert.equal(x.calls,0);
    await inertAction(p,'seasonality','dataModes','modes');
  });
  for(const method of ['deleteSaved','clearAllSaved']) await test(`${method} immediately removes loaded-note review eligibility and refreshes both guides`,async p=>{
    await fixture(p,loadNote);
    const x=plain(await p.evaluate(method=>{
      const before=sqCompanionGuide('saved'),earned=JSON.stringify(sqBadges().earned),id=state.loadedResearchId;
      if(method==='deleteSaved')deleteSaved(id);else clearAllSaved();
      return {before,loaded:state.loadedResearchId,disabled:$('reviewHypothesisBtn').disabled,saved:mascotCalls.states.saved.guide,research:mascotCalls.states.research.guide,unchanged:earned===JSON.stringify(sqBadges().earned),count:sqJSON('splab_history',[]).length,calls:networkCalls};
    },method));
    assert.equal(x.before.action,'review');assert.equal(x.loaded,null);assert.equal(x.disabled,true);assert.equal(x.saved.action,'notes');assert.equal(x.research.action,'targets');assert.equal(x.count,0);assert.equal(x.unchanged,true);assert.equal(x.calls,0);
  });
  for(const reason of ['', 'too short', 123456789012345]) await test(`invalid saved note ${typeof reason==='number'?'number':JSON.stringify(reason)} cannot produce a review guide`,async p=>{
    const x=plain(await p.evaluate(reason=>{
      localStorage.setItem('splab_history',JSON.stringify([{id:'invalid-note',ticker:'AAPL',p:'2y',price:125,perf:20,reason}]));loadSaved('invalid-note');
      return {saved:sqCompanionGuide('saved'),research:sqCompanionGuide('research'),mounted:mascotCalls.states.saved.guide,disabled:$('reviewHypothesisBtn').disabled,earned:sqBadges().earned};
    },reason));
    assert.equal(x.saved.action,'history');assert.equal(x.research.action,'targets');assert.equal(x.disabled,true);assert.deepEqual(x.mounted,x.saved);assert.deepEqual(x.earned,{});
  });
  for(const change of ['price','perf','divisor','increment','correction','note','ticker','horizon','mode']) await test(`${change} change invalidates both loaded-note guides without changing earned progress`,async p=>{
    await fixture(p,loadNote);
    const x=plain(await p.evaluate(async change=>{
      const earned=JSON.stringify(sqBadges().earned),before=mascotCalls.states.saved.guide.action;
      if(['price','perf','divisor','increment'].includes(change)){$(change).value={price:'130',perf:'25',divisor:'3.5',increment:'0.5'}[change];sqInputChanged(change);}
      if(change==='correction')sqSetCorrection(20);
      if(change==='note'){$('researchReason').value='A changed hypothesis to save separately.';await $('researchReason').dispatch('input');}
      if(change==='ticker'){$('ticker').value='MSFT';await $('ticker').dispatch('input');}
      if(change==='horizon')setPeriod('3m');
      if(change==='mode')setMode('demo');
      return {before,saved:mascotCalls.states.saved.guide,research:mascotCalls.states.research.guide,loaded:state.loadedResearchId,disabled:$('reviewHypothesisBtn').disabled,unchanged:earned===JSON.stringify(sqBadges().earned),calls:networkCalls};
    },change));
    assert.equal(x.before,'review');assert.equal(x.loaded,null);assert.equal(x.disabled,true);assert.equal(x.saved.action,'history');assert.notEqual(x.research.action,'review');assert.equal(x.unchanged,true);assert.equal(x.calls,0);
  });
  await test('Watchlist guide counts 0, 1 and 2 usable snapshots, rejects corrupt records and deduplicates selections',async p=>{
    const x=plain(await p.evaluate(()=>{
      const s=makeSnapshot('AAPL'),rows=[];
      for(let usable=0;usable<=2;usable++){
        setWatchlist([{symbol:'AAPL',snapshot:usable>0?s:{...s,low:null}},{symbol:'MSFT',snapshot:usable>1?{...s,symbol:'MSFT'}:{...s,price:0}},{symbol:'NVDA',snapshot:{...s,high:'invalid'}}]);
        setCompareSelection(['AAPL','MSFT','NVDA']);renderWatchlist();renderComparePanel();
        rows.push({guide:sqCompanionGuide('watchlist'),mounted:mascotCalls.states.watchlist.guide,selected:sqCompareSnapshots().length});
      }
      setCompareSelection(['AAPL','AAPL']);renderComparePanel();
      return {rows,duplicate:sqCompanionGuide('watchlist'),selected:sqCompareSnapshots().length,earned:sqBadges().earned,xp:sqResearchXp(),calls:networkCalls};
    }));
    assert.deepEqual(x.rows.map(r=>r.selected),[0,1,2]);assert.deepEqual(x.rows.map(r=>r.guide.action),['watch','watchlist','compare']);
    assert.match(x.rows[1].guide.text,/1 usable research snapshot is/);assert.match(x.rows[2].guide.text,/2 usable snapshots selected/);assert.match(x.rows[2].guide.text,/source, session, horizon and correction/);assert.match(x.rows[2].guide.text,/not an investment ranking/);
    for(const row of x.rows)assert.deepEqual(row.guide,row.mounted);
    assert.equal(x.selected,1);assert.equal(x.duplicate.action,'watchlist');assert.deepEqual(x.earned,{});assert.equal(x.xp,0);assert.equal(x.calls,0);
  });
  await test('removing or invalidating a selected snapshot refreshes the comparison guide immediately',async p=>{
    await fixture(p,watchTwo);
    const x=plain(await p.evaluate(()=>{
      const before=mascotCalls.states.watchlist.guide;const list=getWatchlist();list[1].snapshot.low=null;setWatchlist(list);renderWatchlist();renderComparePanel();const invalid=mascotCalls.states.watchlist.guide;
      setWatchlist([]);renderWatchlist();renderComparePanel();return {before,invalid,empty:mascotCalls.states.watchlist.guide,earned:sqBadges().earned,calls:networkCalls};
    }));
    assert.equal(x.before.action,'compare');assert.equal(x.invalid.action,'watchlist');assert.match(x.invalid.text,/1 usable/);assert.equal(x.empty.action,'watch');assert.deepEqual(x.earned,{});assert.equal(x.calls,0);
  });
  await test('one award celebrates only the active visible placement while all five receive the same XP',async p=>{
    const x=plain(await p.evaluate(()=>{
      const rows=[];
      for(const [context,badge] of [['research','first'],['quests','trend'],['seasonality','range'],['saved','season'],['watchlist','multi']]){
        setView(context==='seasonality'?'research':context);if(context==='seasonality')setAnalysisTab('seasonality');
        const n=mascotCalls.celebrations.length;sqEarn(badge);
        rows.push({context,newEvents:mascotCalls.celebrations.length-n,host:mascotCalls.celebrationHosts.at(-1),xp:sqResearchXp(),states:Object.values(mascotCalls.states).map(s=>s.xp)});
      }
      return {rows,mounts:mascotCalls.mounts.length};
    }));
    for(const row of x.rows){assert.equal(row.newEvents,1);assert.equal(row.host,row.context);assert.ok(row.states.every(xp=>xp===row.xp));}assert.equal(x.mounts,5);
  });
  await test('awards while paused update every form silently and resuming never replays missed celebrations',async p=>{
    const x=plain(await p.evaluate(()=>{
      setView('quests');sqCompanionPause(true);sqEarn('first');
      const paused={events:mascotCalls.celebrations.length,states:Object.values(mascotCalls.states).map(s=>({xp:s.xp,paused:s.paused}))};
      const stamp=sqBadges().earned.first.at;sqCompanionPause(false);sqRenderCompanion();const resumed=mascotCalls.celebrations.length;
      sqEarn('trend');return {paused,resumed,events:mascotCalls.celebrations,hosts:mascotCalls.celebrationHosts,stamp,after:sqBadges().earned.first.at,states:Object.values(mascotCalls.states).map(s=>s.xp),calls:networkCalls};
    }));
    assert.equal(x.paused.events,0);assert.ok(x.paused.states.every(s=>s.xp===50&&s.paused));assert.equal(x.resumed,0);
    assert.deepEqual(x.events,[{before:50,xp:100}]);assert.deepEqual(x.hosts,['quests']);assert.equal(x.stamp,x.after);assert.ok(x.states.every(xp=>xp===100));assert.equal(x.calls,0);
  });
  await test('viewport hiding, view changes, collapse and settings suppress animation without touching research',async p=>{
    const x=plain(await p.evaluate(()=>{
      const active=()=>Object.entries(mascotCalls.states).filter(([,s])=>s.active).map(([context])=>context).sort();
      for(const record of sqCompanions.values())record.host.getBoundingClientRect=()=>({width:250,height:180,top:50,bottom:230});
      sqCompanionVisibility();const initial=active();
      sqCompanions.get('research').host.getBoundingClientRect=()=>({width:250,height:180,top:1000,bottom:1180});sqCompanionVisibility();const below=active();
      sqEarn('first');const hiddenEvents=mascotCalls.celebrations.length;
      setView('quests');const quests=active();openSettings();const settings=active();sqEarn('trend');const modalEvents=mascotCalls.celebrations.length;closeSettings();const restored=active();
      sqCompanionCollapse(true);const collapsed=active();sqCompanionCollapse(false);const expanded=active();
      return {initial,below,hiddenEvents,quests,settings,modalEvents,restored,collapsed,expanded,xp:sqResearchXp(),calls:networkCalls};
    }));
    assert.deepEqual(x.initial,['research']);assert.deepEqual(x.below,[]);assert.equal(x.hiddenEvents,0);assert.deepEqual(x.quests,['quests']);assert.deepEqual(x.settings,[]);assert.equal(x.modalEvents,0);assert.deepEqual(x.restored,['quests']);assert.deepEqual(x.collapsed,[]);assert.deepEqual(x.expanded,['quests']);assert.equal(x.xp,100);assert.equal(x.calls,0);
  });
  await test('pause and collapse from any placement synchronize all controllers and restore silently',async p=>{
    const x=plain(await p.evaluate(async()=>{
      const before=JSON.stringify({state,calc:calc(),badges:sqBadges()});storageWrites.length=0;
      setView('watchlist');const button={attrs:{},setAttribute(k,v){this.attrs[k]=v},closest(selector){return selector==='[data-mascot-motion]'?this:null}};
      await $('watchlistCompanionHost').dispatch('click',{target:button});
      const paused=Object.values(mascotCalls.states).map(s=>s.paused),aria=button.attrs['aria-pressed'];
      $('savedCompanionPanel').open=false;await $('savedCompanionPanel').dispatch('toggle');
      const collapsed=[...sqCompanions.values()].map(r=>r.panel.open),inactive=Object.values(mascotCalls.states).every(s=>!s.active);
      return {before,after:JSON.stringify({state,calc:calc(),badges:sqBadges()}),paused,aria,collapsed,inactive,
        writes:storageWrites.map(w=>w.args[0]),pref:localStorage.getItem('sq_companion_paused'),closed:localStorage.getItem('sq_companion_collapsed'),events:mascotCalls.celebrations};
    }));
    assert.equal(x.before,x.after);assert.ok(x.paused.every(Boolean));assert.equal(x.aria,'true');assert.ok(x.collapsed.every(open=>!open));assert.equal(x.inactive,true);assert.equal(x.pref,'true');assert.equal(x.closed,'true');assert.deepEqual(x.events,[]);assert.deepEqual([...new Set(x.writes)].sort(),['sq_companion_collapsed','sq_companion_paused']);
    const reload=harness({sq_companion_paused:true,sq_companion_collapsed:true});
    const y=plain(await reload.evaluate(()=>({states:mascotCalls.states,panels:[...sqCompanions.values()].map(r=>r.panel.open),events:mascotCalls.celebrations,mounts:mascotCalls.mounts})));
    assert.ok(Object.values(y.states).every(s=>s.paused&&!s.active&&s.greetings===0));assert.ok(y.panels.every(open=>!open));assert.equal(y.mounts.length,5);assert.ok(y.mounts.every(m=>m.options.static));assert.deepEqual(y.events,[]);
  });
  await test('resuming and expanding preserve every earned timestamp and never replay missed celebrations or greetings',async()=>{
    const earned={first:{at:'2026-10-07T11:00:00Z'}};
    const p=harness({sq_companion_paused:true,sq_companion_collapsed:true,sq_badges_v1011:{version:1,earned,horizons:[]}});
    const x=plain(await p.evaluate(()=>{
      sqCompanionCollapse(false);sqCompanionPause(false);setView('quests');setView('research');
      const greetings=mascotCalls.greetings.length;for(let i=0;i<5;i++){sqRenderCompanion();sqCompanionVisibility();setView('quests');setView('research');}
      return {earned:sqBadges().earned,xp:sqResearchXp(),events:mascotCalls.celebrations,greetings,afterGreetings:mascotCalls.greetings.length,states:mascotCalls.states,paused:localStorage.getItem('sq_companion_paused'),collapsed:localStorage.getItem('sq_companion_collapsed')};
    }));
    assert.deepEqual(x.earned,earned);assert.equal(x.xp,50);assert.deepEqual(x.events,[]);assert.equal(x.greetings,x.afterGreetings);assert.ok(Object.values(x.states).every(s=>!s.paused&&s.xp===50));assert.equal(x.paused,'false');assert.equal(x.collapsed,'false');
  });
  await test('summary activation saves collapse synchronously before any queued toggle or reload',async p=>{
    const x=plain(await p.evaluate(()=>{let prevented=0;const event={preventDefault:()=>{prevented++}};$('savedCompanionSummary').dispatch('click',event);const closed={stored:localStorage.getItem('sq_companion_collapsed'),open:[...sqCompanions.values()].map(r=>r.panel.open)};$('questsCompanionSummary').dispatch('click',event);return {closed,stored:localStorage.getItem('sq_companion_collapsed'),open:[...sqCompanions.values()].map(r=>r.panel.open),prevented,xp:sqResearchXp(),calls:networkCalls};}));
    assert.equal(x.closed.stored,'true');assert.ok(x.closed.open.every(open=>!open));assert.equal(x.stored,'false');assert.ok(x.open.every(Boolean));assert.equal(x.prevented,2);assert.equal(x.xp,0);assert.equal(x.calls,0);
  });
  console.log(`${passed} companion-role behavior checks passed; ${failed} failed. Controllers and geometry are recorded adapters; browser layout and actual animation are not exercised.`);
  if(failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
