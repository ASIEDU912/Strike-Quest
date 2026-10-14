/* Development review entry: one tool launcher, not duplicate research panels. */
(function(){
  'use strict';
  const actions=document.querySelector('.studio-instrument-actions');
  if(!actions||!window.StrikeEvidence||document.getElementById('sqOpenEvidence'))return;
  const button=document.createElement('button');button.id='sqOpenEvidence';button.type='button';button.className='btn secondary';button.textContent='Evidence Studio';button.onclick=()=>window.StrikeEvidence.open(button);actions.append(button);
  const news=document.getElementById('studioNews');
  if(news){const item=document.createElement('article');item.innerHTML='<span class="studio-preview-tag">PUBLIC PREVIEW · EVIDENCE TOOLS</span><h3>Charts, filings and original research tools</h3><p>Opt-in TradingView display, dated SEC annual fundamentals for six supported companies, and original local basket-overlap calculations. Computed-data licensing review is included; no TickerInside or ETFIQ feed is activated. This is not a new market-price backend.</p><button class="studio-text-button" type="button">Open Evidence Studio →</button>';item.querySelector('button').onclick=()=>{news.close();window.StrikeEvidence.open(document.getElementById('studioNewsBtn'));};news.querySelector('.studio-news-banner')?.after(item);}
})();
