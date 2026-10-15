// Composed public app fixtures only. All external requests and sockets are blocked.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),base='https://reflection.fixture.test';
const journalKey='sq_research_checkins_v1',rewardKey='sq_journey_v1:guest:revisit';
const at='2026-10-01T12:00:00.000Z';
const idea={id:'retained-idea',ticker:'AAPL',p:'2y',price:100,perf:20,c:10,divisor:1.5,increment:1,low:96,mid:108,high:120,reason:'PRIVATE_ORIGINAL: Test a clearly stated assumption.',at,inputMode:'manual'};
const session={mode:'manual',ticker:'AAPL',period:'2y',correction:10,price:'100',perf:'20',divisor:'1.5',increment:'1'};
const core={version:1,earned:{first:{at,mode:'manual',origin:'fixture'}},horizons:[]};
const baseSeed={splab_history:JSON.stringify([idea]),sq_next_session:JSON.stringify(session),sq_badges_v1011:JSON.stringify(core),sq_progress:JSON.stringify({earned:{first:{at}}}),sq_badges_next:JSON.stringify({earned:{},horizons:[]}),[journalKey]:JSON.stringify({version:1,entries:[]})};
const prior={id:'old-checkin',originalId:idea.id,original:{...idea,period:'2y',correction:10},current:{...idea,period:'2y',correction:10},reason:'PRIVATE_REFLECTION: More evidence is needed before concluding.',thinking:'uncertain',evidence:'assumptions',observation:'',createdAt:at};
function pass(name){console.log('REFLECTION_BROWSER_PASS '+name);}
async function fixture(browser,width=390,extra={},options={}){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],external=[];
 await context.addInitScript(({seed,noLocks})=>{
  if(!sessionStorage.getItem('reflection-seeded')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('reflection-seeded','1');}
  sessionStorage.setItem('strikequests_v9_splash_seen','1');
  if(noLocks)Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
 },{seed:{...baseSeed,...extra},noLocks:!!options.noLocks});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==base){external.push(u.href);return route.abort();}
  const file=path.resolve(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
 });
 await context.routeWebSocket('**/*',socket=>{external.push(socket.url());socket.close();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForSelector('body[data-quest-renewal]');
 await page.locator('[data-view="saved"]').click();
 return {page,context,async finish(){assert.deepEqual(errors,[]);assert.deepEqual(external,[],'No provider, telemetry or external requests');await context.close();}};
}
async function xp(page){return page.evaluate(()=>sqResearchXp());}
async function stored(page,key){return page.evaluate(k=>localStorage.getItem(k),key);}
async function protectedState(page){return page.evaluate(()=>Object.fromEntries(['splab_history','sq_next_session','sq_badges_v1011','sq_progress','sq_badges_next'].map(k=>[k,localStorage.getItem(k)])));}
async function open(page){await page.locator('[data-checkin-id="retained-idea"]').click();}
async function fill(page,thinking='uncertain',evidence='assumptions'){
 await page.locator('#checkinThinking').selectOption(thinking);
 await page.locator('#checkinEvidence').selectOption(evidence);
 await page.locator('#checkinReason').fill('PRIVATE_REFLECTION: Compare the source and assumptions; uncertainty remains useful.');
 if(evidence==='observation')await page.locator('#checkinObservation').fill('PRIVATE_SOURCE: A dated fixture document, 1 October 2026, contains a changed assumption.');
}
async function save(page){
 await page.locator('#saveCheckinBtn').click();
 await page.waitForFunction(()=>!sqCheckinDraft);
 await page.waitForFunction(()=>!document.getElementById('questCheckinRewardButton').disabled);
}
async function claim(page){
 await page.locator('#questCheckinRewardButton').click();
 await page.locator('#questConfirm').click();
 await page.waitForFunction(()=>!!localStorage.getItem('sq_journey_v1:guest:revisit'));
}
async function happy(browser,engine,width){
 const f=await fixture(browser,width),{page}=f,before=await protectedState(page),initial=await xp(page);
 assert.equal(initial,50);
 assert.equal(await page.locator('#questCheckinRewardButton').isDisabled(),true);
 await open(page);await page.locator('#saveCheckinBtn').click();
 assert.equal(await stored(page,rewardKey),null);assert.equal(await xp(page),initial);
 assert.equal(await page.locator('#questCheckinRewardButton').isDisabled(),true);
 await fill(page);
 // Repeated save dispatches serialize and leave a single completed reflection.
 await page.evaluate(()=>{$('saveCheckinBtn').click();$('saveCheckinBtn').click();});
 await page.waitForFunction(()=>!sqCheckinDraft);
 await page.waitForFunction(()=>!document.getElementById('questCheckinRewardButton').disabled);
 assert.equal(JSON.parse(await stored(page,journalKey)).entries.length,1);
 assert.equal(await xp(page),initial,'Saving makes the milestone ready, not automatically claimed');
 const journal=await stored(page,journalKey);
 await page.locator('#questCheckinRewardButton').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#questReviewDialog').isVisible(),true);
 assert.match(await page.locator('#questReviewText').innerText(),/unsure count equally/);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'questCancel');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'questCheckinRewardButton');
 assert.equal(await stored(page,rewardKey),null);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#questCheckinRewardButton').click();
 await page.evaluate(()=>{$('questConfirm').click();$('questConfirm').click();});
 await page.waitForFunction(()=>!!localStorage.getItem('sq_journey_v1:guest:revisit'));
 const reward=await stored(page,rewardKey);
 assert.equal(await xp(page),initial+100);
 assert.deepEqual(Object.keys(JSON.parse(reward)).sort(),['at','mode','version']);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'questCheckinRewardTitle');
 assert.equal(await page.locator('#savedCompanionHost .sq-mascot__head').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.equal(await page.locator('#questCheckinRewardStatus').getAttribute('aria-live'),'polite');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(await protectedState(page),before,'Saved research, original XP, dates and defaults preserved byte-for-byte');
 assert.equal(await stored(page,journalKey),journal,'Claim never rewrites the journal');
 await page.locator('[data-view="quests"]').click();
 assert.equal(await page.locator('#questStageMap .current [data-creature-form]').getAttribute('data-creature-form'),'toddler-scout');
 assert.equal(await page.locator('#questStageMap .locked').count(),1);
 await page.getByText('Your original Lumi collection',{exact:true}).click();
 assert.equal(await page.locator('#questLegacyLooks [data-creature-form]').count(),2,'Original collection still uses core XP only');
 await page.reload();await page.locator('[data-view="saved"]').click();
 assert.equal(await stored(page,rewardKey),reward);assert.equal(await xp(page),initial+100);
 assert.equal(await page.locator('#questCheckinRewardButton').isDisabled(),true);
 await open(page);await fill(page,'held','source');await page.locator('#saveCheckinBtn').click();await page.waitForFunction(()=>!sqCheckinDraft);
 assert.equal(await stored(page,rewardKey),reward,'Additional completed research gives no repeat award');
 const backup=await page.evaluate(()=>JSON.stringify(sqCreateCheckinBackup()));
 page.once('dialog',d=>d.accept());await page.locator('#clearCheckinsBtn').click();
 await page.waitForFunction(()=>localStorage.getItem('sq_research_checkins_v1')===null);
 assert.equal(await stored(page,rewardKey),reward);assert.equal(await xp(page),initial+100);
 await page.locator('#importCheckinsFile').setInputFiles({name:'private-fixture.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await page.waitForFunction(()=>document.getElementById('checkinImportPreview').hidden===false||!document.getElementById('checkinBackupStatus').textContent.includes('Reading'));
 assert.equal(await page.locator('#confirmCheckinImportBtn').isEnabled(),true,await page.locator('#checkinBackupStatus').innerText());
 await page.locator('#confirmCheckinImportBtn').click();
 await page.waitForFunction(()=>sqReadCheckins().entries.length===2);
 assert.equal(await stored(page,rewardKey),reward);assert.equal(await xp(page),initial+100);
 assert.deepEqual(await protectedState(page),before);
 pass(engine+'/'+width+': core workflow, keyboard, cancel, duplicate saves/claims, reload, journal clear/import, original collection, defaults and reduced motion');
 await f.finish();
}
async function outcomes(browser,engine){
 for(const thinking of ['changed','held','uncertain'])for(const evidence of ['assumptions','source','observation']){
  const f=await fixture(browser),{page}=f;await open(page);await fill(page,thinking,evidence);await save(page);await claim(page);
  assert.equal(await xp(page),150);assert.equal(JSON.parse(await stored(page,rewardKey)).mode,'manual');await f.finish();
 }
 pass(engine+': all nine reflection/basis combinations earn the same 100 XP');
}
async function preservedAndBlocked(browser,engine){
 const oldReward=JSON.stringify({version:1,at,mode:'demo'});
 for(const seed of [
  {[rewardKey]:oldReward},
  {[journalKey]:JSON.stringify({version:1,entries:[prior]})}
 ]){
  const f=await fixture(browser,390,seed),{page}=f,journal=await stored(page,journalKey);
  if(seed[rewardKey]){assert.equal(await xp(page),150);assert.equal(await page.locator('#questCheckinRewardButton').isDisabled(),true);assert.equal(await stored(page,rewardKey),oldReward);}
  else{await claim(page);assert.equal(await xp(page),150);assert.equal(await stored(page,journalKey),journal);}
  await f.finish();
 }
 for(const broken of ['{broken',JSON.stringify({version:2,entries:[prior]}),JSON.stringify({version:1,entries:[{...prior,reason:'tiny'}]}),JSON.stringify({version:1,entries:[prior,prior]})]){
  const f=await fixture(browser,390,{[journalKey]:broken}),{page}=f;
  assert.equal(await page.locator('#questCheckinRewardButton').isDisabled(),true);assert.equal(await stored(page,journalKey),broken);assert.equal(await stored(page,rewardKey),null);await f.finish();
 }
 const f=await fixture(browser,390,{[journalKey]:JSON.stringify({version:1,entries:[prior]}),[rewardKey]:'{"version":99}'});
 assert.equal(await f.page.locator('#questCheckinRewardButton').isDisabled(),true);assert.equal(await stored(f.page,rewardKey),'{"version":99}');await f.finish();
 pass(engine+': previous awards and completed journals retained; corrupt, future and duplicate storage fail closed');
}
async function failures(browser,engine){
 let f=await fixture(browser),page=f.page;await open(page);await fill(page);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sq_research_checkins_v1')throw Error('Fixture quota');return set.call(this,k,v);};});
 await page.locator('#saveCheckinBtn').click();assert.equal(await page.locator('#researchCheckin').isVisible(),true);
 assert.equal(await page.locator('#questCheckinRewardButton').isDisabled(),true);assert.equal(await stored(page,rewardKey),null);await f.finish();
 f=await fixture(browser,390,{[journalKey]:JSON.stringify({version:1,entries:[prior]})});page=f.page;
 const journal=await stored(page,journalKey);
 await page.evaluate(()=>{window.restoreSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sq_journey_v1:guest:revisit')throw Error('Fixture quota');return restoreSet.call(this,k,v);};});
 await page.locator('#questCheckinRewardButton').click();await page.locator('#questConfirm').click();
 await page.waitForFunction(()=>document.getElementById('questReviewStatus').textContent.includes('Could not safely'));
 assert.equal(await stored(page,rewardKey),null);assert.equal(await stored(page,journalKey),journal);
 await page.evaluate(()=>{Storage.prototype.setItem=restoreSet;});
 await page.locator('#questConfirm').click();await page.waitForFunction(()=>!!localStorage.getItem('sq_journey_v1:guest:revisit'));assert.equal(await xp(page),150);await f.finish();
 f=await fixture(browser,390,{[journalKey]:JSON.stringify({version:1,entries:[prior]})});page=f.page;
 await page.locator('#questCheckinRewardButton').click();
 await page.evaluate(()=>{localStorage.removeItem('sq_research_checkins_v1');sqRenderCheckin();});
 await page.locator('#questConfirm').click();await page.waitForFunction(()=>document.getElementById('questReviewStatus').textContent.includes('Could not safely'));
 assert.equal(await stored(page,rewardKey),null);await f.finish();
 pass(engine+': failed journal save, failed reward save/retry and stale completion preview keep data intact');
}
async function multiTab(browser,engine,noLocks=false){
 const extra={[journalKey]:JSON.stringify({version:1,entries:[prior]})};
 const f=await fixture(browser,390,extra,{noLocks}),p=f.page,q=await f.context.newPage();await q.goto(base);await q.locator('[data-view="saved"]').click();
 await Promise.all([p.locator('#questCheckinRewardButton').click(),q.locator('#questCheckinRewardButton').click()]);
 await Promise.all([p.locator('#questConfirm').click(),q.locator('#questConfirm').click()]);
 await p.waitForFunction(()=>!!localStorage.getItem('sq_journey_v1:guest:revisit'));
 await q.waitForFunction(()=>!!localStorage.getItem('sq_journey_v1:guest:revisit'));
 assert.equal(await xp(p),150);assert.equal(await xp(q),150);
 assert.equal(await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.endsWith(':revisit')).length),1);
 await f.finish();pass(engine+': simultaneous tabs '+(noLocks?'without':'with')+' Web Locks produce one fixed award');
}
async function synthetic(browser,engine){
 const entry={...prior,original:{...prior.original,inputMode:'demo',sourceContext:{synthetic:true}}};
 const f=await fixture(browser,390,{[journalKey]:JSON.stringify({version:1,entries:[entry]})}),page=f.page;
 await page.locator('#questCheckinRewardButton').click();assert.match(await page.locator('#questReviewText').innerText(),/synthetic learning/);
 await page.locator('#questConfirm').click();await page.waitForFunction(()=>!!localStorage.getItem('sq_journey_v1:guest:revisit'));
 assert.equal(JSON.parse(await stored(page,rewardKey)).mode,'demo');assert.equal(await xp(page),150);await f.finish();
 pass(engine+': synthetic learning stays labelled even when today’s scenario is Manual');
}
(async()=>{
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();
  try{for(const width of [320,390,1440])await happy(browser,engine,width);await outcomes(browser,engine);await preservedAndBlocked(browser,engine);await failures(browser,engine);await multiTab(browser,engine);await multiTab(browser,engine,true);await synthetic(browser,engine);}
  finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
