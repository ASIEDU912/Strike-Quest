'use strict';
const assert=require('node:assert/strict'),{createSecService,createSecHandler}=require('../scripts/sec-research.cjs'),fixture=require('./fixtures/sec-evidence.cjs');
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS SEC relay:',name);};
const userAgent='StrikeQuests Synthetic QA qa@example.invalid';
function mock(extra={}){let time=Date.parse('2026-10-14T12:00:00Z');const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.includes('company_tickers')?{0:{ticker:'AAPL',cik_str:1234,title:'Synthetic QA company'}}:fixture()),{status:200,headers:{'content-type':'application/json'}})};return {calls,options:{userAgent,fetchImpl,now:()=>time,sleep:async ms=>{time+=ms;},...extra}};}
(async()=>{
 await test('unconfigured User-Agent cannot reach SEC',async()=>{const m=mock({userAgent:''});await assert.rejects(()=>createSecService(m.options).load('AAPL'),/SETUP_REQUIRED/);assert.equal(m.calls.length,0);});
 await test('company lookup and facts are a bounded, keyless request',async()=>{const m=mock(),data=await createSecService(m.options).load('AAPL');assert.equal(data.model.cik,'0000001234');assert.equal(m.calls.length,2);assert.equal(m.calls[0].url,'https://www.sec.gov/files/company_tickers.json');assert.ok(m.calls.every(x=>Object.keys(x.options.headers).sort().join(',')==='Accept,User-Agent'));assert.ok(m.calls.every(x=>x.options.redirect==='error'));});
 await test('repeated/concurrent loads share requests and cache only public facts',async()=>{const m=mock(),s=createSecService(m.options);await Promise.all([s.load('AAPL'),s.load('AAPL')]);await s.load('AAPL');assert.equal(m.calls.length,2);});
 await test('invalid symbol never becomes a requested URL',async()=>{const m=mock();await assert.rejects(()=>createSecService(m.options).load('AAPL?apikey=BAD'),/INVALID_SYMBOL/);assert.equal(m.calls.length,0);});
 await test('unknown ticker does not guess a CIK',async()=>{const m=mock();await assert.rejects(()=>createSecService(m.options).load('NVDA'),/SYMBOL_UNAVAILABLE/);assert.equal(m.calls.length,1);});
 await test('mismatched company facts are rejected',async()=>{const m=mock({fetchImpl:async url=>new Response(JSON.stringify(url.includes('company_tickers')?{0:{ticker:'AAPL',cik_str:1234}}:{...fixture(),cik:9999}),{headers:{'content-type':'application/json'}})});await assert.rejects(()=>createSecService(m.options).load('AAPL'),/IDENTITY_OR_SCHEMA/);});
 await test('HTML block page is not parsed as financial data',async()=>{const m=mock({fetchImpl:async()=>new Response('<html>blocked</html>',{headers:{'content-type':'text/html'}})});await assert.rejects(()=>createSecService(m.options).load('AAPL'),/INVALID_RESPONSE/);});
 await test('rate limit sets cooldown rather than retry storm',async()=>{let calls=0;const m=mock({fetchImpl:async()=>{calls++;return new Response('',{status:429});}}),s=createSecService(m.options);await assert.rejects(()=>s.load('AAPL'),/RATE_LIMITED/);await assert.rejects(()=>s.load('AAPL'),/RATE_LIMITED/);assert.equal(calls,1);});
 await test('nonunique ticker mapping fails closed',async()=>{const m=mock({fetchImpl:async()=>new Response(JSON.stringify({0:{ticker:'AAPL',cik_str:1234},1:{ticker:'AAPL',cik_str:9876}}),{headers:{'content-type':'application/json'}})});await assert.rejects(()=>createSecService(m.options).load('AAPL'),/AMBIGUOUS/);});
 async function request(headers,method='GET',url='/research-data/sec?symbol=AAPL'){
   const m=mock(),handler=createSecHandler(m.options),result={headers:{}};await handler({headers,method,url},{setHeader:(k,v)=>result.headers[k]=v,writeHead:n=>result.status=n,end:b=>result.body=JSON.parse(b)});return {result,calls:m.calls};
 }
 await test('same-origin loopback route responds with curated facts',async()=>{const {result}=await request({host:'localhost:3000',origin:'http://localhost:3000','sec-fetch-site':'same-origin'});assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.body.symbol,'AAPL');});
 for(const [headers,method,url] of [[{host:'attacker.example'},'GET'],[{host:'localhost:3000',origin:'https://attacker.example'},'GET'],[{host:'localhost:3000','sec-fetch-site':'cross-site'},'GET'],[{host:'localhost:3000'},'POST'],[{host:'localhost:3000'},'GET','/research-data/sec?symbol=AAPL&url=https://attacker.example']]){
  await test('invalid host/origin/method/extra parameter cannot trigger external fetch',async()=>{const {result,calls}=await request(headers,method,url);assert.ok(result.status>=400);assert.equal(calls.length,0);});
 }
 console.log(`${count} SEC relay checks passed · no live SEC requests`);
})().catch(e=>{console.error(e);process.exitCode=1});
