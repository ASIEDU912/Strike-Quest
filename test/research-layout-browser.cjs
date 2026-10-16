// Responsive ordering and interaction checks against the released baseline.
// Disposable fixture storage only; every external request and socket is blocked.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),origin='https://research-layout.fixture.test',old='086c82872db74373977b572aff7a48c64bc4dd59';
const at='2026-10-01T12:00:00.000Z';
const idea={id:'layout-idea',ticker:'XLK',p:'2y',price:190.43,perf:76.93,c:20,divisor:1.5,increment:1,low:194,mid:218,high:242,reason:'Private synthetic layout fixture; preserve this saved idea.',at,inputMode:'manual'};
const entry={id:'layout-checkin',originalId:idea.id,original:{...idea,period:'2y',correction:20},current:{...idea,period:'2y',correction:20},reason:'Private fixture reflection: uncertainty remains after reviewing assumptions.',thinking:'uncertain',evidence:'assumptions',observation:'',createdAt:at};
const seed={sq_next_session:JSON.stringify({mode:'manual',ticker:'XLK',period:'2y',correction:20,price:'190.43',perf:'76.93',divisor:'1.5',increment:'1'}),splab_history:JSON.stringify([idea]),sq_research_checkins_v1:JSON.stringify({version:1,entries:[entry]}),sq_badges_v1011:JSON.stringify({version:1,earned:{first:{at,mode:'manual',origin:'fixture'}},horizons:[]}),sq_progress:JSON.stringify({earned:{first:{at}}}),sq_badges_next:JSON.stringify({earned:{},horizons:[]}),'sq_journey_v1:guest:revisit':JSON.stringify({version:1,at,mode:'manual'})};
const beforeFiles=new Map();
for(const file of ['studio.js','studio.css','public-preview.js'])beforeFiles.set(file,execFileSync('git',['show',old+':'+file],{cwd:root}));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
for(const x of manifest.files){const bytes=fs.readFileSync(path.join(root,x.path));assert.equal(bytes.length,x.bytes,x.path+' length');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),x.sha256,x.path+' hash');}
console.log('LAYOUT_MANIFEST_PASS '+manifest.files.length+' release files');
let imageBytes=0;
async function image(page,name,locator){
 const bytes=await (locator||page).screenshot({type:'jpeg',quality:58,animations:'disabled',...(locator?{}:{fullPage:false})});
 assert.ok(bytes.length<180000);imageBytes+=bytes.length;assert.ok(imageBytes<750000);
 console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
 const b64=bytes.toString('base64');for(let i=0;i<b64.length;i+=160)console.log('SQ_IMAGE_DATA '+b64.slice(i,i+160));console.log('SQ_IMAGE_END '+name);
}
async function fixture(browser,width,baseline=false,extra={}){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],external=[];
 await context.addInitScript(seed=>{if(!sessionStorage.getItem('layout-seeded')){for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('layout-seeded','1');}sessionStorage.setItem('strikequests_v9_splash_seen','1');},{...seed,...extra});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin!==origin){external.push(u.href);return route.abort();}
  const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1)),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
  return route.fulfill({body:baseline&&beforeFiles.has(relative)?beforeFiles.get(relative):fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'});
 });
 await context.routeWebSocket('**/*',s=>{external.push(s.url());s.close();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/#research');await page.waitForSelector('body[data-quest-renewal="'+(baseline?'10.3.2':'10.3.4')+'"]');
 await page.locator('#scenarioHeading').waitFor();await page.waitForFunction(()=>document.querySelector('#studioReference').textContent.includes('190.43'));
 if(!baseline)await page.waitForFunction(()=>document.getElementById('studioResearchLumiName').textContent==='Lumi · Scout');
 return {page,context,async finish(){assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();}};
}
async function state(page){return page.evaluate(keys=>({xp:sqResearchXp(),storage:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))}),Object.keys(seed));}
async function metrics(page){return page.evaluate(()=>{
 const ids=['studioInstrument','missionControls','scenarioSection','companionPanel','researchContext','dataQuality','studioHistory','studioResearchLumi'];
 const box=el=>{const r=el.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right,height:r.height,width:r.width};};
 return {boxes:Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?box(document.getElementById(id)):null])),targets:[...document.querySelectorAll('#targetsRow .target')].map(el=>({box:box(el),text:el.querySelector('.n').textContent,price:box(el.querySelector('.n')),font:getComputedStyle(el.querySelector('.n')).fontSize,background:getComputedStyle(el).backgroundImage,icon:el.querySelector('svg').innerHTML})),overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
(async()=>{
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();
  try{
   for(const width of [320,390,768,1440]){
    const baseline=await fixture(browser,width,true),before=await metrics(baseline.page);
    if(engine==='chromium'&&width===390)await image(baseline.page,'before-research-390.jpg');
    await baseline.finish();
    const f=await fixture(browser,width),p=f.page,initial=await state(p),after=await metrics(p);
    assert.equal(initial.xp,150);assert.equal(after.overflow,false);
    const b=after.boxes;console.log('LAYOUT_MEASURE '+JSON.stringify({engine,width,before:before.boxes,after:b}));
    assert.ok(b.scenarioSection.top<b.companionPanel.top&&b.companionPanel.top<b.researchContext.top);
    assert.ok(b.studioHistory.top>b.companionPanel.top);
    assert.ok(b.studioResearchLumi.top<b.missionControls.top);
    assert.ok(b.studioResearchLumi.bottom<(await p.locator('.bottom-nav').boundingBox()).y,'Compact Lumi fully above navigation on first screen');
    assert.ok(b.scenarioSection.top<before.boxes.scenarioSection.top-250,'Scenarios materially higher');
    assert.ok(b.companionPanel.top<before.boxes.companionPanel.top-250,'Full guide materially higher');
    assert.deepEqual(after.targets.map(({text,font,background,icon})=>({text,font,background,icon})),before.targets.map(({text,font,background,icon})=>({text,font,background,icon})),'Prices, large type, colors and icons unchanged');
    for(const x of after.targets){assert.ok(x.price.left>=x.box.left-1&&x.price.right<=x.box.right+1,'Price stays inside its card');}
    const dom=await p.evaluate(()=>[...document.getElementById('viewResearch').children].map(e=>e.id||e.className));
    assert.ok(dom.indexOf('scenarioSection')<dom.indexOf('researchContext'),'DOM follows visual order');
    for(const selector of ['#ticker','#periodTabs','#correction','#divisor','#increment','#price','#perf','#targetCorrection'])assert.equal(await p.locator(selector).isVisible(),true,selector);
    assert.equal(await p.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#correction').inputValue(),'20');
    assert.equal(await p.locator('#studioResearchLumiArt [data-creature-form]').getAttribute('data-creature-form'),'toddler-scout');
    assert.match(await p.locator('#studioResearchLumiName').innerText(),/Scout/);
    assert.equal(await p.locator('#studioResearchLumiArt .sq-mascot__head').evaluate(e=>getComputedStyle(e).animationName),'none');
    // Quick Picks now follows the compact shortcut in the opening instrument card.
    await p.locator('#studioResearchLumi').focus();await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(()=>document.activeElement.id),'quickPicks');
    await p.locator('#studioResearchLumi').focus();await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(()=>document.activeElement.id),'companionSummary');
    const focused=await p.locator('#companionSummary').boundingBox(),nav=await p.locator('.bottom-nav').boundingBox();
    assert.ok(focused.y>=-1&&focused.y+focused.height<nav.y,'Guide focus clear of fixed navigation');
    assert.deepEqual(await state(p),initial,'Navigation and compact Lumi award nothing');
    await p.locator('#targetCorrection').focus();await p.keyboard.press('ArrowRight');
    assert.equal(await p.locator('#correction').inputValue(),'21');assert.equal(await p.locator('#high').innerText(),'$242');
    await p.locator('#resetScenario').click();assert.equal(await p.locator('#correction').inputValue(),'10');assert.equal(await p.locator('#targetCorrection').inputValue(),'10');
    assert.equal(await p.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');
    // Restore working input through its real control; the saved original remains 20%.
    await p.locator('#targetCorrection').focus();for(let i=0;i<10;i++)await p.keyboard.press('ArrowRight');
    assert.equal(await p.locator('#targetCorrection').inputValue(),'20');
    await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#studioResearchLumi').click();
    assert.equal(await p.locator('#companionHost .sq-mascot__head').evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.equal(await p.locator('#studioResearchLumiArt .sq-mascot__head').evaluate(e=>getComputedStyle(e).animationName),'none');
    await p.keyboard.press('Enter');assert.equal(await p.locator('#companionPanel').getAttribute('open'),null);
    await p.reload();await p.waitForSelector('body[data-quest-renewal="10.3.4"]');assert.equal(await p.locator('#companionPanel').getAttribute('open'),null,'Collapse preference retained');
    await p.locator('#studioResearchLumi').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'companionSummary');
    await p.keyboard.press('Enter');assert.equal(await p.locator('#companionPanel').getAttribute('open'),'');
    const end=await state(p);assert.equal(end.xp,initial.xp);
    for(const key of Object.keys(seed).filter(k=>k!=='sq_next_session'))assert.equal(end.storage[key],initial.storage[key],key+' byte-for-byte');
    assert.deepEqual(JSON.parse(end.storage.sq_next_session),JSON.parse(initial.storage.sq_next_session));
    // Scenario shortcut keeps the correction slider before prices and focuses the destination.
    await p.locator('#openTargetsBtn').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'scenarioSection');
    const control=await p.locator('#targetCorrection').boundingBox(),prices=await p.locator('#targetsRow').boundingBox();assert.ok(control.y+control.height<prices.y);
    if(engine==='chromium'&&width===390){await p.locator('[data-view="research"]').click();await image(p,'after-research-390.jpg');await image(p,'after-scenarios-390.jpg',p.locator('#scenarioSection'));await image(p,'after-lumi-guide-390.jpg',p.locator('#companionPanel'));}
    if(engine==='chromium'&&width===1440){await p.locator('[data-view="research"]').click();await image(p,'after-research-1440.jpg');}
    console.log('LAYOUT_PASS '+JSON.stringify({engine,width,before:{scenarios:before.boxes.scenarioSection.top,lumi:before.boxes.companionPanel.top},after:{scenarios:b.scenarioSection.top,lumi:b.companionPanel.top,compactLumi:b.studioResearchLumi.top},checks:'same target type/icons/colors, expanded controls, DOM order, keyboard focus, reduced motion, collapse reload, same saved data/journal/XP, no overflow or external requests'}));
    await f.finish();
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

