// Native input + elapsed-time paint regression. Synthetic fixture only: no live
// providers, user browser/storage, downloads, paid services or external uploads.
// Run TAP_BROWSERS=chromium,webkit node test/mascot-tap-browser.cjs.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const playwright = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'https://strikequests.tap.fixture.test';
const fixedNow = '2026-10-07T12:00:00.000Z';
const hosts = [
  {context:'research',host:'companionHost',panel:'companionPanel',summary:'companionSummary'},
  {context:'quests',host:'questsCompanionHost',panel:'questsCompanionPanel',summary:'questsCompanionSummary'},
  {context:'seasonality',host:'seasonalityCompanionHost',panel:'seasonalityCompanionPanel',summary:'seasonalityCompanionSummary'},
  {context:'saved',host:'savedCompanionHost',panel:'savedCompanionPanel',summary:'savedCompanionSummary'},
  {context:'watchlist',host:'watchlistCompanionHost',panel:'watchlistCompanionPanel',summary:'watchlistCompanionSummary'}
];
const stages = [[0,'rookie'],[50,'scout'],[150,'ranger'],[375,'keeper'],[500,'voyager']];
const reactions = ['wave','tilt','tail'];
const parts = {wave:'.sq-mascot__paw',tilt:'.sq-mascot__head',tail:'.sq-mascot__tail'};
const reports = [];
let browser;
const select = (h,selector) => `#${h.host} ${selector}`;
function pass(label,detail={}) { reports.push({label,...detail});console.log('SQ_TAP_PASS '+JSON.stringify(reports.at(-1))); }

// Compare decoded pixels, never compressed PNG bytes or metadata.
function pngPixels(buffer) {
  assert.equal(buffer.subarray(1,4).toString(),'PNG');
  let at=8,width,height,channels;const chunks=[];
  while(at<buffer.length) {
    const length=buffer.readUInt32BE(at),type=buffer.toString('ascii',at+4,at+8),data=buffer.subarray(at+8,at+8+length);
    if(type==='IHDR') {
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[12],0);
      channels=({2:3,6:4})[data[9]];assert.ok(channels,'Expected RGB/RGBA screenshots');
    }
    if(type==='IDAT')chunks.push(data);at+=length+12;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(width*height*channels);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++) {
    const filter=raw[y*(stride+1)],i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;
    assert.ok(filter<=4);pixels[i]=(raw[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
  }
  return {width,height,channels,pixels};
}
function changedPixels(a,b) {
  a=pngPixels(a);b=pngPixels(b);assert.deepEqual([a.width,a.height,a.channels],[b.width,b.height,b.channels]);
  let count=0;for(let i=0;i<a.pixels.length;i+=a.channels)if(Math.max(...[0,1,2].map(k=>Math.abs(a.pixels[i+k]-b.pixels[i+k])))>12)count++;
  return count;
}
const range=values=>Math.max(...values)-Math.min(...values);
const travel=(samples,key)=>Math.hypot(range(samples.map(s=>s[key].x)),range(samples.map(s=>s[key].y)));
function emitImage(buffer,name,frame) {
  assert.ok(buffer.length<100*1024,`Oversize evidence: ${name}`);
  console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),commit:process.env.REVIEW_HEAD_SHA||'local',temporal:true,frame}));
  const data=buffer.toString('base64');for(let i=0;i<data.length;i+=160)console.log('SQ_IMAGE_DATA '+data.slice(i,i+160));
  console.log('SQ_IMAGE_END '+name);
}

async function fixture(width=390) {
  const context=await browser.newContext({viewport:{width,height:width<700?844:1050},deviceScaleFactor:1,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
  const unexpected=[],errors=[];
  await context.addInitScript(fixedNow=>{
    const OriginalDate=Date;
    window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return OriginalDate.parse(fixedNow);}};
    sessionStorage.setItem('strikequests_v9_splash_seen','1');
    window.__tapStorageWrites=[];
    for(const name of ['setItem','removeItem','clear']) {
      const original=Storage.prototype[name];
      Storage.prototype[name]=function(...args){window.__tapStorageWrites.push({store:this===localStorage?'local':'session',name,args});return original.apply(this,args);};
    }
  },fixedNow);
  const allowed=new Set(['/','/index.html','/mascot.js','/mascot.css','/studio.js','/studio.css','/account-core.js','/account.js','/account.css','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png','/favicon.ico']);
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
  // The visually hidden legacy splash still writes a session flag after 280ms.
  // Let startup finish before attributing any storage write to artwork input.
  await page.goto(base+'/#research');await page.waitForFunction(()=>document.querySelectorAll('[data-mascot-tap]').length===5&&document.getElementById('appSplash').classList.contains('hide'));
  const startup=await protectedState(page);
  assert.ok(startup.writes.some(write=>write.store==='session'&&write.name==='setItem'&&write.args[0]==='strikequests_v9_splash_seen'),'Startup session write completed before the interaction baseline');
  await page.waitForTimeout(1450);
  assert.deepEqual(await protectedState(page),startup,'Untapped startup control has stable data and storage');
  return {page,context,check(){assert.deepEqual(errors,[],'No browser errors');assert.deepEqual(unexpected,[],'No unexpected/provider/WebSocket traffic');}};
}
async function visit(page,h) {
  await page.locator(`[data-view="${h.context==='seasonality'?'research':h.context}"]`).click();
  if(h.context==='seasonality')await page.locator('#openSeasonalityBtn').click();
  if(h.context==='research')await page.locator('[data-analysis="overview"]').click();
  await page.locator('#'+h.summary).scrollIntoViewIfNeeded();
  if(!await page.locator('#'+h.panel).evaluate(el=>el.open))await page.locator('#'+h.summary).click();
  await page.locator(select(h,'[data-mascot-tap]')).scrollIntoViewIfNeeded();
  await page.waitForFunction(host=>!document.querySelector('#'+host+' .sq-companion').classList.contains('sq-mascot--inactive'),h.host);
  await page.waitForFunction(host=>!document.querySelector('#'+host+' .sq-companion').classList.contains('sq-companion--greeting'),h.host);
}
async function seedStage(page,xp) {
  await page.evaluate(xp=>{
    const mask=Array.from({length:1<<SQ_CORE.length},(_,i)=>i).find(mask=>SQ_CORE.reduce((sum,b,i)=>sum+((mask&(1<<i))?ACHIEVEMENTS[b.id].xp:0),0)===xp);
    if(mask===undefined)throw Error('No synthetic badge fixture for '+xp);
    // Change only earned milestones; keep the normal startup horizon record.
    // Reload visits the active horizon independently of any artwork input.
    sqBadgeSave({version:1,earned:Object.fromEntries(SQ_CORE.filter((_,i)=>mask&(1<<i)).map(b=>[b.id,{at:'2026-10-07T12:00:00Z',mode:'demo',origin:'tap-test'}])),horizons:sqBadges().horizons});
    sqRenderBadges();
  },xp);
  assert.equal(await page.evaluate(()=>sqResearchXp()),xp);
}
async function protectedState(page) {
  return page.evaluate(()=>{
    const storage=store=>Object.fromEntries(Object.keys(store).sort().map(key=>[key,store.getItem(key)]));
    return {writes:window.__tapStorageWrites,inputs:['ticker','price','perf','divisor','increment','researchReason'].map(id=>[id,$(id).value]),badges:sqBadges(),xp:sqResearchXp(),saved:sqJSON('splab_history',[]),watch:getWatchlist(),compare:getCompareSelection(),toast:$('badgeToast').textContent,local:storage(localStorage),session:storage(sessionStorage),state};
  });
}
async function reaction(page,h) {
  return page.locator(select(h,'.sq-companion')).evaluate(el=>[...el.classList].filter(name=>/^sq-companion--tap-(wave|tilt|tail)$/.test(name)).map(name=>name.slice('sq-companion--tap-'.length)));
}
async function feedback(page,h) {
  const geometry=await page.locator(select(h,'[data-mascot-tap]')).evaluate(el=>({artBottom:el.querySelector('.sq-companion__art').getBoundingClientRect().bottom,cueTop:el.querySelector('.sq-companion__feedback').getBoundingClientRect().top}));
  assert.ok(geometry.cueTop>=geometry.artBottom,`${h.context}: feedback has a separate gutter outside the illustration ${JSON.stringify(geometry)}`);
  const cue=page.locator(select(h,'.sq-companion__feedback'));
  assert.equal(await cue.isVisible(),true,`${h.context}: visible acknowledgement`);
  const text=(await cue.textContent()).trim();assert.ok(text.length>0,`${h.context}: nonempty acknowledgement`);
  assert.equal(await cue.evaluate(el=>Number(getComputedStyle(el).opacity)>0),true,'Acknowledgement is painted');
  const status=page.locator(select(h,'.sq-companion__tap-status'));
  assert.equal(await status.getAttribute('role'),'status');
  assert.equal(await status.getAttribute('aria-live'),'polite');
  assert.equal(await status.getAttribute('aria-atomic'),'true');
  assert.ok((await status.textContent()).trim().length>0,'Separate tap announcement');
  assert.equal(await page.locator('.sq-companion__tap-status').evaluateAll((nodes,host)=>nodes.every(el=>el.closest('#'+host)||!el.textContent),h.host),true,'Only the activated placement acknowledges the tap');
  assert.equal(await page.locator('.sq-companion__status').evaluateAll(nodes=>nodes.every(el=>el.textContent==='')),true,'Tap never announces earned XP');
  return text;
}
async function clean(page,h) {
  assert.deepEqual(await reaction(page,h),[],`${h.context}: finite reaction cleaned up`);
  assert.equal((await page.locator(select(h,'.sq-companion__tap-status')).textContent()).trim(),'','No stale live-region acknowledgement');
  const cue=page.locator(select(h,'.sq-companion__feedback'));
  assert.ok(!await cue.isVisible()||!(await cue.textContent()).trim()||await cue.evaluate(el=>Number(getComputedStyle(el).opacity)===0),'No stale visible acknowledgement');
}
async function prepareInput(page,h,input) {
  if(input==='pointer'||input==='touch')return;
  // Keep an old pointer position from acquiring delayed :hover after scrolling
  // in WebKit. The keyboard focus ring stays visible; artwork is never frozen.
  await page.mouse.move(1,1);
  // Establish keyboard modality before taking stationary geometry/paint samples.
  // Tab may scroll to the next existing control; restore artwork focus first.
  await page.keyboard.press('Tab');await page.locator(select(h,'[data-mascot-tap]')).focus();
  await page.locator(select(h,'[data-mascot-tap]')).scrollIntoViewIfNeeded();
  await page.mouse.move(1,1);
  await page.waitForFunction(host=>!document.querySelector('#'+host+' .sq-companion').classList.contains('sq-mascot--inactive')&&!document.querySelector('#'+host+' [data-mascot-tap]').matches(':hover'),h.host);
}
async function activate(page,h,input,prepared=false) {
  if(!prepared)await prepareInput(page,h,input);
  const button=page.locator(select(h,'[data-mascot-tap]'));
  if(input==='pointer')await button.click();
  else if(input==='touch')await button.tap();
  else {
    if(input==='Space') {
      await page.keyboard.down('Space');
      assert.deepEqual(await reaction(page,h),[],'Native Space activates on keyup, not keydown');
      await page.keyboard.up('Space');
    } else await page.keyboard.press(input);
    const focus=await button.evaluate(el=>({focused:document.activeElement===el,visible:el.matches(':focus-visible'),style:getComputedStyle(el).outlineStyle,width:parseFloat(getComputedStyle(el).outlineWidth)}));
    assert.ok(focus.focused&&focus.visible&&focus.style!=='none'&&focus.width>=2,`${input}: visible native keyboard focus ${JSON.stringify(focus)}`);
  }
}
async function dimensions(page,h) {
  const button=page.locator(select(h,'[data-mascot-tap]'));
  const semantics=await button.evaluate(el=>({tag:el.tagName,type:el.type,label:el.getAttribute('aria-label'),disabled:el.disabled,art:!!el.querySelector('.sq-companion__art'),tabIndex:el.tabIndex,nested:el.querySelectorAll('button,a,input,select,textarea').length}));
  assert.deepEqual(semantics,{tag:'BUTTON',type:'button',label:'Say hello to Lumi',disabled:false,art:true,tabIndex:0,nested:0},`${h.context}: one semantic artwork button`);
  const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,`${h.context}: at least 44px touch target`);
  const help=await button.getAttribute('aria-describedby');assert.ok(help,'Artwork interaction has a description');
  assert.equal(await page.locator('[id="'+help+'"]').count(),1,'Description IDs are unique across placements');
  assert.match(await page.locator('[id="'+help+'"]').textContent(),/cosmetic/i);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  return box;
}
async function isolateParts(page,h) {
  // Freeze HTML sway, body breathing, blinks and all accessories. Only the
  // requested real SVG part may repaint. Idle motion cannot make this test pass.
  await page.evaluate(({host,parts})=>{
    document.getElementById('tap-paint-isolation')?.remove();
    const style=document.createElement('style');style.id='tap-paint-isolation';
    const prefix='#'+host+' ';
    style.textContent=prefix+'.sq-companion__tap{background:transparent!important;box-shadow:none!important}'+
      prefix+'.sq-companion__art{animation:none!important;transform:none!important;transition:none!important}'+
      prefix+'.sq-mascot *:not(.sq-mascot__paw):not(.sq-mascot__head):not(.sq-mascot__tail){animation:none!important;transition:none!important}'+
      Object.entries(parts).map(([name,part])=>prefix+'.sq-companion:not(.sq-companion--tap-'+name+') '+part+'{animation:none!important;transition:none!important}').join('');
    document.head.appendChild(style);
  },{host:h.host,parts});
}
async function clip(page,h) {
  const b=await page.locator(select(h,'.sq-companion__art')).boundingBox();
  return {x:Math.floor(b.x),y:Math.floor(b.y),width:Math.ceil(b.width),height:Math.ceil(b.height)};
}
async function startTrace(page,h) {
  await page.evaluate(({host,parts})=>{
    window.__tapTrace=new Promise((resolve,reject)=>{
      const samples=[],start=performance.now(),card=document.querySelector('#'+host+' .sq-companion');
      let frame;const watchdog=setTimeout(()=>{cancelAnimationFrame(frame);reject(Error('Tap animation sampling stalled'));},8000);
      const tick=now=>{
        try {
          const button=card.querySelector('[data-mascot-tap]').getBoundingClientRect(),art=card.querySelector('.sq-companion__art').getBoundingClientRect();
          const sample={time:now-start,button:{x:button.x,y:button.y,width:button.width,height:button.height},art:{x:art.x,y:art.y},classes:[...card.classList].filter(n=>/^sq-companion--tap-(wave|tilt|tail)$/.test(n))};
          for(const [key,selector] of Object.entries(parts)) {
            const el=card.querySelector(selector);if(!el)throw Error('Missing animated part '+selector);
            // Remove all ancestor transforms: a static child riding a wrapper fails.
            const relative=el.parentElement.getScreenCTM().inverse().multiply(el.getScreenCTM()),point=new DOMPoint(135,45).matrixTransform(relative),css=getComputedStyle(el);
            sample[key]={x:point.x,y:point.y,name:css.animationName,duration:css.animationDuration,iterations:css.animationIterationCount};
          }
          samples.push(sample);
          if(now-start<1400)frame=requestAnimationFrame(tick);else{clearTimeout(watchdog);resolve(samples);}
        }catch(error){clearTimeout(watchdog);reject(error);}
      };
      frame=requestAnimationFrame(tick);
    });
  },{host:h.host,parts});
}
async function finitePaint(page,h,input,label,emit=false) {
  await prepareInput(page,h,input);
  const before=await protectedState(page),box=await dimensions(page,h),crop=await clip(page,h),frames=[];
  frames.push(await page.screenshot({clip:crop,animations:'allow'}));
  await startTrace(page,h);await activate(page,h,input,true);
  const active=await reaction(page,h);assert.equal(active.length,1,`${label}: exactly one finite reaction`);
  assert.equal(await page.locator('.sq-companion--tap-wave,.sq-companion--tap-tilt,.sq-companion--tap-tail').count(),1,`${label}: one placement reacts`);
  const kind=active[0];await feedback(page,h);
  await page.waitForTimeout(160);frames.push(await page.screenshot({clip:crop,animations:'allow'}));
  await page.waitForTimeout(240);frames.push(await page.screenshot({clip:crop,animations:'allow'}));
  const samples=await page.evaluate(()=>window.__tapTrace),live=samples.filter(s=>s.classes.length);
  assert.ok(samples.length>15&&live.length>4,`${label}: real advancing animation frames`);
  assert.ok(samples.every(s=>s.classes.length<=1),`${label}: reactions never stack`);
  assert.ok(live.every(s=>s[kind].name!=='none'&&s[kind].iterations==='1'),`${label}: actual finite part animation`);
  assert.ok(live.every(s=>s[kind].duration.split(',').every(d=>parseFloat(d)>0&&parseFloat(d)<=1.05)),`${label}: bounded CSS animation duration`);
  assert.ok(travel(live,kind)>2,`${label}: ${kind} genuinely moves independently`);
  for(const other of reactions.filter(name=>name!==kind))assert.ok(travel(samples,other)<.01,`${label}: unrelated ${other} was frozen`);
  assert.ok(travel(samples,'art')<.1,`${label}: HTML sway was frozen`);
  assert.ok(travel(samples,'button')<.1,`${label}: touch target does not move`);
  assert.ok(samples.every(s=>Math.abs(s.button.width-box.width)<.1&&Math.abs(s.button.height-box.height)<.1),`${label}: touch target dimensions stay fixed`);
  const painted=Math.max(changedPixels(frames[0],frames[1]),changedPixels(frames[0],frames[2]));
  assert.ok(painted>12,`${label}: moving SVG part must visibly repaint (${painted} pixels)`);
  assert.ok(live.at(-1).time-live[0].time>=650,`${label}: finite response is perceptible`);
  await clean(page,h);assert.equal(samples.at(-1)[kind].name,'none',`${label}: finite transform settles`);
  assert.deepEqual(await protectedState(page),before,`${label}: no XP, data, provider state, toast or storage writes`);
  if(emit)for(let i=0;i<frames.length;i++)emitImage(frames[i],`${label}-${kind}-frame-${i}.png`,i);
  return {kind,painted,travel:travel(live,kind)};
}
async function matrix(page,engine) {
  for(const [xp,stage] of stages) {
    await seedStage(page,xp);
    for(const h of hosts) {
      await visit(page,h);assert.equal(await page.locator(select(h,'.sq-mascot--'+stage)).count(),1);
      await isolateParts(page,h);
      const results=[];
      for(const input of ['pointer','touch','Enter'])results.push(await finitePaint(page,h,input,`${engine}-${h.context}-${stage}-${input.toLowerCase()}`,h.context==='quests'&&xp===500));
      assert.deepEqual(results.map(r=>r.kind).sort(),[...reactions].sort(),'Three successive taps include wave, head tilt and tail response');
      const before=await protectedState(page);await activate(page,h,'Space');
      assert.deepEqual(await reaction(page,h),[results[0].kind],'The three-response cycle repeats');await feedback(page,h);
      await page.waitForTimeout(1150);await clean(page,h);assert.deepEqual(await protectedState(page),before,'Space is cosmetic and storage-free');
      pass(`${engine}/${h.context}/${stage}: pointer, touch, Enter, Space and finite SVG paint`,{xp,parts:results});
      await page.evaluate(()=>document.getElementById('tap-paint-isolation').remove());
    }
  }
}
async function staticResponse(page,h,input,label,emit=false) {
  await prepareInput(page,h,input);
  const before=await protectedState(page),crop=await clip(page,h);
  await startTrace(page,h);await activate(page,h,input,true);await feedback(page,h);
  const cue=(await page.locator(select(h,'.sq-companion__feedback')).textContent()).trim();
  // Both images are after activation. Feedback has a separate gutter and may
  // expire without touching this fixed artwork crop, even on a slow renderer.
  const state=()=>page.locator(select(h,'[data-mascot-tap]')).evaluate(el=>{const cue=el.querySelector('.sq-companion__feedback'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {time:performance.now(),scrollY,hover:el.matches(':hover'),boxShadow:getComputedStyle(el).boxShadow,backgroundColor:getComputedStyle(el).backgroundColor,button:rect(el),art:rect(el.querySelector('.sq-companion__art')),cue:{hidden:cue.hidden,text:cue.textContent,rect:rect(cue)}};});
  const startA=await state(),a=await page.screenshot({clip:crop,animations:'allow'}),endA=await state();
  await page.waitForTimeout(250);const startB=await state(),b=await page.screenshot({clip:crop,animations:'allow'}),endB=await state();
  if(['Enter','Space'].includes(input))for(const snapshot of [startA,endA,startB,endB])assert.equal(snapshot.hover,false,`${label}: keyboard paint is isolated from pointer hover`);
  const paintDelta=changedPixels(a,b);
  const samples=await page.evaluate(()=>window.__tapTrace);
  if(paintDelta){
    emitImage(a,`${label}-static-failure-a.png`,0);emitImage(b,`${label}-static-failure-b.png`,1);
    console.log('SQ_STATIC_FAILURE '+JSON.stringify({label,paintDelta,crop,startA,endA,startB,endB,travel:Object.fromEntries(['art','wave','tilt','tail'].map(key=>[key,travel(samples,key)])),samples:samples.filter((_,i)=>i===0||i===samples.length-1||i%12===0)}));
  }
  assert.equal(paintDelta,0,`${label}: paused/reduced art stays still`);
  for(const key of ['art','wave','tilt','tail'])assert.ok(travel(samples,key)<.01,`${label}: ${key} does not animate`);
  assert.equal(await page.locator(select(h,'.sq-companion__art')+','+select(h,'.sq-mascot *')).evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).animationName==='none')),true,'Motion preference suppresses every art animation');
  await clean(page,h);assert.deepEqual(await protectedState(page),before,`${label}: static acknowledgement changes no state/storage`);
  if(emit) {
    await activate(page,h,input);await feedback(page,h);
    emitImage(await page.locator('#'+h.panel).screenshot({animations:'allow'}),label+'-static-feedback.png',0);
    await page.waitForTimeout(1150);await clean(page,h);
  }
  pass(label,{static:true,cue});
}
async function interruptionAndPreferences(page,engine) {
  const h=hosts[0];await visit(page,h);
  const before=await protectedState(page);
  await activate(page,h,'pointer');const first=await reaction(page,h);await page.waitForTimeout(700);
  await activate(page,h,'touch');const second=await reaction(page,h);assert.notDeepEqual(second,first,'Rapid taps replace the response');
  await page.waitForTimeout(480);assert.deepEqual(await reaction(page,h),second,'The older timer cannot erase the newer response');await feedback(page,h);
  await page.waitForTimeout(650);await clean(page,h);
  for(let i=0;i<12;i++){await activate(page,h,i%2?'touch':'pointer');assert.equal((await reaction(page,h)).length,1);await feedback(page,h);}
  await page.waitForTimeout(1150);await clean(page,h);assert.deepEqual(await protectedState(page),before,'Rapid taps have no data/storage side effects');
  pass(`${engine}: rapid replacement, no stacked classes, stale timer protection and settlement`);

  await activate(page,h,'pointer');await page.locator('[data-view="watchlist"]').click();
  await page.waitForFunction(()=>document.querySelector('#companionHost .sq-companion').classList.contains('sq-mascot--inactive'));await clean(page,h);
  await visit(page,h);await clean(page,h);await page.waitForTimeout(1150);await clean(page,h);
  await activate(page,h,'pointer');await page.locator('#'+h.summary).click();await clean(page,h);
  await page.locator('#'+h.summary).click();await visit(page,h);await clean(page,h);
  await activate(page,h,'pointer');await seedStage(page,0);await clean(page,h);
  assert.equal(await page.locator(select(h,'.sq-mascot--rookie')).count(),1);
  await activate(page,h,'pointer');await feedback(page,h);await seedStage(page,500);await clean(page,h);
  assert.equal(await page.locator(select(h,'.sq-mascot--voyager')).count(),1);await page.waitForTimeout(1150);await clean(page,h);
  pass(`${engine}: navigation/collapse/evolution cancel reactions and discard stale feedback`);

  // None of the existing controls is a second hit area for the artwork response.
  await page.locator('#'+h.summary).click();await clean(page,h);await page.locator('#'+h.summary).click();await visit(page,h);await clean(page,h);
  await activate(page,h,'pointer');await page.locator(select(h,'[data-mascot-motion]')).click();await clean(page,h);
  for(const item of hosts)assert.equal(await page.locator(select(item,'[data-mascot-motion]')).getAttribute('aria-pressed'),'true');
  await staticResponse(page,h,'pointer',`${engine}-paused`,true);
  await staticResponse(page,h,'touch',`${engine}-paused-repeat`);
  await page.locator(select(h,'[data-mascot-action]')).click();
  for(const item of hosts)await clean(page,item);
  await visit(page,h);await page.locator('#'+h.summary).click();
  const persisted=await page.evaluate(()=>({xp:sqResearchXp(),badges:JSON.stringify(sqBadges()),paused:localStorage.getItem('sq_companion_paused'),collapsed:localStorage.getItem('sq_companion_collapsed')}));
  assert.equal(persisted.paused,'true');assert.equal(persisted.collapsed,'true');
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('[data-mascot-tap]').length===5&&document.getElementById('appSplash').classList.contains('hide'));
  assert.deepEqual(await page.evaluate(()=>({xp:sqResearchXp(),badges:JSON.stringify(sqBadges()),paused:localStorage.getItem('sq_companion_paused'),collapsed:localStorage.getItem('sq_companion_collapsed')})),persisted,'XP and prior pause/collapse settings survive reload unchanged');
  for(const item of hosts){assert.equal(await page.locator('#'+item.panel).evaluate(el=>el.open),false);await clean(page,item);}
  await visit(page,h);await staticResponse(page,h,'Enter',`${engine}-paused-after-reload`);
  await page.locator(select(h,'[data-mascot-motion]')).click();await clean(page,h);
  pass(`${engine}: summary/pause/guide never tap; shared pause/collapse and XP persist`);

  await page.emulateMedia({reducedMotion:'reduce'});
  for(const item of hosts) {
    await visit(page,item);assert.equal(await page.locator(select(item,'[data-mascot-motion]')).isVisible(),false);
    await staticResponse(page,item,'Space',`${engine}-${item.context}-reduced-motion`,item.context==='quests');
  }
  await page.emulateMedia({reducedMotion:'no-preference'});await visit(page,h);
  await activate(page,h,'pointer');assert.equal((await reaction(page,h)).length,1);await feedback(page,h);await page.waitForTimeout(1150);await clean(page,h);
  pass(`${engine}: reduced-motion feedback works everywhere and animated input resumes`);
}
async function responsive(page,engine,width) {
  await seedStage(page,500);
  for(const h of hosts) {
    await visit(page,h);await prepareInput(page,h,'Enter');const initial=await dimensions(page,h),before=await protectedState(page);
    await activate(page,h,'Enter',true);await feedback(page,h);await page.waitForTimeout(400);
    const after=await page.locator(select(h,'[data-mascot-tap]')).boundingBox();
    for(const key of ['x','y','width','height'])assert.ok(Math.abs(initial[key]-after[key])<.1,`${engine}/${width}/${h.context}: fixed target ${key}`);
    await page.waitForTimeout(750);await clean(page,h);assert.deepEqual(await protectedState(page),before);
  }
  pass(`${engine}/${width}: all placements retain fixed 44px targets, focus and overflow safety`);
}
(async()=>{
  const engines=(process.env.TAP_BROWSERS||'chromium,webkit').split(',').map(s=>s.trim());
  for(const engine of engines) {
    assert.ok(['chromium','webkit'].includes(engine));
    browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    const x=await fixture();
    try{await matrix(x.page,engine);await interruptionAndPreferences(x.page,engine);x.check();}finally{await x.context.close();}
    for(const width of [320,1440]) {
      const y=await fixture(width);try{await responsive(y.page,engine,width);y.check();}finally{await y.context.close();}
    }
    await browser.close();browser=null;
  }
  console.log('SQ_TAP_COMPLETE '+JSON.stringify({engines,checks:reports.length,hostStageCombinations:hosts.length*stages.length*engines.length,liveProviderRequests:0}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
