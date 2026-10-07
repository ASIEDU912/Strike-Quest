// Fixture-only rendered multi-host companion regression. Never visits a provider.
// Run with COMPANION_BROWSERS=chromium,webkit (default); no browser downloads here.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'https://strikequests.companion.fixture.test';
const fixedNow = '2026-10-07T12:00:00.000Z';
const hosts = [
  {context:'research',host:'companionHost',panel:'companionPanel',summary:'companionSummary'},
  {context:'quests',host:'questsCompanionHost',panel:'questsCompanionPanel',summary:'questsCompanionSummary'},
  {context:'seasonality',host:'seasonalityCompanionHost',panel:'seasonalityCompanionPanel',summary:'seasonalityCompanionSummary'},
  {context:'saved',host:'savedCompanionHost',panel:'savedCompanionPanel',summary:'savedCompanionSummary'},
  {context:'watchlist',host:'watchlistCompanionHost',panel:'watchlistCompanionPanel',summary:'watchlistCompanionSummary'}
];
const stages = [[0,'rookie'],[50,'scout'],[150,'ranger'],[375,'keeper'],[500,'voyager']];
const reports=[];
let browser;
function pass(name){reports.push(name);console.log('SQ_COMPANION_PASS '+name);}
async function fixture(width){
  const context=await browser.newContext({viewport:{width,height:width<700?844:1050},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
  const unexpected=[],errors=[];
  await context.addInitScript(fixedNow=>{
    const OriginalDate=Date;
    window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return OriginalDate.parse(fixedNow);}};
    sessionStorage.setItem('strikequests_v9_splash_seen','1');
  },fixedNow);
  // A small explicit asset allowlist prevents an accidental fixture-origin API
  // request from being fulfilled with arbitrary repository files.
  const allowed=new Set(['/','/index.html','/mascot.js','/mascot.css','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png','/favicon.ico']);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===base&&url.pathname==='/config.json')return route.fulfill({contentType:'application/json',body:JSON.stringify({marketDataApi:'https://blocked-provider.fixture.test'})});
    if(url.origin!==base||!allowed.has(url.pathname)){unexpected.push(url.href);return route.abort('blockedbyclient');}
    const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
    if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
    return route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await context.routeWebSocket('**/*',socket=>{unexpected.push(socket.url());socket.close();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelectorAll('.sq-companion').length===5);
  return {page,context,check(){assert.deepEqual(errors,[],'No page errors');assert.deepEqual(unexpected,[],'No unexpected/provider requests');}};
}
async function visit(page,name,expanded=true){
  const h=hosts.find(h=>h.context===name);assert.ok(h);
  await page.locator(`[data-view="${name==='seasonality'?'research':name}"]`).click();
  if(name==='seasonality')await page.locator('#openSeasonalityBtn').click();
  if(name==='research')await page.locator('[data-analysis="overview"]').click();
  await page.locator('#'+h.summary).scrollIntoViewIfNeeded();
  if(expanded){
    if(!await page.locator('#'+h.panel).evaluate(el=>el.open))await page.locator('#'+h.summary).click();
    await page.locator('#'+h.host).scrollIntoViewIfNeeded();
    await page.waitForFunction(id=>!document.querySelector('#'+id+' .sq-companion').classList.contains('sq-mascot--inactive'),h.host);
  }
  return h;
}
async function protectedState(page){return page.evaluate(()=>JSON.stringify({mode:state.mode,period:state.period,correction:state.correction,ticker:$('ticker').value,price:$('price').value,perf:$('perf').value,divisor:$('divisor').value,increment:$('increment').value,reason:$('researchReason').value,loaded:state.loadedResearchId||null,badges:sqBadges(),saved:sqJSON('splab_history',[]),watch:getWatchlist(),compare:getCompareSelection(),session:sqJSON('sq_next_session',{})}));}
async function action(page,name,target){
  const h=await visit(page,name),before=await protectedState(page);
  const button=page.locator('#'+h.host+' [data-mascot-action]');
  const description=await button.getAttribute('aria-describedby');
  assert.ok(description);assert.equal(await page.locator('#'+description).count(),1);
  await button.focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),target,`${name} guide focus`);
  assert.equal(await protectedState(page),before,`${name}: guidance only navigates; no save/load/compare, input changes or XP`);
}
async function noOverflow(page,label){
  const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(sizes.scroll<=sizes.width+1,label+': '+JSON.stringify(sizes));
}
async function seedStage(page,xp){
  await page.evaluate(xp=>{
    const mask=Array.from({length:1<<SQ_CORE.length},(_,i)=>i).find(mask=>SQ_CORE.reduce((sum,b,i)=>sum+((mask&(1<<i))?ACHIEVEMENTS[b.id].xp:0),0)===xp);
    if(mask===undefined)throw Error('No dated core badge fixture for '+xp);
    sqBadgeSave({version:1,earned:Object.fromEntries(SQ_CORE.filter((_,i)=>mask&(1<<i)).map(b=>[b.id,{at:'2026-10-07T12:00:00Z',mode:'demo',origin:'companion-test'}])),horizons:[]});
    sqRenderBadges();
  },xp);
  assert.equal(await page.evaluate(()=>sqResearchXp()),xp);
}
async function uniqueIds(page){
  const issues=await page.evaluate(()=>{
    const result=[];
    for(const svg of document.querySelectorAll('.sq-mascot')){
      for(const el of svg.querySelectorAll('[id]'))if(document.querySelectorAll('[id="'+el.id+'"]').length!==1)result.push('Duplicate '+el.id);
      for(const id of svg.getAttribute('aria-labelledby').split(/\s+/))if(!svg.querySelector('[id="'+id+'"]'))result.push('Missing label '+id);
      for(const el of svg.querySelectorAll('*'))for(const attr of el.attributes)for(const match of attr.value.matchAll(/url\(#([^)]*)\)/g))if(!svg.querySelector('[id="'+match[1]+'"]'))result.push('Cross-host paint '+match[1]);
    }
    return result;
  });assert.deepEqual(issues,[],'All SVG labels, gradients and filters are unique and host-local');
}
async function emitImage(page,h,name){
  // Bounded synthetic-only panel capture; no device/user data or uploads.
  await page.locator('#'+h.panel).scrollIntoViewIfNeeded();
  const buffer=await page.locator('#'+h.panel).screenshot({animations:'disabled'});
  assert.ok(buffer.length<180*1024,`Evidence image too large: ${name}`);
  console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),commit:process.env.REVIEW_HEAD_SHA||'local'}));
  const b64=buffer.toString('base64');for(let i=0;i<b64.length;i+=160)console.log('SQ_IMAGE_DATA '+b64.slice(i,i+160));
  console.log('SQ_IMAGE_END '+name);
}
async function layoutAndPreferences(page,width,engine){
  assert.equal(await page.evaluate(()=>sqResearchXp()),0);
  const before=await protectedState(page);
  for(const h of hosts){
    await visit(page,h.context);
    assert.equal(await page.locator('#'+h.host+' .sq-mascot--rookie').count(),1);
    assert.equal(await page.locator('#'+h.host+' .sq-companion--compact').count(),h.context==='quests'?0:1);
    for(const part of ['title','text'])assert.ok((await page.locator('#'+h.host+' .sq-companion__guide-'+part).textContent()).trim().length>8);
    const button=await page.locator('#'+h.host+' [data-mascot-action]').boundingBox();assert.ok(button.height>=44,`${h.context} CTA touch target`);
    await noOverflow(page,`${engine}/${width}/${h.context}`);
  }
  assert.equal(await protectedState(page),before);await uniqueIds(page);
  await action(page,'research','scenarioSection');await action(page,'quests','analyzeBtn');
  await action(page,'seasonality','coverageSummary');assert.equal(await page.locator('#qualityDetails').evaluate(el=>el.open),true);
  await action(page,'saved','researchReason');await action(page,'watchlist','watchCurrentBtn');
  pass(`${engine}/${width}: five contextual placements, navigation-only keyboard actions, unique SVG IDs and no overflow`);
  await visit(page,'quests');await page.locator('#questsCompanionHost [data-mascot-motion]').click();
  for(const h of hosts){assert.equal(await page.locator('#'+h.host+' [data-mascot-motion]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#'+h.host+' .sq-mascot--static').count(),1);}
  await page.locator('#questsCompanionSummary').click();
  await page.waitForFunction(()=>['companionPanel','questsCompanionPanel','seasonalityCompanionPanel','savedCompanionPanel','watchlistCompanionPanel'].every(id=>!document.getElementById(id).open));
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.sq-companion').length===5);
  for(const h of hosts){assert.equal(await page.locator('#'+h.panel).evaluate(el=>el.open),false);assert.equal(await page.locator('#'+h.host+' [data-mascot-motion]').textContent(),'Resume motion');assert.equal(await page.locator('#'+h.host+' .sq-companion__status').textContent(),'');}
  assert.equal(await page.evaluate(()=>localStorage.getItem('sq_companion_paused')),'true');assert.equal(await page.evaluate(()=>localStorage.getItem('sq_companion_collapsed')),'true');
  await visit(page,'saved',false);await page.locator('#savedCompanionSummary').click();
  await page.waitForFunction(()=>['companionPanel','questsCompanionPanel','seasonalityCompanionPanel','savedCompanionPanel','watchlistCompanionPanel'].every(id=>document.getElementById(id).open));
  await page.locator('#savedCompanionHost [data-mascot-motion]').click();
  for(const h of hosts)assert.equal(await page.locator('#'+h.host+' [data-mascot-motion]').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>sqResearchXp()),0);
  pass(`${engine}/${width}: pause/collapse synchronize across all hosts, survive reload and resume without XP`);
}
async function contextualData(page,engine){
  await visit(page,'seasonality');
  let sample=await page.evaluate(()=>({current:state.extra.seasonality.currentMonth.observations,total:state.extra.seasonality.totalMonths,text:sqCompanionGuide('seasonality').text}));
  assert.notEqual(sample.current,sample.total);assert.match(sample.text,new RegExp('\\b'+sample.current+' Oct observations?\\b'));assert.match(sample.text,/synthetic/i);
  await page.locator('[data-private-mode="manual"]').click();
  assert.match(await page.locator('#seasonalityCompanionHost .sq-companion__guide-text').textContent(),/unavailable|no .*history|no .*sample/i);
  assert.equal(await page.locator('#seasonalityObs').textContent(),'—');
  await action(page,'seasonality','dataModes');
  // Genuine input invalidation from Demo must also clear an already-open guide.
  await page.locator('[data-private-mode="demo"]').click();await visit(page,'seasonality');
  await page.locator('#ticker').fill('');
  assert.match(await page.locator('#seasonalityCompanionHost .sq-companion__guide-text').textContent(),/unavailable|no .*history|no .*sample/i);
  assert.equal(await page.locator('#seasonalityObs').textContent(),'—');
  await page.evaluate(()=>{setMode('demo');applySymbol('AAPL');});
  await visit(page,'seasonality');await page.locator('[data-season-mode="specific"]').click();
  await page.evaluate(()=>{saveSelectedSeasonYears([1900]);renderSeasonality();});
  assert.match(await page.locator('#seasonalityCompanionHost .sq-companion__guide-text').textContent(),/0 Oct observations/);
  await action(page,'seasonality','seasonModeSwitch');
  await page.evaluate(()=>setSeasonalityMode('range'));
  pass(`${engine}: current-month counts stay separate from all-month totals; Manual/ticker invalidation and empty selected years stay truthful`);
  await page.evaluate(()=>{
    localStorage.setItem('splab_history',JSON.stringify([{id:'fixture-note',ticker:'AAPL',p:'2y',at:'2026-10-06T12:00:00Z',price:200,perf:30,divisor:1.5,increment:1,correction:10,low:198,mid:210,high:220,inputMode:'demo',reason:'Revisit these synthetic assumptions after checking the sample.'}]));renderHistory();
  });
  await action(page,'saved','history');assert.match(await page.locator('#savedCompanionHost .sq-companion__guide-text').textContent(),/1 saved research snapshot/);
  await page.locator('#history').getByRole('button',{name:'Load',exact:true}).click();
  await action(page,'research','researchReason');await action(page,'saved','researchReason');
  assert.equal(await page.evaluate(()=>!!sqBadges().earned.review),false);
  await visit(page,'saved');await page.locator('#history').getByRole('button',{name:'Delete',exact:true}).click();
  assert.match(await page.locator('#savedCompanionHost .sq-companion__guide-title').textContent(),/Keep a thought/);
  await action(page,'saved','researchReason');
  assert.equal(await page.evaluate(()=>sqJSON('splab_history',[]).length),0);
  await page.evaluate(()=>{
    const snapshot={price:200,perf:30,low:198,mid:210,high:220,period:'2y',correction:10,inputMode:'demo',updatedAt:'2026-10-07T12:00:00Z'};
    setWatchlist([{symbol:'AAPL',snapshot},{symbol:'MSFT',snapshot:{...snapshot,price:320}}]);setCompareSelection([]);renderWatchlist();
  });
  await action(page,'watchlist','watchlist');assert.equal(await page.evaluate(()=>getCompareSelection().length),0);
  await page.evaluate(()=>{setCompareSelection(['AAPL','MSFT']);renderWatchlist();});
  await action(page,'watchlist','comparePanel');assert.equal(await page.evaluate(()=>!!sqBadges().earned.compare),false);
  await visit(page,'watchlist');
  for(const symbol of ['AAPL','MSFT'])await page.locator('.watch-item').filter({has:page.locator('.watch-symbol',{hasText:symbol})}).getByRole('button',{name:'Remove',exact:true}).click();
  assert.match(await page.locator('#watchlistCompanionHost .sq-companion__guide-title').textContent(),/Start with a research snapshot/);
  pass(`${engine}: saved empty/populated/loaded/deleted notes and watchlist empty/populated/selected guides never auto-save, load, compare or award`);
}
async function stagesAndCelebrations(page,engine){
  await page.evaluate(()=>{setMode('demo');applySymbol('AAPL');});
  for(const [xp,name] of stages){
    await seedStage(page,xp);
    for(const h of hosts){assert.equal(await page.locator('#'+h.host+' .sq-mascot--'+name).count(),1);assert.match(await page.locator('#'+h.summary).textContent(),new RegExp(xp+' XP'));assert.equal(await page.locator('#'+h.host+' .sq-companion__status').textContent(),'');}
    await uniqueIds(page);
  }
  const max=await page.evaluate(()=>{const b=sqBadges();b.earned.review={at:'2026-10-07T12:00:00Z'};sqBadgeSave(b);sqRenderBadges();return sqResearchXp();});assert.equal(max,500);
  for(const h of hosts){
    await seedStage(page,0);await visit(page,h.context);await page.waitForTimeout(1100);
    const result=await page.evaluate(()=>{
      const toast=$('badgeToast'),observer=new MutationObserver(()=>{});observer.observe(toast,{childList:true,characterData:true,subtree:true});
      sqEarn('first');const once=observer.takeRecords().length;
      const celebrants=[...document.querySelectorAll('.sq-mascot--levelup,.sq-mascot--earn')].map(svg=>svg.closest('[id$="Host"]').id);
      sqEarn('first');sqRenderBadges();sqRenderCompanion();const repeat=observer.takeRecords().length;observer.disconnect();
      return {once,repeat,celebrants,xp:sqResearchXp(),toast:toast.textContent,statuses:[...document.querySelectorAll('.sq-companion__status')].map(el=>el.textContent)};
    });
    assert.ok(result.once>0);assert.equal(result.repeat,0);assert.deepEqual(result.celebrants,[h.host]);assert.equal(result.xp,50);assert.match(result.toast,/Lumi evolved into Signal Scout/);assert.ok(result.statuses.every(x=>x===''));
  }
  // An offscreen active-view host still synchronizes its stage, silently.
  await seedStage(page,0);await visit(page,'quests');await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForFunction(()=>document.querySelector('#questsCompanionHost .sq-companion').classList.contains('sq-mascot--inactive'));
  await page.evaluate(()=>sqEarn('first'));
  assert.equal(await page.locator('.sq-mascot--levelup,.sq-mascot--earn').count(),0);
  await seedStage(page,500);
  pass(`${engine}: all five stages synchronize through final500; one visible celebration and one central announcement; repeated awards and offscreen hosts stay silent`);
}
(async()=>{
  const engines=(process.env.COMPANION_BROWSERS||'chromium,webkit').split(',').map(s=>s.trim());
  for(const engine of engines){
    assert.ok(['chromium','webkit'].includes(engine));
    browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    for(const width of [320,390,1440]){
      const x=await fixture(width);
      try{
        await layoutAndPreferences(x.page,width,engine);
        if(width===390){
          await contextualData(x.page,engine);await stagesAndCelebrations(x.page,engine);
          if(engine==='chromium'){await x.page.waitForTimeout(4000);for(const h of hosts){await visit(x.page,h.context);await emitImage(x.page,h,`lumi-${h.context}-390-final500.png`);}}
        }
        x.check();
      }finally{await x.context.close();}
    }
    await browser.close();browser=null;
  }
  console.log('SQ_COMPANION_COMPLETE '+JSON.stringify({checks:reports.length,engines,liveProviderRequests:0}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
