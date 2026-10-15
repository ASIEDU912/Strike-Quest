/* Synthetic test-only badge seeding. Never loaded by the app or sent to a provider. */
'use strict';
function seed(xp) {
  if(!/\.test$/.test(location.hostname)||!Number.isInteger(xp)||xp<0||xp>3480)throw Error('Isolated fixture and bounded XP required');
  const J=window.StrikeJourney,C=window.StrikeAccountCore,raw=C?.raw||localStorage,user=C?.user||null;
  if(!J||!window.StrikeMascot?.createJourney)throw Error('Ten-stage application must be mounted');
  const items=[...SQ_CORE.map(b=>({id:b.id,xp:ACHIEVEMENTS[b.id].xp,core:true})),...J.BADGES.map(b=>({id:b.id,xp:b.xp,core:false}))];
  const paths=Array(xp+1);paths[0]=[];
  for(const item of items)for(let n=xp;n>=item.xp;n--)if(!paths[n]&&paths[n-item.xp])paths[n]=[...paths[n-item.xp],item];
  if(!paths[xp])throw Error('No distinct valid badge fixture for '+xp);
  // Remove only synthetic journey awards, preserving the application's normal
  // active-horizon record and every unrelated fixture storage key.
  for(const b of J.BADGES)raw.removeItem(J.key(b.id,user));
  const earned={},at='2026-10-07T12:00:00Z';
  for(const item of paths[xp]){
    if(item.core)earned[item.id]={at,mode:'demo',origin:'quest-fixture'};
    else raw.setItem(J.key(item.id,user),JSON.stringify({version:1,at,mode:'demo'}));
  }
  sqBadgeSave({version:1,earned,horizons:sqBadges().horizons});sqRenderBadges();
}
module.exports={seed};
