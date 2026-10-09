// Real pinned Supabase browser SDK; every provider request is intercepted.
// These synthetic UI/transport checks do not establish provider email delivery.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),pw=require('playwright'),C=require('../account-core.js');
const root=path.resolve(__dirname,'..'),base='https://strikequests.account.fixture.test',provider='https://vjxroixeqhtswzgqfcpk.supabase.co',dir=path.join(root,'test-results/account');
const A='123e4567-e89b-42d3-a456-426614174000',B='123e4567-e89b-42d3-a456-426614174001',at='2026-10-08T12:00:00Z',AUTH='sq_auth_dev_v1';
fs.mkdirSync(dir,{recursive:true});let browser,count=0;
function pass(s){count++;console.log('PASS Account browser:',s);}
const assets=new Set(['/','/index.html','/account-core.js','/account.js','/account.css','/vendor/supabase.js','/mascot.js','/mascot.css','/studio.js','/studio.css','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png','/favicon.ico']);
const person=id=>({id,aud:'authenticated',role:'authenticated',email:(id===A?'a':'b')+'@example.invalid',email_confirmed_at:at,app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:at,updated_at:at});
const jwt=id=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})).toString('base64url'),'SYNTHETIC_SIGNATURE'].join('.');
const session=id=>({access_token:jwt(id),token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'SYNTHETIC_REFRESH_'+id,user:person(id)});
function owner(req){try{return JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;}catch{return null;}}
function database(){return {rows:new Map(),writes:[],reads:0,auth:[],offline:false,expired:false,failRecover:false};}
async function fixture(db,width=390,seed={},options={}){
 const ctx=await browser.newContext({viewport:{width,height:width<600?844:1050},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],unexpected=[];
 await ctx.addInitScript(seed=>{if(!sessionStorage.getItem('account_fixture_seeded')){for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v);sessionStorage.setItem('account_fixture_seeded','1');}sessionStorage.setItem('strikequests_v9_splash_seen','1');},seed);
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(u.origin===provider){
   if(db.offline)return route.abort('internetdisconnected');
   if(u.pathname.startsWith('/auth/v1/')){
    db.auth.push({path:u.pathname,method:req.method()});
    if(u.pathname==='/auth/v1/token'){
     const body=req.postDataJSON()||{};if(body.password==='wrong-password')return json({msg:'Invalid login credentials',error_code:'invalid_credentials'},400);
     return json(session(body.email?.startsWith('b@')?B:A));
    }
    if(u.pathname==='/auth/v1/user'){
     if(db.expired)return json({msg:'Session expired',error_code:'bad_jwt'},401);
     return json(person(owner(req)||A));
    }
    if(u.pathname==='/auth/v1/signup')return json({user:person(A),session:null});
    if(u.pathname==='/auth/v1/recover')return json(db.failRecover?{msg:'Email provider unavailable',error_code:'over_email_send_rate_limit'}:{},db.failRecover?429:200);
    if(u.pathname==='/auth/v1/logout')return json({});
    unexpected.push(u.pathname);return route.abort();
   }
   if(u.pathname==='/rest/v1/sq_sync_records'){
    const id=owner(req);if(!id)return json({message:'No session'},401);
    if(req.method()==='GET'){db.reads++;return json([...db.rows.values()].filter(r=>r.user_id===id));}
    if(req.method()==='POST'){
     const rows=req.postDataJSON();assert.ok(Array.isArray(rows));
     for(const r of rows){
      const prior=db.rows.get(r.user_id+':'+r.kind+':'+r.record_key);
      if(r.user_id!==id||!r.deleted&&!C.valid(r.kind,r.record_key,r.payload)||r.deleted&&r.payload!==null||prior&&(r.revision!==prior.revision+1||r.created_at!==prior.created_at))return json({message:'Sync record identity or revision conflict',code:'23514'},400);
     }
     const received=rows.map(r=>({...r,updated_at:new Date().toISOString()}));for(const r of received)db.rows.set(r.user_id+':'+r.kind+':'+r.record_key,r);db.writes.push(rows);return json(received,201);
    }
    unexpected.push(req.method()+' '+u.pathname);return route.abort();
   }
   unexpected.push(u.pathname);return route.abort();
  }
  if(u.origin!==base){unexpected.push(u.href);return route.abort();}
  if(u.pathname==='/account-config.json')return options.unconfigured?json({},404):json({environment:'development',supabaseUrl:provider,publishableKey:'sb_publishable_SYNTHETIC_FIXTURE_ONLY'});
  if(!assets.has(u.pathname)){unexpected.push(u.href);return route.abort();}
  const f=path.join(root,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(f)]||'text/plain',body:fs.readFileSync(f)});
 });
 await ctx.routeWebSocket('**/*',socket=>{unexpected.push(socket.url());socket.close();});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+(options.callback||''));await p.waitForFunction(()=>!!document.getElementById('sqAccountControls'));
 return {p,ctx,check(){assert.deepEqual(errors,[],'No browser errors');assert.deepEqual(unexpected,[],'No market, tracking or unhandled provider traffic');}};
}
async function panel(p){if(!(await p.locator('#settingsModal').evaluate(e=>e.classList.contains('show'))))await p.locator('#settingsBtn').click();await p.locator('#studioAccounts').evaluate(e=>e.open=true);}
async function signin(p,id=A){await panel(p);await p.locator('#sqOpenSignIn').click();await p.locator('#sqAccountEmail').fill((id===A?'a':'b')+'@example.invalid');await p.locator('#sqAccountPassword').fill('SYNTHETIC_PASSWORD');await p.locator('#sqSignInForm button[type=submit]').click();await p.locator('#sqReviewSync').waitFor();await p.waitForFunction(()=>document.getElementById('sqReviewSync')&&!document.getElementById('sqReviewSync').disabled);}
async function review(p,type='sync'){await panel(p);await p.locator(type==='sync'?'#sqReviewSync':'#sqReviewGuest').click();await p.locator('#sqSyncPreview').waitFor();await p.waitForFunction(()=>!document.getElementById('sqSyncConsent').disabled);}
async function apply(p){await p.locator('#sqSyncConsent').check();await p.locator('#sqApplySync').click();await p.locator('#sqSyncPreview').waitFor({state:'detached'});await p.locator('#sqReviewSync').waitFor();await p.waitForFunction(()=>!document.getElementById('sqReviewSync').disabled);}
const localWatch=p=>p.evaluate(()=>JSON.parse(StrikeAccountCore.store.getItem('sq_watchlist')||'[]'));
async function snap(p,name){await p.locator('#sqSyncTitle').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(dir,name+'.png'),animations:'disabled'});if(process.env.ACCOUNT_LOG_EVIDENCE==='1'){const bytes=await p.screenshot({type:'jpeg',quality:25,animations:'disabled'});assert.ok(bytes.length<180000);console.log('SQ_IMAGE_BEGIN '+JSON.stringify({name:name+'.jpg',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),commit:process.env.REVIEW_HEAD_SHA||'local-review'}));const data=bytes.toString('base64');for(let i=0;i<data.length;i+=160)console.log('SQ_IMAGE_DATA '+data.slice(i,i+160));console.log('SQ_IMAGE_END '+name+'.jpg');}}
async function run(engine){
 const db=database();const guestJournal=JSON.stringify({version:1,entries:[{id:'PRIVATE_JOURNAL_SENTINEL',reason:'PRIVATE_REFLECTION_SENTINEL'}]});
 const guestWatch=JSON.stringify([{symbol:'AAPL',name:'Guest fixture'}]);
 const first=await fixture(db,320,{sq_watchlist:guestWatch,sq_research_checkins_v1:guestJournal,sq_alpha_key:'PRIVATE_PROVIDER_KEY_SENTINEL',sq_next_session:JSON.stringify({reason:'PRIVATE_DRAFT_SENTINEL'}),sq_studio_preferences_v1:JSON.stringify({name:'PRIVATE_LOCAL_NAME',theme:'quiet'})}),p=first.p;
 assert.equal(db.auth.length,0);assert.equal(db.reads,0);assert.equal(db.writes.length,0);pass(engine+' guest start has no provider or sync calls');
 await signin(p);assert.deepEqual(await localWatch(p),[]);assert.equal(db.reads,0);assert.equal(db.writes.length,0);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_research_checkins_v1')),guestJournal);assert.equal(await p.evaluate(()=>StrikeAccountCore.store.getItem('sq_research_checkins_v1')),null);pass(engine+' verified sign-in leaves guest research and journal isolated');
 await review(p,'import');assert.equal(await p.locator('[data-import]:checked').count(),0);assert.equal(await p.locator('#sqApplySync').isDisabled(),true);await p.locator('#sqCancelSync').click();assert.deepEqual(await localWatch(p),[]);assert.equal(db.writes.length,0);pass(engine+' cancel guest import makes no local copies or cloud writes');
 await review(p,'import');await p.locator('.sq-sync-entry').filter({hasText:'Watchlist · AAPL'}).locator('[data-import]').check();await apply(p);assert.equal((await localWatch(p))[0].name,'Guest fixture');assert.equal(db.writes.length,0);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_watchlist')),guestWatch);pass(engine+' selected guest import copies locally without implicit upload');
 await review(p);assert.equal(await p.locator('#sqApplySync').isDisabled(),true);await p.locator('#sqCancelSync').click();assert.equal(db.writes.length,0);pass(engine+' cancel sync preview performs no cloud write');
 await review(p);await snap(p,engine+'-320-sync');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await apply(p);assert.equal(db.writes.length,1);assert.equal(db.writes[0].length,2);assert.deepEqual(db.writes[0].map(r=>r.kind).sort(),['horizon','watchlist']);assert.equal(db.writes[0].find(r=>r.kind==='horizon').record_key,'2y');assert.doesNotMatch(JSON.stringify(db.writes),/PRIVATE_JOURNAL|PRIVATE_REFLECTION|PRIVATE_PROVIDER|PRIVATE_DRAFT|PRIVATE_LOCAL_NAME/);pass(engine+' reviewed sync uploads only eligible selected research at 320px');
 const second=await fixture(db,1440),q=second.p;await signin(q);assert.equal((await localWatch(q)).length,0);await review(q);await apply(q);assert.equal((await localWatch(q))[0].name,'Guest fixture');assert.equal(db.writes.length,1);pass(engine+' second isolated device downloads only after consent');
 await review(q);assert.equal(await q.locator('.sq-sync-entry').count(),0);assert.match(await q.locator('#sqSyncPreview').textContent(),/identical items skipped/);await q.locator('#sqCancelSync').click();assert.equal(db.writes.length,1);pass(engine+' repeat preview skips identical records');
 await p.evaluate(()=>StrikeAccountCore.store.setItem('sq_watchlist',JSON.stringify([{symbol:'AAPL',name:'Device edit'}])));
 const row=db.rows.get(A+':watchlist:AAPL');db.rows.set(A+':watchlist:AAPL',{...row,payload:{symbol:'AAPL',name:'Cloud edit'},revision:2});
 await review(p);await p.locator('#sqSyncConsent').check();assert.equal(await p.locator('#sqApplySync').isDisabled(),true);await snap(p,engine+'-320-conflict');await p.locator('[data-conflict]').selectOption('download');await apply(p);assert.equal((await localWatch(p))[0].name,'Cloud edit');assert.equal(db.writes.length,1);pass(engine+' concurrent versions require a choice and keep-cloud does not overwrite');
 await p.evaluate(()=>StrikeAccountCore.store.setItem('sq_watchlist',JSON.stringify([{symbol:'AAPL',name:'Stale upload'}])));await review(p);
 db.rows.set(A+':watchlist:AAPL',{...db.rows.get(A+':watchlist:AAPL'),payload:{symbol:'AAPL',name:'Race winner'},revision:3});
 await p.locator('#sqSyncConsent').check();await p.locator('#sqApplySync').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('cloud write failed'));
 assert.equal((await localWatch(p))[0].name,'Stale upload');assert.equal(db.writes.length,1);assert.equal(db.rows.get(A+':watchlist:AAPL').payload.name,'Race winner');await p.locator('#sqCancelSync').click();pass(engine+' revision race fails without applying the stale local merge');
 await review(p,'import');await p.locator('.sq-sync-entry').filter({hasText:'Watchlist · AAPL'}).locator('[data-import]').check();await p.locator('#sqSyncConsent').check();await p.evaluate(()=>localStorage.setItem('sq_watchlist',JSON.stringify([{symbol:'AAPL',name:'Changed guest'}])));await p.locator('#sqApplySync').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('Guest research changed'));assert.equal((await localWatch(p))[0].name,'Stale upload');await p.locator('#sqCancelSync').click();pass(engine+' a stale guest preview cannot overwrite local account research');
 await p.locator('#sqContinueGuest').click();await p.locator('#sqOpenSignIn').waitFor();assert.equal(await p.evaluate(()=>StrikeAccountCore.user),null);assert.equal(await p.evaluate(key=>localStorage.getItem(key),AUTH),null);assert.equal(await p.evaluate(()=>localStorage.getItem('sq_research_checkins_v1')),guestJournal);pass(engine+' sign-out returns to preserved guest workspace and clears SDK session');
 await signin(p,B);assert.deepEqual(await localWatch(p),[]);await review(p);assert.equal(await p.locator('.sq-sync-entry').count(),1);assert.match(await p.locator('.sq-sync-entry').textContent(),/Horizon · 2y/);await p.locator('#sqCancelSync').click();assert.equal(db.writes.length,1);pass(engine+' second account cannot see account A local or cloud records');
 await p.locator('#sqContinueGuest').click();await p.locator('#sqOpenSignIn').waitFor();await signin(p,A);assert.equal((await localWatch(p))[0].name,'Stale upload');pass(engine+' account A local work survives sign-out without becoming guest data');
 // Expired verification and offline sign-out never permit a sync write.
 db.expired=true;await p.locator('#sqReviewSync').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('session could not be verified'));assert.equal(db.writes.length,1);assert.equal(await p.locator('#sqSyncPreview').count(),0);db.expired=false;db.offline=true;await p.locator('#sqContinueGuest').click();await p.locator('#sqOpenSignIn').waitFor();assert.equal(await p.evaluate(key=>localStorage.getItem(key),AUTH),null);assert.match(await p.locator('#sqAccountStatus').textContent(),/revocation could not be confirmed/);db.offline=false;pass(engine+' expired session blocks sync; offline sign-out clears this device with honest status');
 await p.locator('#sqOpenSignIn').click();await p.locator('#sqAccountEmail').fill('a@example.invalid');await p.locator('#sqAccountPassword').fill('wrong-password');await p.locator('#sqSignInForm button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('Sign-in failed'));assert.equal(await p.locator('#sqAccountPassword').inputValue(),'');assert.equal(db.writes.length,1);pass(engine+' failed sign-in clears password and leaves research untouched');
 await p.locator('#sqAccountPassword').fill('SYNTHETIC_PASSWORD');await p.locator('#sqSignUp').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('Check your email'));assert.equal(db.writes.length,1);pass(engine+' unconfirmed signup stays guest without copying research');
 db.failRecover=true;await p.locator('#sqRecover').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('Recovery email could not'));db.failRecover=false;await p.locator('#sqRecover').click();await p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('check its email'));assert.equal(db.writes.length,1);pass(engine+' recovery request failure and success never upload research');
 const rec=await fixture(db,390,{[AUTH+'-code-verifier']:JSON.stringify('SYNTHETIC_PKCE_VERIFIER/recovery')},{callback:'/?code=SYNTHETIC_RECOVERY_CODE&recovery=1'});await rec.p.locator('#sqNewPassword').waitFor();await rec.p.waitForFunction(()=>!document.getElementById('sqNewPassword').disabled);assert.equal(await rec.p.evaluate(()=>location.search.includes('code=')),false);await rec.p.locator('#sqNewPassword').fill('SYNTHETIC_NEW_PASSWORD');await rec.p.locator('#sqRecoveryForm button').click();await rec.p.locator('#sqReviewSync').waitFor();assert.ok(db.auth.some(a=>a.path==='/auth/v1/user'&&a.method==='PUT'));assert.equal(db.writes.length,1);pass(engine+' PKCE recovery exchanges code, removes URL credentials and updates password before account entry');
 const original=await rec.p.evaluate(()=>{setMode('demo');setPeriod('1y');$('researchReason').value='SYNTHETIC_SAVED_REASON: review the source before comparing scenarios.';saveCurrent();StrikeAccountCore.store.setItem('sq_studio_preferences_v1',JSON.stringify({name:'PRIVATE_ACCOUNT_NICKNAME',theme:'quiet'}));StrikeAccountCore.store.setItem('sq_research_checkins_v1',JSON.stringify({version:1,entries:[{reason:'PRIVATE_ACCOUNT_REFLECTION'}]}));return {saved:sqHistoryRecords()[0],badges:sqBadges()};});
 await review(rec.p);await apply(rec.p);assert.equal(db.writes.length,2);const uploaded=db.writes[1];for(const kind of ['saved_analysis','appearance','milestone','horizon'])assert.ok(uploaded.some(r=>r.kind===kind));assert.doesNotMatch(JSON.stringify(uploaded),/PRIVATE_ACCOUNT_NICKNAME|PRIVATE_ACCOUNT_REFLECTION/);assert.deepEqual(uploaded.find(r=>r.kind==='saved_analysis').payload,original.saved);pass(engine+' actual app save, source context, appearance and milestones enter only reviewed projections');
 await review(q);await apply(q);const roundtrip=await q.evaluate(()=>({saved:sqHistoryRecords()[0],badges:sqBadges(),prefs:JSON.parse(StrikeAccountCore.store.getItem('sq_studio_preferences_v1')),journal:StrikeAccountCore.store.getItem('sq_research_checkins_v1')}));assert.deepEqual(roundtrip.saved,original.saved);assert.deepEqual(roundtrip.badges,original.badges);assert.equal(roundtrip.prefs.theme,'quiet');assert.equal(roundtrip.prefs.name,undefined);assert.equal(roundtrip.journal,null);pass(engine+' second device preserves saved inputs, source labels and earned dates without private journal or nickname');
 await q.evaluate(()=>removeWatch('AAPL'));await review(q);await apply(q);assert.equal(db.writes.length,3);assert.equal(db.rows.get(A+':watchlist:AAPL').deleted,true);await review(rec.p);await apply(rec.p);assert.equal((await localWatch(rec.p)).length,0);assert.equal(db.writes.length,3);pass(engine+' reviewed tombstone removes the stale device item without reviving it');
 db.rows.set(A+':watchlist:MSFT',{user_id:A,kind:'watchlist',record_key:'MSFT',payload:{symbol:'MSFT',name:'<img src=x onerror="window.__accountInjection=1">',exchange:'<b>FIXTURE</b>',snapshot:null},deleted:false,revision:1,created_at:at,updated_at:at});await review(q);await apply(q);await q.evaluate(()=>{setCompareSelection(['MSFT']);renderWatchlist();renderComparePanel();});assert.equal(await q.locator('#watchlist img,#comparePanel img').count(),0);assert.equal(await q.evaluate(()=>window.__accountInjection||0),0);assert.match(await q.locator('#watchlist').textContent(),/<img src=x/);pass(engine+' imported cloud labels render as text in Watchlist and comparison');
 const none=await fixture(db,390,{}, {unconfigured:true});await panel(none.p);await none.p.locator('#sqOpenSignIn').click();await none.p.waitForFunction(()=>document.getElementById('sqAccountStatus').textContent.includes('not configured here'));assert.equal(await none.p.locator('#sqSignInForm').count(),0);pass(engine+' unavailable configuration keeps guest controls honest');
 first.check();second.check();rec.check();none.check();await first.ctx.close();await second.ctx.close();await rec.ctx.close();await none.ctx.close();
}
(async()=>{for(const engine of ['chromium','webkit']){browser=await pw[engine].launch({headless:true});await run(engine);await browser.close();browser=null;}console.log(count+' synthetic account browser checks passed');})().catch(async e=>{console.error(e.stack);if(browser)await browser.close();process.exitCode=1;});
