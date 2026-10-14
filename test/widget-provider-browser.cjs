/* Bounded real-widget verification, not a market-data API or user-data test.
 * Fixtures cover privacy/controls; this suite verifies actual provider rendering.
 */
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),pw=require('playwright');
const root=path.resolve('test-results/public-candidate'),out=path.resolve('test-results/widget-provider');
fs.mkdirSync(out,{recursive:true});let browser,server;
const cases=[],pageErrors=[],unexpectedRequests=[];
const sentinel='SQ_PRIVATE_SYNTHETIC_PROBE_NOT_USER_DATA';
const fileHash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 for(const engine of ['chromium','webkit']){
  browser=await pw[engine].launch({headless:true});
  for(const [symbol,exchange,title] of [['AAPL','NASDAQ',/Apple/i],['XLK','AMEX',/Technology.*Select|Technology.*SPDR/i],['NVDA','NASDAQ',/NVIDIA/i]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage(),requests=[];
   p.on('pageerror',e=>pageErrors.push({engine,symbol,message:e.message}));
   await context.addInitScript(()=>{if(window===window.top)navigator.serviceWorker.register=async()=>{};});
   await context.route('**/*',r=>{
    const req=r.request(),u=new URL(req.url());
    if(u.origin===base)return r.continue();
    // Exact additional first-party endpoint observed in the prior real chart run.
    // No arbitrary *.tradingview-widget.com suffix, proxy, account or market API.
    const rules=u.origin==='https://widget-sheriff.tradingview-widget.com'&&u.pathname==='/sheriff/api/v1/rules/search';
    const provider=u.protocol==='https:'&&(u.hostname==='www.tradingview-widget.com'||u.hostname==='tradingview.com'||u.hostname.endsWith('.tradingview.com'));
    if((req.url()+' '+(req.postData()||'')).includes(sentinel)){unexpectedRequests.push('PRIVATE_SENTINEL_EGRESS');return r.abort();}
    if(provider||rules){requests.push(u.origin+u.pathname);return r.continue();}
    unexpectedRequests.push(u.origin+u.pathname);return r.abort();
   });
   await p.goto(base);await p.locator('#appSplash').waitFor({state:'hidden'});await p.locator('[data-view="research"]').click();await p.locator('[data-private-mode="manual"]').click();
   await p.evaluate(({symbol,sentinel})=>{applySymbol(symbol);localStorage.setItem('sq_private_qa_probe',sentinel);},{symbol,sentinel});
   const before=await p.evaluate(()=>JSON.stringify({saved:sqHistoryRecords(),watch:getWatchlist(),journal:localStorage.getItem('sq_research_checkins_v1'),inputs:[$('ticker').value,$('price').value,$('perf').value,state.period,state.correction],probe:localStorage.getItem('sq_private_qa_probe')}));
   await p.locator('#sqOpenEvidence').click();await p.locator('#sqEvidenceExchange').selectOption(exchange);
   assert.equal(requests.length,0,'No external request before consent');
   await p.locator('#sqEvidenceConsent').check();await p.locator('#sqLoadTradingView').click();const iframe=p.locator('#sqTradingViewHost iframe');await iframe.scrollIntoViewIfNeeded();
   assert.equal(await iframe.getAttribute('srcdoc'),null);assert.equal(new URL(await iframe.getAttribute('src')).origin,'https://www.tradingview-widget.com');
   assert.equal(await iframe.getAttribute('referrerpolicy'),'no-referrer');assert.doesNotMatch(await iframe.getAttribute('sandbox'),/allow-top-navigation|allow-forms|allow-storage-access/);
   const f=await (await iframe.elementHandle()).contentFrame();let canvasVisible=false,identityVisible=false;
   try{await f.locator('canvas').first().waitFor({state:'visible',timeout:45000});canvasVisible=true;await f.getByText(title).first().waitFor({state:'visible',timeout:15000});identityVisible=true;}catch{}
   const isolation=await f.evaluate(()=>{const out={};for(const [name,read]of [['parentStorage',()=>parent.localStorage],['parentDocument',()=>parent.document]]){try{read();out[name]=false;}catch{out[name]=true;}}return out;});
   const filename=engine+'-'+symbol+'-chart-390.png';await iframe.screenshot({path:path.join(out,filename)});
   const after=await p.evaluate(()=>JSON.stringify({saved:sqHistoryRecords(),watch:getWatchlist(),journal:localStorage.getItem('sq_research_checkins_v1'),inputs:[$('ticker').value,$('price').value,$('perf').value,state.period,state.correction],probe:localStorage.getItem('sq_private_qa_probe')}));
   assert.equal(after,before,'External display must not rewrite research');
   await p.locator('#sqEvidenceClose').click();await p.waitForFunction(()=>!document.querySelector('#sqTradingViewHost iframe'));
   const result={engine,symbol,exchange,canvasVisible,identityVisible,parentAccessDenied:isolation.parentStorage&&isolation.parentDocument,consentRequired:true,unloaded:true,researchUnchanged:before===after,screenshot:filename,screenshotSha256:fileHash(path.join(out,filename)),requestOrigins:[...new Set(requests.map(x=>new URL(x).origin))]};cases.push(result);
   console.log('REAL_WIDGET_CASE '+JSON.stringify(result));await context.close();
  }
  await browser.close();browser=null;
 }
 const report={sourceCommit:process.env.GITHUB_SHA,canvasVisible:cases.length===6&&cases.every(x=>x.canvasVisible&&x.identityVisible),parentAccessDenied:cases.every(x=>x.parentAccessDenied),unexpectedRequests,pageErrors,cases,physicalDeviceVerified:false,pricesExtracted:false};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
 assert.ok(report.canvasVisible,'Every intended real provider chart and listing must render');assert.ok(report.parentAccessDenied);assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpectedRequests,[]);
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,message:e.message,cases,pageErrors,unexpectedRequests},null,2));console.error(e.message);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
