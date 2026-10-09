'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildBrief,seriesFor,VERSION}=require('../studio.js');
let n=0;function test(name,f){f();console.log('PASS Studio:',name);n++;}
const r={p:200,c:.1,div:1.5,low:216,mid:228,high:240};
const e={trend1m:'Up',trend3m:'Down',low52:100,high52:300,seasonality:{currentMonth:{observations:10,avgReturn:2,medianReturn:1}}};
test('identified historical snapshot gets descriptive, conflicting trends',()=>{const b=buildBrief({result:r,kind:'eod',extra:e});assert.match(b.items[0].title,/1M up · 3M down/);assert.ok(b.items.every(i=>i.ready));});
for(const kind of ['manual','unknown'])test(kind+' never inherits market context',()=>{const b=buildBrief({result:r,kind,extra:e});assert.equal(b.items[0].ready,false);assert.equal(b.items[1].ready,false);assert.equal(b.items[2].ready,false);assert.equal(b.items[3].ready,true);});
test('synthetic values are explicitly labeled',()=>assert.match(buildBrief({result:r,kind:'synthetic',extra:e}).notes.join(' '),/Synthetic learning example/));
test('stale snapshot warning stays separate from calculation',()=>assert.match(buildBrief({result:r,kind:'stale',extra:e}).notes.join(' '),/stale/));
test('missing inputs have no assumed zero scenario',()=>{const b=buildBrief({kind:'manual'});assert.equal(b.items[3].ready,false);assert.match(b.items[3].body,/not assumed to be zero/);});
for(const value of [undefined,NaN,Infinity])test('missing/nonfinite range value is not chart evidence '+value,()=>assert.equal(buildBrief({result:r,kind:'eod',extra:{...e,high52:value}}).items[1].ready,false));
test('reference outside range is not clamped into a signal',()=>{assert.match(buildBrief({result:{...r,p:400},kind:'eod',extra:e}).items[1].body,/above/);assert.match(buildBrief({result:{...r,p:50},kind:'eod',extra:e}).items[1].body,/below/);});
test('one year does not imply a seasonal probability',()=>{const b=buildBrief({result:r,kind:'eod',extra:{...e,seasonality:{currentMonth:{observations:1,avgReturn:10,medianReturn:10}}}});assert.match(b.items[2].body,/One observation is not/);assert.match(b.notes.join(' '),/sample is small/);});
test('zero sample remains unavailable',()=>assert.equal(buildBrief({kind:'eod',extra:{seasonality:{currentMonth:{observations:0}}}}).items[2].ready,false));
test('render brief is not a claim of adjustment normalization',()=>assert.match(buildBrief({kind:'eod'}).notes.join(' '),/does not normalize splits or dividends/));
test('provider-specific uncertainty is retained',()=>assert.match(buildBrief({kind:'eod',meta:{issue:'Weekly baseline is approximate.'}}).notes.join(' '),/baseline is approximate/));
test('pure summary leaves passed research unchanged',()=>{const x={result:r,kind:'eod',extra:e};const before=JSON.stringify(x);buildBrief(x);assert.equal(JSON.stringify(x),before);});
const raw={symbol:'AAPL',source:'Fixture provider',daily:[{date:'2026-10-07',close:200}],weekly:[{date:'2026-09-30',close:180},{date:'2026-10-07',close:200}]};
const meta={symbol:'AAPL',source:'StrikeQuests · Fixture provider',session:'2026-10-07'};
test('matching source/session data can be plotted',()=>assert.equal(seriesFor(raw,meta,'AAPL','auto_eod',200,'2026-09-30').length,2));
for(const [name,fn] of Object.entries({
 'Manual mode':()=>seriesFor(raw,meta,'AAPL','manual',200,''),
 'wrong ticker':()=>seriesFor(raw,meta,'MSFT','auto_eod',200,''),
 'wrong source':()=>seriesFor({...raw,source:'Other'},meta,'AAPL','auto_eod',200,''),
 'missing source':()=>seriesFor({...raw,source:null},meta,'AAPL','auto_eod',200,''),
 'wrong session':()=>seriesFor(raw,{...meta,session:'2026-10-06'},'AAPL','auto_eod',200,''),
 'edited price':()=>seriesFor(raw,meta,'AAPL','auto_eod',201,''),
 'synthetic as provider':()=>seriesFor({...raw,synthetic:true},meta,'AAPL','auto_eod',200,''),
 'provider as demo':()=>seriesFor(raw,meta,'AAPL','demo',200,''),
 'one observation':()=>seriesFor(raw,meta,'AAPL','auto_eod',200,'2026-10-07'),
 'out of order':()=>seriesFor({...raw,weekly:raw.weekly.slice().reverse()},meta,'AAPL','auto_eod',200,'')
}))test(name+' has no invented chart',()=>assert.equal(fn().length,0));
test('explicit matching synthetic example can be drawn',()=>assert.equal(seriesFor({...raw,synthetic:true},meta,'AAPL','demo',200,'').length,2));
test('Studio contains no provider or tracking network call',()=>{const code=fs.readFileSync(path.join(__dirname,'../studio.js'),'utf8');assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/);});
test('accounts remain explicitly guest-only until provider configured',()=>{const code=fs.readFileSync(path.join(__dirname,'../studio.js'),'utf8');assert.match(code,/Account sign-in is not configured in this review/);assert.doesNotMatch(code,/accounts\.google\.com|supabase\.co\/auth\/v1/);});
test('release is explicitly a preview',()=>assert.match(VERSION,/preview/));
console.log(n+' Research Studio logic checks passed');
