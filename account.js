/* Optional development accounts. Explicit review is required for every sync write. */
(function(){
  'use strict';
  const C=window.StrikeAccountCore,panel=document.getElementById('studioAccounts');
  if(!C?.store||!panel)return;
  const PROJECT='vjxroixeqhtswzgqfcpk',AUTH_KEY='sq_auth_dev_v1';
  const body=panel.querySelector('.studio-settings-body');
  const shell=document.createElement('div');shell.id='sqAccountControls';body.append(shell);
  let client=null,initPromise=null,user=null,pending=null,epoch=0,busy=false,recovery=false,request=null;
  let message=C.user?'Opening this account’s local workspace. Connecting does not upload research.':'';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const secrets=()=>[C.raw.getItem('sq_alpha_key'),C.raw.getItem('splab_barchart_key'),C.store.getItem('sq_alpha_key'),C.store.getItem('splab_barchart_key'),$('alphaKey')?.value,$('apiKey')?.value];
  const label=e=>e.kind==='appearance'?'Appearance':e.kind==='milestone'?'Milestone · '+e.record_key:e.kind==='horizon'?'Horizon · '+e.record_key:e.kind==='saved_analysis'?'Saved analysis · '+(e.local?.ticker||e.cloud?.ticker||e.guest?.ticker||e.record_key):'Watchlist · '+e.record_key;
  function invalidate(){epoch++;pending=null;request?.abort();request=null;}
  function status(text){message=text;const el=$('sqAccountStatus');if(el)el.textContent=text;}
  function clearAuth(){
    for(let i=C.raw.length-1;i>=0;i--){const k=C.raw.key(i);if(k===AUTH_KEY||k?.startsWith(AUTH_KEY+'-'))C.raw.removeItem(k);}
    C.raw.removeItem(C.ACTIVE);
  }
  function reloadWorkspace(id){
    invalidate();if(id)C.raw.setItem(C.ACTIVE,id);else C.raw.removeItem(C.ACTIVE);
    sessionStorage.setItem('sq_open_account','1');location.reload();
  }
  function render(){
    const account=user?.id||C.user;
    panel.querySelector('.studio-preview-tag').textContent=account?'ACCOUNT · DEV':'GUEST';
    body.querySelector('p').innerHTML=account?'<strong>Local account workspace.</strong> Guest research remains separate. Synchronization runs only when you review and confirm it.':'<strong>Continue as guest</strong> is active. Your Watchlist, saved analyses and appearance settings belong to this browser.';
    const old=body.querySelector('.studio-account-status');if(old)old.hidden=!!client||!!account;
    shell.innerHTML=`<p class="sq-account-status" id="sqAccountStatus" role="status" aria-live="polite">${escape(message)}</p>`;
    if(recovery){
      shell.insertAdjacentHTML('beforeend','<form id="sqRecoveryForm" class="sq-account-form"><h4>Choose a new password</h4><label for="sqNewPassword">New password · at least 8 characters</label><input type="password" id="sqNewPassword" autocomplete="new-password" minlength="8" maxlength="128" required><button class="btn primary" type="submit">Save new password</button></form><button type="button" class="btn secondary" id="sqContinueGuest">Continue as guest</button>');
    }else if(account){
      shell.insertAdjacentHTML('beforeend',`<p>${user?'Signed in as '+escape(user.email||'your account'):'Cached account workspace; verify your session before using cloud records.'}</p><div class="sq-account-actions"><button type="button" class="btn primary" id="sqReviewSync">Review synchronization</button><button type="button" class="btn secondary" id="sqReviewGuest">Review guest import</button><button type="button" class="btn secondary" id="sqContinueGuest">Sign out · continue as guest</button></div><p>Sync includes Watchlist snapshots, saved analyses (including saved reasoning and source details), appearance theme and earned milestones. Private Research Check-in entries, display name, drafts, caches and provider keys stay on this device.</p>`);
    }else if(client){
      shell.insertAdjacentHTML('beforeend','<form id="sqSignInForm" class="sq-account-form"><label for="sqAccountEmail">Email</label><input type="email" id="sqAccountEmail" autocomplete="username" maxlength="254" required><label for="sqAccountPassword">Password</label><input type="password" id="sqAccountPassword" autocomplete="current-password" minlength="8" maxlength="128" required><button class="btn primary" type="submit">Sign in</button><button class="btn secondary" id="sqSignUp" type="button">Create account</button><button class="btn secondary" id="sqRecover" type="button">Send password recovery email</button></form><button class="btn secondary" type="button" id="sqContinueGuest">Continue as guest</button><p>Email confirmation and recovery depend on the development provider’s email limits. Opening sign-in does not upload guest research.</p>');
    }else{
      shell.insertAdjacentHTML('beforeend','<button type="button" class="btn secondary" id="sqOpenSignIn">Open optional sign-in</button>');
    }
    if(pending)renderPreview();
    shell.querySelectorAll('button,input,select').forEach(el=>{el.disabled=busy;});
  }
  function renderPreview(){
    const p=pending,isImport=p.type==='import';
    const box=document.createElement('section');box.className='sq-sync-preview';box.id='sqSyncPreview';box.setAttribute('aria-labelledby','sqSyncTitle');
    box.innerHTML=`<h4 id="sqSyncTitle" tabindex="-1">${isImport?'Review guest import':'Review synchronization'}</h4><p>${isImport?'Select guest items to copy into this account’s local workspace. Guest originals remain on this device. A separate sync review is required to upload them.':'Review the changes between this account’s local workspace and its cloud records. Deletions are included. Nothing has been written yet.'}</p><p>${p.plan.identical} identical items skipped · ${p.plan.entries.length} items to review.</p><div id="sqSyncEntries"></div>`;
    const entries=box.querySelector('#sqSyncEntries');
    p.plan.entries.forEach((e,i)=>{
      const row=document.createElement('div');row.className='sq-sync-entry';
      let control;
      if(isImport)control=`<label><input type="checkbox" data-import="${i}"> ${e.conflict?'Replace the account’s local version with this guest version':'Copy into this account’s local workspace'}</label>`;
      else if(e.action==='conflict')control=`<label for="sqConflict${i}">Both versions differ. Choose explicitly.</label><select id="sqConflict${i}" data-conflict="${i}"><option value="">Choose a version</option><option value="upload">Keep device${e.local===null?' deletion':''} · write to cloud</option><option value="download">Keep cloud${e.cloud===null?' deletion':''} · apply on device</option></select>`;
      else control=`<p>${e.action==='upload'?(e.local===null?'Delete from cloud':'Write device version to cloud'):(e.cloud===null?'Delete from this account’s device workspace':'Copy cloud version to device')}</p>`;
      row.innerHTML=`<strong>${escape(label(e))}</strong>${control}<details><summary>Inspect eligible fields</summary><div class="sq-sync-versions">${isImport?`<p>Guest version</p><pre>${escape(JSON.stringify(e.guest,null,2))}</pre>`:`<p>Device version</p><pre>${escape(e.local===null?'Deleted / absent':JSON.stringify(e.local,null,2))}</pre><p>Cloud version</p><pre>${escape(e.cloud===null?'Deleted / absent':JSON.stringify(e.cloud,null,2))}</pre>`}</div></details>`;entries.append(row);
    });
    box.insertAdjacentHTML('beforeend',`<label class="sq-sync-consent"><input type="checkbox" id="sqSyncConsent"> I reviewed ${isImport?'the selected guest copies':'these changes, including cloud writes and deletions'}, and consent to apply them.</label><div class="sq-account-actions"><button class="btn primary" type="button" id="sqApplySync" disabled>${isImport?'Copy selected guest items':'Apply reviewed synchronization'}</button><button class="btn secondary" type="button" id="sqCancelSync">Cancel</button></div>`);
    shell.append(box);box.addEventListener('change',updateConsent);
    // Buttons are enabled only after explicit consent and all conflict choices.
    function updateConsent(){
      const selected=!isImport||!!box.querySelector('[data-import]:checked');
      const conflicts=[...box.querySelectorAll('[data-conflict]')].every(s=>!!s.value);
      $('sqApplySync').disabled=busy||!$('sqSyncConsent').checked||!selected||!conflicts;
    }
  }
  function focusPreview(){panel.open=true;$('sqSyncTitle')?.focus();}
  async function init(){
    if(client)return client;
    if(initPromise)return initPromise;
    initPromise=(async()=>{
      const r=await fetch('./account-config.json',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok)throw Error('Account sign-in is not configured here. Continue as guest; your local research is available.');
      const config=await r.json();
      if(config.supabaseUrl!==`https://${PROJECT}.supabase.co`||typeof config.publishableKey!=='string'||!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(config.publishableKey)||config.environment!=='development')throw Error('The development account configuration is unavailable.');
      if(!window.StrikeSupabase)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./vendor/supabase.js';script.onload=resolve;script.onerror=()=>reject(Error('Sign-in could not load. Continue as guest or retry when online.'));document.head.append(script);});
      client=window.StrikeSupabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:AUTH_KEY,storage:C.raw,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
      client.auth.onAuthStateChange((event)=>{
        if(event==='PASSWORD_RECOVERY'){invalidate();recovery=true;setTimeout(()=>{message='Recovery session opened. Choose a new password.';render();openPanel();},0);}
        if(event==='SIGNED_OUT'&&C.user)setTimeout(()=>{clearAuth();reloadWorkspace(null);},0);
      });
      await client.auth.getSession();
      // The SDK consumes callback credentials. Remove all auth parameters afterwards.
      const u=new URL(location.href);for(const k of ['code','sb_flow_id','error','error_code','error_description','recovery'])u.searchParams.delete(k);
      if(/access_token|refresh_token|type=recovery/.test(u.hash))u.hash='';history.replaceState(null,'',u.pathname+u.search+u.hash);
      return client;
    })();
    try{return await initPromise;}finally{initPromise=null;}
  }
  async function verify(){
    const api=await init(),{data,error}=await api.auth.getUser();
    if(error||!C.uuid(data?.user?.id))throw Error('Your session could not be verified. Reconnect or sign in again before synchronizing.');
    if(!C.user||data.user.id!==C.user)throw Error('The account changed. Return to guest and sign in again.');
    user=data.user;return user;
  }
  async function signIn(signUp=false){
    const email=$('sqAccountEmail').value.trim(),password=$('sqAccountPassword').value;
    if(!$('sqSignInForm').reportValidity())return;
    $('sqAccountPassword').value='';
    await task(async()=>{
      const api=await init();const response=signUp?await api.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await api.auth.signInWithPassword({email,password});
      if(response.error)throw Error(signUp?'Account creation could not complete. Check provider availability or try signing in.':'Sign-in failed. Check your email and password or use password recovery.');
      if(!response.data.session){status('Check your email for confirmation before signing in. No research was uploaded.');return;}
      const verified=await api.auth.getUser();if(verified.error||!C.uuid(verified.data?.user?.id))throw Error('The session could not be verified. No research was uploaded.');
      reloadWorkspace(verified.data.user.id);
    });
  }
  async function task(fn){
    if(busy)return;busy=true;shell.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
    try{await fn();}catch(e){status(e.message||'The account action could not complete.');}
    finally{busy=false;shell.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);if($('sqApplySync')){$('sqSyncConsent').dispatchEvent(new Event('change',{bubbles:true}));}}
  }
  async function review(type){
    invalidate();await task(async()=>{
      const token=epoch;await verify();if(token!==epoch)throw Error('The account changed. Review again.');
      const local=C.collect(C.store,secrets());
      if(type==='import'){
        const guestStore=C.createStore(C.raw,null),guest=C.collect(guestStore,secrets());
        pending={type,token,localFingerprint:C.fingerprint(C.store),guestFingerprint:C.fingerprint(guestStore),plan:C.importPlan(guest,local)};
      }else{
        request=new AbortController();const {data,error}=await client.from('sq_sync_records').select('user_id,kind,record_key,payload,deleted,revision,created_at,updated_at').eq('user_id',user.id).order('kind').order('record_key').limit(401).abortSignal(request.signal);
        if(error)throw Error('Cloud records could not be read. Device research is unchanged.');
        if(token!==epoch)throw Error('The account changed. Review again.');
        const remote=C.rowsMap(data,user.id);for(const r of remote.values())C.secretGuard(r.payload,secrets());
        const base=C.rowsMap(C.parse(C.store,C.BASE,[]),user.id);
        pending={type,token,localFingerprint:C.fingerprint(C.store),remote,plan:C.plan(local,remote,base)};
      }
      message='Review ready. Private journal entries are excluded.';render();focusPreview();
    });
  }
  function checkPending(p){
    if(p!==pending||p.token!==epoch||C.raw.getItem(C.ACTIVE)!==C.user||p.localFingerprint!==C.fingerprint(C.store))throw Error('The workspace changed since this preview. Cancel and review again.');
    if(p.type==='import'&&p.guestFingerprint!==C.fingerprint(C.createStore(C.raw,null)))throw Error('Guest research changed since this preview. Cancel and review again.');
  }
  async function apply(){
    if(!pending||!$('sqSyncConsent')?.checked||$('sqApplySync').disabled)return;
    const p=pending;
    const selected=[...shell.querySelectorAll('[data-import]:checked')].map(el=>p.plan.entries[Number(el.dataset.import)]);
    const choices=Object.fromEntries([...shell.querySelectorAll('[data-conflict]')].map(el=>[p.plan.entries[Number(el.dataset.conflict)].id,el.value]));
    await task(async()=>{
      checkPending(p);await verify();checkPending(p);
      let changes,baseline;
      if(p.type==='import'){
        if(!selected.length)throw Error('Select guest items before applying.');
        changes=selected.map(e=>({...e,value:e.guest}));
      }else{
        const resolved=C.resolved(p.plan,choices);changes=resolved.filter(e=>e.action==='download').map(e=>({...e,value:e.cloud}));
        const writes=C.uploadRows(resolved,user.id);
        // Verify the local merge and storage bounds before sending cloud writes.
        const temporary=new Map();for(const k of ['sq_watchlist','splab_history','sq_studio_preferences_v1','sq_badges_v1011']){const v=C.store.getItem(k);if(v!==null)temporary.set(k,v);}
        C.applyLocal({getItem:k=>temporary.get(k)??null,setItem:(k,v)=>temporary.set(k,v),removeItem:k=>temporary.delete(k)},changes);
        const next=new Map(p.remote);
        if(writes.length){
          request=new AbortController();
          const {data,error}=await client.from('sq_sync_records').upsert(writes,{onConflict:'user_id,kind,record_key',ignoreDuplicates:false}).select('user_id,kind,record_key,payload,deleted,revision,created_at,updated_at').abortSignal(request.signal);
          if(error)throw Error('The cloud write failed or another device changed a revision. Cancel and review again; nothing was applied locally.');
          const received=C.rowsMap(data,user.id);if(received.size!==writes.length)throw Error('Cloud confirmation was incomplete. Review again before applying locally.');
          for(const [id,r]of received)next.set(id,r);
        }
        baseline=[...next.values()];
      }
      checkPending(p);C.applyLocal(C.store,changes,baseline);pending=null;
      sessionStorage.setItem('sq_account_notice',p.type==='import'?'Selected guest items copied locally. Review synchronization to upload them.':'Reviewed synchronization applied. Private journal entries stayed on this device.');reloadWorkspace(C.user);
    });
  }
  async function guest(){
    invalidate();await task(async()=>{
      let failed=!!C.user&&!client;try{if(client){const {error}=await client.auth.signOut({scope:'local'});failed=!!error;}}catch{failed=true;}
      clearAuth();if(failed)sessionStorage.setItem('sq_account_notice','Signed out on this device. Server session revocation could not be confirmed while offline.');
      if(C.user||recovery)reloadWorkspace(null);else {user=null;recovery=false;message='Guest mode is active. No research was copied or uploaded.';render();}
    });
  }
  function openPanel(){openSettings();panel.open=true;$('sqAccountStatus')?.scrollIntoView({block:'center'});}
  shell.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    const id=button.id;
    if(id==='sqOpenSignIn')task(async()=>{await init();message='Optional development sign-in. Continue as guest at any time.';render();$('sqAccountEmail')?.focus();});
    if(id==='sqSignUp')signIn(true);
    if(id==='sqReviewSync')review('sync');
    if(id==='sqReviewGuest')review('import');
    if(id==='sqApplySync')apply();
    if(id==='sqCancelSync'){invalidate();message='Preview canceled. No preview changes were applied.';render();}
    if(id==='sqContinueGuest')guest();
    if(id==='sqRecover'){
      const email=$('sqAccountEmail').value.trim();if(!$('sqAccountEmail').reportValidity())return;$('sqAccountPassword').value='';
      task(async()=>{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?recovery=1'});if(error)throw Error('Recovery email could not be requested. Try again when the provider is available.');status('If this account is eligible, check its email for the recovery link. Open it in this browser to complete recovery.');});
    }
  });
  shell.addEventListener('submit',e=>{
    e.preventDefault();if(e.target.id==='sqSignInForm')signIn();
    if(e.target.id==='sqRecoveryForm'){
      const password=$('sqNewPassword').value;if(!e.target.reportValidity())return;$('sqNewPassword').value='';
      task(async()=>{const {data,error}=await client.auth.getUser();if(error||!C.uuid(data?.user?.id))throw Error('Recovery session expired. Request a new recovery link.');const response=await client.auth.updateUser({password});if(response.error)throw Error('Password could not be updated. Request a new link or retry.');recovery=false;reloadWorkspace(data.user.id);});
    }
  });
  window.addEventListener('storage',e=>{if(e.key===C.ACTIVE&&e.newValue!==C.user){invalidate();location.reload();}else if(pending)status('Research changed in another tab. Cancel and review again before applying.');});
  const notice=sessionStorage.getItem('sq_account_notice');if(notice){message=notice;sessionStorage.removeItem('sq_account_notice');}
  render();
  if(sessionStorage.getItem('sq_open_account')){sessionStorage.removeItem('sq_open_account');requestAnimationFrame(openPanel);}
  const callback=new URL(location.href).searchParams.has('code')||/type=recovery/.test(location.hash);
  if(C.user||callback)task(async()=>{
    await init();
    if(recovery)return;
    const {data,error}=await client.auth.getUser();
    if(error){message=C.user?'Offline or expired account session. Your local account workspace is available; reconnect before sync.':'The sign-in or recovery link could not be verified. Request a new link or continue as guest.';render();return;}
    if(!C.uuid(data?.user?.id))throw Error('No verified account session is available. Continue as guest.');
    if(!C.user){reloadWorkspace(data.user.id);return;}
    if(data.user.id!==C.user){clearAuth();reloadWorkspace(null);return;}
    user=data.user;message=notice||'Signed in. Review synchronization to read cloud records; sign-in does not upload local data.';render();
  });
})();
