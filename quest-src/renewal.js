/* StrikeQuests Quest Renewal. Local cosmetic milestones; never reads a journal or sends data. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else {root.StrikeJourney=factory();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>root.StrikeJourney.mount(),{once:true});else root.StrikeJourney.mount();}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION='10.3.0-quest-review.1';
  const RANKS=Object.freeze(['Spark','Scout','Seeker','Navigator','Analyst','Strategist','Sage','Guardian','Ascendant','Mythic Lumi'].map((name,i)=>Object.freeze({name,index:i,minXp:[0,100,240,430,680,1000,1400,1850,2400,3000][i],formIndex:Math.floor(i/2)})));
  const rows=[
    ['focus2y','2-Year Pathfinder','Scenarios',40,'Review a valid 2-Year scenario with a 10% correction.',f=>f.valid&&f.period==='2y'&&f.correction===10],
    ['assumptions','Assumption Author','Scenarios',50,'Write at least 12 characters of reasoning for a valid scenario, then review it.',f=>f.valid&&f.noteLength>=12],
    ['manualLimits','Honest Unknowns','Evidence',50,'Review what a valid Manual scenario cannot tell you without historical data.',f=>f.valid&&f.mode==='manual'&&!f.hasHistory],
    ['customModel','Model Builder','Scenarios',80,'Review a valid scenario with a positive, non-default divisor.',f=>f.valid&&f.customDivisor],
    ['twoHorizons','Horizon Explorer','Scenarios',80,'Save reasoned snapshots for the same instrument at two different horizons.',f=>f.pairedHorizons],
    ['fiveHorizons','Full Horizon Map','Evidence',160,'Review all five supported historical horizons; unsupported inputs do not count.',f=>f.supportedHorizons===5],
    ['singleYear','Calendar Scout','Seasonality',60,'Select one specific year with actual complete monthly observations, then review it.',f=>f.seasonMode==='specific'&&f.years===1&&f.sample>0],
    ['threeYears','Calendar Explorer','Seasonality',90,'Review a specific selection of at least three years with monthly observations.',f=>f.seasonMode==='specific'&&f.years>=3&&f.sample>0],
    ['decade','Decade Archivist','Seasonality',160,'Review a seasonal sample spanning at least ten observed years.',f=>f.years>=10&&f.sample>=100],
    ['sampleLimits','Sample Skeptic','Seasonality',70,'Review the uncertainty of a current-month sample with one to four observations.',f=>f.monthCount>0&&f.monthCount<5&&f.core.season],
    ['evidenceTriad','Evidence Explorer','Evidence',140,'Explicitly review trend, 52-week range and seasonal sample context.',f=>f.core.trend&&f.core.range&&f.core.season],
    ['provenance','Source Detective','Evidence',80,'Review the source and date of an available historical scenario, including synthetic labels.',f=>f.valid&&f.hasHistory&&f.datedSource],
    ['archive3','Field Notebook','Archive',120,'Keep three distinct valid snapshots with reasoning; duplicate saves do not count.',f=>f.archives>=3],
    ['archive5','Research Shelf','Archive',160,'Keep five distinct valid snapshots with reasoning.',f=>f.archives>=5],
    ['archive10','Research Library','Archive',240,'Keep ten distinct valid snapshots with reasoning.',f=>f.archives>=10],
    ['threeInstruments','Perspective Collector','Archive',120,'Keep reasoned, valid saved research for three different instruments.',f=>f.instruments>=3],
    ['revisit','Thoughtful Return','Reflection',100,'Load a saved note and explicitly mark the original hypothesis reviewed. No journal entry is required.',f=>f.loaded&&f.core.review],
    ['compare3','Three Perspectives','Compare',100,'Review three distinct, usable snapshots selected in Compare.',f=>f.comparing>=3],
    ['etfPair','ETF Explorer','Compare',140,'Review two selected ETF snapshots whose instrument types are known.',f=>f.etfs>=2],
    ['contrast','Assumption Detective','Compare',160,'Compare usable snapshots with different sources, sessions or horizons; review the mismatch.',f=>f.comparing>=2&&f.contrast],
    ['watch3','Watchlist Scout','Compare',100,'Keep three different instruments with valid research snapshots on the Watchlist.',f=>f.watching>=3],
    ['watch5','Watchlist Navigator','Compare',160,'Keep five different instruments with valid research snapshots on the Watchlist.',f=>f.watching>=5],
    ['fullRun','Research Trailblazer','Reflection',220,'Complete all nine original research milestones without trading or repeated-click rewards.',f=>f.coreCount===9],
    ['mastery','Curiosity Champion','Reflection',300,'Review and earn the other 23 expedition badges. Research tools are always available.',(f,e)=>rows.slice(0,-1).every(r=>e[r[0]])]
  ];
  const BADGES=Object.freeze(rows.map(([id,name,category,xp,detail,eligible],i)=>Object.freeze({id,name,category,xp,detail,eligible,icon:['✦','✎','◇','⚙','⌁','✧','▦','▥','◷','?','△','◎','▤','▥','▣','◈','↶','≋','◉','⇄','☆','✶','♜','✺'][i]})));
  const finite=n=>(typeof n==='number'||typeof n==='string')&&String(n).trim()!==''&&Number.isFinite(Number(n));
  const positive=n=>finite(n)&&Number(n)>0;
  function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s.slice(0,10)&&Date.parse(s)<=Date.now()+120000;}
  function record(s){return !!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).sort().join(',')==='at,mode,version'&&s.version===1&&validDate(s.at)&&['demo','manual','auto_eod'].includes(s.mode);}
  function score(earned,base=0){return (Number.isFinite(base)?Math.max(0,Math.min(500,Math.floor(base))):0)+BADGES.reduce((n,b)=>n+(record(earned?.[b.id])?b.xp:0),0);}
  function progress(xp){xp=Number.isFinite(xp)?Math.max(0,Math.floor(xp)):0;const stage=[...RANKS].reverse().find(s=>xp>=s.minXp),next=RANKS[stage.index+1]||null;return {xp,stage,next,fraction:next?(xp-stage.minXp)/(next.minXp-stage.minXp):1,remaining:next?next.minXp-xp:0};}
  function space(user){if(!user)return 'guest';if(typeof user!=='string'||! /^[a-f0-9-]{36}$/i.test(user))throw Error('Account workspace is unavailable.');return user;}
  function key(id,user){if(!BADGES.some(b=>b.id===id))throw Error('Unknown milestone.');return 'sq_journey_v1:'+space(user)+':'+id;}
  function read(storage,user){const earned={},blocked=[];for(const b of BADGES){try{const raw=storage.getItem(key(b.id,user));if(raw!==null){const value=JSON.parse(raw);if(record(value))earned[b.id]=value;else blocked.push(b.id);}}catch{blocked.push(b.id);}}return {earned,blocked};}
  function persist(storage,user,id,value){if(!record(value))throw Error('Unsupported milestone.');const k=key(id,user),prior=storage.getItem(k);if(prior!==null){let parsed;try{parsed=JSON.parse(prior);}catch{throw Error('Existing milestone data is unreadable and was preserved.');}if(!record(parsed))throw Error('Existing milestone data is unsupported and was preserved.');return false;}storage.setItem(k,JSON.stringify(value));return true;}
  function factsOf(input){
    const s=input||{},history=Array.isArray(s.history)?s.history:[],watch=Array.isArray(s.watchlist)?s.watchlist:[],core={};
    for(const id of ['first','trend','range','season','multi','saved','watch','compare','complete','review'])core[id]=validDate(s.badges?.earned?.[id]?.at);
    const validSaved=history.filter(x=>x&&positive(x.price)&&finite(x.perf)&&typeof x.reason==='string'&&x.reason.trim().length>=12&&validDate(x.at));
    const distinct=new Map(validSaved.map(x=>[[x.ticker,x.p||x.period,x.price,x.perf,x.c??x.correction,x.divisor,x.increment].join('|'),x]));
    const saved=[...distinct.values()],groups=new Map();for(const x of saved){if(!groups.has(x.ticker))groups.set(x.ticker,new Set());groups.get(x.ticker).add(x.p||x.period);}
    const good=x=>x&&positive(x.price)&&Number.isFinite(x.perf)&&['low','mid','high'].every(k=>positive(x[k]));
    const usable=watch.filter(x=>good(x?.snapshot)),selection=[...new Set(s.selected||[])],compared=usable.filter(x=>selection.includes(x.symbol));
    const contrasts=new Set(compared.map(x=>[x.snapshot.period,x.snapshot.inputMode,x.snapshot.sourceContext?.source,x.snapshot.sourceContext?.session].join('|')));
    const years=[...new Set(s.season?.usedYears||[])];
    return {valid:!!s.valid,period:s.period,correction:Number(s.correction),mode:s.mode,noteLength:Number(s.noteLength)||0,customDivisor:positive(s.divisor)&&Number(s.divisor)!==Number(s.defaultDivisor),hasHistory:!!s.hasHistory,datedSource:!!s.datedSource,core,coreCount:Object.keys(core).filter(k=>k!=='review'&&core[k]).length,supportedHorizons:new Set((s.badges?.horizons||[]).filter(p=>['3m','6m','1y','2y','3y'].includes(p))).size,pairedHorizons:[...groups.values()].some(v=>v.size>=2),archives:saved.length,instruments:groups.size,loaded:validSaved.some(x=>x.id===s.loadedId),context:[s.symbol,s.price,s.perf,s.divisor,s.increment,s.sourceSession,selection.join(','),years.join(','),[...distinct.keys()].join(';')].join('|'),seasonMode:s.season?.mode,years:years.length,sample:Number(s.season?.totalMonths)||0,monthCount:Number(s.season?.currentMonth?.observations)||0,watching:new Set(usable.map(x=>x.symbol)).size,comparing:new Set(compared.map(x=>x.symbol)).size,etfs:new Set(compared.filter(x=>(s.etfSymbols||[]).includes(x.symbol)).map(x=>x.symbol)).size,contrast:contrasts.size>=2};
  }
  function mount(){
    if(typeof window==='undefined'||!window.StrikeMascot?.createJourney||!document.getElementById('viewHome')||document.body.dataset.questRenewal)return false;
    const $=id=>document.getElementById(id),C=window.StrikeAccountCore,raw=C?.raw||window.localStorage,user=C?.user||null,legacy=window.StrikeMascot;
    const storageKey=space(user),STYLE=/* @JOURNEY_STYLE@ */ '';
    document.body.dataset.questRenewal=VERSION;const css=document.createElement('style');css.id='questRenewalStyle';css.textContent=STYLE;document.head.append(css);
    const baseXp=sqResearchXp;
    window.StrikeMascotLegacy=legacy;window.StrikeMascot=legacy.createJourney();
    sqResearchXp=function(){return score(read(raw,user).earned,baseXp());};
    for(const [context,r] of sqCompanions){r.controller.destroy();r.controller=StrikeMascot.mount(r.host,sqResearchXp(),{idPrefix:'lumi-'+context,context,compact:context!=='quests',guide:sqCompanionGuide(context),static:(C?.store||raw).getItem('sq_companion_paused')==='true',announce:false,onPause:v=>sqCompanionPause(v)});}
    let timer,frame=0,last='',preview=null,trigger=null;
    const section=document.createElement('section');section.className='card quest-expeditions';section.id='questExpeditions';section.setAttribute('aria-labelledby','questExpeditionTitle');
    section.innerHTML='<div class="studio-eyebrow">RESEARCH EXPEDITIONS · OPTIONAL & COSMETIC</div><h2 id="questExpeditionTitle">More discoveries. A longer journey.</h2><p>24 additional badges for thoughtful research, not trades, streaks or repeated taps. Review each requirement before claiming. Synthetic examples count as learning, not market results.</p><p id="questStorageStatus" role="status"></p><div id="questCatalog"></div>';
    $('viewQuests').append(section);
    const ladder=document.createElement('section');ladder.className='card quest-ladder';ladder.id='questLadder';ladder.setAttribute('aria-labelledby','questLadderTitle');ladder.innerHTML='<div class="studio-eyebrow">LUMI’S 10-STAGE EXPEDITION</div><h2 id="questLadderTitle">Curiosity grows over time</h2><p id="questGrowthText"></p><progress id="questGrowthProgress" max="1" aria-label="Progress to Lumi’s next stage"></progress><div id="questStageMap" class="quest-stage-map"></div><p class="quest-note">The longer journey keeps every original XP award and badge date. Your previously unlocked looks remain in the collection below. Each pair of stages shares a body form with a new cosmic crest at the second stage.</p><details><summary>Your original Lumi collection</summary><div id="questLegacyLooks" class="quest-legacy-looks"></div></details>';
    $('viewQuests').prepend(ladder);
    for(const view of ['Home','Research']){const bar=document.createElement('nav');bar.className='quest-fastpath';bar.setAttribute('aria-label',view+' research shortcuts');bar.innerHTML='<button class="btn primary" type="button" data-quest-action="focus">2Y · 10% View</button><button class="btn secondary" type="button" data-quest-action="season">Seasonality</button><button class="btn secondary" type="button" data-quest-action="resume">Continue current ticker</button><button class="btn secondary" type="button" data-quest-action="picks">Quick Picks</button><small class="quest-current-context"></small>';$('view'+view).prepend(bar);}
    const home=document.createElement('section');home.className='card quest-home-growth';home.innerHTML='<div class="studio-eyebrow">YOUR NEXT EVOLUTION</div><h2 id="questHomeStage"></h2><p id="questHomeProgress"></p><progress id="questHomeMeter" max="1" aria-label="Home Lumi evolution progress"></progress><button type="button" class="btn secondary" data-quest-action="journey">Explore stages & badges</button>';const hero=$('viewHome').querySelector('.studio-hero');if(hero)hero.after(home);else $('viewHome').append(home);
    if($('studioHomeTitle'))$('studioHomeTitle').innerHTML='Explore the evidence.<br><em>Grow with Lumi.</em>';
    const news=document.querySelector('dialog[aria-labelledby="studioNewsTitle"]');if(news){const article=document.createElement('article');article.innerHTML='<span class="studio-preview-tag">REVIEW · '+VERSION+'</span><h3>Quest energy. A longer Lumi journey.</h3><p>Blue-and-gold scenario highlights, an explicit 2Y · 10% shortcut, easier Seasonality access, ten slower stages and 24 optional research badges. Existing saved inputs are not reset. New expedition badges stay in this browser and are not included in account sync yet.</p>';news.querySelector('.studio-news-head')?.after(article);}
    const settings=document.createElement('details');settings.className='studio-settings-group';settings.innerHTML='<summary>Quest Renewal & progress privacy</summary><div class="studio-settings-body"><p>Ten stages and 24 expedition badges are cosmetic. Core research is always unlocked. Existing core XP, saved research, account sync and journal backups remain separate and unchanged. New expedition badges are device-local and separated by guest/account workspace; they do not sync yet. Pause Lumi or use your device’s reduced-motion setting for a still presentation.</p><button class="btn secondary" type="button" data-quest-action="journey">Explore the journey</button></div>';$('studioAccounts')?.parentElement?.append(settings);
    const notice=document.createElement('p');notice.id='questReactionNotice';notice.className='quest-reaction-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.body.append(notice);
    const dialog=document.createElement('dialog');dialog.id='questReviewDialog';dialog.setAttribute('aria-labelledby','questReviewTitle');dialog.innerHTML='<h2 id="questReviewTitle"></h2><p id="questReviewText"></p><p id="questReviewStatus" role="status"></p><div class="quest-dialog-actions"><button type="button" class="btn primary" id="questConfirm">Mark reviewed & earn</button><button type="button" class="btn secondary" id="questCancel">Cancel</button></div>';document.body.append(dialog);
    function facts(){return factsOf({valid:!!calc(),period:state.period,correction:state.correction,mode:state.mode,noteLength:($('researchReason')?.value||'').trim().length,divisor:$('divisor')?.value,defaultDivisor:PERIODS[state.period]?.divisor,history:sqHistoryRecords(),watchlist:getWatchlist().map(x=>({...x,snapshot:sqWatchSnapshot(x)})),selected:getCompareSelection(),badges:sqBadges(),loadedId:state.loadedResearchId,symbol:$('ticker').value,price:$('price').value,perf:$('perf').value,increment:$('increment').value,sourceSession:state.dataMeta?.session,hasHistory:!!state.extra?.baselineDate,datedSource:!!state.dataMeta?.source&&!!state.dataMeta?.session,season:state.extra?.seasonality,etfSymbols:LOCAL_SYMBOLS.filter(x=>x.type==='ETF').map(x=>x.symbol)});}
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function animate(kind,text){
      clearTimeout(timer);document.body.dataset.questReaction=kind;notice.textContent=text;
      notice.classList.add('show');timer=setTimeout(()=>{delete document.body.dataset.questReaction;notice.classList.remove('show');notice.textContent='';},1400);
    }
    function refresh(){
      const store=read(raw,user),f=facts(),p=progress(sqResearchXp()),hash=JSON.stringify([store,f,p.xp,state.period,state.correction,$('ticker')?.value]);document.body.dataset.questPaused=String((C?.store||raw).getItem('sq_companion_paused')==='true'||sqCompanionCollapsed);if(hash===last)return;last=hash;
      const label='Stage '+(p.stage.index+1)+' / 10 · '+p.stage.name,text=p.next?p.remaining+' XP to '+p.next.name+' · '+p.xp+' total XP':'Mythic Lumi · all ten stages discovered';
      $('questHomeStage').textContent=label;$('questHomeProgress').textContent=text;$('questGrowthText').textContent=label+' — '+text;$('questHomeMeter').value=p.fraction;$('questGrowthProgress').value=p.fraction;
      document.querySelectorAll('.quest-current-context').forEach(el=>{el.textContent=($('ticker').value||'No ticker')+' · '+PERIODS[state.period].label+' · '+state.correction+'% correction. Navigation preserves this context.';});
      document.querySelectorAll('[data-quest-action="focus"]').forEach(b=>b.setAttribute('aria-pressed',String(state.period==='2y'&&state.correction===10)));
      $('questStorageStatus').textContent=store.blocked.length?'Some expedition progress could not be read safely. It has not been overwritten. Other research and your journal are untouched.':'Expedition badges: '+Object.keys(store.earned).length+' / 24 · stored only in this '+(user?'account’s device workspace.':'guest browser.');
      $('questStageMap').innerHTML=RANKS.map(r=>'<article class="quest-stage '+(r.index===p.stage.index?'current':r.minXp<=p.xp?'unlocked':'locked')+'"'+(r.index===p.stage.index?' aria-current="step"':'')+'><div aria-hidden="true">'+StrikeMascot.renderSvg(r.minXp,{size:84,static:true,idPrefix:'quest-map-'+r.index})+'</div><b>'+String(r.index+1).padStart(2,'0')+' · '+r.name+'</b><small>'+r.minXp+' XP · '+(r.index===p.stage.index?'Current stage':r.minXp<=p.xp?'Discovered':'Future stage')+'</small></article>').join('');
      $('questLegacyLooks').innerHTML=legacy.STAGES.filter(r=>r.minXp<=baseXp()).map(r=>'<div>'+legacy.renderSvg(r.minXp,{size:72,static:true,idPrefix:'quest-legacy-'+r.id})+'<small>'+r.name+'</small></div>').join('');
      $('questCatalog').innerHTML=[...new Set(BADGES.map(b=>b.category))].map(category=>'<h3>'+category+'</h3><div class="quest-badge-grid">'+BADGES.filter(b=>b.category===category).map(b=>{const earned=store.earned[b.id],ready=!store.blocked.length&&!!b.eligible(f,store.earned);return '<article class="quest-badge '+(earned?'earned':ready?'ready':'locked')+'" data-expedition="'+b.id+'"><span class="quest-badge-icon" aria-hidden="true">'+b.icon+'</span><div><b>'+b.name+'</b><span class="quest-badge-xp">'+b.xp+' XP</span><p>'+b.detail+'</p><small>'+ (earned?'Earned '+escape(new Date(earned.at).toLocaleDateString())+' · '+(earned.mode==='demo'?'synthetic practice':earned.mode==='manual'?'manual research':'historical research'):ready?'Ready for your review':'Requirement not yet met')+'</small></div><button class="btn secondary" type="button" data-quest-claim="'+b.id+'" '+(earned||!ready?'disabled':'')+'>'+(earned?'Earned':'Review milestone')+'</button></article>';}).join('')+'</div>').join('');
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;refresh();});}
    function close(){preview=null;dialog.close();trigger?.focus();}
    function open(id){const b=BADGES.find(x=>x.id===id),s=read(raw,user),f=facts();if(!b||s.blocked.length||s.earned[id]||!b.eligible(f,s.earned))return;preview={id,signature:JSON.stringify(f)};trigger=document.activeElement;$('questReviewTitle').textContent=b.name+' · '+b.xp+' XP';$('questReviewText').textContent=b.detail+' Confirm that you have reviewed this research requirement. '+(state.mode==='demo'?'These inputs are a labeled synthetic learning example. ':'')+'This records a local cosmetic milestone, not an investment result.';$('questReviewStatus').textContent='';$('questConfirm').disabled=false;dialog.showModal();$('questCancel').focus();}
    async function confirm(){
      const captured=preview;if(!captured)return;$('questConfirm').disabled=true;
      const operation=()=>{if(preview!==captured)return;const s=read(raw,user),b=BADGES.find(x=>x.id===captured.id),f=facts();if(s.blocked.length||JSON.stringify(f)!==captured.signature||!b.eligible(f,s.earned))throw Error('Research changed. Cancel and review the milestone again.');const fresh=persist(raw,user,b.id,{version:1,at:new Date().toISOString(),mode:state.mode});close();last='';sqRenderBadges();refresh();$('questExpeditionTitle').tabIndex=-1;$('questExpeditionTitle').focus({preventScroll:true});if(fresh)animate('earned','Milestone earned: '+b.name+' · '+b.xp+' XP.');};
      try{if(navigator.locks?.request)await navigator.locks.request('sq-journey-'+storageKey,operation);else operation();}catch{$('questReviewStatus').textContent='Could not safely save this milestone. Existing data was kept. Cancel and retry after checking storage and your research.';$('questConfirm').disabled=false;}
    }
    function action(name){
      if($('settingsModal')?.classList.contains('show'))closeSettings();
      if(name==='focus'){
        const change=state.period!=='2y'||state.correction!==10;
        if(change&&!window.confirm('Set this working scenario to 2-Year and 10% correction? Your ticker and saved records stay unchanged. Manual inputs may need a matching 2-Year historical change.'))return;
        if(state.period!=='2y')setPeriod('2y');if(state.correction!==10)sqSetCorrection(10);sqOpenResearchTool('targets');
      }else if(name==='season'){sqOpenResearchTool('seasonality');animate('season','Lumi is curious: check the selected years and sample limits.');}
      else if(name==='resume')setView('research');
      else if(name==='picks'){setView('research');$('quickPicks')?.scrollIntoView({block:'center'});$('quickPicks')?.querySelector('button')?.focus({preventScroll:true});}
      else if(name==='journey'){setView('quests');$('questLadder').scrollIntoView({block:'start'});}
      schedule();
    }
    document.addEventListener('click',e=>{const target=e.target.closest?.('button');if(!target)return;if(target.dataset.questAction){action(target.dataset.questAction);return;}if(target.dataset.questClaim){open(target.dataset.questClaim);return;}if(target.id==='questCancel'){close();return;}if(target.id==='questConfirm'){void confirm();return;}
      if(['saveBtn','saveNoteBtn','saveResearchNoteBtn'].includes(target.id)){const before=sqHistoryRecords().map(x=>x.id).join('|');setTimeout(()=>{if(before!==sqHistoryRecords().map(x=>x.id).join('|'))animate('saved','Lumi tucked away your research. Saved ideas are not investment outcomes.');schedule();},0);}
      if(target.id==='completeResearchBtn'&&!target.disabled)setTimeout(()=>{if(sqBadges().earned.complete)animate('earned','Research run completed. Curiosity, not trading, earns progress.');},0);
      schedule();
    },true);
    dialog.addEventListener('cancel',()=>{preview=null;});dialog.addEventListener('close',()=>{preview=null;});
    document.addEventListener('input',schedule);document.addEventListener('change',schedule);
    window.addEventListener('storage',e=>{if(e.key?.startsWith('sq_journey_v1:')){last='';sqRenderBadges();schedule();}});
    const originalPause=sqCompanionPause;sqCompanionPause=function(v){originalPause(v);document.body.dataset.questPaused=String(v||sqCompanionCollapsed);schedule();};
    const originalCollapse=sqCompanionCollapse;sqCompanionCollapse=function(v){originalCollapse(v);document.body.dataset.questPaused=String(v||(C?.store||raw).getItem('sq_companion_paused')==='true');schedule();};
    const oldRender=sqRenderBadges;sqRenderBadges=function(...args){const result=oldRender(...args);schedule();return result;};
    sqRenderBadges();refresh();return true;
  }
  return Object.freeze({VERSION,RANKS,BADGES,progress,score,record,read,persist,factsOf,key,mount});
});
