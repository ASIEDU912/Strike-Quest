const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let passed = 0, failed = 0;
let browser;
async function fresh() {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'strikequests.test' && u.pathname === '/') {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('http://strikequests.test/#research');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{localStorage.setItem('sq_provider_pref','auto');state.mode='auto_eod';state.extra={};state.demoRaw=null;state.dataMeta=null;setPeriod('1y');});
  return { page, context };
}
async function test(name, fn) {
  const {page,context} = await fresh();
  try { await fn(page); console.log('PASS', name); passed++; }
  catch(e) { console.error('FAIL',name, e.message); failed++; }
  finally { await context.close(); }
}
const saved = { id: 'saved-test', ticker: 'AAPL', p: '1y', price: 120, perf: 30,
  divisor: 3.5, increment: 0.5, correction: 14, instrument: 'Apple Inc. • AAPL',
  low: 111, mid: 120, high: 129, at: '2026-10-01T12:00:00Z' };
(async()=>{
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}), headless: true });
  await test('saved analysis preserves custom divisor and exact inputs',async page=>{
    const result=await page.evaluate(x=>{localStorage.setItem('splab_history',JSON.stringify([x]));loadSaved(x.id);return {divisor:document.getElementById('divisor').value,price:document.getElementById('price').value,mode:state.mode};},saved);
    assert.equal(Number(result.divisor),3.5); assert.equal(result.price,'120.00'); assert.equal(result.mode,'manual');
  });
  await test('loading saved research never requests fresh market data',async page=>{
    const calls=await page.evaluate(x=>{localStorage.setItem('splab_history',JSON.stringify([x]));localStorage.setItem('splab_barchart_key','TEST_ONLY');let count=0;fetchData=()=>{count++};loadSaved(x.id);return count;},saved);
    assert.equal(calls,0);
  });
  await test('Alpha-only Quick Picks initiate automatic EOD loading',async page=>{
    const calls=await page.evaluate(()=>{localStorage.setItem('sq_alpha_key','TEST_ONLY');let count=0;fetchData=()=>{count++};applySymbol('AAPL');return count;});
    assert.equal(calls,1);
  });
  await test('2026 validation presets still pass',async page=>{
    for(const symbol of ['aapl','xlk']){
      const text=await page.evaluate(s=>{loadPreset(s);return document.getElementById('validation').textContent;},symbol);
      assert.match(text,/validation passes/);
    }
  });
  await test('specific-year seasonality includes only selected calendar years',async page=>{
    const years=await page.evaluate(()=>computeSeasonality([{date:'2024-12-31',close:100},{date:'2025-01-31',close:110},{date:'2025-12-31',close:120},{date:'2026-01-31',close:130}],{mode:'specific',selectedYears:[2025],lookbackYears:2}).usedYears);
    assert.deepEqual(Array.from(years),[2025]);
  });
  await test('older market responses cannot overwrite a newer symbol',async page=>{
    const result=await page.evaluate(async()=>{
      localStorage.setItem('sq_alpha_key','TEST_ONLY');
      const waiting=[];
      window.fetch=url=>new Promise(resolve=>waiting.push({url:String(url),resolve}));
      const row = n=>({'1. open':String(n),'2. high':String(n+1),'3. low':String(n-1),'4. close':String(n),'5. adjusted close':String(n),'6. volume':'10'});
      function release(symbol,price){for(const q of waiting.filter(x=>new URL(x.url).searchParams.get('symbol')===symbol)){
        const f=new URL(q.url).searchParams.get('function');
        const key=f==='TIME_SERIES_DAILY'?'Time Series (Daily)':f==='TIME_SERIES_WEEKLY_ADJUSTED'?'Weekly Adjusted Time Series':'Monthly Adjusted Time Series';
        q.resolve({ok:true,json:async()=>({[key]:{'2025-09-26':row(price-20),'2026-10-01':row(price)}})});
      }}
      document.getElementById('ticker').value='AAPL';const first=fetchData(true);
      document.getElementById('ticker').value='MSFT';const second=fetchData(true);
      release('MSFT',400);await second;release('AAPL',200);await first;
      return {ticker:document.getElementById('ticker').value,price:document.getElementById('price').value, cache:readEodCache()};
    });
    assert.equal(result.ticker,'MSFT'); assert.equal(result.price,'400.00'); assert.equal(result.cache['MSFT|1y'].price,400);
  });
  await test('switching to manual prevents a pending request from overwriting saved values',async page=>{
    const result=await page.evaluate(async x=>{
      localStorage.setItem('sq_alpha_key','TEST_ONLY');localStorage.setItem('splab_history',JSON.stringify([x]));
      const waiting=[];window.fetch=url=>new Promise(resolve=>waiting.push({url:String(url),resolve}));
      document.getElementById('ticker').value='MSFT';const pending=fetchData(true);loadSaved(x.id);
      const row={'1. open':'400','2. high':'401','3. low':'399','4. close':'400','5. adjusted close':'400','6. volume':'10'};
      for(const q of waiting){const f=new URL(q.url).searchParams.get('function');const key=f==='TIME_SERIES_DAILY'?'Time Series (Daily)':f==='TIME_SERIES_WEEKLY_ADJUSTED'?'Weekly Adjusted Time Series':'Monthly Adjusted Time Series';q.resolve({ok:true,json:async()=>({[key]:{'2025-09-26':row,'2026-10-01':row}})})}
      await pending;return {price:document.getElementById('price').value,ticker:document.getElementById('ticker').value,mode:state.mode};
    },saved);
    assert.equal(result.price,'120.00');assert.equal(result.ticker,'AAPL');assert.equal(result.mode,'manual');
  });
  await test('changing horizon invalidates pending market results',async page=>{
    const result=await page.evaluate(async()=>{
      localStorage.setItem('sq_alpha_key','TEST_ONLY');
      document.getElementById('price').value='123';
      const waiting=[];window.fetch=url=>new Promise(resolve=>waiting.push({url:String(url),resolve}));
      const pending=fetchData(true);setPeriod('3m');
      const row={'1. open':'400','2. high':'401','3. low':'399','4. close':'400','5. adjusted close':'400','6. volume':'10'};
      for(const q of waiting){const f=new URL(q.url).searchParams.get('function');const key=f==='TIME_SERIES_DAILY'?'Time Series (Daily)':f==='TIME_SERIES_WEEKLY_ADJUSTED'?'Weekly Adjusted Time Series':'Monthly Adjusted Time Series';q.resolve({ok:true,json:async()=>({[key]:{'2025-09-26':row,'2026-10-01':row}})})}
      await pending;return {price:document.getElementById('price').value,period:state.period,cache:readEodCache()};
    });
    assert.equal(result.price,'123');assert.equal(result.period,'3m');assert.equal(Object.keys(result.cache).length,0);
  });
  await test('late Barchart results cannot replace a newer ticker',async page=>{
    const result=await page.evaluate(async()=>{
      localStorage.setItem('splab_barchart_key','TEST_ONLY');
      const waiting=[];window.fetch=url=>new Promise(resolve=>waiting.push({url:String(url),resolve}));
      const release=(symbol,price)=>{for(const q of waiting.filter(x=>{const p=new URL(x.url).searchParams;return (p.get('symbols')||p.get('symbol'))===symbol})){
        const quote=q.url.includes('getQuoteEod');const results=quote?[{name:symbol,close:price,date:'2026-10-01'}]:[{tradingDay:'2020-01-01',close:price-10,high:price,low:price-20},{tradingDay:'2026-10-01',close:price,high:price+1,low:price-1}];
        q.resolve({ok:true,json:async()=>({status:{code:200},results})});
      }};
      document.getElementById('ticker').value='AAPL';const first=fetchData(true);document.getElementById('ticker').value='MSFT';const second=fetchData(true);
      release('MSFT',400);await second;release('AAPL',200);await first;
      return {ticker:document.getElementById('ticker').value,price:document.getElementById('price').value};
    });
    assert.equal(result.price,'400.00');assert.equal(result.ticker,'MSFT');
  });
  await test('legacy saved correction remains loadable without stale market context',async page=>{
    const result=await page.evaluate(()=>{
      state.extra={high52:999,low52:1,dataProvider:'Other ticker'};
      localStorage.setItem('splab_history',JSON.stringify([{id:'legacy',ticker:'AAPL',p:'1y',price:100,perf:10,c:12}]));
      loadSaved('legacy');return {correction:document.getElementById('correction').value,divisor:document.getElementById('divisor').value,hasOldRange:'high52' in state.extra};
    });
    assert.equal(Number(result.correction),12);assert.equal(Number(result.divisor),2);assert.equal(result.hasOldRange,false);
  });
  await test('repeated requests keep the newest result in both visible and raw caches',async page=>{
    const result=await page.evaluate(async()=>{
      localStorage.setItem('sq_alpha_key','TEST_ONLY');document.getElementById('ticker').value='AAPL';
      const waiting=[];window.fetch=url=>new Promise(resolve=>waiting.push({url:String(url),resolve}));
      const first=fetchData(true);const second=fetchData(true);
      const release=(batch,price)=>{for(const q of batch){const f=new URL(q.url).searchParams.get('function');const key=f==='TIME_SERIES_DAILY'?'Time Series (Daily)':f==='TIME_SERIES_WEEKLY_ADJUSTED'?'Weekly Adjusted Time Series':'Monthly Adjusted Time Series';const row={'1. open':String(price),'2. high':String(price+1),'3. low':String(price-1),'4. close':String(price),'5. adjusted close':String(price),'6. volume':'10'};q.resolve({ok:true,json:async()=>({[key]:{'2025-09-26':row,'2026-10-01':row}})});}};
      release(waiting.slice(3),400);await second;release(waiting.slice(0,3),200);await first;
      return {price:document.getElementById('price').value,rawPrice:getAlphaRaw('AAPL').daily.at(-1).close,snapshotPrice:readEodCache()['AAPL|1y'].price};
    });
    assert.equal(result.price,'400.00');assert.equal(result.rawPrice,400);assert.equal(result.snapshotPrice,400);
  });
  await browser.close();console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
