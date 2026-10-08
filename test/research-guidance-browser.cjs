// Rendered regression suite for the research-guidance iteration.
// All document, asset, config and provider traffic is intercepted. No live provider is contacted.
// This file was authored/syntax-checked in the restricted executor; run it only where Chromium launch is permitted.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const evidence = path.resolve(process.env.EVIDENCE_DIR || path.join(root, 'test-results'));
const base = 'https://strikequests.fixture.test';
const market = 'https://market.fixture.test';
const fixedNow = '2026-10-07T12:00:00.000Z';
const reports = [], errors = [], allRequests = [];
let browser;
function pass(name) { reports.push(name); console.log('PASS', name); }
function fixture(symbol) {
  const price = symbol === 'MSFT' ? 320 : 200;
  const weekly = Array.from({length:211}, (_, i) => {
    const close = price - (210 - i) * .3;
    return {date:new Date(Date.UTC(2026,8,30)-(210-i)*7*86400000).toISOString().slice(0,10),close,high:close+5,low:close-5};
  });
  const monthly = Array.from({length:121}, (_, i) => {
    const close = Math.max(10, price - 120 + i);
    return {date:new Date(Date.UTC(2016,9+i,0)).toISOString().slice(0,10),close,high:close+5,low:close-5};
  });
  return {ok:true,symbol,source:'Local automated fixture',cache:'hit',fetchedAt:Date.parse(fixedNow),daily:[weekly.at(-1)],weekly,monthly};
}
async function createPage(viewport, seed={}) {
  const context = await browser.newContext({viewport,serviceWorkers:'block'});
  await context.addInitScript(({seed,fixedNow}) => {
    const OriginalDate = Date;
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return OriginalDate.parse(fixedNow); }
    };
    // Seed only once so browser reload can exercise real persisted state.
    if(!sessionStorage.getItem('fixture_seeded')) {
      for(const [key,value] of Object.entries(seed)) localStorage.setItem(key,JSON.stringify(value));
      localStorage.setItem('sq_alpha_key','TEST_ONLY');
      localStorage.setItem('splab_barchart_key','TEST_ONLY');
      sessionStorage.setItem('fixture_seeded','1');
      sessionStorage.setItem('strikequests_v9_splash_seen','1');
    }
  }, {seed,fixedNow});
  const network = {provider:[],unexpected:[],hold:false,pending:[]};
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    allRequests.push({origin:url.origin,path:url.pathname});
    if(url.origin === base) {
      if(url.pathname === '/config.json') return route.fulfill({contentType:'application/json',body:JSON.stringify({marketDataApi:market})});
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const file = path.resolve(root,relative);
      if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({status:404,body:''});
      const type = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'}[path.extname(file)] || 'text/plain';
      return route.fulfill({contentType:type,body:fs.readFileSync(file)});
    }
    if(url.origin === market && ['/health','/v1/market'].includes(url.pathname)) {
      network.provider.push(url.pathname);
      const body = url.pathname === '/health' ? {ok:true,providerConfigured:true,cacheConfigured:true} : fixture(url.searchParams.get('symbol'));
      const fulfill = async () => {
        try { await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)}); }
        catch(error) { if(!request.failure()) throw error; } // Editing Manual inputs may already have aborted this request.
      };
      if(network.hold && url.pathname === '/v1/market') { network.pending.push(fulfill); network.onPending?.(); return; }
      return fulfill();
    }
    network.unexpected.push(request.url());
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base+'/#research');
  await page.waitForFunction(() => document.getElementById('appSplash').classList.contains('hide'));
  return {page,context,network};
}
async function noOverflow(page) {
  const x = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(x.scroll <= x.width + 1, JSON.stringify(x));
}
async function focused(page, id, requireVisibleControl=true) {
  assert.equal(await page.evaluate(() => document.activeElement?.id), id);
  if(requireVisibleControl) {
    const x = await page.locator('#'+id).evaluate(el => {
      const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,nav:nav.top,width:innerWidth};
    });
    assert.ok(x.top >= 0 && x.bottom <= x.nav + 1 && x.left >= 0 && x.right <= x.width + 1, JSON.stringify({id,...x}));
  }
}
async function clickMission(page, target, source='missionNextAction', visible=true) {
  const before = await page.evaluate(() => ({mode:state.mode,earned:JSON.stringify(sqBadges().earned)}));
  await page.locator('#'+source).click();
  await focused(page,target,visible);
  const after = await page.evaluate(() => ({mode:state.mode,earned:JSON.stringify(sqBadges().earned)}));
  assert.deepEqual(after,before);
}
async function sourceLabels(page, selector, expected) {
  const labels = await page.locator(selector+' .snapshot-source b').allTextContents();
  assert.deepEqual(labels,expected);
}
(async () => {
  fs.mkdirSync(evidence,{recursive:true});
  browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
  for(const viewport of [{width:320,height:700},{width:390,height:844},{width:1440,height:1050}]) {
    const {page,context,network} = await createPage(viewport);
    const suffix = `${viewport.width}px`;
    // Actual fresh startup and real mascot module, without seeding a horizon.
    assert.deepEqual(await page.evaluate(()=>({period:state.period,correction:state.correction,divisor:Number($('divisor').value)})),{period:'2y',correction:10,divisor:1.5});
    assert.equal(await page.locator('[data-p="2y"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#targetCorrection').inputValue(),'10');
    assert.match(await page.locator('#coreScenarioLabel').textContent(),/2-Year.*10%/);
    assert.equal(await page.locator('#companionHost .sq-mascot--rookie').count(),1);
    assert.equal(await page.locator('#companionHost [data-creature-form="round-cub"]').count(),1);
    assert.equal(await page.locator('#companionHost .sq-companion__status').textContent(),'');
    assert.equal(await page.locator('#companionHost .sq-mascot--levelup, #companionHost .sq-mascot--earn').count(),0);
    assert.equal(await page.evaluate(()=>sqResearchXp()),0);
    const privateBefore=await page.evaluate(()=>JSON.stringify({mode:state.mode,period:state.period,correction:state.correction,price:$('price').value,perf:$('perf').value,divisor:$('divisor').value,earned:sqBadges().earned}));
    for(let i=0;i<3;i++){
      await page.locator('#openTargetsBtn').click();await focused(page,'scenarioSection',false);
      assert.equal(await page.locator('#scenarioSection').isVisible(),true);
      await page.locator('#openSeasonalityBtn').click();await focused(page,'analysisSeasonality',false);
      assert.equal(await page.locator('#analysisSeasonality').isVisible(),true);
    }
    assert.equal(await page.evaluate(()=>JSON.stringify({mode:state.mode,period:state.period,correction:state.correction,price:$('price').value,perf:$('perf').value,divisor:$('divisor').value,earned:sqBadges().earned})),privateBefore);
    assert.equal(network.provider.length,0);assert.deepEqual(network.unexpected,[]);
    await noOverflow(page);
    pass(`${suffix}: fresh 2Y/10%/1.5 startup and primary tools keep exact private inputs; navigation earns no XP`);
    // Persist only the companion's appearance preferences, then verify a real reload.
    await page.locator('#companionHost [data-mascot-motion]').click();
    assert.equal(await page.locator('#companionHost [data-mascot-motion]').getAttribute('aria-pressed'),'true');
    await page.locator('#companionSummary').click();
    await page.waitForFunction(()=>localStorage.getItem('sq_companion_collapsed')==='true');
    await page.reload();
    assert.equal(await page.locator('#companionPanel').evaluate(el=>el.open),false);
    assert.equal(await page.locator('#companionHost .sq-mascot--static').count(),1);
    assert.equal(await page.locator('#companionHost .sq-companion__status').textContent(),'');
    assert.equal(await page.evaluate(()=>sqResearchXp()),0);
    await page.locator('#companionSummary').click();await page.locator('#companionHost [data-mascot-motion]').click();
    assert.equal(await page.locator('#companionHost .sq-mascot--static').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('sq_companion_paused')),'false');
    await noOverflow(page);
    await page.screenshot({path:path.join(evidence,`core-lumi-fresh-${viewport.width}.png`),fullPage:true});
    pass(`${suffix}: pause and collapse preferences survive reload, restore silently and resume without awards`);
    assert.equal(await page.locator('#researchScore').textContent(),'0/9');
    assert.equal(await page.locator('#missionNextAction').getAttribute('aria-describedby'),'missionNextText');
    assert.equal(await page.locator('#nextBadgeAction').getAttribute('aria-describedby'),'nextBadgeText');
    for(const id of ['missionNextAction','nextBadgeAction']) assert.ok((await page.locator('#'+id).textContent()).trim().length>4);
    await page.locator('#missionNextAction').focus(); await page.keyboard.press('Enter');
    await focused(page,'analyzeBtn');
    assert.equal(await page.locator('#researchScore').textContent(),'0/9');
    assert.equal(await page.locator('#analyzeBtn').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    await noOverflow(page);
    pass(`${suffix}: keyboard guidance has meaningful labels, visible focus and no automatic award`);

    await page.locator('#analyzeBtn').click();
    assert.equal(await page.evaluate(()=>sqResearchXp()),50);
    assert.equal(await page.locator('#companionHost .sq-mascot--scout').count(),1);
    assert.equal(await page.locator('#companionHost [data-creature-form="long-eared-juvenile"]').count(),1);
    assert.match(await page.locator('#badgeToast').textContent(),/Lumi evolved into Signal Scout/);
    assert.equal(await page.locator('#companionHost .sq-companion__status').textContent(),'');
    const once=await page.evaluate(()=>JSON.stringify(sqBadges().earned.first));
    const repeat=await page.evaluate(async()=>{
      let changes=0;const observer=new MutationObserver(records=>changes+=records.length);
      observer.observe(document.querySelector('#companionHost .sq-companion__art'),{childList:true});
      for(let i=0;i<4;i++){await sqAnalyze();sqRenderBadges();sqRenderCompanion()}
      await Promise.resolve();changes+=observer.takeRecords().length;observer.disconnect();
      return {changes,xp:sqResearchXp(),record:JSON.stringify(sqBadges().earned.first)};
    });
    assert.deepEqual(repeat,{changes:0,xp:50,record:once});
    assert.deepEqual(await page.evaluate(()=>[$('missionNextProgress').value,$('missionNextProgress').max]),await page.evaluate(()=>[$('nextBadgeProgress').value,$('nextBadgeProgress').max]));
    pass(`${suffix}: first explicit analysis evolves Lumi once; repeated analysis/render does not rebuild or reward`);
    for(const [target,evidenceId] of [['reviewTrendsBtn','reviewTrendEvidence'],['reviewRangeBtn','reviewRangeEvidence'],['reviewSampleBtn','sampleCount']]) {
      await clickMission(page,target);
      assert.equal(await page.locator('#qualityDetails').evaluate(el=>el.open),true);
      assert.ok((await page.locator('#'+evidenceId).textContent()).length>10);
      const descriptions=(await page.locator('#'+target).getAttribute('aria-describedby')).split(' ');
      for(const id of descriptions)assert.equal(await page.locator('#'+id).count(),1);
      await page.locator('#'+target).click();
    }
    assert.equal(await page.locator('#researchScore').textContent(),'4/9');
    await clickMission(page,'periodTabs','missionNextAction',false);
    await page.locator('[data-p="3m"]').click();
    await clickMission(page,'researchReason');
    await page.locator('#researchReason').fill('I compared two supported synthetic horizons and would revisit the assumptions.');
    await page.locator('#saveReasonBtn').click();
    assert.equal(await page.locator('#researchScore').textContent(),'6/9');
    pass(`${suffix}: successive guidance opens readable evidence, then supported horizons and explicit saved reasoning`);

    await clickMission(page,'watchCurrentBtn'); await page.locator('#watchCurrentBtn').click();
    await clickMission(page,'quickPicks','missionNextAction',false);
    await page.locator('[data-quick="MSFT"]').click(); await page.locator('#watchCurrentBtn').click();
    await clickMission(page,'watchlist','missionNextAction',false);
    assert.equal(await page.locator('#viewWatchlist').evaluate(el=>el.classList.contains('active')),true);
    await sourceLabels(page,'#watchlist',['Synthetic example','Synthetic example']);
    for(const symbol of ['AAPL','MSFT']) await page.locator('.watch-item').filter({has:page.locator('.watch-symbol',{hasText:symbol})}).getByRole('button',{name:'Compare',exact:true}).click();
    await sourceLabels(page,'#comparePanel',['Synthetic example','Synthetic example']);
    assert.match(await page.locator('.compare-context-note').textContent(),/sources, sessions, horizons and corrections/);
    await noOverflow(page);
    if(viewport.width<700) assert.ok(await page.locator('.watch-actions button').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height>=44)));
    await page.screenshot({path:path.join(evidence,`guidance-watch-compare-${viewport.width}.png`),fullPage:true});
    await page.locator('[data-view="quests"]').click();
    await clickMission(page,'completeResearchBtn','nextBadgeAction');
    assert.equal(await page.locator('#researchScore').textContent(),'8/9');
    await page.locator('#completeResearchBtn').click();
    assert.equal(await page.locator('#researchScore').textContent(),'9/9');
    assert.equal(await page.evaluate(()=>sqResearchXp()),500);
    assert.equal(await page.locator('#companionHost [data-creature-form="celestial-winged-fox"]').count(),1);
    assert.equal(await page.locator('#companionHost .sq-mascot__aura').count(),1);
    assert.equal(await page.locator('#companionHost .sq-mascot__wings').count(),1);
    assert.match(await page.locator('#companionHost .sq-mascot title').textContent(),/feathered wings.*five comet tails/);
    assert.equal(await page.locator('#companionHost .sq-companion__progress').evaluate(el=>el.value),1);
    assert.deepEqual(await page.evaluate(()=>[$('missionNextProgress').value,$('missionNextProgress').max]),[9,9]);
    await clickMission(page,'history','nextBadgeAction',false);
    assert.equal(await page.locator('#viewSaved').evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.evaluate(()=>!!sqBadges().earned.review),false);
    pass(`${suffix}: compare, completion and reflection require their explicit actions; navigation alone earns nothing`);

    for(let i=0;i<3;i++) {
      await page.locator('#history .history-actions').first().getByRole('button',{name:'Load',exact:true}).click();
      assert.match(await page.locator('#sourceBadge').textContent(),/synthetic/i);
      assert.match(await page.locator('#qualitySummary').textContent(),/Saved synthetic example/);
      assert.equal(await page.evaluate(()=>state.mode),'manual');
      if(i===0){assert.equal(await page.locator('#reviewHypothesisBtn').isEnabled(),true);await page.locator('#reviewHypothesisBtn').click();}
      await page.locator('#saveReasonBtn').click();
      await page.locator('[data-view="saved"]').click();
      assert.ok((await page.locator('#history .snapshot-source b').allTextContents()).every(text=>text==='Synthetic example'));
    }
    await page.reload(); await page.waitForFunction(()=>document.getElementById('appSplash').classList.contains('hide'));
    assert.equal(await page.evaluate(()=>state.mode),'manual');
    assert.equal(await page.evaluate(()=>state.savedOrigin),'demo');
    assert.equal(await page.locator('#researchScore').textContent(),'9/9');
    assert.equal(await page.evaluate(()=>!!sqBadges().earned.review),true);
    assert.equal(await page.evaluate(()=>sqResearchXp()),500);
    assert.equal(await page.locator('#companionHost .sq-companion__status').textContent(),'');
    assert.equal(await page.locator('#companionHost .sq-mascot--levelup, #companionHost .sq-mascot--earn').count(),0);
    assert.equal(network.provider.length,0); assert.deepEqual(network.unexpected,[]);
    await noOverflow(page);
    pass(`${suffix}: synthetic provenance, earned progress and reflection survive repeated save/load and browser reload privately`);

    // Large mixed-source cards exercise wrapping independently of the current scenario.
    await page.evaluate(()=>{
      const base={price:12345.67,perf:1234.56,low:11000,mid:12500,high:14000,updatedAt:'2026-10-07T12:00:00Z'};
      const source='<img src=x onerror="window.__sourceInjection=1"> & '+ 'LongProviderName'.repeat(16);
      setWatchlist([
        {symbol:'AAPL',snapshot:{...base,inputMode:'demo',period:'3m',correction:0}},
        {symbol:'MSFT',snapshot:{...base,inputMode:'manual',period:'2y',correction:12}},
        {symbol:'NVDA',snapshot:{...base,inputMode:'auto_eod',period:'1y',correction:30,sourceContext:{source,session:'2026-09-30'}}}
      ]);
      setCompareSelection(['AAPL','MSFT','NVDA']); setView('watchlist');
    });
    await sourceLabels(page,'#watchlist',['Synthetic example','Manual · unverified','Stale EOD snapshot']);
    await sourceLabels(page,'#comparePanel',['Synthetic example','Manual · unverified','Stale EOD snapshot']);
    assert.equal(await page.locator('.snapshot-source img').count(),0); assert.equal(await page.evaluate(()=>window.__sourceInjection),undefined);
    for(const text of ['3-Month','2-Year','1-Year','0% correction','12% correction','30% correction'])assert.ok((await page.locator('#comparePanel').textContent()).includes(text));
    await noOverflow(page);
    await page.screenshot({path:path.join(evidence,`guidance-mixed-sources-${viewport.width}.png`),fullPage:true});
    await page.locator('[data-view="research"]').click();
    await page.locator('#missionNextAction').scrollIntoViewIfNeeded();
    const button=await page.locator('#missionNextAction').boundingBox(); assert.ok(button.height>=44&&button.width>0);
    if(viewport.width<=700){const box=await page.locator('.mission-next').boundingBox();assert.ok(button.width>=box.width-2)}
    await page.screenshot({path:path.join(evidence,`guidance-next-mission-${viewport.width}.png`)});
    pass(`${suffix}: mixed sources keep separate horizons/corrections; hostile provider text is escaped and mobile cards do not overflow`);
    await context.close();
  }

  // A fresh private Manual session must not get stuck on unavailable trend/range/sample reviews.
  {
    const {page,context,network}=await createPage({width:390,height:844});
    await page.locator('#openSeasonalityBtn').click();
    assert.match(await page.locator('#seasonalityCurrentText').textContent(),/Strongest average month/);
    await page.locator('[data-private-mode="manual"]').click();
    // Do not reopen: changing mode must clear the already-active pane immediately.
    assert.equal(await page.locator('#analysisSeasonality').isVisible(),true);
    assert.match(await page.locator('#seasonalityCurrentText').textContent(),/No complete monthly sample/);
    assert.equal(await page.locator('#seasonalitySignal').textContent(),'Unavailable');
    assert.equal(await page.locator('#seasonalitySource').textContent(),'No monthly history');
    for(const id of ['seasonalityHit','seasonalityAvg','seasonalityObs'])assert.equal(await page.locator('#'+id).textContent(),'—');
    assert.equal(await page.locator('#price').inputValue(),'');assert.equal(await page.locator('#perf').inputValue(),'');
    assert.equal(await page.evaluate(()=>sqResearchXp()),0);assert.equal(network.provider.length,0);
    pass('active seasonality immediately removes stale Demo summary, signals and statistics on empty Manual mode');
    await clickMission(page,'price');
    await page.locator('#price').fill('125');await page.locator('#perf').fill('20');
    await page.locator('#analyzeBtn').click();await clickMission(page,'researchReason');
    for(const id of ['reviewTrendsBtn','reviewRangeBtn','reviewSampleBtn'])assert.equal(await page.locator('#'+id).isDisabled(),true);
    await page.locator('#researchReason').fill('Manual inputs have no independently verified market context.');await page.locator('#saveReasonBtn').click();
    await clickMission(page,'watchCurrentBtn');await page.locator('#watchCurrentBtn').click();
    assert.equal(await page.evaluate(()=>state.mode),'manual');assert.equal(network.provider.length,0);
    await page.locator('[data-view="saved"]').click();await page.locator('#history .history-actions').first().getByRole('button',{name:'Load',exact:true}).click();
    assert.equal(await page.locator('#reviewHypothesisBtn').isEnabled(),true);
    await page.locator('#targetCorrection').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#reviewHypothesisBtn').isDisabled(),true);
    assert.equal(await page.evaluate(()=>!!sqBadges().earned.review),false);
    pass('Manual guidance skips unavailable historical context; keyboard correction invalidates an old reflection');
    await context.close();
  }

  // Automatic mode is explicitly selected; every response below comes from the route fixture.
  {
    const {page,context,network}=await createPage({width:390,height:844});
    for(const field of ['price','perf']) {
      await page.locator('[data-private-mode="auto_eod"]').click();
      await page.waitForFunction(()=>state.dataMeta?.symbol==='AAPL'&&document.getElementById('price').value==='200.00');
      assert.match(await page.locator('#sourceBadge').textContent(),/Stale/);
      assert.match(await page.locator('#qualitySummary').textContent(),/Not a current quote/);
      assert.match(await page.locator('#targetContext').textContent(),/STALE SNAPSHOT/);
      const before=network.provider.length;
      const high=await page.locator('#high').textContent(),levels={};
      for(const value of [0,10,30,10,0,30]) {
        await page.locator('#targetCorrection').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))},value);
        assert.equal(await page.locator('#correction').inputValue(),String(value));
        assert.equal(await page.locator('#high').textContent(),high);
        const low=await page.locator('#low').textContent();if(levels[value])assert.equal(low,levels[value]);levels[value]=low;
      }
      await page.locator('#divisor').fill('3.5');await page.locator('#increment').selectOption('0.5');
      assert.equal(await page.evaluate(()=>state.mode),'auto_eod');assert.equal(network.provider.length,before);
      await page.locator('#openSeasonalityBtn').click();
      assert.match(await page.locator('#seasonalityCurrentText').textContent(),/Strongest average month/);
      const other=field==='price'?'perf':'price',oldOther=await page.locator('#'+other).inputValue();
      await page.locator('#'+field).fill(field==='price'?'250.125':'-17.375');
      assert.equal(await page.evaluate(()=>state.mode),'manual');assert.equal(await page.locator('#'+other).inputValue(),oldOther);
      assert.equal(await page.locator('#'+field).inputValue(),field==='price'?'250.125':'-17.375');
      assert.equal(await page.evaluate(()=>state.dataMeta),null);assert.deepEqual(await page.evaluate(()=>state.extra),{});
      assert.equal(await page.locator('#analysisSeasonality').isVisible(),true);
      assert.match(await page.locator('#seasonalityCurrentText').textContent(),/No complete monthly sample/);
      assert.equal(await page.locator('#seasonalitySignal').textContent(),'Unavailable');
      assert.equal(await page.locator('#seasonalitySource').textContent(),'No monthly history');
      for(const id of ['seasonalityHit','seasonalityAvg','seasonalityObs'])assert.equal(await page.locator('#'+id).textContent(),'—');
      assert.equal(await page.locator('#targetCorrection').inputValue(),'30');assert.equal(await page.locator('#divisor').inputValue(),'3.5');
      assert.equal(await page.locator('#refreshBtn').isDisabled(),true);assert.equal(network.provider.length,before);
      await page.locator('#researchReason').fill('Edited provider inputs are now an unverified private scenario.');await page.locator('#saveReasonBtn').click();
      await page.locator('[data-view="saved"]').click();assert.equal(await page.locator('#history .snapshot-source b').first().textContent(),'Manual · unverified');
      await page.locator('[data-view="research"]').click();
      pass(`Automatic ${field} actual input detaches provenance while correction/divisor changes remain network-free assumptions`);
    }
    await page.locator('[data-private-mode="auto_eod"]').click();
    await page.waitForFunction(()=>state.dataMeta?.symbol==='AAPL');
    await page.evaluate(()=>sqBadgeSave({version:1,earned:{},horizons:[]}));
    for(const period of ['3m','2y']) {
      await page.locator(`[data-p="${period}"]`).click();
      await page.waitForFunction(period=>state.period===period&&!!state.dataMeta?.session&&sqBadges().horizons.includes(period),period);
    }
    assert.deepEqual(await page.evaluate(()=>sqBadges().horizons),['3m','2y']);assert.deepEqual(await page.evaluate(()=>sqBadges().earned),{});
    pass('successful current Automatic history applies and records each supported horizon without auto-awarding research');
    network.hold=true;const intercepted=new Promise(resolve=>{network.onPending=resolve});await page.locator('#refreshBtn').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Loading shared'));
    // Wait for the intercepted request rather than a fixed response delay.
    let timer;try{await Promise.race([intercepted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider fixture request did not arrive')),10000)})])}finally{clearTimeout(timer)}
    await page.locator('#price').fill('177.77');const perf=await page.locator('#perf').inputValue();
    network.hold=false;await network.pending.shift()();
    await page.evaluate(()=>Promise.resolve());
    assert.equal(await page.evaluate(()=>state.mode),'manual');assert.equal(await page.locator('#price').inputValue(),'177.77');assert.equal(await page.locator('#perf').inputValue(),perf);
    assert.equal(await page.evaluate(()=>state.dataMeta),null);assert.deepEqual(network.unexpected,[]);
    pass('typing during an intercepted provider refresh aborts it and protects the Manual scenario');
    await context.close();
  }

  // An active historical pane cannot retain a different ticker's data while typing.
  {
    const {page,context,network}=await createPage({width:390,height:844});
    await page.locator('#openSeasonalityBtn').click();
    assert.match(await page.locator('#seasonalityCurrentText').textContent(),/Strongest average month/);
    await page.locator('#ticker').fill('NVDA');
    assert.equal(await page.locator('#analysisSeasonality').isVisible(),true);
    assert.match(await page.locator('#seasonalityCurrentText').textContent(),/No complete monthly sample/);
    assert.equal(await page.locator('#seasonalitySignal').textContent(),'Unavailable');
    assert.equal(await page.locator('#seasonalitySource').textContent(),'No monthly history');
    for(const id of ['seasonalityHit','seasonalityAvg','seasonalityObs'])assert.equal(await page.locator('#'+id).textContent(),'—');
    assert.equal(await page.evaluate(()=>sqResearchXp()),0);assert.equal(network.provider.length,0);
    pass('typing a different ticker immediately clears the active historical seasonality pane');
    await context.close();
  }
  // Explicit saved choices override startup defaults, and OS reduced motion disables all companion animation.
  {
    const saved={mode:'manual',ticker:'MSFT',period:'3m',correction:20,price:'125.125',perf:'-6.375',divisor:'3.5',increment:'0.5',reason:'A saved private hypothesis.'};
    const {page,context,network}=await createPage({width:320,height:700},{sq_next_session:saved});
    assert.deepEqual(await page.evaluate(()=>({period:state.period,correction:state.correction,divisor:$('divisor').value,price:$('price').value,perf:$('perf').value})),{period:'3m',correction:20,divisor:'3.5',price:'125.125',perf:'-6.375'});
    assert.equal(await page.locator('[data-p="3m"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#targetCorrection').inputValue(),'20');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#analyzeBtn').click();
    assert.equal(await page.locator('#companionHost [data-mascot-motion]').isVisible(),false);
    assert.equal(await page.locator('#companionHost .sq-mascot *').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).animationName==='none')),true);
    assert.equal(await page.evaluate(()=>sqResearchXp()),50);assert.equal(network.provider.length,0);await noOverflow(page);
    pass('saved Manual 3M/20%/custom-divisor choices restore exactly and reduced-motion disables companion animation');
    await context.close();
  }

  // Persisted old records remain unknown and non-string notes cannot enable reflection.
  {
    const rows=[{id:'legacy',ticker:'AAPL',p:'6m',price:100,perf:10,low:90,mid:100,high:110,at:'2026-10-01T12:00:00Z',reason:12345}];
    const {page,context,network}=await createPage({width:320,height:700},{splab_history:rows,sq_progress:{earned:{first:{at:'2026-09-01T12:00:00Z'}}}});
    await page.locator('[data-view="saved"]').click();await sourceLabels(page,'#history',['Source unknown']);
    await page.locator('#history .history-actions').first().getByRole('button',{name:'Load',exact:true}).click();
    assert.equal(await page.locator('#reviewHypothesisBtn').isDisabled(),true);assert.equal(await page.evaluate(()=>sqBadges().earned.first.at),'2026-09-01T12:00:00Z');
    assert.equal(network.provider.length,0);await noOverflow(page);
    pass('legacy source remains unknown, old earned timestamp survives, and a numeric saved reason never qualifies reflection');
    await context.close();
  }
  assert.deepEqual(errors,[]);
  pass('no uncaught browser errors across guidance, persistence, provenance, mobile and fixture-only Automatic flows');
  fs.writeFileSync(path.join(evidence,'research-guidance-browser-results.json'),JSON.stringify({passed:reports.length,checks:reports,errors,liveProviderRequests:0,requests:allRequests,viewports:[320,390,1440]},null,2));
  console.log(`${reports.length} research guidance browser checks passed; all requests were intercepted.`);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
