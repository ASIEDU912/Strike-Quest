/* Local workspace isolation and typed account sync plans. No network or auth tokens. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {
    root.StrikeAccountCore=api;
    try{api.raw=root.localStorage;api.user=api.raw.getItem(api.ACTIVE);api.user=api.uuid(api.user)?api.user:null;api.store=api.createStore(api.raw,api.user);}catch{api.user=null;}
  }
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ACTIVE='sq_active_account_v1',BASE='sq_sync_base_v1';
  const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
  const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e15;
  const string=(v,n)=>typeof v==='string'&&v.length<=n;
  const symbol=v=>typeof v==='string'&&/^[A-Z0-9.^_-]{1,18}$/.test(v);
  const key=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(v);
  const periods=['3m','6m','1y','2y','3y'];
  const badges=['first','trend','range','season','multi','saved','watch','compare','complete','review'];
  const allowed=(v,ks)=>object(v)&&Object.keys(v).every(k=>ks.includes(k));
  const optional=(v,k,check)=>!own(v,k)||v[k]===null||check(v[k]);
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const timestamp=v=>typeof v==='string'&&v.length<=80&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)&&date(v.slice(0,10))&&Number.isFinite(Date.parse(v));
  function source(v,ticker){
    if(v==null)return true;
    if(!allowed(v,['source','session','fetchedAt','stale','synthetic','symbol','baselineOffset','issue','coverage']))return false;
    if(!optional(v,'source',x=>string(x,160))||!optional(v,'session',date)||!optional(v,'issue',x=>string(x,1000))||!optional(v,'symbol',x=>symbol(x)&&x===ticker))return false;
    if(!['fetchedAt','baselineOffset'].every(k=>optional(v,k,finite))||!['stale','synthetic'].every(k=>optional(v,k,x=>typeof x==='boolean')))return false;
    const c=v.coverage;
    return c==null||allowed(c,['fullRange','monthlyGaps','weeklyGaps','weeklyPoints','monthlyRows'])&&optional(c,'fullRange',x=>typeof x==='boolean')&&['monthlyGaps','weeklyGaps','weeklyPoints','monthlyRows'].every(k=>optional(c,k,finite));
  }
  function historyContext(v){
    return v==null||allowed(v,['baselineDate','baselineClose','trend1m','trend3m','low52','high52','sampleMonths'])&&optional(v,'baselineDate',date)&&['baselineClose','low52','high52','sampleMonths'].every(k=>optional(v,k,finite))&&['trend1m','trend3m'].every(k=>optional(v,k,x=>['Up','Down','Flat'].includes(x)));
  }
  function provenance(v,ticker){return optional(v,'inputMode',x=>['manual','demo','auto_eod'].includes(x))&&optional(v,'savedOrigin',x=>string(x,40))&&source(v.sourceContext,ticker);}
  const snapshotFields=['symbol','price','perf','low','mid','high','period','correction','score','updatedAt','inputMode','savedOrigin','sourceContext','returnPct','high52','low52'];
  const savedFields=['id','ticker','instrument','p','c','correction','price','perf','divisor','increment','low','mid','high','at','reason','inputMode','savedOrigin','sourceContext','researchContext'];
  function valid(kind,k,v){
    if(!object(v)||JSON.stringify(v).length>16384||new TextEncoder().encode(JSON.stringify(v)).length>16384)return false;
    if(kind==='appearance')return k==='appearance'&&allowed(v,['theme'])&&['quest','quiet'].includes(v.theme);
    if(kind==='milestone')return badges.includes(k)&&allowed(v,['id','at','mode','origin'])&&v.id===k&&timestamp(v.at)&&optional(v,'mode',x=>string(x,80))&&optional(v,'origin',x=>string(x,80));
    if(kind==='horizon')return periods.includes(k)&&allowed(v,['period','at'])&&v.period===k&&optional(v,'at',timestamp);
    if(kind==='saved_analysis')return key(k)&&allowed(v,savedFields)&&v.id===k&&symbol(v.ticker)&&optional(v,'instrument',x=>string(x,100))&&optional(v,'p',x=>periods.includes(x))&&optional(v,'at',timestamp)&&optional(v,'reason',x=>string(x,2000))&&['c','correction','price','perf','divisor','increment','low','mid','high'].every(n=>optional(v,n,finite))&&provenance(v,v.ticker)&&historyContext(v.researchContext);
    if(kind==='watchlist'){
      if(!symbol(k)||!allowed(v,['symbol','name','exchange','at','updatedAt','snapshot'])||v.symbol!==k||!optional(v,'name',x=>string(x,160))||!optional(v,'exchange',x=>string(x,80))||!['at','updatedAt'].every(n=>optional(v,n,timestamp)))return false;
      const s=v.snapshot;
      return s==null||allowed(s,snapshotFields)&&optional(s,'symbol',x=>x===k)&&optional(s,'period',x=>periods.includes(x))&&optional(s,'updatedAt',timestamp)&&['price','perf','low','mid','high','correction','score','returnPct','high52','low52'].every(n=>optional(s,n,finite))&&provenance(s,k);
    }
    return false;
  }
  function createStore(raw,user){
    if(user!==null&&!uuid(user))throw Error('Invalid account identity.');
    const prefix=user?'sq_account_v1:'+user+':':'';
    return {getItem:k=>raw.getItem(prefix+k),setItem:(k,v)=>raw.setItem(prefix+k,String(v)),removeItem:k=>raw.removeItem(prefix+k)};
  }
  const storageKeys=['sq_watchlist','splab_history','sq_studio_preferences_v1','sq_badges_v1011'];
  function fingerprint(store){return JSON.stringify(storageKeys.map(k=>store.getItem(k)));}
  function parse(store,k,fallback){const raw=store.getItem(k);if(raw===null)return fallback;try{return JSON.parse(raw);}catch{throw Error('Local research could not be read safely. Nothing was synchronized.');}}
  function secretGuard(v,secrets=[]){
    const text=JSON.stringify(v);
    if(secrets.filter(x=>typeof x==='string'&&x.trim()).some(s=>[s,encodeURIComponent(s),JSON.stringify(s).slice(1,-1)].some(t=>text.includes(t)))||/(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret)[\s"'\\]*[=:][\s"'\\]*[a-z0-9%+./_-]{6,}/i.test(text)||/sb_(?:secret|publishable)_[a-zA-Z0-9_-]{8,}/.test(text))throw Error('Possible credentials were found in eligible research. Remove them before synchronization.');
  }
  function collect(store,secrets=[]){
    const records=new Map();
    const add=(kind,k,payload)=>{
      if(!valid(kind,k,payload))throw Error('An eligible '+kind.replace('_',' ')+' item has unsupported or invalid fields. Existing data was kept.');
      secretGuard(payload,secrets);
      const id=kind+':'+k;if(records.has(id))throw Error('Duplicate record identities need to be resolved before synchronization.');
      records.set(id,{kind,record_key:k,payload});
    };
    const watch=parse(store,'sq_watchlist',[]),saved=parse(store,'splab_history',[]);
    if(!Array.isArray(watch)||!Array.isArray(saved)||watch.length>100||saved.length>100)throw Error('Research exceeds the supported synchronization limit or is malformed.');
    watch.forEach(v=>add('watchlist',v?.symbol,v));
    saved.forEach(v=>{
      // Old saves may contain numeric strings. Canonicalize numbers in the copy only.
      const p=object(v)?JSON.parse(JSON.stringify(v)):v;
      if(object(p)){p.id=String(p.id??'');for(const n of ['c','correction','price','perf','divisor','increment','low','mid','high'])if(typeof p[n]==='string'&&p[n].trim()&&Number.isFinite(Number(p[n])))p[n]=Number(p[n]);}
      add('saved_analysis',p?.id,p);
    });
    const prefs=parse(store,'sq_studio_preferences_v1',null);
    if(prefs!==null){if(!object(prefs)||own(prefs,'theme')&&!['quest','quiet'].includes(prefs.theme))throw Error('Appearance preferences are malformed.');if(own(prefs,'theme'))add('appearance','appearance',{theme:prefs.theme});}
    const b=parse(store,'sq_badges_v1011',null);
    if(b!==null){
      if(!object(b)||b.version!==1||!object(b.earned)||!Array.isArray(b.horizons))throw Error('Research milestones could not be read safely.');
      for(const [id,v]of Object.entries(b.earned)){if(!badges.includes(id))throw Error('An unsupported milestone needs review.');add('milestone',id,{...v,id});}
      for(const p of b.horizons)add('horizon',p,{period:p});
    }
    return records;
  }
  function rowsMap(rows,user){
    if(!Array.isArray(rows)||rows.length>400)throw Error('The account exceeds the supported synchronization limit.');
    const result=new Map();
    for(const r of rows){
      const identity=r?.kind==='watchlist'?symbol(r.record_key):r?.kind==='saved_analysis'?key(r.record_key):r?.kind==='appearance'?r.record_key==='appearance':r?.kind==='milestone'?badges.includes(r.record_key):r?.kind==='horizon'?periods.includes(r.record_key):false;
      if(!object(r)||r.user_id!==user||!identity||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>2147483647||typeof r.deleted!=='boolean'||!timestamp(r.created_at)||!timestamp(r.updated_at)||!(r.deleted?r.payload===null:valid(r.kind,r.record_key,r.payload)))throw Error('The account contains an invalid record. Nothing was synchronized.');
      if(!['watchlist','saved_analysis','appearance','milestone','horizon'].includes(r.kind))throw Error('An unsupported account category was returned.');
      const id=r.kind+':'+r.record_key;if(result.has(id))throw Error('The account returned duplicate identities.');result.set(id,r);
    }
    return result;
  }
  function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}
  const payload=r=>r&&!r.deleted?r.payload:null;
  const equal=(a,b)=>stable(a)===stable(b);
  function plan(local,remote,base){
    const entries=[];let identical=0;
    for(const id of new Set([...local.keys(),...remote.keys(),...base.keys()])){
      const l=local.get(id),r=remote.get(id),b=base.get(id),lv=payload(l),rv=payload(r),bv=payload(b);
      if(equal(lv,rv)){identical++;continue;}
      let action;
      if(!b){action=!l?'download':!r?'upload':'conflict';}
      else {const lc=!equal(lv,bv),rc=!equal(rv,bv);action=lc&&rc?'conflict':lc?'upload':'download';}
      const ref=l||r||b;entries.push({id,kind:ref.kind,record_key:ref.record_key,local:lv,cloud:rv,remote:r||null,action});
    }
    return {entries,identical};
  }
  function resolved(plan,decisions={}){
    return plan.entries.map(e=>{const action=e.action==='conflict'?decisions[e.id]:e.action;if(!['upload','download'].includes(action))throw Error('Choose a version for every conflict before applying.');return {...e,action};});
  }
  function uploadRows(entries,user,now=new Date().toISOString()){
    return entries.filter(e=>e.action==='upload').map(e=>({user_id:user,kind:e.kind,record_key:e.record_key,payload:e.local,deleted:e.local===null,revision:(e.remote?.revision||0)+1,created_at:e.remote?.created_at||now,updated_at:now}));
  }
  function applyLocal(store,changes,baseline){
    // Read once, then atomically roll back local changes on storage failure.
    const watch=parse(store,'sq_watchlist',[]),saved=parse(store,'splab_history',[]),prefs=parse(store,'sq_studio_preferences_v1',{}),b=parse(store,'sq_badges_v1011',{version:1,earned:{},horizons:[]});
    const wm=new Map(watch.map(v=>[v.symbol,v])),sm=new Map(saved.map(v=>[String(v.id),v]));
    let appearance=false,watchChanged=false,savedChanged=false,badgesChanged=false;
    for(const e of changes){
      const v=e.value;
      if(v!==null&&!valid(e.kind,e.record_key,v))throw Error('A local change failed validation.');
      if(e.kind==='watchlist'){watchChanged=true;if(v===null)wm.delete(e.record_key);else wm.set(e.record_key,v);}
      if(e.kind==='saved_analysis'){savedChanged=true;if(v===null)sm.delete(e.record_key);else sm.set(e.record_key,v);}
      if(e.kind==='appearance'){appearance=true;if(v===null)delete prefs.theme;else prefs.theme=v.theme;}
      if(e.kind==='milestone'){badgesChanged=true;if(v===null)delete b.earned[e.record_key];else {const {id,...award}=v;b.earned[id]=award;}}
      if(e.kind==='horizon'){badgesChanged=true;b.horizons=b.horizons.filter(p=>p!==e.record_key);if(v!==null)b.horizons.push(e.record_key);}
    }
    if(wm.size>100||sm.size>100)throw Error('This merge exceeds 100 Watchlist or saved-analysis items. Nothing was applied locally.');
    const next={};
    if(watchChanged)next.sq_watchlist=JSON.stringify([...wm.values()]);
    if(savedChanged)next.splab_history=JSON.stringify([...sm.values()].sort((a,c)=>(Date.parse(c.at)||0)-(Date.parse(a.at)||0)));
    if(appearance)next.sq_studio_preferences_v1=JSON.stringify(prefs);
    if(badgesChanged)next.sq_badges_v1011=JSON.stringify(b);
    if(baseline)next[BASE]=JSON.stringify(baseline);
    const old=Object.fromEntries(Object.keys(next).map(k=>[k,store.getItem(k)]));
    try{for(const [k,v]of Object.entries(next))store.setItem(k,v);}catch(error){for(const [k,v]of Object.entries(old))try{v===null?store.removeItem(k):store.setItem(k,v);}catch{}throw Error('Device storage failed. Review synchronization again; any confirmed cloud writes remain in your account.');}
  }
  function importPlan(guest,local){
    let identical=0;const entries=[];
    for(const [id,r]of guest){const current=local.get(id);if(current&&equal(current.payload,r.payload)){identical++;continue;}entries.push({id,kind:r.kind,record_key:r.record_key,guest:r.payload,local:current?.payload||null,conflict:!!current});}
    return {entries,identical};
  }
  return {ACTIVE,BASE,uuid,createStore,valid,collect,rowsMap,plan,resolved,uploadRows,applyLocal,importPlan,fingerprint,parse,secretGuard,equal};
});
