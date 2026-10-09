/* StrikeQuests Research Studio — public preview.
 * Studio UI. Account networking is isolated in account.js; no market provider changes.
 * Existing research state, provenance, privacy modes and journal code remain authoritative.
 */
(function(root, factory) {
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else { root.StrikeStudio=api; api.mount(); }
})(typeof globalThis==='object'?globalThis:this, function(){
  'use strict';
  const VERSION='10.2.0-preview.1';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const price=n=>finite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n):'unavailable';
  const percent=n=>finite(n)?`${n>0?'+':''}${n.toFixed(1)}%`:'unavailable';
  const text=v=>typeof v==='string'?v:'';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function buildBrief(input={}){
    const {result:r,kind='unknown',extra:e={},meta:m={},horizon='selected horizon',month='Current month'}=input;
    const privateValues=kind==='manual'||kind==='unknown';
    const hasTrend=!privateValues&&['Up','Down','Flat'].includes(e.trend1m)&&['Up','Down','Flat'].includes(e.trend3m);
    const hasRange=!privateValues&&finite(r?.p)&&finite(e.low52)&&finite(e.high52)&&e.high52>e.low52;
    const current=!privateValues?e.seasonality?.currentMonth:null;
    const n=finite(current?.observations)?current.observations:0;
    let range='No supported 52-week range is available for these inputs.';
    if(hasRange){const p=(r.p-e.low52)/(e.high52-e.low52)*100;range=p<0?`Reference is below the observed ${price(e.low52)}–${price(e.high52)} range.`:p>100?`Reference is above the observed ${price(e.low52)}–${price(e.high52)} range.`:`Reference is ${Math.round(p)}% of the way from ${price(e.low52)} to ${price(e.high52)}.`;}
    const notes=['These are hypothetical scenarios, not listed option contracts or forecasts.'];
    if(kind==='synthetic')notes.unshift('Synthetic learning example. None of these figures are live market quotes.');
    if(kind==='manual')notes.unshift('User-entered values are unverified; no historical context is inferred from them.');
    if(kind==='unknown')notes.unshift('A usable, identified data snapshot has not been established.');
    if(kind==='stale')notes.unshift('This snapshot is stale or needs date verification. Do not treat it as current.');
    if(!privateValues)notes.push('Price adjustment conventions are inherited from the source; this build does not normalize splits or dividends across providers.');
    if(m.issue)notes.push(text(m.issue).slice(0,800));
    if(n>0&&n<5)notes.push('The selected monthly sample is small; a single year describes that year only.');
    return {notes,items:[
      {id:'trend',label:'Trend context',ready:hasTrend,title:hasTrend?`1M ${e.trend1m.toLowerCase()} · 3M ${e.trend3m.toLowerCase()}`:'History needed',body:hasTrend?'Directions compare reference closes. Alignment does not establish future performance.':'Manual prices alone do not provide one- or three-month trend history.',action:'Inspect trend evidence'},
      {id:'range',label:'Market position',ready:hasRange,title:hasRange?'A location, not a signal':'Range unavailable',body:range,action:'Inspect range evidence'},
      {id:'seasonality',label:'Seasonal sample',ready:n>0,title:n?`${month} · ${n} observation${n===1?'':'s'}`:'Sample unavailable',body:n===1?`Selected-year return: ${percent(current.avgReturn)}. One observation is not a seasonal probability.`:n?`Average ${percent(current.avgReturn)} · median ${percent(current.medianReturn)}. Completed historical months, not a forecast.`:'Choose supported history and calendar years to inspect the sample.',action:'Open seasonality'},
      {id:'scenario',label:'Your scenario',ready:!!r,title:r?`${horizon} · ${Math.round(r.c*100)}% correction`:'Valid inputs needed',body:r?`Low ${price(r.low)} · Mid ${price(r.mid)} · High ${price(r.high)}. Divisor ${r.div}; no correction is applied to High.`:'Enter valid reference, historical change and scenario settings. Missing values are not assumed to be zero.',action:'Inspect the calculation'}
    ]};
  }
  // Plot only the matching, currently displayed history; never fabricate a trend line.
  function seriesFor(raw,meta,symbol,mode,reference,start){
    if(mode==='manual'||!raw||!meta||meta.symbol!==symbol||raw.symbol&&raw.symbol!==symbol)return [];
    if((mode==='demo')!==!!raw.synthetic)return [];
    if(raw.daily?.at(-1)?.date!==meta.session||raw.daily?.at(-1)?.close!==reference)return [];
    if(mode!=='demo'&&(!raw.source||!text(meta.source).includes(raw.source)))return [];
    const rows=(raw.weekly||[]).filter(x=>typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date>=start&&x.date<=meta.session&&finite(x.close)&&x.close>0);
    return rows.length>1&&rows.every((x,i)=>!i||x.date>rows[i-1].date)?rows:[];
  }
  function mount(){
    if(typeof document==='undefined'||!document.getElementById('viewResearch'))return;
    const $=id=>document.getElementById(id);
    const sqLocalStorage=window.StrikeAccountCore?.store||localStorage;
    const ICONS={home:'m3 10 9-7 9 7v10H3Zm5 10v-7h8v7',search:'M20 20l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',season:'M4 6h16v15H4ZM8 3v6m8-6v6M4 11h16M8 15h2m4 0h2m-8 3h2',compare:'M4 18V9m8 9V3m8 15v-6M2 21h20',journal:'M5 3h14v18H5ZM8 8h8m-8 4h8m-8 4h5',star:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9Z',arrow:'M4 12h16m-6-6 6 6-6 6',watch:'M12 21S2 15 2 8c0-6 8-7 10-1 2-6 10-5 10 1 0 7-10 13-10 13',saved:'M6 3h12v18l-6-4-6 4Z',news:'M4 4h16v17H4ZM8 8h8m-8 4h8m-8 4h5',shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-4 9 3 3 5-6',gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'};
    const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name]||ICONS.star}"/></svg>`;
    const storage={read(k,fallback){try{return JSON.parse(sqLocalStorage.getItem(k)||'null')??fallback}catch{return fallback}},write(k,v){try{sqLocalStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}};
    const PREF_KEY='sq_studio_preferences_v1',NEWS_KEY='sq_studio_news_read_v1';
    let pref=storage.read(PREF_KEY,{});if(!pref||typeof pref!=='object'||Array.isArray(pref))pref={};
    pref={name:typeof pref.name==='string'?pref.name.slice(0,32):'',theme:pref.theme==='quiet'?'quiet':'quest'};
    let frame=0,lastArt=-1,settingsTrigger=null,settingsInert=[],newsTrigger=null;
    const home=document.createElement('main');home.id='viewHome';home.className='app-view studio-home';home.setAttribute('aria-labelledby','studioHomeTitle');
    home.innerHTML=`
      <section class="studio-hero">
        <div class="studio-hero-copy"><div class="studio-eyebrow"><span class="studio-orbit-dot"></span> YOUR RESEARCH HEADQUARTERS</div><p class="studio-greeting" id="studioGreeting">Welcome to your next discovery.</p><h2 id="studioHomeTitle">A little curiosity.<br><em>A clearer perspective.</em></h2><p class="studio-hero-description">Explore the evidence. Shape a scenario.<br>Keep the reasoning that matters.</p><button class="btn primary studio-start" data-studio-action="research">Start researching ${icon('arrow')}</button><p class="studio-hero-note">No trades. No pressure. Your own pace.</p></div>
        <button type="button" class="studio-lumi" id="studioLumi" data-studio-action="quests" aria-label="Meet Lumi and view research milestones"><span id="studioLumiArt" aria-hidden="true"></span><span class="studio-lumi-label"><span class="studio-orbit-dot"></span><b id="studioLumiName">Lumi · Rookie</b>${icon('arrow')}</span></button>
      </section>
      <div class="studio-section-head"><h2>Your toolkit</h2><span>Choose a direction</span></div>
      <section class="studio-toolkit" aria-label="Research shortcuts">${[
        ['research','search','Research','Build your scenario'],['seasonality','season','Seasonality','Explore selected years'],['compare','compare','Compare','Put ideas side by side'],['journal','journal','Private journal','Return to your thinking']
      ].map(([a,i,t,s])=>`<button type="button" class="studio-tool" data-studio-action="${a}"><span class="studio-tool-icon">${icon(i)}</span><b>${t}</b><small>${s}</small><span class="studio-tool-arrow">${icon('arrow')}</span></button>`).join('')}</section>
      <div class="studio-home-columns"><div>
        <section class="card studio-continue"><div class="studio-eyebrow">PICK UP THE THREAD</div><h2>Continue your research</h2><div class="studio-resume" id="studioResume"></div><button type="button" class="studio-text-button" data-studio-action="saved">Browse saved ideas ${icon('arrow')}</button></section>
        <section class="card studio-journey"><div class="studio-card-head"><div><div class="studio-eyebrow">PROGRESS WITH PURPOSE</div><h2>Your research journey</h2></div><span id="studioXp" class="studio-gold-chip">0 XP</span></div><p id="studioJourneyText"></p><progress id="studioProgress" max="9" value="0" aria-label="Earned research milestones"></progress><div id="studioBadges" class="studio-badge-preview"></div><button type="button" class="studio-text-button" data-studio-action="quests">Explore your milestones ${icon('arrow')}</button></section>
      </div><div>
        <section class="card studio-source"><div class="studio-card-head"><h2>Behind the numbers</h2>${icon('shield')}</div><span class="studio-source-tag" id="studioSourceTag"></span><dl id="studioSourceList"></dl><p id="studioSourceNote"></p><button type="button" class="studio-text-button" data-studio-action="source">Review data & privacy ${icon('arrow')}</button></section>
        <section class="card studio-new-card"><span class="studio-preview-tag">PUBLIC PREVIEW</span><h2>A fresh space to think.</h2><p>Home, Research Brief and a quieter way to find your tools. Explore what is included in this public preview.</p><button type="button" class="studio-text-button" data-studio-action="news">What’s new ${icon('arrow')}</button></section>
      </div></div>`;
    $('viewResearch').before(home);
    // Five destinations, with Settings consistently available in the header.
    const nav=document.querySelector('.bottom-nav');
    nav.innerHTML=[['home','home','Home'],['research','search','Research'],['watchlist','watch','Watchlist'],['saved','saved','Saved'],['quests','star','Quests']].map(([view,i,label])=>`<button type="button" class="nav-btn" data-view="${view}"><span class="nav-icon">${icon(i)}</span><span>${label}</span></button>`).join('');
    const header=document.querySelector('.top'),actions=document.createElement('div');actions.className='studio-header-actions';
    actions.innerHTML=`<button type="button" class="settings-btn studio-news-button" id="studioNewsBtn" aria-label="What’s new">${icon('news')}<span class="studio-unread" hidden></span></button>`;
    header.append(actions);actions.append($('settingsBtn'));$('settingsBtn').innerHTML=icon('gear');
    const review=document.createElement('span');review.className='studio-review-label';review.textContent='Research Studio · Public preview';header.querySelector('.brand p').replaceWith(review);
    // Give the real research tools a more useful reading order. IDs and listeners are preserved.
    const research=$('viewResearch'),instrument=document.createElement('section');instrument.className='card studio-instrument';instrument.id='studioInstrument';
    instrument.innerHTML=`<div class="studio-instrument-top"><div class="studio-instrument-identity"><span id="studioCompanyMark" class="studio-company-mark" aria-hidden="true">A</span><div><div class="studio-eyebrow" id="studioInstrumentMode"></div><h2 id="studioInstrumentName"></h2><p id="studioInstrumentMeta"></p></div></div><div class="studio-reference"><span>Reference</span><b id="studioReference"></b><small id="studioPriceSession"></small></div></div><div id="studioChart" class="studio-chart"></div><div class="studio-instrument-actions"><button type="button" class="btn primary" data-studio-action="targets">Explore scenarios ${icon('arrow')}</button><button type="button" class="btn secondary" data-studio-action="watch">${icon('watch')} Watchlist</button><button type="button" class="btn secondary" data-studio-action="notes">${icon('journal')} Keep a thought</button></div>`;
    const brief=document.createElement('section');brief.id='studioBrief';brief.className='card studio-brief research-jump';brief.tabIndex=-1;
    brief.innerHTML='<div class="studio-card-head"><div><div class="studio-eyebrow">EVIDENCE, NOT A VERDICT</div><h2>Research Brief</h2></div><span class="studio-source-tag" id="studioBriefSource"></span></div><p class="studio-brief-intro">A plain-language reading of this snapshot. Tap a card to inspect the evidence.</p><div id="studioBriefItems" class="studio-brief-grid"></div><details class="studio-brief-limits"><summary>What this brief cannot establish</summary><ul id="studioBriefLimits"></ul></details>';
    const mission=research.querySelector('.mission-controls'),inputs=research.querySelector('.market-inputs'),learning=research.querySelector('.quest-hero'),quick=research.querySelector('.quick-card');
    research.prepend(instrument);instrument.after(mission);mission.after(inputs);inputs.after(brief);brief.after($('researchContext'));$('researchContext').after($('scenarioSection'));$('scenarioSection').after($('dataQuality'));$('dataQuality').after(learning);learning.after(quick);
    mission.querySelector('.section-title')?.replaceChildren(document.createTextNode('Choose your perspective'));
    const searchRow=mission.querySelector(':scope > .row');if(searchRow){searchRow.classList.add('studio-search-row');instrument.prepend(searchRow);}
    const signal=research.querySelector('.analysis-card .hero');if(signal)signal.classList.add('studio-secondary-price');
    // Settings become grouped sections; provider controls and existing handlers stay intact.
    const sheet=$('settingsModal').querySelector('.sheet');const children=[...sheet.children].slice(1);
    const dataDetails=document.createElement('details');dataDetails.id='studioDataSettings';dataDetails.className='studio-settings-group';dataDetails.open=false;dataDetails.innerHTML='<summary>Market data & privacy</summary><div class="studio-settings-body"></div>';
    const diagnosis=children.find(el=>el.tagName==='DETAILS'&&el.textContent.includes('Diagnostics & validation'));
    children.filter(el=>el!==diagnosis).forEach(el=>dataDetails.lastChild.append(el));sheet.append(dataDetails);
    const personal=document.createElement('details');personal.className='studio-settings-group';personal.id='studioAppearance';
    personal.innerHTML=`<summary>Appearance & personal space</summary><div class="studio-settings-body"><p>Display name stays in this workspace on this device. Appearance theme is eligible for reviewed account sync.</p><label for="studioNickname">Optional display name</label><input id="studioNickname" maxlength="32" autocomplete="off" placeholder="How should we greet you?"><label for="studioTheme">Appearance</label><select id="studioTheme"><option value="quest">Quest · blue & gold</option><option value="quiet">Quiet · reduced visual effects</option></select><button type="button" id="studioSavePreferences" class="btn secondary">Save preferences</button><p id="studioPreferenceStatus" role="status"></p></div>`;
    sheet.append(personal);
    // The account controller enables real email sign-in only with development configuration.
    const account=document.createElement('details');account.className='studio-settings-group';account.id='studioAccounts';
    account.innerHTML=`<summary>Accounts & devices <span class="studio-preview-tag">GUEST</span></summary><div class="studio-settings-body"><p><strong>Continue as guest</strong> is active. Your Watchlist, saved analyses and appearance settings belong to this browser.</p><p>Optional email sign-in connects to the development account service when configured. Guest import and synchronization each require your reviewed consent.</p><p><strong>Private Research Check-in notes remain on-device</strong> even when accounts become available. Use the separate journal export/import controls to transfer them privately.</p><p class="studio-account-status" role="status">Account sign-in is not configured in this review; no personal records have been uploaded.</p></div>`;
    sheet.append(account);
    const access=document.createElement('details');access.className='studio-settings-group';
    access.innerHTML=`<summary>Lumi & accessibility</summary><div class="studio-settings-body"><p>Reduced-motion preferences on your device remain respected. The Home illustration is still; research companions keep their existing motion controls.</p><button type="button" class="btn secondary" id="studioPauseLumi">Pause Lumi animations</button><button type="button" class="btn secondary" id="studioCollapseLumi">Collapse companion panels</button><p id="studioLumiSettingStatus" role="status"></p></div>`;sheet.append(access);
    const privateGroup=document.createElement('details');privateGroup.className='studio-settings-group';
    privateGroup.innerHTML=`<summary>Private research & backups</summary><div class="studio-settings-body"><p>Private check-ins remain local. Journal backups contain private, unencrypted text. They exclude provider keys and are never automatically uploaded.</p><button type="button" class="btn secondary" data-studio-action="backup">Open journal backup</button></div>`;sheet.append(privateGroup);
    const about=document.createElement('details');about.className='studio-settings-group';
    about.innerHTML=`<summary>About & updates</summary><div class="studio-settings-body"><p>StrikeQuests Research Studio ${VERSION}. This public preview includes the Studio experience and private journal backup. Accounts and cloud sync are unavailable on this site. Data entitlements are unchanged.</p><button type="button" class="btn secondary" data-studio-action="news">What’s new in this preview</button></div>`;sheet.append(about);if(diagnosis){diagnosis.classList.add('studio-settings-group');sheet.append(diagnosis);}
    $('settingsModal').setAttribute('role','dialog');$('settingsModal').setAttribute('aria-modal','true');sheet.querySelector('h3').id='studioSettingsHeading';$('settingsModal').setAttribute('aria-labelledby','studioSettingsHeading');$('closeSettings').setAttribute('aria-label','Close settings');
    // Native dialog supplies a top layer, inert background and keyboard containment.
    const news=document.createElement('dialog');news.id='studioNews';news.className='studio-news';news.setAttribute('aria-labelledby','studioNewsTitle');
    news.innerHTML=`<div class="studio-news-head"><div><span class="studio-eyebrow">STRIKEQUESTS</span><h2 id="studioNewsTitle">What’s new</h2></div><button type="button" class="settings-btn" id="studioCloseNews" aria-label="Close what’s new">×</button></div><p class="studio-news-banner">You are exploring the public Research Studio preview. Accounts and cloud sync remain unavailable; your research stays on this device.</p><article><span class="studio-preview-tag">PUBLIC PREVIEW · ${VERSION}</span><h3>Your own research headquarters</h3><p>A Home dashboard, working shortcuts and a return path to your saved ideas.</p><button class="studio-text-button" data-studio-action="home">Explore Home ${icon('arrow')}</button></article><article><span class="studio-preview-tag">INCLUDED · RESEARCH</span><h3>Understand the snapshot</h3><p>A source-aware Research Brief and a matched-history chart. Synthetic, manual, stale and missing data stay explicit.</p><button class="studio-text-button" data-studio-action="brief">Open Research Brief ${icon('arrow')}</button></article><article><span class="studio-preview-tag">INCLUDED · PRIVATE BACKUP</span><h3>A private way to carry your journal</h3><p>Private journal backup is included: preview imports, skip identical records and block conflicts. Notes are never placed in public summaries.</p><button class="studio-text-button" data-studio-action="backup">Review backup controls ${icon('arrow')}</button></article><article><span class="studio-published-tag">RELEASED · 8 OCT 2026 · v10.1.5</span><h3>Research Check-in</h3><p>Compare a saved idea with a prepared current snapshot without rewriting the original. Reflections remain private.</p><button class="studio-text-button" data-studio-action="journal">Open Saved ${icon('arrow')}</button></article><div class="studio-news-footer"><button type="button" class="btn secondary" id="studioMarkNewsRead">Mark these updates read</button><p id="studioNewsStatus" role="status"></p></div>`;document.body.append(news);
    function focusTarget(view,id,detail){setView(view);if(detail)$(detail).open=true;const el=$(id);if(el){if(!el.matches('button,input,select,textarea,a'))el.tabIndex=-1;el.scrollIntoView({block:'center',behavior:'auto'});el.focus({preventScroll:true});}}
    function runAction(action){
      if(news.open){newsTrigger=null;news.close();}if($('settingsModal').classList.contains('show'))closeSettings();
      if(action==='home')setView('home');
      else if(action==='research')focusTarget('research','ticker');
      else if(action==='seasonality')sqOpenResearchTool('seasonality');
      else if(action==='targets')sqOpenResearchTool('targets');
      else if(action==='compare')focusTarget('watchlist','watchlist');
      else if(action==='watch')focusTarget('watchlist','watchlist');
      else if(action==='notes')focusTarget('research','researchReason');
      else if(action==='saved'||action==='journal')focusTarget('saved','history');
      else if(action==='backup')focusTarget('saved','checkinBackupTitle');
      else if(action==='quests')setView('quests');
      else if(action==='brief')focusTarget('research','studioBrief');
      else if(action==='source'){openSettings();dataDetails.open=true;$('studioSettingsHeading').focus();}
      else if(action==='news')openNews();
    }
    function openNews(){newsTrigger=document.activeElement;news.showModal();$('studioCloseNews').focus();}
    function newsBadge(){const unread=storage.read(NEWS_KEY,'')!==VERSION;$('studioNewsBtn').querySelector('.studio-unread').hidden=!unread;$('studioNewsBtn').setAttribute('aria-label',unread?'What’s new · unread preview notes':'What’s new');}
    document.addEventListener('click',e=>{const el=e.target.closest('[data-studio-action]');if(el)runAction(el.dataset.studioAction);const evidence=e.target.closest('[data-studio-evidence]');if(evidence){const id=evidence.dataset.studioEvidence;if(id==='seasonality')sqOpenResearchTool('seasonality');else if(id==='scenario')sqOpenResearchTool('targets');else focusTarget('research',id==='trend'?'reviewTrendEvidence':'reviewRangeEvidence','qualityDetails');}});
    $('studioNewsBtn').addEventListener('click',openNews);$('studioCloseNews').addEventListener('click',()=>news.close());news.addEventListener('close',()=>{if(newsTrigger?.isConnected&&!$('settingsModal').classList.contains('show'))newsTrigger.focus({preventScroll:true});});news.addEventListener('click',e=>{if(e.target===news){const b=news.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)news.close();}});
    $('studioMarkNewsRead').addEventListener('click',()=>{const ok=storage.write(NEWS_KEY,VERSION);$('studioNewsStatus').textContent=ok?'Marked read on this device.':'Could not save. These updates are still marked unread.';newsBadge();});
    $('studioNickname').value=pref.name;$('studioTheme').value=pref.theme;document.body.dataset.studioTheme=pref.theme;
    $('studioSavePreferences').addEventListener('click',()=>{const next={name:$('studioNickname').value.trim().slice(0,32),theme:$('studioTheme').value==='quiet'?'quiet':'quest'};if(storage.write(PREF_KEY,next)){pref=next;document.body.dataset.studioTheme=pref.theme;refresh();$('studioPreferenceStatus').textContent='Saved in this device workspace. Review account sync separately to copy the theme.';}else $('studioPreferenceStatus').textContent='Could not save preferences. Existing settings were kept.';});
    $('studioPauseLumi').addEventListener('click',()=>{const paused=sqLocalStorage.getItem('sq_companion_paused')!=='true';sqCompanionPause(paused);$('studioLumiSettingStatus').textContent=paused?'Lumi animations paused.':'Lumi animations resumed, subject to your device motion preferences.';accessButtons();});
    $('studioCollapseLumi').addEventListener('click',()=>{sqCompanionCollapse(!sqCompanionCollapsed);accessButtons();});
    function accessButtons(){$('studioPauseLumi').textContent=sqLocalStorage.getItem('sq_companion_paused')==='true'?'Resume Lumi animations':'Pause Lumi animations';$('studioCollapseLumi').textContent=sqCompanionCollapsed?'Expand companion panels':'Collapse companion panels';}
    function syncNavigation(view){document.body.dataset.studioView=view;document.querySelectorAll('.nav-btn').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});flushRefresh();}
    const oldSetView=setView;setView=function(view){if(!['home','research','watchlist','saved','quests','settings'].includes(view))return;oldSetView(view);if(view!=='settings')syncNavigation(view);};
    const oldOpen=openSettings,oldClose=closeSettings;
    $('settingsBtn').removeEventListener('click',oldOpen);$('closeSettings').removeEventListener('click',oldClose);
    openSettings=function(){if($('settingsModal').classList.contains('show')){$('studioSettingsHeading').focus();return;}settingsTrigger=document.activeElement;oldOpen();settingsInert=[document.querySelector('.shell'),nav].filter(Boolean).map(el=>[el,el.inert]);settingsInert.forEach(([el])=>{el.inert=true;});document.body.classList.add('studio-modal-open');$('studioSettingsHeading').tabIndex=-1;$('studioSettingsHeading').focus();accessButtons();};
    closeSettings=function(){oldClose();settingsInert.forEach(([el,old])=>{el.inert=old;});settingsInert=[];document.body.classList.remove('studio-modal-open');if(settingsTrigger?.isConnected)settingsTrigger.focus({preventScroll:true});};
    $('settingsBtn').addEventListener('click',()=>openSettings());$('closeSettings').addEventListener('click',()=>closeSettings());
    $('settingsModal').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSettings();return;}if(e.key==='Tab'){const list=[...sheet.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('studioSettingsHeading'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
    function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;refresh();});}
    // Finish pending cards before callers position or focus a destination. A later
    // reflow above that destination must not move it behind the fixed navigation.
    function flushRefresh(){if(frame){cancelAnimationFrame(frame);frame=0;}refresh();}
    const oldRender=render;render=function(){const out=oldRender.apply(this,arguments);schedule();return out;};
    const oldSeason=renderSeasonality;renderSeasonality=function(){const out=oldSeason.apply(this,arguments);schedule();return out;};
    const oldBadges=sqRenderBadges;sqRenderBadges=function(){const out=oldBadges.apply(this,arguments);schedule();return out;};
    const oldHistory=renderHistory;renderHistory=function(){const out=oldHistory.apply(this,arguments);schedule();return out;};
    // Status mutations include request failures without a changed calculation.
    new MutationObserver(schedule).observe($('status'),{childList:true,characterData:true,subtree:true});
    function chart(rows,synthetic){
      if(!rows.length)return '<div class="studio-chart-empty"><span>No matching chart data</span><p>Enter a scenario privately, or load supported history. No trend line is invented.</p></div>';
      const w=740,h=155,pad=14,values=rows.map(x=>x.close),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1;
      const points=rows.map((r,i)=>[pad+i/(rows.length-1)*(w-2*pad),h-pad-(r.close-lo)/span*(h-2*pad)]);
      const path=points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),fill=path+`L${w-pad} ${h}L${pad} ${h}Z`;
      return `<div class="studio-chart-label"><span>${synthetic?'SYNTHETIC WEEKLY EXAMPLE':'WEEKLY CLOSE HISTORY'}</span><span>${rows.length} points · selected horizon</span></div><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${synthetic?'Synthetic example, not market data. ':''}Weekly closes from ${escape(rows[0].date)} to ${escape(rows.at(-1).date)}"><defs><linearGradient id="studioChartFade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#48aefb" stop-opacity=".25"/><stop offset="1" stop-color="#48aefb" stop-opacity="0"/></linearGradient></defs><path d="M0 35H740M0 80H740M0 125H740" class="studio-chart-grid"/><path d="${fill}" fill="url(#studioChartFade)"/><path d="${path}" class="studio-chart-line"/><circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="4" fill="#acdfff"/></svg><div class="studio-chart-dates"><span>${escape(rows[0].date)}</span><span>${escape(rows.at(-1).date)}</span></div>`;
    }
    function refresh(){
      const r=calc(),symbol=$('ticker').value.trim().toUpperCase(),meta=state.dataMeta||{},e=state.extra||{},info=sqSourceInfo(sqProvenance()),synthetic=info.kind==='synthetic';
      const labels={synthetic:'Synthetic example',manual:'Manual · unverified',unknown:'No verified snapshot',stale:'Stale / verify session',eod:'Dated EOD snapshot'};
      const label=labels[info.kind]||labels.unknown;
      document.querySelectorAll('#dataSeg [data-mode]').forEach(button=>{button.classList.toggle('active',button.dataset.mode===state.mode);button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));});
      if(sqPrivate()){$('sharedApiStatus').textContent='Not contacted in '+(state.mode==='demo'?'Demo':'private Manual')+' mode. Selecting Automatic is a separate choice.';$('sharedApiStatus').className='status';}
      $('studioGreeting').textContent=pref.name?`Welcome back, ${pref.name}.`:'Welcome to your next discovery.';
      $('studioSourceTag').textContent=label;$('studioSourceTag').dataset.kind=info.kind;$('studioBriefSource').textContent=label;$('studioBriefSource').dataset.kind=info.kind;
      const retrieval=finite(meta.fetchedAt)?new Date(meta.fetchedAt):null;
      $('studioSourceList').innerHTML=[['Instrument',symbol||'Not selected'],['Data session',meta.session||'Not verified'],['Retrieved',retrieval&&!isNaN(retrieval)?retrieval.toISOString().slice(0,16).replace('T',' ')+' UTC':'Not recorded']].map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
      $('studioSourceNote').textContent=state.mode==='demo'?'Generated learning values. No provider connection.':state.mode==='manual'?'Private inputs. No provider is contacted.':r?'A recorded session is not a live quote. Check source coverage before interpreting.':'No usable dataset is loaded. Service health does not guarantee available market data.';
      const history=sqHistoryRead();
      const latest=history.records[0];
      $('studioResume').innerHTML=history.blocked?'<p>Saved research could not be read safely. Existing records are left untouched.</p>':latest?`<span class="studio-resume-mark">${icon('saved')}</span><div><b>${escape(latest.ticker||'Saved idea')}</b><span>${escape(PERIODS[latest.p]?.label||'Horizon not recorded')} · ${escape(typeof latest.at==='string'?latest.at.slice(0,10):'Date not recorded')}</span><small>Open Saved to choose a record. Your current inputs stay unchanged.</small></div>`:`<span class="studio-resume-mark">${icon('journal')}</span><div><b>Your first idea starts here.</b><span>Save an observation, assumption or question to revisit.</span><small>Notes stay private on this device.</small></div>`;
      const badges=sqBadges(),earned=SQ_CORE.filter(b=>badges.earned[b.id]),xp=sqResearchXp(),stage=StrikeMascot.stageForXp(xp),mission=sqNextMission(badges);
      $('studioXp').textContent=`${xp} XP`;$('studioProgress').value=earned.length;$('studioJourneyText').textContent=`${earned.length} of 9 core milestones · ${mission.title}. No streaks or missed-day penalties.`;
      const preview=earned.length?earned.slice(-3):SQ_CORE.slice(0,3);
      $('studioBadges').innerHTML=preview.map(b=>`<button type="button" class="studio-badge ${badges.earned[b.id]?'is-earned':''}" data-studio-action="quests" aria-label="${escape(b.name)} · ${badges.earned[b.id]?'earned':'not earned'}">${sqBadgeArt(b).replaceAll('sq-art-', 'studio-badge-art-')}<span>${escape(b.name)}</span><small>${badges.earned[b.id]?'Earned':'To discover'}</small></button>`).join('');
      if(xp!==lastArt){$('studioLumiArt').innerHTML=StrikeMascot.renderSvg(xp,{static:true});lastArt=xp;}$('studioLumiName').textContent=`Lumi · ${stage.name}`;
      const m=symbolMeta(symbol);$('studioCompanyMark').textContent=symbol.slice(0,2)||'SQ';$('studioInstrumentMode').textContent=label;$('studioInstrumentName').textContent=symbol||'Choose an instrument';$('studioInstrumentMeta').textContent=m.name===symbol?'Instrument details unavailable':m.name;$('studioReference').textContent=r?price(r.p):'—';$('studioPriceSession').textContent=meta.session?`Session ${meta.session}`:state.mode==='manual'?'User-entered reference':'No recorded session';
      const rows=seriesFor(getAlphaRaw(symbol),meta,symbol,state.mode,r?.p,e.baselineDate||'');$('studioChart').innerHTML=chart(rows,synthetic);
      const briefData=buildBrief({result:r,kind:info.kind,extra:e,meta,horizon:PERIODS[state.period]?.label,month:MONTH_NAMES[new Date().getMonth()]});
      $('studioBriefItems').innerHTML=briefData.items.map((item,i)=>`<button type="button" class="studio-brief-item" data-studio-evidence="${item.id}"><span class="studio-brief-number">0${i+1}</span><span class="studio-brief-label">${escape(item.label)}</span><b>${escape(item.title)}</b><span class="studio-brief-body">${escape(item.body)}</span><span class="studio-brief-link">${escape(item.action)} ${icon('arrow')}</span></button>`).join('');
      $('studioBriefLimits').innerHTML=briefData.notes.map(note=>`<li>${escape(note)}</li>`).join('');
      document.querySelector('.foot').textContent=`StrikeQuests · Research Studio ${VERSION} · public preview · hypothetical scenarios`;
    }
    accessButtons();newsBadge();refresh();setView(['research','watchlist','saved','quests'].includes(location.hash.slice(1))?location.hash.slice(1):'home');
    // Refresh UI preferences from cooperating tabs; never import their private research automatically.
    window.addEventListener('storage',e=>{if(e.key===NEWS_KEY)newsBadge();});
  }
  return Object.freeze({VERSION,buildBrief,seriesFor,mount});
});
