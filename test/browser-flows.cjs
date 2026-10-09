const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const evidence=path.resolve(process.env.EVIDENCE_DIR||path.join(root,'test-results'));
fs.mkdirSync(evidence,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
let server,browser,passed=0;
const pass=name=>{passed++;console.log('PASS',name)};
function data(symbol){
 const monthly=Array.from({length:81},(_,i)=>{const d=new Date(Date.UTC(2020,i+1,0));return {date:d.toISOString().slice(0,10),open:100+i,high:103+i,low:98+i,close:101+i,volume:1000}});
 const rows=[{date:'2020-01-01',close:100,high:102,low:98},...monthly,{date:'2026-10-01',close:symbol==='MSFT'?400:200,high:401,low:198}];
 return {ok:true,version:'TEST FIXTURE',symbol,source:'Synthetic QA fixture',cache:'hit',fetchedAt:Date.now(),daily:rows.slice(-20),weekly:rows,monthly};
}
(async()=>{
 server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const errors=[],calls=[];
 const ctx=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin===base)return route.continue();
  if(u.hostname==='strikequests-market-data.strikequests.workers.dev'){
   const body=u.pathname==='/health'?{ok:true,cacheConfigured:true,providerConfigured:true}:data(u.searchParams.get('symbol'));
   calls.push(u.pathname);return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':base},body:JSON.stringify(body)});
  }
  return route.fulfill({status:404,body:''});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#research');await page.locator('[data-private-mode="auto_eod"]').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('shared EOD loaded'));
 await page.locator('#appSplash').waitFor({state:'hidden'});
 assert.equal(await page.locator('#price').inputValue(),'200.00');pass('explicit Automatic selection uses shared API with no visitor key');
 await page.screenshot({path:path.join(evidence,'desktop-shared-fixture.png'),fullPage:true});
 await page.locator('[data-quick="MSFT"]').click();await page.waitForFunction(()=>document.getElementById('price').value==='400.00');
 assert.equal(await page.locator('#ticker').inputValue(),'MSFT');pass('Quick Pick click refreshes selected ticker');
 await page.locator('[data-analysis="seasonality"]').click();
 await page.locator('[data-season-mode="specific"]').click();await page.locator('#seasonPrevYearBtn').click();
 assert.match(await page.locator('#seasonalitySelectionNote').textContent(),/2025/);pass('seasonality controls select a specific calendar year');
 await page.locator('#watchCurrentBtn').click();
 await page.locator('[data-view="watchlist"]').click();assert.match(await page.locator('#viewWatchlist').textContent(),/MSFT/);pass('watchlist captures selected research');
 await page.locator('#settingsBtn').click();await page.locator('#studioDataSettings>summary').click();await page.locator('[data-mode="manual"]').click();await page.locator('#closeSettings').click();
 await page.locator('[data-view="research"]').click();
 await page.locator('#price').fill('125');await page.locator('#perf').fill('20');await page.locator('#divisor').fill('3.5');
 await page.locator('[data-view="saved"]').click();await page.locator('#saveBtn').click();
 await page.locator('[data-view="research"]').click();await page.locator('#divisor').fill('9');
 const beforeLoad=calls.length;
 await page.locator('[data-view="saved"]').click();await page.locator('#history button').filter({hasText:'Load'}).first().click();
 assert.equal(await page.locator('#divisor').inputValue(),'3.5');assert.equal(await page.locator('#price').inputValue(),'125.00');assert.equal(calls.length,beforeLoad);pass('save/load UI preserves custom inputs without market refresh');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'mobile-manual-fixture.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);pass('390px mobile layout has no horizontal overflow');
 await page.locator('[data-view="quests"]').click();assert.match(await page.locator('#viewQuests').textContent(),/Research Progress/);pass('research progress navigation works');
 assert.deepEqual(errors,[]);pass('browser flow has no uncaught application errors');
 await ctx.close();
 // Real service-worker lifecycle and offline shell, using a separate clean profile.
 const offlineCtx=await browser.newContext({viewport:{width:390,height:844}});
 const swPage=await offlineCtx.newPage();
 await offlineCtx.route('**/config.json?*',route=>route.fulfill({contentType:'application/json',body:'{"marketDataApi":""}'}));
 await offlineCtx.route('https://**/*',route=>route.fulfill({status:503,body:''}));
 await swPage.goto(base+'/#research');await swPage.evaluate(()=>navigator.serviceWorker.ready);
 await swPage.reload();await swPage.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const keys=await swPage.evaluate(async()=>{const all=[];for(const name of await caches.keys()){const c=await caches.open(name);all.push(...(await c.keys()).map(r=>r.url))}return all});
 assert.deepEqual(keys.map(u=>new URL(u).pathname).sort(),['/','/account-core.js','/account.css','/account.js','/config.json','/icon-180.png','/icon-192.png','/icon-512.png','/index.html','/manifest.webmanifest','/mascot.css','/mascot.js','/studio.css','/studio.js','/vendor/supabase.js']);
 assert.equal(keys.some(u=>u.includes('?')||u.includes('workers.dev')||u.includes('supabase.co')||u.includes('account-config.json')),false);pass('real service worker caches only fifteen static app-shell URLs');
 await offlineCtx.setOffline(true);await swPage.reload();await swPage.locator('#ticker').waitFor();
 assert.match(await swPage.title(),/StrikeQuests/);pass('installed shell opens offline');
 // A fragment-bearing reload must use the same allowlisted offline shell.
 for(const shell of ['/','/index.html'])for(const view of ['home','research','watchlist','saved','quests']){
  await swPage.goto(base+shell+'#'+view);await swPage.reload();
  await swPage.waitForFunction(v=>document.body.dataset.studioView===v,view);
  assert.equal(await swPage.locator('.bottom-nav [data-view="'+view+'"]').getAttribute('aria-current'),'page');
  assert.match(await swPage.title(),/StrikeQuests/);pass('offline reload preserves '+shell+'#'+view);
 }
 const offlineKeys=await swPage.evaluate(async()=>{const all=[];for(const name of await caches.keys()){const c=await caches.open(name);all.push(...(await c.keys()).map(r=>r.url))}return all});
 assert.deepEqual(offlineKeys.sort(),keys.sort());pass('offline navigation adds no fragment, query or provider cache entries');
 await offlineCtx.close();
 console.log(`${passed} browser UI/PWA flow checks passed; all market data is synthetic`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))});
