/* StrikeQuests original evidence calculations. No network, browser storage or provider keys. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StrikeEvidenceCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION='1.0.0-review';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  const days=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
  const symbol=x=>typeof x==='string'&&/^[A-Z][A-Z0-9.-]{0,14}$/.test(x)?x:null;
  const cik=x=>/^\d{1,10}$/.test(String(x))&&Number(x)>0?String(x).padStart(10,'0'):null;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TAGS={revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],netIncome:['NetIncomeLoss'],operatingCash:['NetCashProvidedByUsedInOperatingActivities'],capex:['PaymentsToAcquirePropertyPlantAndEquipment'],assets:['Assets'],liabilities:['Liabilities']};
  function filingUrl(id,accn){return cik(id)&&/^\d{10}-\d{2}-\d{6}$/.test(accn||'')?`https://www.sec.gov/Archives/edgar/data/${Number(id)}/${accn.replaceAll('-','')}/${accn}-index.html`:null;}
  function factsFor(raw,key,today){
    const result=[];
    for(const tag of TAGS[key]){
      const list=raw.facts?.['us-gaap']?.[tag]?.units?.USD;
      if(!Array.isArray(list)||list.length>20000)continue;
      for(const f of list){
        if(!f||!finite(f.val)||!date(f.end)||!date(f.filed)||f.end>f.filed||f.filed>today||!['10-K','10-K/A'].includes(f.form)||!filingUrl(raw.cik,f.accn))continue;
        const instant=['assets','liabilities'].includes(key);
        if(instant?f.start!=null:(!date(f.start)||days(f.start,f.end)<330||days(f.start,f.end)>400))continue;
        result.push({key,tag,value:f.val,start:instant?null:f.start,end:f.end,filed:f.filed,form:f.form,accession:f.accn,unit:'USD',source:filingUrl(raw.cik,f.accn)});
      }
    }
    return result;
  }
  // A contradictory value in the same latest filing/context is unavailable, not guessed.
  function select(rows){
    if(!rows.length)return null;
    const sorted=[...rows].sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed)||TAGS[a.key].indexOf(a.tag)-TAGS[b.key].indexOf(b.tag));
    const first=sorted[0],peers=sorted.filter(x=>x.end===first.end&&x.filed===first.filed&&x.tag===first.tag);
    return new Set(peers.map(x=>x.start)).size===1&&new Set(peers.map(x=>x.value)).size===1?first:null;
  }
  function fundamentals(raw,{expectedCik,today=new Date().toISOString().slice(0,10)}={}){
    const id=cik(raw?.cik);
    if(!id||!date(today)||!raw?.facts||typeof raw.facts!=='object'||(expectedCik&&id!==cik(expectedCik)))throw Error('SEC_IDENTITY_OR_SCHEMA_MISMATCH');
    const rows=Object.fromEntries(Object.keys(TAGS).map(k=>[k,factsFor(raw,k,today)]));
    const revenue=select(rows.revenue),anchor=revenue||select(rows.netIncome);
    const aligned=k=>anchor?select(rows[k].filter(f=>f.end===anchor.end&&f.accession===anchor.accession&&(['assets','liabilities'].includes(k)||f.start===anchor.start))):null;
    const facts={revenue,netIncome:aligned('netIncome'),operatingCash:aligned('operatingCash'),capex:aligned('capex'),assets:aligned('assets'),liabilities:aligned('liabilities')};
    const previous=revenue?select(rows.revenue.filter(x=>x.tag===revenue.tag&&days(x.end,revenue.end)>=330&&days(x.end,revenue.end)<=400&&Math.abs(days(x.start,x.end)-days(revenue.start,revenue.end))<=10)):null;
    const derived=[];
    const add=(id,label,value,unit,formula,inputs)=>derived.push({id,label,value:finite(value)?value:null,unit,formula,inputs:inputs.filter(Boolean)});
    add('revenueGrowth','Annual revenue change',previous?.value>0&&revenue?(revenue.value/previous.value-1)*100:null,'percent','(Current annual revenue / prior comparable annual revenue − 1) × 100',[revenue,previous]);
    add('netMargin','Net margin',revenue?.value>0&&facts.netIncome?facts.netIncome.value/revenue.value*100:null,'percent','Net income / revenue × 100; same period and filing',[facts.netIncome,revenue]);
    add('cashAfterCapex','Operating cash less capex',facts.operatingCash&&facts.capex&&facts.capex.value>=0?facts.operatingCash.value-facts.capex.value:null,'USD','Operating cash flow − payments to acquire property, plant and equipment; not all definitions of free cash flow',[facts.operatingCash,facts.capex]);
    add('liabilityShare','Liabilities / assets',facts.assets?.value>0&&facts.liabilities?facts.liabilities.value/facts.assets.value*100:null,'percent','Total liabilities / total assets × 100; same end date and filing; not debt-to-assets',[facts.liabilities,facts.assets]);
    const history=[];
    if(revenue)for(const end of [...new Set(rows.revenue.filter(x=>x.tag===revenue.tag).map(x=>x.end))].sort().slice(-5)){
      const point=select(rows.revenue.filter(x=>x.tag===revenue.tag&&x.end===end));if(point)history.push(point);
    }
    return {version:1,cik:id,entityName:typeof raw.entityName==='string'?raw.entityName.slice(0,200):'Filing entity',asOf:today,period:anchor?{start:anchor.start,end:anchor.end,filed:anchor.filed,form:anchor.form}:null,facts,derived,history,
      limitations:['Annual US-GAAP/USD facts only. No quarterly, trailing-twelve-month or valuation estimates.','Latest available annual disclosures, including amendments; not an as-originally-reported backtest.','Missing, conflicting, custom-tagged or differently dated facts stay unavailable. No ETF look-through company ratios.','Original StrikeQuests calculations, not SEC-produced ratios or investment recommendations.']};
  }
  function parseBasket(input){
    if(typeof input!=='string'||input.length>20000)throw Error('Use at most 200 rows and 20,000 characters.');
    const lines=input.trim().split(/\r?\n/).filter(x=>x.trim());if(!lines.length||lines.length>200)throw Error('Enter 1–200 symbol,weight rows.');
    const rows=[],seen=new Set();let total=0;
    for(const line of lines){const parts=line.split(',').map(x=>x.trim()),s=symbol(parts[0]?.toUpperCase());
      if(parts.length!==2||!s||!/^\d+(?:\.\d+)?$/.test(parts[1]))throw Error('Each row must be SYMBOL,weight_percent. No headers, names or private notes.');
      const weight=Number(parts[1]);if(weight<=0||weight>100||!finite(weight)||seen.has(s))throw Error('Use unique symbols with positive weights up to 100%.');
      seen.add(s);rows.push({symbol:s,weight});total+=weight;
    }
    if(total>100.0000001)throw Error('A basket exceeds 100%. Correct the weights; they are not silently normalized.');
    return {rows,total:Math.min(total,100),complete:Math.abs(total-100)<1e-7};
  }
  function overlap(left,right){
    const a=parseBasket(left),b=parseBasket(right),other=new Map(b.rows.map(x=>[x.symbol,x.weight]));
    const shared=a.rows.filter(x=>other.has(x.symbol)).map(x=>({symbol:x.symbol,a:x.weight,b:other.get(x.symbol),overlap:Math.min(x.weight,other.get(x.symbol))}));
    const value=shared.reduce((s,x)=>s+x.overlap,0);
    return {overlap:value,complete:a.complete&&b.complete,coverageA:a.total,coverageB:b.total,shared:shared.sort((x,y)=>y.overlap-x.overlap),unprovidedA:100-a.total,unprovidedB:100-b.total,formula:'Sum of the smaller weight for each shared symbol. Unprovided holdings are not assumed to be different.',unit:'percentage points of the two baskets',computedBy:'StrikeQuests · local inputs; not verified issuer holdings'};
  }
  function tradingSymbol(value,exchange){const s=symbol(value),map={NASDAQ:'NASDAQ',NYSE:'NYSE',AMEX:'AMEX',NYSEARCA:'AMEX','NYSE ARCA':'AMEX'};return s&&map[exchange]?`${map[exchange]}:${s}`:null;}
  // The official widget runs in an opaque sandbox, not in the app's storage origin.
  function tradingDocument(qualified){
    if(typeof qualified!=='string'||!/^(NASDAQ|NYSE|AMEX):[A-Z][A-Z0-9.-]{0,14}$/.test(qualified))throw Error('Confirm a supported exchange-qualified symbol.');
    const config={autosize:true,symbol:qualified,interval:'D',timezone:'Etc/UTC',theme:'dark',style:'1',locale:'en',allow_symbol_change:false,calendar:false,support_host:'https://www.tradingview.com'};
    const link=`https://www.tradingview.com/symbols/${qualified.replace(':','-')}/`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#101d2d;color:#b8d6eb;font:12px system-ui}a{color:#8bc8ff}.tradingview-widget-container{width:100%;height:100%}.tradingview-widget-container__widget{height:calc(100% - 32px);width:100%}.tradingview-widget-copyright{height:32px;text-align:center;line-height:32px}</style></head><body><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="${link}" rel="noopener noreferrer" target="_blank">${esc(qualified)} chart</a> by <a href="https://www.tradingview.com/" rel="noopener noreferrer" target="_blank">TradingView</a></div><script src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>${JSON.stringify(config)}<\/script></div></body></html>`;
  }
  return Object.freeze({VERSION,date,cik,symbol,filingUrl,fundamentals,parseBasket,overlap,tradingSymbol,tradingDocument});
});
