// Synthetic journal backup/restore tests. No accounts, NAS, providers or credentials.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const create=require('./dom-harness.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),STORE='sq_research_checkins_v1';
const plain=x=>JSON.parse(JSON.stringify(x));
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
async function fixture(){
 const p=create(html);
 await p.evaluate(()=>{setMode('manual');$('ticker').value='AAPL';$('price').value='100';$('perf').value='20';$('researchReason').value='ORIGINAL_PRIVATE fixture research';saveCurrent();sqStartCheckin(sqHistoryRecords()[0].id);$('checkinReason').value='JOURNAL_PRIVATE fixture reflection';$('checkinThinking').value='uncertain';$('checkinEvidence').value='observation';$('checkinObservation').value='OBSERVATION_PRIVATE fixture source dated 2026-10-08';sqSaveCheckin();});
 return p;
}
async function backup(p){return plain(await p.evaluate(()=>sqCreateCheckinBackup()));}
async function raw(p){return p.evaluate(()=>localStorage.getItem('sq_research_checkins_v1'));}
async function protectedState(p){return p.evaluate(()=>JSON.stringify({history:localStorage.getItem('splab_history'),keys:[localStorage.getItem('sq_alpha_key'),localStorage.getItem('splab_barchart_key')],session:localStorage.getItem('sq_next_session'),badges:localStorage.getItem('sq_badges_v1011'),watch:localStorage.getItem('sq_watchlist'),compare:localStorage.getItem('sq_compare'),xp:sqResearchXp(),mode:state.mode,price:$('price').value,reason:$('researchReason').value}));}
async function reject(b){
 const p=await fixture(),before=await raw(p),state=await protectedState(p);
 const x=await p.evaluate(text=>({staged:sqStageCheckinImport(text),applied:sqConfirmCheckinImport(),pending:!!sqCheckinImport}),typeof b==='string'?b:JSON.stringify(b));
 assert.equal(x.staged,false);assert.equal(x.applied,false);assert.equal(x.pending,false);assert.equal(await raw(p),before);assert.equal(await protectedState(p),state);
}
(async()=>{
 const seed=await fixture(),b=await backup(seed);
 await test('round trip restores exact IDs, dates, copied notes and provenance to a different device without original history',async()=>{
  const p=create(html),before=await protectedState(p);
  assert.equal(await p.evaluate(text=>sqStageCheckinImport(text,'NAS backup.json'),JSON.stringify(b)),true);assert.equal(await raw(p),null);
  assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),true);
  assert.deepEqual((await backup(p)).entries,b.entries);assert.equal(await protectedState(p),before);
  assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),false);
 });
 await test('repeated import is idempotent and never rewrites an existing entry',async()=>{
  const p=await fixture();const own=await backup(p),before=await raw(p);
  const x=await p.evaluate(text=>{sqStageCheckinImport(text);return {plan:sqCheckinImport.plan,applied:sqConfirmCheckinImport()};},JSON.stringify(own));
  assert.equal(x.plan.duplicates,1);assert.equal(x.plan.additions.length,0);assert.equal(x.applied,false);assert.equal(await raw(p),before);
 });
 await test('merge appends new entries while preserving exact existing records and unrelated storage',async()=>{
  const p=await fixture(),before=JSON.parse(await raw(p)).entries,state=await protectedState(p);
  await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b));assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),true);
  const after=JSON.parse(await raw(p)).entries;assert.deepEqual(after[0],before[0]);assert.deepEqual(after[1],b.entries[0]);assert.equal(await protectedState(p),state);
 });
 await test('canonical comparisons tolerate JSON property reordering without duplicate writes',async()=>{
  const p=await fixture(),own=await backup(p);own.entries[0]=Object.fromEntries(Object.entries(own.entries[0]).reverse());
  const x=await p.evaluate(text=>{sqStageCheckinImport(text);return {duplicates:sqCheckinImport.plan.duplicates,conflicts:sqCheckinImport.plan.conflicts};},JSON.stringify(own));assert.equal(x.duplicates,1);assert.equal(x.conflicts,0);
 });
 await test('exact repeated IDs within one file are skipped, while conflicting copies block the entire batch',async()=>{
  const doubled=plain(b);doubled.entries.push(plain(b.entries[0]));const p=create(html);
  await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(doubled));assert.equal(await p.evaluate(()=>sqCheckinImport.plan.duplicates),1);assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),true);
  const conflict=plain(doubled);conflict.entries[1].reason='Different private reflection on the same entry ID.';const q=create(html);
  assert.equal(await q.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(conflict)),false);assert.equal(await q.evaluate(()=>sqConfirmCheckinImport()),false);assert.equal(await raw(q),null);
 });
 await test('conflict with an existing ID blocks all additions without overwriting either record',async()=>{
  const p=await fixture(),own=await backup(p),before=await raw(p);own.entries[0].reason='A different reflection using an existing ID.';own.entries.push(b.entries[0]);
  assert.equal(await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(own)),false);assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),false);assert.equal(await raw(p),before);
 });
 await test('100-entry capacity never truncates or overwrites a journal; full journals can still export',async()=>{
  const p=create(html),full=plain(b);full.entries=Array.from({length:100},(_,i)=>({...plain(b.entries[0]),id:'full-'+i}));
  await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(full));assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),true);assert.equal((await backup(p)).entries.length,100);const before=await raw(p);
  assert.equal(await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b)),false);assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),false);assert.equal(await raw(p),before);
 });
 await test('stale preview detects intervening save, clear or corrupt storage before any write',async()=>{
  for(const replacement of [null,'{broken',JSON.stringify({version:1,entries:[{...b.entries[0],id:'another-tab'}]})]){
   const p=await fixture();await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b));
   await p.evaluate(({replacement})=>{if(replacement===null)localStorage.removeItem('sq_research_checkins_v1');else localStorage.setItem('sq_research_checkins_v1',replacement);},{replacement});
   assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),false);assert.equal(await raw(p),replacement);
  }
 });
 await test('storage/quota failure keeps the preview and all existing bytes for retry',async()=>{
  const p=await fixture(),before=await raw(p);await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b));
  await p.evaluate(()=>{window.realWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='sq_research_checkins_v1')throw Error('Storage unavailable');return realWrite(key,value);};});
  assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),false);assert.equal(await raw(p),before);assert.equal(await p.evaluate(()=>!!sqCheckinImport),true);
  await p.evaluate(()=>{localStorage.setItem=realWrite;});assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),true);
 });
 await test('unsupported or damaged device storage blocks export and import without repair or reset',async()=>{
  for(const value of ['{broken','{"version":2,"entries":[]}','{"version":1,"entries":[null]}']){
   const p=create(html);await p.evaluate(value=>localStorage.setItem('sq_research_checkins_v1',value),value);
   await assert.rejects(p.evaluate(()=>sqCreateCheckinBackup()));assert.equal(await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b)),false);assert.equal(await raw(p),value);
  }
 });
 await test('whitelist excludes API fields, credentials, other history, drafts and settings from exports',async()=>{
  const p=await fixture();await p.evaluate(()=>{
   localStorage.setItem('sq_alpha_key','FIXTURE_ALPHA_SECRET_927');localStorage.setItem('splab_barchart_key','FIXTURE_BARCHART_SECRET_391');
   const journal=JSON.parse(localStorage.getItem('sq_research_checkins_v1'));journal.entries[0].apiKey='FIXTURE_ALPHA_SECRET_927';journal.entries[0].current.apiKey='FIXTURE_BARCHART_SECRET_391';localStorage.setItem('sq_research_checkins_v1',JSON.stringify(journal));sqStartCheckin(sqHistoryRecords()[0].id);$('checkinReason').value='UNFINISHED_DRAFT_PRIVATE';
  });
  const result=await backup(p),text=JSON.stringify(result);for(const marker of ['FIXTURE_ALPHA','FIXTURE_BARCHART','UNFINISHED_DRAFT','splab_history','sq_alpha_key'])assert.ok(!text.includes(marker));assert.ok(text.includes('JOURNAL_PRIVATE'));
 });
 await test('configured credentials or credential-shaped strings pasted into reflections block export and import',async()=>{
  const p=await fixture();await p.evaluate(()=>{localStorage.setItem('sq_alpha_key','FIXTURE_ALPHA_SECRET_927');const j=JSON.parse(localStorage.getItem('sq_research_checkins_v1'));j.entries[0].reason='Private note includes FIXTURE_ALPHA_SECRET_927';localStorage.setItem('sq_research_checkins_v1',JSON.stringify(j));});await assert.rejects(p.evaluate(()=>sqCreateCheckinBackup()));
  const bad=plain(b);bad.entries[0].reason='Private note with api_key=FIXTURE_SECRET_927';await reject(bad);
 });
 await test('Cancel and navigation discard import state without changing check-in drafts or journal',async()=>{
  const p=await fixture(),before=await raw(p);await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b));await p.evaluate(()=>sqCancelCheckinImport());assert.equal(await p.evaluate(()=>sqConfirmCheckinImport()),false);assert.equal(await raw(p),before);
  await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b));await p.evaluate(()=>setView('research'));assert.equal(await p.evaluate(()=>!!sqCheckinImport),false);assert.equal(await raw(p),before);
 });
 await test('imported private notes never enter Share/Copy summaries or a market-data request',async()=>{
  const p=create(html);await p.evaluate(()=>{window.networkCalls=0;fetch=()=>{networkCalls++;throw Error('Forbidden network');};setMode('manual');$('price').value='100';$('perf').value='20';});
  await p.evaluate(text=>sqStageCheckinImport(text),JSON.stringify(b));await p.evaluate(()=>sqConfirmCheckinImport());
  const x=await p.evaluate(async()=>{window.copies=[];navigator.clipboard={writeText:async text=>copies.push(text)};navigator.share=async data=>copies.push(data.text);await copyResult();await shareResult();return {texts:[resultSummary(),...copies],calls:networkCalls};});
  assert.equal(x.calls,0);for(const text of x.texts)for(const marker of ['ORIGINAL_PRIVATE','JOURNAL_PRIVATE','OBSERVATION_PRIVATE'])assert.ok(!text.includes(marker));
 });
 const changes=[
  ['wrong format',x=>x.format='another-app'],['future version',x=>x.version=2],['wrong journal version',x=>x.journalVersion=2],['invalid export date',x=>x.exportedAt='2026-02-30T00:00:00Z'],
  ['unknown envelope field',x=>x.apiKey='fixture'],['entries object',x=>x.entries={}],['more than 100',x=>x.entries=Array(101).fill(x.entries[0])],['null entry',x=>x.entries=[null]],
  ['empty ID',x=>x.entries[0].id=''],['invalid identity type',x=>x.entries[0].originalId={}],['impossible date',x=>x.entries[0].createdAt='2026-02-30T00:00:00Z'],['invalid enum',x=>x.entries[0].thinking='profit'],
  ['short note',x=>x.entries[0].reason='short'],['oversized note',x=>x.entries[0].reason='x'.repeat(2001)],['invalid observation',x=>x.entries[0].observation='short'],['unknown entry field',x=>x.entries[0].apiKey='fixture'],
  ['unknown nested field',x=>x.entries[0].current.apiKey='fixture'],['mismatched ticker',x=>x.entries[0].current.ticker='MSFT'],['missing provenance field',x=>delete x.entries[0].original.at],['numeric string',x=>x.entries[0].current.price='150'],
  ['invalid horizon',x=>x.entries[0].original.period='__proto__'],['source metadata array',x=>x.entries[0].original.sourceContext=[]],['bad source instrument',x=>x.entries[0].original.sourceContext={source:'Fixture',session:null,fetchedAt:null,stale:false,synthetic:false,symbol:'MSFT',baselineOffset:null,issue:null,coverage:null}],
  ['invalid history date',x=>x.entries[0].original.researchContext.baselineDate='2026-02-30']
 ];
 for(const [name,change] of changes)await test('reject '+name+' atomically',async()=>{const bad=plain(b);change(bad);await reject(bad);});
 for(const text of ['{broken','null','[]','{}','x'.repeat(2*1024*1024+1),JSON.stringify(b).replace('"price":100','"price":1e999')])await test('reject malformed, oversized or nonfinite JSON',()=>reject(text));
 console.log(count+' private journal backup checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
