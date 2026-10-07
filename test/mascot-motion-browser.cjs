// Real elapsed-time motion regression. All application requests are fulfilled from
// local files; unexpected traffic is blocked. No provider or paid artifact service.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const playwright = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'https://strikequests.motion.test';
const engines = (process.env.MOTION_BROWSERS || 'chromium,webkit').split(',');
const reports = [];
let browser;

// Decode screenshot pixels rather than comparing compressed PNG bytes/metadata.
function pngPixels(buffer) {
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  let at = 8, width, height, channels;
  const chunks = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at), type = buffer.toString('ascii', at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8); assert.equal(data[12], 0);
      channels = ({2:3, 6:4})[data[9]];
      assert.ok(channels, 'Expected an RGB/RGBA screenshot');
    }
    if (type === 'IDAT') chunks.push(data);
    at += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  const paeth = (a,b,c) => { const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c); return pa<=pb&&pa<=pc?a:pb<=pc?b:c; };
  for (let y=0;y<height;y++) {
    const filter = raw[y*(stride+1)]; assert.ok(filter<=4);
    for (let x=0;x<stride;x++) {
      const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;
      pixels[i]=(raw[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
    }
  }
  return {width,height,channels,pixels};
}
function changedPixels(a,b) {
  a=pngPixels(a);b=pngPixels(b);
  assert.deepEqual([a.width,a.height,a.channels],[b.width,b.height,b.channels]);
  let changed=0;
  for(let i=0;i<a.pixels.length;i+=a.channels) if(Math.max(...[0,1,2].map(k=>Math.abs(a.pixels[i+k]-b.pixels[i+k])))>12)changed++;
  return changed;
}
function range(values) { return Math.max(...values)-Math.min(...values); }
function distanceRange(samples,key) {
  return Math.hypot(range(samples.map(s=>s[key].x)),range(samples.map(s=>s[key].y)));
}
async function app(engine,width=390) {
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700,reducedMotion:'no-preference',serviceWorkers:'block'});
  const unexpected=[],errors=[];
  await context.addInitScript(()=>sessionStorage.setItem('strikequests_v9_splash_seen','1'));
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base){unexpected.push(url.href);return route.abort('blockedbyclient');}
    const file=path.resolve(root,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
    return route.fulfill({contentType:types[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>!!document.querySelector('#companionHost .sq-mascot'));
  return {page,context,check:()=>{assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);}};
}
async function stage(page,xp) {
  // Award records exist only inside this isolated test browser, never on a user device.
  await page.evaluate(xp=>{
    const mask=Array.from({length:1<<SQ_CORE.length},(_,i)=>i).find(mask=>SQ_CORE.reduce((sum,b,i)=>sum+((mask&(1<<i))?ACHIEVEMENTS[b.id].xp:0),0)===xp);
    if(mask===undefined)throw Error('No badge fixture for '+xp);
    sqBadgeSave({version:1,earned:Object.fromEntries(SQ_CORE.filter((_,i)=>mask&(1<<i)).map(b=>[b.id,{at:'2026-10-07T00:00:00Z',mode:'demo',origin:'motion-test'}])),horizons:[]});
    sqRenderBadges();
  },xp);
  await page.locator('#companionHost').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>sqResearchXp()),xp);
}
async function artClip(page) {
  // Fixed viewport crop. Cropping to a moving element would hide whole-art motion.
  const box=await page.locator('.sq-companion__art').boundingBox();
  return {x:Math.floor(box.x)-12,y:Math.floor(box.y)-12,width:Math.ceil(box.width)+24,height:Math.ceil(box.height)+24};
}
async function trace(page,duration=4200) {
  return page.evaluate(duration=>new Promise((resolve,reject)=>{
    const samples=[],start=performance.now(),svg=document.querySelector('#companionHost svg');
    let frame;const watchdog=setTimeout(()=>{cancelAnimationFrame(frame);reject(new Error('Motion sampling stalled before '+duration+'ms'));},duration+7000);
    const parts={body:'.sq-mascot__body',head:'.sq-mascot__head',tail:'.sq-mascot__tail',eyes:'.sq-mascot__eyes',drone:'.sq-mascot__drone',archive:'.sq-mascot__archive',wings:'.sq-mascot__wings',aura:'.sq-mascot__aura'};
    const tick=now=>{
      try {
      const art=document.querySelector('.sq-companion__art'),r=art.getBoundingClientRect();
      const sample={time:now-start,art:{x:r.x,y:r.y}};
      for(const [key,selector] of Object.entries(parts)) {
        const el=svg.querySelector(selector);if(!el)continue;
        // Remove ancestor motion: a static child riding the whole illustration cannot pass.
        const relative=el.parentElement.getScreenCTM().inverse().multiply(el.getScreenCTM());
        const point=new DOMPoint(135,45).matrixTransform(relative),screen=new DOMPoint(90,50).matrixTransform(el.getScreenCTM());
        sample[key]={x:point.x,y:point.y,screenX:screen.x,screenY:screen.y,transform:getComputedStyle(el).transform,opacity:Number(getComputedStyle(el).opacity)};
      }
      samples.push(sample);
      if(now-start<duration)frame=requestAnimationFrame(tick);else{clearTimeout(watchdog);resolve(samples);}
      }catch(error){clearTimeout(watchdog);reject(error);}
    };
    frame=requestAnimationFrame(tick);
  }),duration);
}
async function motion(page,label,emit=false) {
  const before=await page.evaluate(()=>JSON.stringify(sqBadges().earned));
  assert.equal(await page.locator('[data-mascot-motion]').textContent(),'Pause motion');
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),false);
  const clip=await artClip(page),frames=[];
  frames.push(await page.screenshot({clip,animations:'allow'}));
  const pending=trace(page);
  await page.waitForTimeout(1100);frames.push(await page.screenshot({clip,animations:'allow'}));
  await page.waitForTimeout(1100);frames.push(await page.screenshot({clip,animations:'allow'}));
  const samples=await pending;
  assert.ok(samples.length>20,`${label}: expected advancing animation frames`);
  assert.ok(distanceRange(samples,'art')>2.5,`${label}: HTML sway must visibly move at phone size`);
  for(const key of ['body','head','tail'])assert.ok(distanceRange(samples,key)>1.5,`${label}: ${key} must move independently`);
  for(const key of ['drone','archive','wings'])if(samples[0][key])assert.ok(distanceRange(samples,key)>2,`${label}: ${key} must move independently`);
  const pixels=Math.max(changedPixels(frames[0],frames[1]),changedPixels(frames[0],frames[2]));
  assert.ok(pixels>70,`${label}: actual painted art must change, found ${pixels} pixels`);
  assert.equal(await page.evaluate(()=>JSON.stringify(sqBadges().earned)),before);
  // Disable only the HTML layer in this isolated fixture. SVG parts must still
  // change the rendered pixels; a whole-image sway cannot hide frozen SVG paint.
  await page.locator('.sq-companion__art').evaluate(el=>{el.style.animation='none'});
  const partClip=await artClip(page),partA=await page.screenshot({clip:partClip,animations:'allow'});
  await page.waitForTimeout(900);const partB=await page.screenshot({clip:partClip,animations:'allow'});
  await page.waitForTimeout(900);const partC=await page.screenshot({clip:partClip,animations:'allow'});
  const independentPaintPixels=Math.max(changedPixels(partA,partB),changedPixels(partA,partC));
  assert.ok(independentPaintPixels>40,`${label}: SVG parts must visibly repaint independently`);
  await page.locator('.sq-companion__art').evaluate(el=>{el.style.removeProperty('animation')});
  const result={label,independentPaintPixels,elapsedMs:Math.round(samples.at(-1).time),samples:samples.length,htmlTravelPx:distanceRange(samples,'art'),bodyLocalTravel:distanceRange(samples,'body'),headLocalTravel:distanceRange(samples,'head'),tailLocalTravel:distanceRange(samples,'tail'),changedPixels:pixels};
  reports.push(result);console.log('SQ_MOTION_PASS '+JSON.stringify(result));
  if(emit)for(let i=0;i<frames.length;i++) {
    assert.ok(frames[i].length<100*1024);
    const name=`${label.replace(/[^a-z0-9-]/gi,'-')}-frame-${i}.png`;
    console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name,bytes:frames[i].length,sha256:crypto.createHash('sha256').update(frames[i]).digest('hex'),commit:process.env.REVIEW_HEAD_SHA||'local',temporal:true,frame:i}));
    const b64=frames[i].toString('base64');for(let j=0;j<b64.length;j+=160)console.log('SQ_IMAGE_DATA '+b64.slice(j,j+160));
    console.log('SQ_IMAGE_END '+name);
  }
}
async function still(page,label) {
  const clip=await artClip(page),a=await page.screenshot({clip,animations:'allow'}),samples=await trace(page,1200),b=await page.screenshot({clip,animations:'allow'});
  assert.equal(changedPixels(a,b),0,`${label}: paused/reduced art pixels must stay unchanged`);
  for(const key of ['art','body','head','tail'])assert.ok(distanceRange(samples,key)<.001,`${label}: ${key} must stay still`);
  assert.equal(await page.locator('.sq-companion__art, #companionHost .sq-mascot *').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).animationName==='none')),true);
  console.log('SQ_MOTION_PASS '+JSON.stringify({label,still:true,samples:samples.length}));
}
(async()=>{
  for(const engine of engines) {
    assert.ok(['chromium','webkit'].includes(engine));
    browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    const {page,context,check}=await app(engine);
    for(const xp of [0,50,150,375,500]){await stage(page,xp);await motion(page,`${engine}-390-${xp}xp`,xp===375);}
    await stage(page,375);
    const blink=await trace(page,5400);assert.ok(distanceRange(blink,'eyes')>3,`${engine}: eyes must blink over a complete cycle`);
    await page.locator('[data-mascot-motion]').click();await still(page,`${engine}-paused`);
    await page.reload();await page.locator('#companionHost').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('[data-mascot-motion]').textContent(),'Resume motion');
    await still(page,`${engine}-paused-reload`);
    await page.locator('[data-mascot-motion]').click();await motion(page,`${engine}-resumed-after-reload`);
    await page.locator('#companionSummary').click();
    assert.equal(await page.locator('.sq-companion__art, #companionHost .sq-mascot *').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).animationName==='none')),true);
    await page.reload();assert.equal(await page.locator('#companionPanel').evaluate(el=>el.open),false);
    await page.locator('#companionSummary').click();await page.locator('#companionHost').scrollIntoViewIfNeeded();
    await motion(page,`${engine}-reopened-after-reload`);
    await page.emulateMedia({reducedMotion:'reduce'});await still(page,`${engine}-reduced-motion`);
    assert.equal(await page.locator('[data-mascot-motion]').isVisible(),false);
    await page.emulateMedia({reducedMotion:'no-preference'});await motion(page,`${engine}-motion-preference-restored`);
    // A level-up's finite hop must settle back into the infinite idle animation.
    await page.evaluate(()=>{sqCompanion.update(500);});
    await page.waitForTimeout(1700);
    assert.equal(await page.locator('.sq-mascot--idle').count(),1);
    await motion(page,`${engine}-post-levelup-idle`);
    // Returning from a hidden application view must restart visible motion.
    await page.locator('[data-view="watchlist"]').click();await page.locator('[data-view="research"]').click();
    await page.locator('#companionHost').scrollIntoViewIfNeeded();await motion(page,`${engine}-return-to-research`);
    check();await context.close();
    for(const width of [320,1440]) {
      const x=await app(engine,width);await stage(x.page,375);await motion(x.page,`${engine}-${width}-375xp`);
      assert.ok(await x.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      x.check();await x.context.close();
    }
    await browser.close();browser=null;
  }
  console.log('SQ_MOTION_COMPLETE '+JSON.stringify({engines,temporalChecks:reports.length,liveProviderRequests:0,checks:reports}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
