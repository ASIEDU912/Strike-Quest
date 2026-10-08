// Small fixture-only screenshots for review through GitHub job logs.
// No upload-artifact, cache service, provider requests or credentials are used.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base='https://strikequests.review.test';
const maxImage=160*1024,maxTotal=650*1024;
let browser,total=0;
async function emit(page,name,locator){
  const buffer=await (locator||page).screenshot({type:'jpeg',quality:58,animations:'disabled',...(locator?{}:{fullPage:false})});
  if(buffer.length>maxImage||total+buffer.length>maxTotal)throw Error('Review image size limit exceeded');
  total+=buffer.length;
  const info={name,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),commit:process.env.REVIEW_HEAD_SHA||'local-review'};
  console.log('SQ_IMAGE_BEGIN '+JSON.stringify(info));
  const b64=buffer.toString('base64');
  for(let i=0;i<b64.length;i+=160)console.log('SQ_IMAGE_DATA '+b64.slice(i,i+160));
  console.log('SQ_IMAGE_END '+name);
}
(async()=>{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const unexpected=[];
  await context.addInitScript(()=>{sessionStorage.setItem('strikequests_v9_splash_seen','1');});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==base){unexpected.push(u.origin);return route.abort('blockedbyclient');}
    const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1)),file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
    return route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>state.period==='2y'&&state.correction===10&&!!window.StrikeMascot);
  await page.emulateMedia({reducedMotion:'reduce'});
  await emit(page,'fresh-mobile-390.jpg');
  await page.locator('#companionHost').scrollIntoViewIfNeeded();
  await emit(page,'lumi-rookie-mobile.jpg',page.locator('#companionHost'));
  await page.locator('#openTargetsBtn').click();
  await emit(page,'targets-2y-10-mobile-390.jpg');
  await page.setViewportSize({width:320,height:780});
  await page.locator('#openTargetsBtn').click();
  await emit(page,'targets-2y-10-mobile-320.jpg');
  await page.setViewportSize({width:390,height:844});await page.locator('#openSeasonalityBtn').click();
  await emit(page,'seasonality-mobile-390.jpg',page.locator('#analysisSeasonality'));
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));
  await emit(page,'fresh-desktop-1440.jpg');
  // Fixture awards exist only in this isolated browser context, never on a user's device.
  await page.evaluate(()=>{sqBadgeSave({version:1,earned:Object.fromEntries(SQ_CORE.map(b=>[b.id,{at:'2026-10-07T00:00:00Z',mode:'demo',origin:'visual-test-fixture'}])),horizons:['1y','2y']});sqRenderBadges();});
  await page.setViewportSize({width:390,height:844});await page.locator('#companionHost').scrollIntoViewIfNeeded();
  await emit(page,'lumi-final-aura-mobile.jpg',page.locator('#companionHost'));
  await page.setViewportSize({width:320,height:780});await page.locator('[data-private-mode="manual"]').click();await page.locator('#price').fill('999999.99');await page.locator('#perf').fill('1200');await page.locator('#openTargetsBtn').click();
  console.log('SQ_LAYOUT_DIAGNOSTIC '+JSON.stringify(await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,id:e.id,class:e.getAttribute('class'),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}))));
  await emit(page,'large-manual-320.jpg');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{setMode('demo');applySymbol('XLK');setPeriod('2y');sqSetCorrection(10);$('researchReason').value='The wider horizon changes my scenario; I would revisit the source and baseline before trusting it.';saveCurrent();sqSetCorrection(20);setView('saved');sqStartCheckin(sqHistoryRecords()[0].id);});
  await emit(page,'research-checkin-comparison-mobile.jpg');
  await page.locator('#checkinThinking').selectOption('uncertain');await page.locator('#checkinEvidence').selectOption('assumptions');
  await page.locator('#checkinReason').fill('I changed only the correction assumption. These new hypothetical levels do not show a market move. I still need dated evidence.');
  await page.locator('#checkinThinking').scrollIntoViewIfNeeded();
  await emit(page,'research-checkin-reflection-mobile.jpg');
  await page.locator('#saveCheckinBtn').click();
  await emit(page,'research-checkin-journal-mobile.jpg');
  await page.locator('.checkin-backup').scrollIntoViewIfNeeded();
  await emit(page,'private-journal-backup-mobile.jpg',page.locator('.checkin-backup'));
  await page.evaluate(()=>{const b=sqCreateCheckinBackup();b.entries[0].id='visual-import-fixture';sqStageCheckinImport(JSON.stringify(b),'Private NAS backup.json');});
  await emit(page,'private-journal-import-preview-mobile.jpg',page.locator('#checkinImportPreview'));
  if(unexpected.length||errors.length)throw Error(JSON.stringify({unexpected,errors}));
  console.log('SQ_EVIDENCE_COMPLETE '+JSON.stringify({images:13,bytes:total,liveProviderRequests:0,errors}));
  await context.close();
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
