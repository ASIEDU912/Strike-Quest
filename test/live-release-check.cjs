/* Read-only verification of the exact deployed TradingView patch. Fresh profiles only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),pw=require('playwright'),assert=require('node:assert/strict');
const repo='ASIEDU912/Strike-Quest',expected=process.env.EXPECTED_RELEASE_COMMIT,source=process.env.EXPECTED_SOURCE_COMMIT,out=path.resolve('test-results/live-release');fs.mkdirSync(out,{recursive:true});let browser;
const report={releaseCommit:expected,sourceCommit:source,physicalIphone:false,accountSignInVerified:false,passed:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const blobHash=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const permitted=u=>u.protocol==='https:'&&(u.hostname==='tradingview.com'||u.hostname.endsWith('.tradingview.com')||u.hostname==='www.tradingview-widget.com'||u.hostname==='widget-sheriff.tradingview-widget.com'&&u.pathname==='/sheriff/api/v1/rules/search');
async function api(p){const r=await fetch('https://api.github.com/repos/'+repo+p,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Read-only release API failed: '+r.status);return r.json();}
(async()=>{
 assert.match(expected||'',/^[0-9a-f]{40}$/);assert.match(source||'',/^[0-9a-f]{40}$/);
 const main=await api('/git/ref/heads/main'),rollback=await api('/git/ref/heads/rollback/pre-tradingview-2026-10-14'),pages=await api('/pages'),tree=await api('/git/trees/'+expected+'?recursive=1');
 assert.equal(main.object.sha,expected);assert.equal(rollback.object.sha,'4456c7cb4ec929da29657160f1ca036da0faa11a');assert.equal(pages.cname,'strikequests.com');assert.equal(pages.source.branch,'main');assert.equal(pages.html_url,'https://strikequests.com/');assert.ok(!tree.truncated);
 const base=pages.html_url,blobs=new Map(tree.tree.filter(x=>x.type==='blob').map(x=>[x.path,x.sha]));let manifest,manifestBytes;
 for(let i=0;i<12;i++){const r=await fetch(base+'release-manifest.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok){const b=Buffer.from(await r.arrayBuffer()),m=JSON.parse(b);if(m.sourceCommit===source&&m.version==='10.2.0-preview.2'){manifest=m;manifestBytes=b;break;}}await new Promise(r=>setTimeout(r,10000));}
 assert.ok(manifest,'Expected manifest not yet published');assert.equal(blobHash(manifestBytes),blobs.get('release-manifest.json'));
 const checked=[];for(const item of manifest.files){assert.ok(blobs.has(item.path),'Unexpected manifest path');const r=await fetch(new URL(item.path,base),{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,item.path);const b=Buffer.from(await r.arrayBuffer());assert.equal(hash(b),item.sha256,item.path+' SHA256');assert.equal(blobHash(b),blobs.get(item.path),item.path+' exact Git blob');checked.push(item.path);}
 Object.assign(report,{version:manifest.version,site:base,checkedFiles:checked,rollbackCommit:rollback.object.sha});save();
 browser=await pw.chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],blocked=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));await ctx.addInitScript(()=>{if(window===window.top)navigator.serviceWorker.register=async()=>{};});
 await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===new URL(base).origin)return r.continue();if(permitted(u)){requests.push(u.origin+u.pathname);return r.continue();}blocked.push(u.origin+u.pathname);return r.abort();});
 await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(v=>document.body.dataset.release===v,manifest.version);await p.locator('#appSplash').waitFor({state:'hidden'});assert.equal(await p.locator('.bottom-nav [data-view]').count(),5);
 await p.screenshot({path:path.join(out,'live-home-390.png')});report.homeVerified=true;
 await p.locator('[data-view="research"]').click();await p.locator('[data-private-mode="manual"]').click();await p.evaluate(()=>applySymbol('XLK'));await p.locator('#sqOpenEvidence').click();await p.locator('#sqEvidenceExchange').selectOption('AMEX');assert.equal(requests.length,0,'Widget must wait for consent');
 await p.locator('#sqLoadTradingView').click();assert.equal(await p.locator('#sqTradingViewHost iframe').count(),0);await p.locator('#sqEvidenceConsent').check();await p.locator('#sqLoadTradingView').click();const iframe=p.locator('#sqTradingViewHost iframe');await iframe.scrollIntoViewIfNeeded();
 assert.equal(await iframe.getAttribute('srcdoc'),null);assert.equal(new URL(await iframe.getAttribute('src')).origin,'https://www.tradingview-widget.com');assert.equal(await iframe.getAttribute('referrerpolicy'),'no-referrer');assert.doesNotMatch(await iframe.getAttribute('sandbox'),/allow-top-navigation|allow-forms|allow-storage-access/);
 const f=await (await iframe.elementHandle()).contentFrame();await f.locator('canvas').first().waitFor({state:'visible',timeout:45000});await f.getByText(/Technology.*Select|Technology.*SPDR/i).first().waitFor({state:'visible',timeout:15000});
 const denied=await f.evaluate(()=>{try{void parent.localStorage;return false;}catch{try{void parent.document;return false;}catch{return true;}}});assert.ok(denied,'Provider must not read parent storage or document');
 await iframe.screenshot({path:path.join(out,'live-tradingview-XLK-390.png')});report.widgetScreenshotSha256=hash(fs.readFileSync(path.join(out,'live-tradingview-XLK-390.png')));Object.assign(report,{tradingViewCanvasVisible:true,expectedListingVisible:true,parentAccessDenied:denied,consentRequired:true});
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#sqTradingViewHost iframe'));report.escapeUnloadedWidget=true;await p.locator('#sqOpenEvidence').click();assert.equal(await p.locator('#sqEvidenceConsent').isChecked(),false);await p.keyboard.press('Escape');
 Object.assign(report,{errors,blocked,providerOrigins:[...new Set(requests.map(x=>new URL(x).origin))]});assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);report.passed=true;save();console.log('LIVE_TRADINGVIEW_RELEASE_VERIFIED '+JSON.stringify(report));
})().catch(e=>{report.error=e.message;save();console.error(e.message);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();});
