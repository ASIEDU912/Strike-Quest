'use strict';
// Only synthetic fixtures in ephemeral local browser contexts; never reads user data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const old=path.resolve(process.env.ROLLBACK_ROOT),studio=path.resolve(process.env.STUDIO_ROOT);
let root=studio;
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,pathname==='/'?'index.html':'.'+pathname);
 res.setHeader('Cache-Control','no-store');
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,launcher] of Object.entries({chromium,webkit})){
  root=studio;const browser=await launcher.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844}});
   const unexpected=[],errors=[];
   await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){unexpected.push(route.request().url());return route.abort();}return route.continue();});
   await context.routeWebSocket('**/*',socket=>{unexpected.push(socket.url());socket.close();});
   await context.addInitScript(()=>sessionStorage.setItem('strikequests_v9_splash_seen','1'));
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);
   await page.waitForFunction(()=>typeof sqStartCheckin==='function'&&!!document.getElementById('viewHome'));
   await page.evaluate(()=>navigator.serviceWorker.ready);
   await page.waitForFunction(async()=>!!navigator.serviceWorker.controller&&(await caches.keys()).includes('strikequests-v10-2-public-preview-1'));
   await page.evaluate(()=>{
    setView('research');setMode('demo');applySymbol('AAPL');
    $('researchReason').value='Synthetic rollback fixture: preserve this saved reasoning.';
    assertFixture(saveCurrent()!==false,'save');
    sqSetCorrection(20);setView('saved');
    assertFixture(sqStartCheckin(sqHistoryRecords()[0].id),'start');
    function assertFixture(ok,label){if(!ok)throw Error('Fixture '+label+' failed');}
   });
   await page.locator('#checkinThinking').selectOption('uncertain');
   await page.locator('#checkinEvidence').selectOption('assumptions');
   await page.locator('#checkinReason').fill('Synthetic journal reflection must survive rollback unchanged.');
   await page.locator('#saveCheckinBtn').click();
   const keys=['splab_history','sq_research_checkins_v1','sq_watchlist','sq_badges_v1011'];
   const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys);
   assert.equal(JSON.parse(before.sq_research_checkins_v1).entries.length,1);
   root=old;
   await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
   await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('strikequests-v10-1-5-research-checkin')&&!keys.includes('strikequests-v10-2-public-preview-1');});
   await page.reload();
   await page.waitForFunction(()=>typeof sqStartCheckin==='function'&&!document.getElementById('viewHome'));
   assert.match(await page.locator('.foot').textContent(),/v10\.1\.5/);
   await page.locator('[data-view="saved"]').click();
   assert.match(await page.locator('#checkinJournal').textContent(),/Synthetic journal reflection must survive/);
   assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys),before);
   assert.equal(await page.evaluate(()=>sqReadCheckins().blocked||false),false);
   await page.screenshot({path:path.join(process.env.EVIDENCE_DIR||'test-results','rollback-'+engine+'.png')});
   await context.setOffline(true);await page.reload();
   await page.waitForFunction(()=>typeof sqStartCheckin==='function');
   assert.match(await page.locator('.foot').textContent(),/v10\.1\.5/);
   assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),keys),before);
   assert.deepEqual(unexpected,[],'No external/provider requests');
   assert.deepEqual(errors,[],'No browser exceptions');
   console.log('ROLLBACK_COMPAT_PASS '+engine+': Studio-created saved analysis/journal/badges preserved byte-for-byte; worker replaced; old cache removed; v10.1.5 online and offline; zero external requests.');
   await context.close();
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
