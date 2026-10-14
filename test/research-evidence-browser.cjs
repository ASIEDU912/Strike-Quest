'use strict';
const pw=require(process.env.SQ_PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {reviewHtml,sourceAssets}=require('../scripts/evidence-shell.cjs'),E=require('../research-evidence-core.js'),fixture=require('./fixtures/sec-evidence.cjs');
const root=path.resolve(__dirname,'..'),base='https://evidence.fixture.test',out=path.resolve(process.env.EVIDENCE_DIR||path.join(root,'test-results/evidence'));
fs.mkdirSync(out,{recursive:true});let browser,count=0;const pass=x=>{count++;console.log('PASS Evidence browser:',x);};
const data={ok:true,symbol:'AAPL',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000001234.json',retrievedAt:'2026-10-14T12:00:00.000Z',model:E.fundamentals(fixture(),{today:'2026-10-14',expectedCik:'1234'})};
async function settle(p){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function capture(p,name){await p.locator('#sqEvidenceDialog .sqe-metrics:visible').first().evaluate(e=>e.scrollIntoView({block:'center'}));const b=await p.locator('#sqEvidenceDialog').screenshot({path:path.join(out,name+'.png'),animations:'disabled'});console.log('EVIDENCE_SCREENSHOT',name,crypto.createHash('sha256').update(b).digest('hex'),process.env.REVIEW_HEAD_SHA||'LOCAL-VERIFIED-REVIEW-SOURCE');}
async function state(p){return p.evaluate(()=>JSON.stringify({period:state.period,correction:state.correction,input:[$('ticker').value,$('price').value,$('perf').value,$('divisor').value,$('increment').value],saved:sqHistoryRecords(),watch:getWatchlist(),compare:getCompareSelection(),badges:sqBadges(),journal:localStorage.getItem('sq_research_checkins_v1'),share:resultSummary()}));}
async function make(width){
 const ctx=await browser.newContext({viewport:{width,height:width<600?844:1100},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],network=[];p.on('pageerror',e=>errors.push(e.message));
 // Playwright's context-wide serviceWorkers:'block' initializer reads
 // navigator.serviceWorker in every frame, which throws in an opaque sandbox.
 // Mock only this fixture's TOP-LEVEL registration. Keep the real iframe isolation
 // and pageerror assertions; do not patch the provider frame or permit its storage.
 await ctx.addInitScript(()=>{
  if(window!==window.top||location.origin!=='https://evidence.fixture.test')return;
  window.__swRegistrationRequests=[];
  navigator.serviceWorker.register=async url=>{window.__swRegistrationRequests.push(String(url));};
 });
 ctx.on('serviceworker',()=>network.push('Unexpected service worker created'));
 const vendorScript="document.querySelector('.tradingview-widget-container__widget').innerHTML='<div style=\"padding:20px;color:#d6e9ff\">SYNTHETIC WIDGET TRANSPORT FIXTURE — not a live TradingView chart. Attribution and sandbox tested separately.</div>';";
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.href==='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js')return route.fulfill({contentType:'application/javascript',body:vendorScript});if(u.origin!==base){network.push(u.href);return route.abort();}const file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!sourceAssets.includes(file)){network.push(u.pathname);return route.abort();}return route.fulfill({contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain',body:file==='index.html'?reviewHtml(fs.readFileSync(path.join(root,file),'utf8')):fs.readFileSync(path.join(root,file))});});
 if(process.env.EVIDENCE_INLINE==='1'){
  let html=reviewHtml(fs.readFileSync(path.join(root,'index.html'),'utf8'));
  for(const file of sourceAssets.filter(x=>x.endsWith('.js')))html=html.replace(`<script src="./${file}"></script>`,()=>`<script>${fs.readFileSync(path.join(root,file),'utf8')}</script>`);
  for(const file of sourceAssets.filter(x=>x.endsWith('.css')))html=html.replace(`<link rel="stylesheet" href="./${file}">`,()=>`<style>${fs.readFileSync(path.join(root,file),'utf8')}</style>`);
  for(const file of sourceAssets.filter(x=>x.endsWith('.png')))html=html.replaceAll('./'+file,'data:image/png;base64,'+fs.readFileSync(path.join(root,file)).toString('base64'));
  await p.goto('about:blank');await p.evaluate(()=>{const store=()=>{const m=new Map();return{getItem:k=>m.get(String(k))??null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:store()});Object.defineProperty(window,'sessionStorage',{value:store()});});await p.setContent(html);
 }else await p.goto(base);
 if(process.env.EVIDENCE_INLINE==='1')await p.addStyleTag({content:fs.readFileSync(path.join(root,'research-evidence.css'),'utf8')});
 await p.waitForFunction(()=>!!window.StrikeEvidence);await p.locator('#appSplash').waitFor({state:'hidden'});
 await p.evaluate(payload=>{
   window.__secFixture=payload;window.__fixtureRequests=[];window.__fixtureMode='ok';
   window.fetch=async(url,options)=>{window.__fixtureRequests.push({url:String(url),method:options?.method,credentials:options?.credentials});
    if(!String(url).startsWith('./research-data/sec?symbol='))throw Error('Unexpected fixture fetch');
    if(window.__fixtureMode==='delay')await new Promise(r=>window.__resolveFixture=r);
    return new Response(JSON.stringify(window.__fixtureMode==='error'?{ok:false,error:'SEC_SETUP_REQUIRED'}:window.__secFixture),{status:window.__fixtureMode==='error'?503:200,headers:{'content-type':'application/json'}});
   };
   const banner=document.createElement('div');banner.textContent='SYNTHETIC QA ONLY · NO LIVE PROVIDER DATA';banner.style.cssText='padding:8px;color:#edd098;font-size:12px';document.querySelector('.top').before(banner);
   localStorage.setItem('sq_research_checkins_v1','SYNTHETIC_PRIVATE_JOURNAL_SENTINEL');
   localStorage.setItem('sq_alpha_key','SYNTHETIC_KEY_SENTINEL');
 },data);
 await p.locator('[data-view="research"]').click();await p.locator('[data-private-mode="manual"]').click();await p.locator('#price').fill('100');await p.locator('#perf').fill('20');await settle(p);
 return {ctx,p,errors,network};
}
(async()=>{
 for(const engine of (process.env.EVIDENCE_BROWSERS||'chromium,webkit').split(',')){
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  for(const width of [320,390,768,1440]){
   const {ctx,p,errors,network}=await make(width),label=engine+'/'+width,before=await state(p);
   await p.locator('#sqOpenEvidence').click();await p.locator('#sqEvidenceDialog .sqe-eyebrow').evaluate(e=>e.textContent='SYNTHETIC QA · STRIKEQUESTS');assert.equal(await p.locator('#sqEvidenceDialog').evaluate(e=>e.open),true);assert.deepEqual(await p.evaluate(()=>window.__fixtureRequests),[]);assert.equal(await p.locator('#sqTradingViewHost iframe').count(),0);pass(label+' opens native Evidence Studio without external requests');
   await p.locator('#sqLoadTradingView').click();assert.match(await p.locator('#sqTradingViewStatus').textContent(),/confirm/);assert.equal(await p.locator('#sqTradingViewHost iframe').count(),0);pass(label+' consent is required for public widget');
   await p.locator('#sqEvidenceConsent').check();await p.locator('#sqLoadTradingView').click();const frame=p.locator('#sqTradingViewHost iframe');assert.equal(await frame.count(),1);assert.doesNotMatch(await frame.getAttribute('sandbox'),/allow-same-origin/);assert.match(await frame.getAttribute('srcdoc'),/NASDAQ:AAPL/);assert.doesNotMatch(await frame.getAttribute('srcdoc'),/SYNTHETIC_PRIVATE|SYNTHETIC_KEY/);assert.equal(await frame.getAttribute('referrerpolicy'),'no-referrer');
   await p.waitForFunction(()=>document.querySelector('#sqTradingViewHost iframe')?.contentWindow!==null);
   const child=await frame.elementHandle().then(e=>e.contentFrame());
   const blocked=await child.evaluate(()=>{try{void parent.localStorage;return false;}catch{return true;}});assert.equal(blocked,true);assert.equal(await state(p),before);pass(label+' widget sandbox cannot read the parent journal, keys or scenario');
   await p.locator('[data-evidence-tab="facts"]').click();assert.equal(await frame.count(),0);await p.evaluate(()=>window.__fixtureMode='error');await p.locator('#sqLoadSecFacts').click();await p.waitForFunction(()=>document.getElementById('sqSecStatus').textContent.includes('SEC_USER_AGENT'));assert.equal(await p.locator('#sqSecResults svg').count(),0);pass(label+' unconfigured SEC relay has an honest empty state');
   await p.evaluate(()=>window.__fixtureMode='ok');await p.locator('#sqLoadSecFacts').click();await p.waitForFunction(()=>document.getElementById('sqSecStatus').textContent.includes('annual facts loaded'));assert.match(await p.locator('#sqSecResults').textContent(),/25.0%/);assert.match(await p.locator('#sqSecResults').textContent(),/30.0%/);assert.equal(await p.locator('#sqSecResults svg').count(),1);assert.match(await p.locator('#sqSecResults').textContent(),/2025-12-31/);assert.equal(await state(p),before);await capture(p,engine+'-'+width+'-fundamentals');pass(label+' annual facts, derived formulas, provenance and native revenue chart work');
   await p.evaluate(()=>window.__fixtureMode='delay');await p.locator('#sqLoadSecFacts').click();await p.waitForFunction(()=>typeof window.__resolveFixture==='function');await p.locator('#sqCancelSecFacts').click();await p.evaluate(()=>window.__resolveFixture());await settle(p);assert.equal(await p.locator('#sqSecResults').textContent(),'');assert.match(await p.locator('#sqSecStatus').textContent(),/cancelled/);pass(label+' late cancelled response does not repopulate old facts');
   await p.locator('[data-evidence-tab="overlap"]').click();const requests=await p.evaluate(()=>window.__fixtureRequests.length);await p.locator('#sqBasketA').fill('AAA,60\nBBB,40');await p.locator('#sqBasketB').fill('AAA,30\nCCC,70');await p.locator('#sqCalculateOverlap').click();assert.match(await p.locator('#sqOverlapResults').textContent(),/30.00 pp/);assert.equal(await p.evaluate(()=>window.__fixtureRequests.length),requests);assert.equal(await state(p),before);await capture(p,engine+'-'+width+'-exposure');pass(label+' original weighted-overlap calculator is local and leaves research untouched');
   await p.locator('#sqBasketA').fill('AAA,10');assert.equal(await p.locator('#sqOverlapResults').textContent(),'');await p.locator('#sqCalculateOverlap').click();assert.match(await p.locator('#sqOverlapStatus').textContent(),/Partial holdings/);assert.match(await p.locator('#sqOverlapResults').textContent(),/10.00 pp/);await p.locator('#sqBasketA').fill('AAA,60\nBBB,50');await p.locator('#sqCalculateOverlap').click();assert.match(await p.locator('#sqOverlapStatus').textContent(),/exceeds 100/);assert.equal(await p.locator('#sqOverlapResults').textContent(),'');pass(label+' incomplete/invalid holdings never get normalized or keep stale results');
   await p.locator('[data-evidence-tab="sources"]').click();assert.match(await p.locator('#sqEvidenceSources').textContent(),/issuer_fields/);assert.match(await p.locator('#sqEvidenceSources').textContent(),/No TickerInside requests/);assert.equal(await p.evaluate(()=>window.__fixtureRequests.length),requests);pass(label+' publisher evaluations preserve field exclusions without activating feeds');
   assert.ok(await p.locator('#sqEvidenceDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'sqOpenEvidence');assert.equal(await p.locator('#sqTradingViewHost iframe').count(),0);assert.equal(await state(p),before);pass(label+' dialog fits, Escape unloads external content and restores focus');
   await p.locator('#sqOpenEvidence').click();assert.equal(await p.locator('#sqEvidenceConsent').isChecked(),false);await p.evaluate(()=>applySymbol('NVDA'));await settle(p);assert.equal(await p.locator('#sqEvidenceDialog').evaluate(e=>e.open),false);pass(label+' symbol changes dismiss stale evidence and reset consent');
   assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert.equal(ctx.serviceWorkers().length,0);if(process.env.EVIDENCE_INLINE!=='1')assert.deepEqual(await p.evaluate(()=>window.__swRegistrationRequests),['./sw.js']);pass(label+' no page errors, live service workers or unmocked provider traffic');await ctx.close();
  }
  await browser.close();browser=null;
 }
 console.log(`${count} Evidence Studio browser checks passed · synthetic Chromium/WebKit fixtures, not physical devices or live providers`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();});
