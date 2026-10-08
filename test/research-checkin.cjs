// Research Check-in behavior regressions; no real providers, accounts or credentials.
// The DOM adapter establishes behavior, not browser layout or accessibility.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const create = require('./dom-harness.cjs');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const NOW = '2026-10-07T12:00:00.000Z';
const STORE = 'sq_research_checkins_v1';
const ORIGINAL = {
  id:'fixture-original', ticker:'AAPL', instrument:'Apple fixture • AAPL',
  p:'1y', correction:10, c:10, price:100, perf:20, divisor:2, increment:1,
  low:99, mid:105, high:110, at:'2026-10-01T12:00:00.000Z',
  reason:'Original private reasoning that should never change.', inputMode:'auto_eod',
  savedOrigin:null, sourceContext:{symbol:'AAPL',source:'Original fixture provider',session:'2026-09-30',fetchedAt:1790856000000,stale:true}
};
const plain = value => JSON.parse(JSON.stringify(value));
let passed=0, failed=0;
function harness(seed={}, raw={}) {
  const stores={splab_history:[ORIGINAL],...seed};
  const pre=`const RealDate=Date;Date=class extends RealDate{constructor(...args){super(...(args.length?args:[${JSON.stringify(NOW)}]))}static now(){return RealDate.parse(${JSON.stringify(NOW)})}};`+
    Object.entries(stores).map(([k,v])=>`localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(JSON.stringify(v))});`).join('')+
    Object.entries(raw).map(([k,v])=>`localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('');
  return create(html.replace('<script>','<script>'+pre+'</script><script>'));
}
async function current(p) {
  await p.evaluate(()=>{
    window.checkinNetwork=0;window.fetch=()=>{checkinNetwork++;throw Error('Live provider traffic is forbidden');};
    setMode('manual');state.period='3m';
    $('ticker').value='AAPL';$('selectedInstrument').textContent='Current Apple fixture • AAPL';
    $('price').value='150';$('perf').value='18';$('divisor').value='3.5';$('increment').value='0.5';
    $('researchReason').value='Current private research note stays separate.';
    sqSetCorrection(30);render();
    sqBadgeSave({version:1,earned:{first:{at:'2026-10-01T00:00:00Z',origin:'fixture',mode:'manual'}},horizons:['1y']});
    window.checkinWrites=[];const write=localStorage.setItem.bind(localStorage);
    localStorage.setItem=(key,value)=>{checkinWrites.push([key,String(value)]);return write(key,value);};
  });
}
async function fill(p, overrides={}) {
  await p.evaluate(values=>{
    $('checkinReason').value=values.reason??'The stronger evidence changed my original assumption.';
    $('checkinThinking').value=values.thinking??'changed';
    $('checkinEvidence').value=values.evidence??'assumptions';
    $('checkinObservation').value=values.observation??'I observed a change in the fixture source dated 6 October 2026.';
    sqRenderCheckin();
  },overrides);
}
async function protectedState(p) {
  return p.evaluate(()=>JSON.stringify({
    mode:state.mode,ticker:$('ticker').value,instrument:$('selectedInstrument').textContent,period:state.period,
    price:$('price').value,perf:$('perf').value,divisor:$('divisor').value,increment:$('increment').value,
    correction:state.correction,reason:$('researchReason').value,origin:state.savedOrigin||null,
    loaded:state.loadedResearchId||null,meta:state.dataMeta,extra:state.extra,
    history:localStorage.getItem('splab_history'),badges:localStorage.getItem('sq_badges_v1011'),
    watch:localStorage.getItem('sq_watchlist'),compare:localStorage.getItem('sq_compare'),
    session:localStorage.getItem('sq_next_session'),cache:localStorage.getItem('strikequest_eod_cache'),
    raw:localStorage.getItem('sq_alpha_raw_cache'),xp:sqResearchXp()
  }));
}
async function entries(p) {return plain(await p.evaluate(()=>JSON.parse(localStorage.getItem('sq_research_checkins_v1')||'{"version":1,"entries":[]}').entries));}
async function test(name,fn) {
  try{await fn();passed++;console.log('PASS',name);}
  catch(error){failed++;console.error('FAIL',name,'\n ',error.stack);}
}
(async()=>{
  await test('Saved exposes an explicit Check-in action and private editor with associated controls',async()=>{
    const p=harness();await current(p);
    const x=await p.evaluate(()=>{setView('saved');return {cards:$('history').innerHTML,ids:['researchCheckin','checkinReason','checkinThinking','checkinEvidence','saveCheckinBtn','captureCheckinBtn','cancelCheckinBtn','checkinStatus','checkinComparison'].every(id=>!!$(id))};});
    assert.ok(x.ids);assert.match(x.cards,/data-checkin-id="fixture-original"/);assert.match(x.cards,/check.in/i);
  });
  await test('opening and rendering a same-ticker comparison never load inputs, write history or award XP',async()=>{
    const p=harness();await current(p);const before=await protectedState(p);
    const x=plain(await p.evaluate(()=>{sqStartCheckin('fixture-original');const first=JSON.stringify(sqCheckinDraft);for(let i=0;i<5;i++)sqRenderCheckin();return {original:sqCheckinDraft.original,current:sqCheckinDraft.current,stable:first===JSON.stringify(sqCheckinDraft),writes:checkinWrites,calls:checkinNetwork};}));
    assert.equal(await protectedState(p),before);assert.deepEqual(x.writes,[]);assert.equal(x.calls,0);assert.ok(x.stable);
    assert.equal(x.original.price,100);assert.equal(x.current.price,150);assert.equal(x.current.perf,18);
    assert.equal(x.original.reason,ORIGINAL.reason);assert.equal(x.current.low,109);assert.equal(x.current.mid,132);assert.equal(x.current.high,155.5);
  });
  await test('comparison exposes separate source/date/horizon/correction/divisor/increment/reference/performance/targets',async()=>{
    const p=harness();await current(p);
    const markup=await p.evaluate(()=>{sqStartCheckin('fixture-original');return $('checkinComparison').innerHTML;});
    for(const label of [/source/i,/date|captur|saved|session/i,/horizon/i,/correction/i,/divisor/i,/increment/i,/reference/i,/performance|historical change|dollar change/i,/low/i,/mid/i,/high/i,/Original fixture provider/,/Manual/,/2026-09-30/,/1-Year/,/3-Month/,/10%/,/30%/,/155\.50|155\.5/])assert.match(markup,label);
  });
  await test('explicit save persists one separate immutable check-in; repeated save is idempotent and earns no XP',async()=>{
    const p=harness();await current(p);const before=await protectedState(p);
    await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const snapshots=await p.evaluate(()=>JSON.stringify({original:sqCheckinDraft.original,current:sqCheckinDraft.current}));
    await p.evaluate(()=>{sqSaveCheckin();sqSaveCheckin();sqRenderCheckin();});
    const saved=await entries(p);assert.equal(saved.length,1);assert.equal(saved[0].originalId,ORIGINAL.id);assert.equal(saved[0].thinking,'changed');assert.equal(saved[0].evidence,'assumptions');
    assert.equal(JSON.stringify({original:saved[0].original,current:saved[0].current}),snapshots);
    assert.match(saved[0].reason,/stronger evidence/);assert.equal(await protectedState(p),before);
    const x=await p.evaluate(()=>({store:JSON.parse(localStorage.getItem('sq_research_checkins_v1')),writes:checkinWrites.filter(x=>x[0]==='sq_research_checkins_v1').length,calls:checkinNetwork}));
    assert.equal(x.store.version,1);assert.equal(x.writes,1);assert.equal(x.calls,0);
  });
  for(const invalid of [{reason:''},{reason:'too short'},{reason:'            '},{thinking:''},{thinking:'profit'},{evidence:''},{evidence:'trade'},{evidence:'observation',observation:''},{evidence:'observation',observation:'too short'}])await test('save rejects missing/invalid reflection '+JSON.stringify(invalid),async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p,invalid);
    const x=await p.evaluate(()=>{sqSaveCheckin();return {store:localStorage.getItem('sq_research_checkins_v1'),draft:!!sqCheckinDraft,status:$('checkinStatus').textContent};});
    assert.equal(x.store,null);assert.ok(x.draft);assert.ok(x.status.length>10);
  });
  for(const thinking of ['changed','held','uncertain'])for(const evidence of ['assumptions','source','observation'])await test(`explicit reflection accepts ${thinking}/${evidence}`,async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p,{thinking,evidence});await p.evaluate(()=>sqSaveCheckin());assert.equal((await entries(p)).length,1);
  });
  await test('different ticker opens without changing inputs and blocks capture/save with same-instrument guidance',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>{$('ticker').value='MSFT';render();});const before=await protectedState(p);
    await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(()=>{sqSaveCheckin();sqCaptureCheckin();return {current:sqCheckinDraft.current,store:localStorage.getItem('sq_research_checkins_v1'),status:$('checkinStatus').textContent};});
    assert.ok(!x.current);assert.equal(x.store,null);assert.equal(await protectedState(p),before);assert.match(x.status,/AAPL|same instrument|same ticker/i);
  });
  await test('invalid current numbers cannot be captured or saved',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>{$('price').value='';render();sqStartCheckin('fixture-original');});await fill(p);
    const x=await p.evaluate(()=>{sqCaptureCheckin();sqSaveCheckin();return {current:sqCheckinDraft.current,store:localStorage.getItem('sq_research_checkins_v1')};});assert.ok(!x.current);assert.equal(x.store,null);
  });
  for(const change of ['price','perf','divisor','increment','correction','period','source','session','ticker'])await test(`changing ${change} leaves frozen values stale until explicit recapture`,async()=>{
    const p=harness();await current(p);
    const old=await p.evaluate(()=>{sqStartCheckin('fixture-original');return JSON.stringify(sqCheckinDraft.current);});await fill(p);
    await p.evaluate(change=>{
      if(change==='correction')sqSetCorrection(10);
      else if(change==='period'){state.period='2y';render();}
      else if(change==='source'||change==='session'){state.dataMeta={symbol:'AAPL',source:change==='source'?'Changed fixture':'Current fixture',session:change==='session'?'2026-10-06':'2026-10-07'};render();}
      else{$(change).value=change==='ticker'?'MSFT':change==='increment'?'1':'175';sqInputChanged(change);}
    },change);
    const blocked=await p.evaluate(()=>{sqRenderCheckin();sqSaveCheckin();return {captured:JSON.stringify(sqCheckinDraft.current),store:localStorage.getItem('sq_research_checkins_v1'),status:$('checkinStatus').textContent};});
    assert.equal(blocked.captured,old);assert.equal(blocked.store,null);assert.match(blocked.status,/changed|stale|capture|same|AAPL/i);
    if(change==='ticker')await p.evaluate(()=>{$('ticker').value='AAPL';render();});
    await p.evaluate(()=>sqCaptureCheckin());await fill(p);await p.evaluate(()=>sqSaveCheckin());assert.equal((await entries(p)).length,1);
  });
  await test('changing inputs and reverting them still requires explicit recapture',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(()=>{$('price').value='175';sqInputChanged('price');$('price').value='150';sqInputChanged('price');sqSaveCheckin();return {store:localStorage.getItem('sq_research_checkins_v1'),draft:!!sqCheckinDraft,status:$('checkinStatus').textContent};});
    assert.equal(x.store,null);assert.ok(x.draft);assert.match(x.status,/changed|stale|capture/i);
    await p.evaluate(()=>{sqCaptureCheckin();sqSaveCheckin();});assert.equal((await entries(p)).length,1);
  });
  await test('provider metadata belonging to another ticker cannot be captured as current research',async()=>{
    const p=harness();await current(p);const x=await p.evaluate(()=>{state.mode='auto_eod';state.dataMeta={symbol:'MSFT',source:'Mismatched provider fixture',session:'2026-10-06'};render();sqStartCheckin('fixture-original');return {captured:sqCaptureCheckin(),blocked:sqCheckinBlock(),status:$('checkinStatus').textContent};});
    assert.equal(x.captured,false);assert.match(x.blocked,/source|instrument|ticker/i);await fill(p);await p.evaluate(()=>sqSaveCheckin());assert.deepEqual(await entries(p),[]);
  });
  await test('a saved original with another ticker’s provider metadata cannot be used silently',async()=>{
    const record={...ORIGINAL,sourceContext:{...ORIGINAL.sourceContext,symbol:'MSFT'}};const p=harness({splab_history:[record]});await current(p);
    const before=await p.evaluate(()=>localStorage.getItem('splab_history'));await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);await p.evaluate(()=>sqSaveCheckin());
    assert.deepEqual(await entries(p),[]);assert.equal(await p.evaluate(()=>localStorage.getItem('splab_history')),before);
  });
  for(const field of ['price','perf','low','mid','high','divisor','increment','correction'])await test(`subcent ${field} differences remain visible and compare using exact values`,async()=>{
    const p=harness();const x=plain(await p.evaluate(({record,field})=>sqCheckinComparison(record,{...record,[field]:record[field]+0.0001}),{record:ORIGINAL,field}));
    const label={price:'Reference input',perf:'Historical change input',low:'Low · hypothetical',mid:'Mid · hypothetical',high:'High · hypothetical',divisor:'Divisor',increment:'Rounding increment',correction:'Correction'}[field];
    const row=x.rows.find(row=>row.label===label);assert.ok(row,label);assert.equal(row.changed,true);assert.equal(x.scenarioChanged,true);assert.notEqual(row.original,row.current,'display must explain the exact difference');
  });
  for(const period of ['__proto__','constructor','toString'])await test(`legacy inherited-property period ${period} cannot poison Load or check-in`,async()=>{
    const record={...ORIGINAL,p:period};const p=harness({splab_history:[record]});await current(p);
    const x=await p.evaluate(()=>{const raw=localStorage.getItem('splab_history');sqStartCheckin('fixture-original');const period=sqCheckinDraft.original.period;sqCancelCheckin();loadSaved('fixture-original');return {period,supported:Object.hasOwn(PERIODS,state.period),before:raw,after:localStorage.getItem('splab_history')};});
    assert.equal(x.period,null);assert.ok(x.supported);assert.equal(x.after,x.before);
  });
  await test('capture deep-copies metadata and persists captured values despite later mutable source objects',async()=>{
    const p=harness();await current(p);
    const x=await p.evaluate(()=>{state.mode='auto_eod';state.dataMeta={symbol:'AAPL',source:'Local provider',session:'2026-10-06',coverage:{fullRange:true}};sqStartCheckin('fixture-original');const captured=JSON.stringify(sqCheckinDraft.current);state.dataMeta.source='Mutated provider';state.dataMeta.coverage.fullRange=false;return {captured,current:JSON.stringify(sqCheckinDraft.current)};});assert.equal(x.current,x.captured);
  });
  for(const mode of ['manual','demo','auto_eod'])await test(`${mode} capture retains truthful provenance without provider requests`,async()=>{
    const p=harness();await current(p);
    await p.evaluate(mode=>{state.mode=mode;state.savedOrigin=null;state.dataMeta=mode==='auto_eod'?{symbol:'AAPL',source:'Local provider fixture',session:'2026-10-06',coverage:{fullRange:true}}:mode==='demo'?{symbol:'AAPL',source:'Synthetic example',session:'2026-09-30',synthetic:true}:null;sqStartCheckin('fixture-original');},mode);await fill(p);await p.evaluate(()=>sqSaveCheckin());
    const saved=(await entries(p))[0];assert.equal(saved.current.inputMode,mode);
    const x=await p.evaluate(current=>({kind:sqSourceInfo(current).kind,calls:checkinNetwork}),saved.current);assert.equal(x.kind,{manual:'manual',demo:'synthetic',auto_eod:'eod'}[mode]);assert.equal(x.calls,0);
  });
  await test('saved synthetic origin stays synthetic in a Manual check-in',async()=>{
    const p=harness();await current(p);const x=await p.evaluate(()=>{state.savedOrigin='demo';sqStartCheckin('fixture-original');return sqSourceInfo(sqCheckinDraft.current).kind;});assert.equal(x,'synthetic');
  });
  await test('Cancel and leaving Saved discard the draft with no check-in, history or XP write',async()=>{
    for(const action of ['cancel','research','watchlist','quests']){
      const p=harness();await current(p);const before=await protectedState(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
      const x=await p.evaluate(action=>{if(action==='cancel')sqCancelCheckin();else setView(action);return {draft:sqCheckinDraft,store:localStorage.getItem('sq_research_checkins_v1')};},action);
      assert.ok(!x.draft,action);assert.equal(x.store,null,action);assert.equal(await protectedState(p),before,action);
    }
  });
  await test('opening a second saved record replaces the draft without leaking the previous reflection',async()=>{
    const second={...ORIGINAL,id:'fixture-second',price:80,reason:'Second independent original research note.'};const p=harness({splab_history:[ORIGINAL,second]});await current(p);
    await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);const x=await p.evaluate(()=>{sqStartCheckin('fixture-second');return {original:sqCheckinDraft.original,reason:$('checkinReason').value,thinking:$('checkinThinking').value,evidence:$('checkinEvidence').value,store:localStorage.getItem('sq_research_checkins_v1')};});
    assert.equal(x.original.price,80);assert.equal(x.reason,'');assert.equal(x.thinking,'');assert.equal(x.evidence,'');assert.equal(x.store,null);
  });
  await test('legacy missing metadata stays unknown without invented defaults or saved-original mutation',async()=>{
    const old={id:'legacy',ticker:'AAPL',price:100,perf:20,low:99,mid:105,high:110};const p=harness({splab_history:[old]});await current(p);
    const x=plain(await p.evaluate(()=>{const before=localStorage.getItem('splab_history');sqStartCheckin('legacy');return {original:sqCheckinDraft.original,markup:$('checkinComparison').innerHTML,before,after:localStorage.getItem('splab_history')};}));
    for(const key of ['period','p','correction','divisor','increment','sourceContext','at'])assert.ok(x.original[key]==null,`${key} must remain unknown`);
    assert.match(x.markup,/unknown|unavailable|not recorded/i);assert.match(x.markup,/Source unknown/);assert.equal(x.after,x.before);
  });
  for(const raw of ['{broken','{}','null','[null,17,"bad"]'])await test('malformed saved history is readable safely and never overwritten: '+raw,async()=>{
    const p=harness({}, {splab_history:raw});const x=await p.evaluate(()=>{renderHistory();sqStartCheckin('missing');return {raw:localStorage.getItem('splab_history'),draft:typeof sqCheckinDraft==='undefined'?null:sqCheckinDraft};});assert.equal(x.raw,raw);assert.ok(!x.draft);
  });
  for(const raw of ['{broken','null','[]','{"version":2,"entries":[]}','{"version":1,"entries":{}}','{"version":1,"entries":[null]}'])await test('corrupted/unsupported check-in storage blocks writes and preserves bytes: '+raw,async()=>{
    const p=harness({}, {[STORE]:raw});await current(p);await p.evaluate(()=>{sqReadCheckins();sqStartCheckin('fixture-original');});await fill(p);
    const x=await p.evaluate(()=>{sqSaveCheckin();return {raw:localStorage.getItem('sq_research_checkins_v1'),status:$('checkinStatus').textContent,draft:!!sqCheckinDraft};});assert.equal(x.raw,raw);assert.ok(x.draft);assert.match(x.status,/storage|read|preserv|unavailable|invalid|damaged/i);
  });
  for(const [field,value] of [
    ['id',{toString:'malformed'}],['ticker',{toString:'malformed'}],['p',{toString:'malformed'}],
    ['price',{toString:'malformed'}],['at',{toString:'malformed'}],['reason',{toString:'malformed'}],
    ['sourceContext',{source:{toString:'malformed'},session:'2026-09-30'}]
  ])await test(`malformed nested original ${field} is safely blocked and preserved`,async()=>{
    const raw=JSON.stringify([{...ORIGINAL,[field]:value}]);const p=harness({}, {splab_history:raw});
    const x=await p.evaluate(()=>{renderHistory();sqStartCheckin('fixture-original');return {raw:localStorage.getItem('splab_history'),draft:!!sqCheckinDraft,blocked:sqHistoryRead().blocked};});
    assert.equal(x.raw,raw);assert.ok(x.blocked);assert.equal(x.draft,false);
  });
  await test('malformed optional historical context is normalized to unknown without mutating history',async()=>{
    const p=harness({splab_history:[{...ORIGINAL,researchContext:{baselineDate:{toString:'malformed'},baselineClose:{toString:'malformed'},trend1m:['Up'],sampleMonths:{toString:'malformed'}}}]});await current(p);
    const x=plain(await p.evaluate(()=>{const raw=localStorage.getItem('splab_history');sqStartCheckin('fixture-original');return {before:raw,after:localStorage.getItem('splab_history'),context:sqCheckinDraft.original.researchContext};}));
    assert.equal(x.after,x.before);for(const value of Object.values(x.context))assert.equal(value,null);
  });
  await test('duplicate saved IDs cannot select or delete the wrong original',async()=>{
    const rows=[ORIGINAL,{...ORIGINAL,price:999,reason:'A second record with an ambiguous duplicated ID.'}];const p=harness({splab_history:rows});
    const x=await p.evaluate(()=>{const raw=localStorage.getItem('splab_history');sqStartCheckin('fixture-original');deleteSaved('fixture-original');return {before:raw,after:localStorage.getItem('splab_history'),draft:!!sqCheckinDraft,blocked:sqHistoryRead().blocked};});
    assert.equal(x.before,x.after);assert.ok(x.blocked);assert.equal(x.draft,false);
  });
  for(const mutation of ['delete','edit'])await test(`${mutation} of original during the draft blocks saving without overwriting that edit`,async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(mutation=>{const rows=JSON.parse(localStorage.getItem('splab_history'));if(mutation==='delete')rows.length=0;else rows[0].reason='Edited in another tab while the check-in was open.';const raw=JSON.stringify(rows);localStorage.setItem('splab_history',raw);sqSaveCheckin();return {before:raw,after:localStorage.getItem('splab_history'),checkins:localStorage.getItem('sq_research_checkins_v1'),draft:!!sqCheckinDraft,status:$('checkinStatus').textContent};},mutation);
    assert.equal(x.before,x.after);assert.equal(x.checkins,null);assert.ok(x.draft);assert.match(x.status,/changed|unavailable|choose.*again/i);
  });
  await test('a full 100-entry journal preserves every existing entry and blocks an extra save',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(()=>{
      const entry={originalId:sqCheckinDraft.originalId,original:sqCheckinDraft.original,current:sqCheckinDraft.current,reason:'Previous fixture reflection with sufficient context.',thinking:'held',evidence:'source',observation:'',createdAt:'2026-10-06T12:00:00.000Z'};
      const entries=Array.from({length:100},(_,i)=>({...entry,id:'journal-fixture-'+i})),raw=JSON.stringify({version:1,entries});
      localStorage.setItem('sq_research_checkins_v1',raw);const writes=checkinWrites.length;sqSaveCheckin();
      return {before:raw,after:localStorage.getItem('sq_research_checkins_v1'),writes:checkinWrites.length-writes,status:$('checkinStatus').textContent,draft:!!sqCheckinDraft};
    });assert.equal(x.after,x.before);assert.equal(x.writes,0);assert.ok(x.draft);assert.match(x.status,/100|full|limit/i);
  });
  await test('duplicate journal IDs block writes without discarding either stored entry',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);await p.evaluate(()=>sqSaveCheckin());
    const x=await p.evaluate(()=>{const journal=JSON.parse(localStorage.getItem('sq_research_checkins_v1'));journal.entries.push({...journal.entries[0]});const raw=JSON.stringify(journal);localStorage.setItem('sq_research_checkins_v1',raw);sqStartCheckin('fixture-original');sqSaveCheckin();return {before:raw,after:localStorage.getItem('sq_research_checkins_v1'),blocked:sqReadCheckins().blocked};});assert.equal(x.before,x.after);assert.equal(x.blocked,true);
  });
  await test('quota failure leaves the reflection available and never reports a successful save',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(()=>{const write=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='sq_research_checkins_v1')throw Error('QuotaExceededError fixture');return write(key,value);};sqSaveCheckin();return {store:localStorage.getItem('sq_research_checkins_v1'),draft:!!sqCheckinDraft,reason:$('checkinReason').value,status:$('checkinStatus').textContent};});
    assert.equal(x.store,null);assert.ok(x.draft);assert.match(x.reason,/stronger evidence/);assert.match(x.status,/could not|unable|failed|storage|not saved/i);
  });
  await test('retry after a recoverable storage failure saves exactly once with the original draft ID',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(()=>{const write=localStorage.setItem,originalId=sqCheckinDraft.id;let fail=true;localStorage.setItem=(key,value)=>{if(key==='sq_research_checkins_v1'&&fail)throw Error('Quota fixture');return write(key,value);};sqSaveCheckin();const retainedId=sqCheckinDraft.id;fail=false;sqSaveCheckin();sqSaveCheckin();return {originalId,retainedId,entries:JSON.parse(localStorage.getItem('sq_research_checkins_v1')).entries};});
    assert.equal(x.originalId,x.retainedId);assert.equal(x.entries.length,1);assert.equal(x.entries[0].id,x.originalId);
  });
  await test('neutral comparisons identify changed assumptions and source/session without claiming investment results',async()=>{
    const p=harness();const x=plain(await p.evaluate(original=>{
      const same=sqCheckinComparison(original,original),assumptions=sqCheckinComparison(original,{...original,correction:30,low:77}),source=sqCheckinComparison(original,{...original,sourceContext:{...original.sourceContext,source:'New fixture source',session:'2026-10-06',stale:false}});
      return {same,assumptions,source};
    },ORIGINAL));
    assert.equal(x.same.sameInstrument,true);assert.equal(x.same.scenarioChanged,false);assert.equal(x.same.sourceChanged,false);
    assert.match(x.same.summary,/does not establish|not.*unchanged|not.*succeed/i);
    assert.equal(x.assumptions.scenarioChanged,true);assert.equal(x.assumptions.sourceChanged,false);assert.match(x.assumptions.summary,/not evidence.*market move|not.*investment outcome/i);
    assert.equal(x.source.scenarioChanged,false);assert.equal(x.source.sourceChanged,true);assert.equal(x.source.stale,true);assert.ok(x.source.warnings.some(text=>/stale/i.test(text)));
    assert.equal(x.assumptions.rows.find(row=>row.label==='Correction').changed,true);
  });
  await test('read failure cannot overwrite unknown saved check-ins',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>{const read=localStorage.getItem.bind(localStorage);localStorage.getItem=key=>{if(key==='sq_research_checkins_v1')throw Error('SecurityError fixture');return read(key);};sqStartCheckin('fixture-original');});await fill(p);
    const x=await p.evaluate(()=>{sqSaveCheckin();return {writes:checkinWrites.filter(x=>x[0]==='sq_research_checkins_v1'),status:$('checkinStatus').textContent,draft:!!sqCheckinDraft};});assert.deepEqual(plain(x.writes),[]);assert.ok(x.draft);assert.match(x.status,/storage|read|unavailable|unable|failed/i);
  });
  for(const approval of [false,true])await test(`Clear check-ins ${approval?'acceptance removes only journal':'cancellation preserves journal and draft'}`,async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);await p.evaluate(()=>sqSaveCheckin());
    await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);const before=await protectedState(p);
    const x=await p.evaluate(approval=>{const raw=localStorage.getItem('sq_research_checkins_v1'),draft=JSON.stringify(sqCheckinDraft);window.confirmations=[];window.confirm=text=>{confirmations.push(text);return approval;};sqClearCheckins();return {before:raw,after:localStorage.getItem('sq_research_checkins_v1'),draftBefore:draft,draftAfter:JSON.stringify(sqCheckinDraft),confirmations,reason:$('checkinReason').value};},approval);
    assert.equal(await protectedState(p),before);assert.equal(x.confirmations.length,1);assert.match(x.confirmations[0],/check.in/i);
    if(approval){assert.equal(x.after,null);assert.equal(x.draftAfter,'null');assert.equal(x.reason,'');}
    else{assert.equal(x.after,x.before);assert.equal(x.draftAfter,x.draftBefore);assert.match(x.reason,/stronger evidence/);}
  });
  await test('Clear check-ins storage failure keeps both journal and draft',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);await p.evaluate(()=>sqSaveCheckin());await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p);
    const x=await p.evaluate(()=>{const raw=localStorage.getItem('sq_research_checkins_v1'),draft=JSON.stringify(sqCheckinDraft),remove=localStorage.removeItem;localStorage.removeItem=key=>{if(key==='sq_research_checkins_v1')throw Error('Fixture storage denied');return remove(key);};window.confirm=()=>true;sqClearCheckins();return {before:raw,after:localStorage.getItem('sq_research_checkins_v1'),draftBefore:draft,draftAfter:JSON.stringify(sqCheckinDraft)};});assert.equal(x.after,x.before);assert.equal(x.draftAfter,x.draftBefore);
  });
  await test('hostile provider, instrument and note data is escaped in comparison and saved check-in output',async()=>{
    const attack='<img src=x onerror="window.__checkinInjection=1"> & \'fixture\'';
    const original={...ORIGINAL,instrument:attack,reason:attack,sourceContext:{...ORIGINAL.sourceContext,source:attack}};
    const p=harness({splab_history:[original]});await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p,{reason:attack});
    const x=await p.evaluate(()=>{const compare=$('checkinComparison').innerHTML;sqSaveCheckin();renderHistory();return {compare,history:$('history').innerHTML,journal:$('checkinJournal').innerHTML,injected:window.__checkinInjection};});
    for(const markup of [x.compare,x.history,x.journal]){assert.ok(!markup.includes('<img'),markup);assert.match(markup,/&lt;img/);}assert.equal(x.injected,undefined);
  });
  await test('check-in reason and original/current private notes never appear in share/copy summaries',async()=>{
    const p=harness();await current(p);await p.evaluate(()=>sqStartCheckin('fixture-original'));await fill(p,{reason:'UNIQUE_CHECKIN_PRIVATE_REASON only for this device.'});await p.evaluate(()=>sqSaveCheckin());
    const x=await p.evaluate(async()=>{window.copies=[];window.shares=[];navigator.clipboard={writeText:async text=>copies.push(text)};navigator.share=async data=>shares.push(data);await copyResult();await shareResult();return {summary:resultSummary(),copies,shares};});
    for(const text of [x.summary,...x.copies,...x.shares.map(x=>x.text)])for(const privateText of ['UNIQUE_CHECKIN_PRIVATE_REASON','Original private reasoning','Current private research note'])assert.ok(!text.includes(privateText));
    assert.equal(x.copies.length,1);assert.equal(x.shares.length,1);
  });
  console.log(`${passed} Research Check-in behavior checks passed; ${failed} failed. No live providers requested.`);
  if(failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
