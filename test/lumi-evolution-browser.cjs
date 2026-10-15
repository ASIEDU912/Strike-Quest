// Isolated app fixtures: no live provider requests or user storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),base='https://lumi-evolution.fixture.test';
const ranks=['Spark','Scout','Seeker','Navigator','Analyst','Strategist','Sage','Guardian','Ascendant','Mythic Lumi'];
const xp=[0,100,240,430,680,1000,1400,1850,2400,3000];
const forms=['baby-spark','toddler-scout','round-cub','long-eared-juvenile','tufted-runner','tufted-runner','three-tail-guardian','three-tail-guardian','celestial-winged-fox','celestial-winged-fox'];
const protectedSeed={splab_history:JSON.stringify([{id:'retained-note',ticker:'AAPL',p:'2y',price:200,perf:30,c:10,divisor:1.5,increment:1,reason:'Preserve this private fixture note.',at:'2026-10-14T12:00:00Z',inputMode:'manual'}]),sq_research_checkins_v1:JSON.stringify({version:1,entries:[]})};
(async()=>{
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();
  try{
   for(const width of [320,390,1440]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],external=[];
    await context.addInitScript(seed=>{
     sessionStorage.setItem('strikequests_v9_splash_seen','1');
     if(!localStorage.getItem('sq_next_session'))localStorage.setItem('sq_next_session',JSON.stringify({mode:'manual',ticker:'AAPL',period:'2y',correction:10,price:'200',perf:'30',divisor:'1.5',increment:'1'}));
     for(const [k,v] of Object.entries(seed))if(!localStorage.getItem(k))localStorage.setItem(k,v);
    },protectedSeed);
    await context.route('**/*',route=>{
     const u=new URL(route.request().url());
     if(u.origin!==base){external.push(u.href);return route.abort();}
     const rel=u.pathname==='/'?'index.html':u.pathname.slice(1),file=path.resolve(root,rel);
     if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
     const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(file)]||'text/plain';
     return route.fulfill({contentType:type,body:fs.readFileSync(file)});
    });
    await context.routeWebSocket('**/*',s=>{external.push(s.url());s.close()});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
    await page.waitForSelector('body[data-quest-renewal="10.3.1"]');
    await page.locator('[data-view="quests"]').click();
    const initial=await page.evaluate(()=>Object.fromEntries(['splab_history','sq_research_checkins_v1','sq_badges_v1',...Object.keys(localStorage).filter(k=>k.startsWith('sq_journey_v1:'))].map(k=>[k,localStorage.getItem(k)])));
    for(let i=0;i<xp.length;i++){
     // Override the score only inside this disposable fixture; never grant/write awards.
     await page.evaluate(n=>{sqResearchXp=()=>n;sqRenderBadges()},xp[i]);
     await page.waitForFunction(i=>document.querySelector('#questGrowthText').textContent.startsWith('Stage '+(i+1)+' / 10'),i);
     assert.deepEqual(await page.locator('#questStageMap b').allTextContents(),ranks.slice(0,Math.min(i+2,10)).map((n,j)=>String(j+1).padStart(2,'0')+' · '+n));
     assert.equal(await page.locator('#questStageMap .locked').count(),i===9?0:1);
     assert.equal(await page.locator('#questStageMap [aria-current="step"] [data-creature-form]').getAttribute('data-creature-form'),forms[i]);
     assert.equal(await page.locator('#questsCompanionHost [data-creature-form]').getAttribute('data-creature-form'),forms[i]);
     assert.equal(await page.locator('#questStageMap .current .sq-mascot__aura').count(),i>=4?1:0);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    await page.evaluate(()=>{sqResearchXp=()=>0;sqRenderBadges()});
    await page.waitForFunction(()=>document.querySelectorAll('#questStageMap .quest-stage').length===2);
    await page.getByText('Your original Lumi collection',{exact:true}).click();
    assert.equal(await page.locator('#questLegacyLooks [data-creature-form]').getAttribute('data-creature-form'),'round-cub');
    assert.match(await page.locator('#questLegacyLooks').innerText(),/Rookie/);
    await page.locator('#questsCompanionHost [data-mascot-tap]').click();
    assert.equal(await page.evaluate(()=>sqResearchXp()),0);
    await page.locator('#questsCompanionHost [data-mascot-motion]').click();
    assert.equal(await page.locator('#questsCompanionHost [data-mascot-motion]').getAttribute('aria-pressed'),'true');
    await page.reload();await page.waitForSelector('body[data-quest-renewal="10.3.1"]');
    assert.equal(await page.locator('#questsCompanionHost [data-mascot-motion]').getAttribute('aria-pressed'),'true');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-view="quests"]').click();
    assert.ok(await page.locator('#questsCompanionHost .sq-mascot__head').evaluate(el=>getComputedStyle(el).animationName==='none'));
    assert.equal(await page.locator('#questStageMap .quest-stage').count(),2);
    const after=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(initial));
    assert.deepEqual(after,initial,'Artwork/reveal changes preserve saved research, journal and earned data');
    for(const [k,v] of Object.entries(protectedSeed))assert.equal(after[k],v);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('LUMI_PASS '+engine+'/'+width+': all ten boundaries, next-only future reveal, exact form placement, original collection, no overflow, pause/reduced motion, saved data retained, zero provider requests');
    await context.close();
   }
  }finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
