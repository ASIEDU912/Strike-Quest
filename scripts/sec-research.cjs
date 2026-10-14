/* Keyless SEC relay for the loopback development server, NOT the production Worker. */
'use strict';
const E=require('../research-evidence-core.js');
const INDEX='https://www.sec.gov/files/company_tickers.json';
const TTL=6*60*60*1000;
class SecError extends Error {constructor(code,status){super(code);this.status=status;}}
function createSecService({userAgent=process.env.SEC_USER_AGENT||'',fetchImpl=globalThis.fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  const cache=new Map(),pending=new Map();let queue=Promise.resolve(),nextStart=0,cooldown=0;
  const configured=typeof userAgent==='string'&&userAgent.length<=200&&/^[\x20-\x7e]+$/.test(userAgent)&&/\S+@\S+\.\S+/.test(userAgent);
  async function get(url){
    const old=cache.get(url);if(old&&now()-old.time<TTL)return old.data;
    if(pending.has(url))return pending.get(url);
    const task=queue.catch(()=>{}).then(async()=>{
      if(now()<cooldown)throw new SecError('SEC_RATE_LIMITED',429);
      await sleep(Math.max(0,nextStart-now()));nextStart=now()+600;
      let res;try{res=await fetchImpl(url,{headers:{'User-Agent':userAgent,'Accept':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new SecError('SEC_UNAVAILABLE',502);}
      if(res.status===429||res.status===403){cooldown=now()+60000;throw new SecError(res.status===429?'SEC_RATE_LIMITED':'SEC_ACCESS_LIMITED',res.status);}
      if(!res.ok)throw new SecError(res.status===404?'SEC_FACTS_UNAVAILABLE':'SEC_UNAVAILABLE',res.status===404?404:502);
      if(!/application\/json/i.test(res.headers.get('content-type')||''))throw new SecError('SEC_INVALID_RESPONSE',502);
      if(Number(res.headers.get('content-length'))>16*1024*1024)throw new SecError('SEC_RESPONSE_TOO_LARGE',502);
      const reader=res.body?.getReader();if(!reader)throw new SecError('SEC_INVALID_RESPONSE',502);
      let length=0;const chunks=[];try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16*1024*1024){await reader.cancel();throw new SecError('SEC_RESPONSE_TOO_LARGE',502);}chunks.push(value);}}catch(e){throw e instanceof SecError?e:new SecError('SEC_UNAVAILABLE',502);}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new SecError('SEC_INVALID_RESPONSE',502);}
      cache.set(url,{time:now(),data});while(cache.size>25)cache.delete(cache.keys().next().value);return data;
    });
    pending.set(url,task);queue=task.catch(()=>{});task.finally(()=>pending.delete(url)).catch(()=>{});return task;
  }
  return {configured,async load(symbol){
    if(!E.symbol(symbol))throw new SecError('INVALID_SYMBOL',400);
    if(!configured)throw new SecError('SEC_SETUP_REQUIRED',503);
    const index=await get(INDEX);
    if(!index||typeof index!=='object'||Array.isArray(index))throw new SecError('SEC_INVALID_RESPONSE',502);
    const matches=Object.values(index).filter(x=>x?.ticker===symbol&&E.cik(x.cik_str));
    const ids=[...new Set(matches.map(x=>E.cik(x.cik_str)))];if(ids.length!==1)throw new SecError(ids.length?'SEC_AMBIGUOUS_SYMBOL':'SEC_SYMBOL_UNAVAILABLE',404);
    const id=ids[0],source=`https://data.sec.gov/api/xbrl/companyfacts/CIK${id}.json`,raw=await get(source);
    let model;try{model=E.fundamentals(raw,{expectedCik:id,today:new Date(now()).toISOString().slice(0,10)});}catch{throw new SecError('SEC_IDENTITY_OR_SCHEMA_MISMATCH',502);}
    return {ok:true,symbol,source,retrievedAt:new Date(cache.get(source)?.time||now()).toISOString(),model};
  }};
}
function createSecHandler(options){const service=createSecService(options);return async function(req,res){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  if(req.method!=='GET')return send(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||''))return send(403,{ok:false,error:'LOCAL_DEVELOPMENT_ONLY'});
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{ok:false,error:'ORIGIN_NOT_ALLOWED'});
  if(req.headers['sec-fetch-site']&& !['same-origin','none'].includes(req.headers['sec-fetch-site']))return send(403,{ok:false,error:'ORIGIN_NOT_ALLOWED'});
  let url;try{url=new URL(req.url,`http://${req.headers.host}`);}catch{return send(400,{ok:false,error:'INVALID_REQUEST'});}
  if(url.searchParams.size!==1||!E.symbol(url.searchParams.get('symbol')))return send(400,{ok:false,error:'INVALID_SYMBOL'});
  try{return send(200,await service.load(url.searchParams.get('symbol')));}catch(e){return send(e instanceof SecError?e.status:502,{ok:false,error:e instanceof SecError?e.message:'SEC_UNAVAILABLE'});}
};}
module.exports={createSecService,createSecHandler};
