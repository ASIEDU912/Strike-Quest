// Actual file download and restoration across isolated PC/mobile browser contexts.
// Synthetic records only; all network and WebSocket requests are fulfilled locally or fail.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),playwright=require('playwright');
const root=path.resolve(__dirname,'..'),base='https://strikequests.backup.fixture.test',STORE='sq_research_checkins_v1';
const evidence=path.resolve(process.env.EVIDENCE_DIR||path.join(root,'test-results'));
let browser,count=0;
const reports=[];
function pass(name){count++;reports.push(name);console.log('SQ_BACKUP_PASS '+name);}
async function fixture(width,seed={}){
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500,isMobile:width<500,serviceWorkers:'block',acceptDownloads:true}),errors=[],unexpected=[];
 await context.addInitScript(seed=>{
  if(!sessionStorage.getItem('backup_seeded')){for(const [key,value] of Object.entries(seed))localStorage.setItem(key,value);sessionStorage.setItem('backup_seeded','1');}
  sessionStorage.setItem('strikequests_v9_splash_seen','1');
 },seed);
 const allowed=new Set(['/','/index.html','/mascot.js','/mascot.css','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png','/favicon.ico']);
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===base&&url.pathname==='/config.json')return route.fulfill({contentType:'application/json',body:'{"marketDataApi":"https://forbidden-provider.fixture.test"}'});
  if(url.origin!==base||!allowed.has(url.pathname)){unexpected.push(url.href);return route.abort('blockedbyclient');}
  const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
  return route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
 });
 await context.routeWebSocket('**/*',socket=>{unexpected.push(socket.url());socket.close();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
 await page.waitForFunction(()=>typeof sqCreateCheckinBackup==='function'&&document.getElementById('appSplash').classList.contains('hide'));
 await page.locator('[data-view="saved"]').click();
 return {page,context,check(){assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[],'No provider, telemetry, upload or NAS requests');}};
}
async function createRecords(page){
 await page.evaluate(()=>{
  setMode('manual');$('ticker').value='AAPL';$('price').value='100';$('perf').value='20';
  $('researchReason').value='ORIGINAL_PRIVATE fixture reasoning with an unknown legacy source.';saveCurrent();
  const id=sqHistoryRecords()[0].id;
  for(const evidence of ['assumptions','observation']){
   sqStartCheckin(id);$('checkinReason').value='JOURNAL_PRIVATE fixture '+evidence+' reflection <img src=x onerror="window.__injection=1">';
   $('checkinThinking').value='uncertain';$('checkinEvidence').value=evidence;$('checkinObservation').value='OBSERVATION_PRIVATE fixture: synthetic source, 2026-10-08';sqSaveCheckin();
  }
  setView('saved');
 });
}
async function protectedState(page){return page.evaluate(()=>JSON.stringify({history:localStorage.getItem('splab_history'),session:localStorage.getItem('sq_next_session'),badges:localStorage.getItem('sq_badges_v1011'),xp:sqResearchXp(),alpha:localStorage.getItem('sq_alpha_key'),barchart:localStorage.getItem('splab_barchart_key'),mode:state.mode,reason:$('researchReason').value,price:$('price').value}));}
async function raw(page){return page.evaluate(()=>localStorage.getItem('sq_research_checkins_v1'));}
async function upload(page,buffer,name='NAS-journal.json'){await page.locator('#importCheckinsFile').setInputFiles({name,mimeType:'application/json',buffer});await page.waitForFunction(()=>!document.getElementById('checkinBackupStatus').textContent.startsWith('Reading'));}
async function layout(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');for(const id of ['exportCheckinsBtn','importCheckinsFile','confirmCheckinImportBtn','cancelCheckinImportBtn']){const box=await page.locator('#'+id).boundingBox();assert.ok(box&&box.height>=44&&box.width>=44,id+' is a touch target');}}
async function roundTrip(width,engine){
 const source=await fixture(1440,{sq_alpha_key:'FIXTURE_ALPHA_SECRET_927',splab_barchart_key:'FIXTURE_BARCHART_SECRET_391'}),{page}=source;
 assert.equal(await page.locator('#exportCheckinsBtn').isDisabled(),true);await createRecords(page);const before=await raw(page),protectedBefore=await protectedState(page);
 const originals=JSON.parse(before).entries;
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw Error('Export must not use public sharing');}});});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportCheckinsBtn').click()]);
 assert.match(download.suggestedFilename(),/^StrikeQuests-Journal-[\w-]+\.json$/);
 const bytes=fs.readFileSync(await download.path()),backup=JSON.parse(bytes);assert.equal(backup.entries.length,2);
 for(const marker of ['FIXTURE_ALPHA_SECRET','FIXTURE_BARCHART_SECRET','splab_history'])assert.ok(!bytes.toString().includes(marker));
 assert.deepEqual(backup.entries.map(x=>x.id),originals.map(x=>x.id));assert.equal(await raw(page),before);assert.equal(await protectedState(page),protectedBefore);
 // A private-folder fixture models the same portable file used with a NAS; no real NAS is contacted.
 const folder=path.join(evidence,'synthetic-nas-private');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,`${engine}-${width}.json`);fs.writeFileSync(file,bytes);
 const own={...backup.entries[0],id:'destination-existing',reason:'DESTINATION_PRIVATE existing reflection stays unchanged.'};
 const target=await fixture(width,{[STORE]:JSON.stringify({version:1,entries:[own]})}),dest=target.page,state=await protectedState(dest),initial=await raw(dest);
 await dest.locator('#importCheckinsFile').setInputFiles(file);await dest.waitForFunction(()=>!document.getElementById('checkinImportPreview').hidden);
 assert.equal(await raw(dest),initial);assert.match(await dest.locator('#checkinImportSummary').textContent(),/2 new.*0 duplicate.*3\/100/);
 assert.equal(await dest.locator('label[for="importCheckinsFile"]').count(),1);assert.equal(await dest.locator('#checkinBackupStatus').getAttribute('aria-live'),'polite');
 await layout(dest);await dest.locator('#checkinImportPreview').screenshot({path:path.join(evidence,`journal-backup-preview-${engine}-${width}.png`),animations:'disabled'});
 await dest.locator('#confirmCheckinImportBtn').focus();await dest.keyboard.press('Enter');
 const restored=JSON.parse(await raw(dest)).entries;assert.deepEqual(restored[0],own);assert.deepEqual(restored.slice(1),backup.entries);assert.equal(await protectedState(dest),state);
 assert.equal(await dest.locator('#checkinJournal img').count(),0);assert.equal(await dest.evaluate(()=>window.__injection),undefined);
 const shared=await dest.evaluate(async()=>{window.copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copies.push(text)}});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>copies.push(data.text)});await copyResult();await shareResult();return [resultSummary(),...copies];});
 for(const text of shared)for(const marker of ['ORIGINAL_PRIVATE','JOURNAL_PRIVATE','OBSERVATION_PRIVATE','DESTINATION_PRIVATE'])assert.ok(!text.includes(marker));
 const merged=await raw(dest);await upload(dest,bytes);assert.match(await dest.locator('#checkinImportSummary').textContent(),/0 new.*2 duplicate/);assert.equal(await dest.locator('#confirmCheckinImportBtn').isDisabled(),true);assert.equal(await raw(dest),merged);
 await dest.locator('#cancelCheckinImportBtn').click();assert.equal(await raw(dest),merged);
 await dest.reload();await dest.waitForFunction(()=>typeof sqConfirmCheckinImport==='function');assert.equal(await raw(dest),merged);assert.equal(await dest.evaluate(()=>!!sqCheckinImport),false);
 source.check();target.check();await source.context.close();await target.context.close();pass(`${engine}/${width}: actual download, private-folder transfer, keyboard restore, exact merge, duplicates, XSS, privacy and reload`);
}
async function failures(engine){
 const f=await fixture(320),{page}=f;await createRecords(page);const before=await raw(page),backup=await page.evaluate(()=>sqCreateCheckinBackup());
 for(const bad of ['{broken',JSON.stringify({...backup,version:2}),JSON.stringify({...backup,entries:[{...backup.entries[0],id:'different',reason:'short'}]}),'x'.repeat(2*1024*1024+1)]){
  await upload(page,Buffer.from(bad));assert.equal(await page.locator('#checkinImportPreview').isVisible(),false);assert.equal(await raw(page),before);
 }
 const conflict={...backup,entries:[{...backup.entries[0],reason:'A conflicting reflection using an existing ID.'}]};await upload(page,Buffer.from(JSON.stringify(conflict)));assert.equal(await page.locator('#confirmCheckinImportBtn').isDisabled(),true);assert.match(await page.locator('#checkinBackupStatus').textContent(),/conflict|different|overwritten/i);assert.equal(await raw(page),before);
 const newFile=Buffer.from(JSON.stringify({...backup,entries:[{...backup.entries[0],id:'new-entry'}]}));await upload(page,newFile);
 await page.evaluate(()=>{const j=JSON.parse(localStorage.getItem('sq_research_checkins_v1'));j.entries.push({...j.entries[0],id:'intervening-entry'});localStorage.setItem('sq_research_checkins_v1',JSON.stringify(j));});const changed=await raw(page);
 await page.locator('#confirmCheckinImportBtn').click();assert.equal(await raw(page),changed);assert.match(await page.locator('#checkinBackupStatus').textContent(),/changed since.*preview/i);
 await upload(page,newFile);await page.evaluate(()=>{window.fixtureWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sq_research_checkins_v1')throw new DOMException('Fixture full','QuotaExceededError');return fixtureWrite.call(this,key,value);};});
 await page.locator('#confirmCheckinImportBtn').click();assert.equal(await raw(page),changed);assert.equal(await page.locator('#checkinImportPreview').isVisible(),true);assert.match(await page.locator('#checkinBackupStatus').textContent(),/insufficient storage/);
 await page.evaluate(()=>{Storage.prototype.setItem=fixtureWrite;});await page.locator('#confirmCheckinImportBtn').click();assert.equal(JSON.parse(await raw(page)).entries.length,4);
 const full={...backup,entries:Array.from({length:100},(_,i)=>({...backup.entries[0],id:'full-'+i}))};await upload(page,Buffer.from(JSON.stringify(full)));assert.equal(await page.locator('#confirmCheckinImportBtn').isDisabled(),true);assert.match(await page.locator('#checkinBackupStatus').textContent(),/100|exceeds/i);
 f.check();await f.context.close();pass(`${engine}: invalid, oversized, future, conflicting, stale, quota and capacity imports preserve existing bytes`);
}
async function interrupted(engine){
 const f=await fixture(390),{page}=f;await createRecords(page);const backup=await page.evaluate(()=>sqCreateCheckinBackup()),file=Buffer.from(JSON.stringify({...backup,entries:[{...backup.entries[0],id:'new-entry'}]})),before=await raw(page);
 await upload(page,file);await page.locator('#cancelCheckinImportBtn').click();assert.equal(await raw(page),before);assert.equal(await page.evaluate(()=>sqConfirmCheckinImport()),false);
 await upload(page,file);await page.locator('[data-view="research"]').click();assert.equal(await page.evaluate(()=>!!sqCheckinImport),false);assert.equal(await raw(page),before);await page.locator('[data-view="saved"]').click();
 await upload(page,file);const other=await f.context.newPage();await other.goto(base);await other.waitForFunction(()=>typeof sqConfirmCheckinImport==='function');await other.evaluate(()=>{const j=JSON.parse(localStorage.getItem('sq_research_checkins_v1'));j.entries.push({...j.entries[0],id:'second-tab'});localStorage.setItem('sq_research_checkins_v1',JSON.stringify(j));});
 await page.waitForFunction(()=>!sqCheckinImport);assert.match(await page.locator('#checkinBackupStatus').textContent(),/another tab/);assert.equal(JSON.parse(await raw(page)).entries.length,3);
 // Asynchronous file completion cannot resurrect a cancelled or superseded preview.
 await page.evaluate(()=>{window.finishRead=null;sqChooseCheckinImport({target:{files:[{size:100,name:'slow.json',text:()=>new Promise(resolve=>{finishRead=resolve;})}]}});sqCancelCheckinImport(false);});
 await page.evaluate(text=>finishRead(text),file.toString());assert.equal(await page.evaluate(()=>!!sqCheckinImport),false);
 f.check();await f.context.close();pass(`${engine}: cancel, navigation, cross-tab updates and late file reads never import or resurrect stale previews`);
}
async function concurrent(engine){
 const f=await fixture(390),{page}=f;await createRecords(page);const backup=await page.evaluate(()=>sqCreateCheckinBackup()),before=JSON.parse(await raw(page)).entries;
 const other=await f.context.newPage();await other.goto(base);await other.waitForFunction(()=>typeof sqConfirmCheckinImport==='function');
 for(const [target,id] of [[page,'tab-one'],[other,'tab-two']])await target.evaluate(({backup,id})=>{sqStageCheckinImport(JSON.stringify({...backup,entries:[{...backup.entries[0],id}]}));},{backup,id});
 await Promise.all([page.evaluate(()=>sqWithCheckinJournalLock(sqConfirmCheckinImport)),other.evaluate(()=>sqWithCheckinJournalLock(sqConfirmCheckinImport))]);
 const after=JSON.parse(await raw(page)).entries;assert.deepEqual(after.slice(0,2),before);assert.equal(after.length,3);assert.ok(['tab-one','tab-two'].includes(after[2].id));
 const missing=after[2].id==='tab-one'?'tab-two':'tab-one';await upload(page,Buffer.from(JSON.stringify({...backup,entries:[{...backup.entries[0],id:missing}]})));await page.locator('#confirmCheckinImportBtn').click();
 assert.equal(JSON.parse(await raw(page)).entries.length,4);f.check();await f.context.close();pass(`${engine}: simultaneous tabs retain all prior entries and require a fresh preview before the second merge`);
}
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 for(const engine of (process.env.BACKUP_BROWSERS||'chromium,webkit').split(',')){
  if(!playwright[engine])throw Error('Unknown browser');browser=await playwright[engine].launch({headless:true});
  for(const width of [1440,390,320])await roundTrip(width,engine);
  await failures(engine);await interrupted(engine);await concurrent(engine);await browser.close();browser=null;
 }
 fs.writeFileSync(path.join(evidence,'journal-backup-browser.json'),JSON.stringify({commit:process.env.REVIEW_HEAD_SHA||'local',checks:reports,liveProviderRequests:0},null,2));console.log(count+' journal backup browser workflows passed');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
