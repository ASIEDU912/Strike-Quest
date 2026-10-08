'use strict';
const pw=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base='https://strikequests.studio.fixture.test',dir=path.resolve(process.env.EVIDENCE_DIR||path.join(root,'test-results/studio'));fs.mkdirSync(dir,{recursive:true});
let browser,count=0;const pass=s=>{count++;console.log('PASS Studio browser:',s)};
const allowed=new Set(['/','/index.html','/mascot.js','/mascot.css','/studio.js','/studio.css','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png','/favicon.ico']);
async function fixture(width){const ctx=await browser.newContext({viewport:{width,height:width<600?844:1050},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});const unexpected=[],errors=[];
 await ctx.addInitScript(()=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...a){super(...(a.length?a:['2026-10-08T12:00:00Z']))}static now(){return RealDate.parse('2026-10-08T12:00:00Z')}};});
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base||!allowed.has(u.pathname)){unexpected.push(u.href);return route.abort();}const f=path.resolve(root,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(f)]||'text/plain',body:fs.readFileSync(f)});});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 if(process.env.STUDIO_INLINE==='1'){
   // Some managed Chromium builds block even fulfilled fixture URLs. Preserve a real
   // browser run without network or private data by loading inline review assets.
   await ctx.route('**/*',route=>{unexpected.push(route.request().url());route.abort();});
   let markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
   for(const filename of ['mascot.js','studio.js'])markup=markup.replace(`<script src="./${filename}"></script>`,`<script>${fs.readFileSync(path.join(root,filename),'utf8')}</script>`);
   for(const filename of ['mascot.css','studio.css'])markup=markup.replace(`<link rel="stylesheet" href="./${filename}">`,`<style>${fs.readFileSync(path.join(root,filename),'utf8')}</style>`);
   for(const filename of ['icon-180.png','icon-192.png','icon-512.png'])markup=markup.replaceAll(`./${filename}`,`data:image/png;base64,${fs.readFileSync(path.join(root,filename)).toString('base64')}`);
   await page.goto('about:blank');
   await page.evaluate(()=>{const store=()=>{const entries=new Map();return {getItem:k=>entries.has(String(k))?entries.get(String(k)):null,setItem:(k,v)=>entries.set(String(k),String(v)),removeItem:k=>entries.delete(String(k)),clear:()=>entries.clear(),key:i=>[...entries.keys()][i]??null,get length(){return entries.size}}};Object.defineProperty(window,'localStorage',{configurable:true,value:store()});Object.defineProperty(window,'sessionStorage',{configurable:true,value:store()});});
   await page.setContent(markup,{waitUntil:'load'});
 }else await page.goto(base);
 await page.waitForFunction(()=>!!window.StrikeStudio&&document.getElementById('viewHome').classList.contains('active'));return {page,ctx,unexpected,errors};}
async function settle(p){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function values(p){return p.evaluate(()=>JSON.stringify({mode:state.mode,ticker:$('ticker').value,period:state.period,correction:state.correction,price:$('price').value,perf:$('perf').value,divisor:$('divisor').value,reason:$('researchReason').value,badges:sqBadges(),history:sqHistoryRecords(),journal:localStorage.getItem('sq_research_checkins_v1')}));}
async function screenshot(p,name,selector){
 const target=selector?p.locator(selector):p;if(selector)await target.scrollIntoViewIfNeeded();
 const opts={animations:'disabled',...(!selector?{fullPage:false}:{})};
 await target.screenshot({path:path.join(dir,name+'.png'),...opts});
 const evidence=new Set(['chromium-390-home','chromium-1440-home','chromium-390-research','chromium-390-brief','chromium-390-settings','chromium-390-news','webkit-390-home','webkit-320-brief']);
 if(process.env.STUDIO_LOG_EVIDENCE==='1'&&evidence.has(name)){
  let buffer=await target.screenshot({type:'jpeg',quality:35,...opts});
  if(buffer.length>180000)buffer=await target.screenshot({type:'jpeg',quality:18,...opts});
  assert.ok(buffer.length<=180000,'Bounded synthetic screenshot evidence');
  const info={name:name+'.jpg',bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),commit:process.env.REVIEW_HEAD_SHA||'local-review'};
  console.log('SQ_IMAGE_BEGIN '+JSON.stringify(info));
  const data=buffer.toString('base64');for(let i=0;i<data.length;i+=160)console.log('SQ_IMAGE_DATA '+data.slice(i,i+160));
  console.log('SQ_IMAGE_END '+info.name);
 }
}
(async()=>{for(const engine of (process.env.STUDIO_BROWSERS||'chromium,webkit').split(',')){browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 for(const width of [390,320,1440]){const f=await fixture(width),p=f.page;await settle(p);
 assert.equal(await p.locator('.bottom-nav [data-view]').count(),5);assert.equal(await p.locator('[data-view="home"]').getAttribute('aria-current'),'page');assert.deepEqual(f.unexpected,[]);pass(engine+'/'+width+' Home starts privately; five functional destinations');
 await screenshot(p,engine+'-'+width+'-home');
 const before=await values(p);
 for(const [action,view] of [['research','viewResearch'],['seasonality','viewResearch'],['compare','viewWatchlist'],['journal','viewSaved']]){await p.locator('[data-view="home"]').click();await p.locator('.studio-tool[data-studio-action="'+action+'"]').click();assert.equal(await p.locator('.app-view.active').getAttribute('id'),view);assert.equal(await values(p),before);}
 pass(engine+'/'+width+' shortcuts navigate without changing inputs, private data or XP');
 await p.locator('[data-view="research"]').click();await settle(p);assert.match(await p.locator('#studioBriefSource').textContent(),/Synthetic/);assert.equal(await p.locator('#studioBriefItems button').count(),4);assert.match(await p.locator('#studioChart').textContent(),/SYNTHETIC/);pass(engine+'/'+width+' Research Brief and chart label synthetic context');
 await screenshot(p,engine+'-'+width+'-research','#studioInstrument');await screenshot(p,engine+'-'+width+'-brief','#studioBrief');
 await p.locator('[data-studio-evidence="range"]').click();assert.equal(await p.locator('#qualityDetails').evaluate(el=>el.open),true);assert.equal(await values(p),before);pass(engine+'/'+width+' evidence link opens its source without awarding review credit');
 await p.locator('#settingsBtn').click();assert.equal(await p.locator('.shell').evaluate(el=>el.inert),true);await screenshot(p,engine+'-'+width+'-settings');
 await p.locator('#studioAccounts>summary').click();assert.match(await p.locator('#studioAccounts').textContent(),/sign-in is not configured/);assert.equal(await p.locator('#studioAccounts').getByRole('button').count(),0);pass(engine+'/'+width+' account panel is honest about guest and local records');
 await p.locator('#studioAppearance>summary').click();await p.locator('#studioNickname').fill('<img onerror=alert(1)>');await p.locator('#studioTheme').selectOption('quiet');await p.locator('#studioSavePreferences').click();assert.match(await p.locator('#studioPreferenceStatus').textContent(),/Saved/);await p.keyboard.press('Escape');await p.locator('[data-view="home"]').click();assert.equal(await p.locator('#studioGreeting img').count(),0);assert.match(await p.locator('#studioGreeting').textContent(),/<img onerror/);assert.equal(await p.locator('body').getAttribute('data-studio-theme'),'quiet');assert.equal(await values(p),before);pass(engine+'/'+width+' optional preferences are literal text and leave research intact');
 await p.locator('#studioNewsBtn').click();assert.equal(await p.locator('#studioNews').evaluate(el=>el.open),true);await p.locator('#studioCloseNews').focus();await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.getElementById('studioNews').contains(document.activeElement)),true);assert.match(await p.locator('.studio-news-banner').textContent(),/not published/);await screenshot(p,engine+'-'+width+'-news');await p.locator('#studioMarkNewsRead').click();await p.keyboard.press('Escape');assert.equal(await p.locator('#studioNewsBtn .studio-unread').isVisible(),false);pass(engine+'/'+width+' What’s New traps focus, marks read and distinguishes review from release');
 await p.locator('#studioNewsBtn').click();await p.locator('#studioNews [data-studio-action="brief"]').click();await settle(p);assert.equal(await p.locator('.app-view.active').getAttribute('id'),'viewResearch');assert.equal(await p.evaluate(()=>document.activeElement.id),'studioBrief');pass(engine+'/'+width+' release-note links go to working features');
 await p.locator('[data-private-mode="manual"]').click();await p.locator('#price').fill('100');await p.locator('#perf').fill('20');await settle(p);assert.equal(await p.locator('#studioChart svg').count(),0);assert.match(await p.locator('#studioBriefSource').textContent(),/Manual/);assert.match(await p.locator('[data-studio-evidence="trend"]').textContent(),/History needed/);pass(engine+'/'+width+' Manual inputs do not inherit a chart or historical claims');
 await p.locator('#researchReason').fill('Private fixture thought — never put into public share text.');await p.locator('#saveReasonBtn').click();await p.locator('[data-view="home"]').click();await settle(p);assert.match(await p.locator('#studioResume').textContent(),/AAPL/);assert.doesNotMatch(await p.locator('#studioResume').textContent(),/Private fixture/);await p.locator('[data-studio-action="saved"]').first().click();assert.equal(await p.locator('#history').getByRole('button',{name:'Load',exact:true}).count(),1);pass(engine+'/'+width+' saved resume preserves privacy and uses existing history controls');
 await p.locator('[data-view="research"]').click();const result=await p.evaluate(()=>resultSummary());assert.ok(!result.includes('Private fixture'));assert.ok(!result.includes('<img'));pass(engine+'/'+width+' public summaries exclude nickname and private reasoning');
 await p.setViewportSize({width,height:width<600?700:1050});await p.locator('#price').fill('999999.99');await p.locator('#perf').fill('1200');await p.locator('#increment').selectOption('0.5');const prior=await values(p);await p.locator('.studio-instrument [data-studio-action="targets"]').click();await settle(p);
 const bounds=await p.evaluate(()=>({top:$('targetsRow').getBoundingClientRect().top,slider:$('targetCorrection').getBoundingClientRect().bottom,nav:document.querySelector('.bottom-nav').getBoundingClientRect().top}));assert.ok(bounds.top>=0&&bounds.slider<bounds.nav,JSON.stringify({engine,width,...bounds}));assert.equal(await values(p),prior);pass(engine+'/'+width+' scenario shortcut settles large values before positioning controls above navigation');
 for(const view of ['home','research','watchlist','saved','quests']){await p.locator('[data-view="'+view+'"]').click();await settle(p);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine+'/'+width+' no horizontal overflow '+view);}
 assert.deepEqual(f.errors,[]);assert.deepEqual(f.unexpected,[]);pass(engine+'/'+width+' every destination fits; no page errors or network');
 await f.ctx.close();
 }
 await browser.close();browser=null;}
 console.log(count+' Research Studio browser checks passed; only synthetic fixtures used.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
