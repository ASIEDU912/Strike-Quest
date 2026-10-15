/* Adapt retained browser checks to the explicitly approved slower ten-stage model.
 * No production changes. Keep all safety, input, geometry, animation and repeated-
 * award assertions; expand host/stage coverage instead of disabling old tests.
 */
'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const paths=['test/research-guidance-browser.cjs','test/companion-roles-browser.cjs','test/mascot-tap-browser.cjs','test/mascot-motion-browser.cjs','test/companion-roles-motion.cjs'];
const one=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Missing/ambiguous test anchor: '+a.slice(0,100));return s.replace(a,b);};
const all=(s,a,b)=>{if(!s.includes(a))throw Error('Missing test anchor: '+a);return s.replaceAll(a,b);};
const values='[0,100,240,430,680,1000,1400,1850,2400,3000]';
for(const path of paths){
 let s=fs.readFileSync(path,'utf8');
 if(s.includes('quest-renewal-fixture.cjs'))throw Error('Fixture migration already applied; reconcile before retry');
 if(path.endsWith('research-guidance-browser.cjs')){
  s=all(s,'.sq-mascot--rookie','.sq-mascot--journey-0');
  s=one(s,'.sq-mascot--scout','.sq-mascot--journey-0');
  s=one(s,'[data-creature-form="long-eared-juvenile"]','[data-creature-form="round-cub"]');
  s=one(s,"assert.match(await page.locator('#badgeToast').textContent(),/Lumi evolved into Signal Scout/);","assert.match(await page.locator('#badgeToast').textContent(),/Milestone unlocked:/);\n    assert.doesNotMatch(await page.locator('#badgeToast').textContent(),/Lumi evolved/);");
  s=one(s,'first explicit analysis evolves Lumi once','first explicit analysis rewards once without rushing an evolution');
  s=one(s,'[data-creature-form="celestial-winged-fox"]','[data-creature-form="long-eared-juvenile"]');
  s=one(s,"assert.equal(await page.locator('#companionHost .sq-mascot__aura').count(),1);","assert.equal(await page.locator('#companionHost .sq-mascot__aura').count(),0);");
  s=one(s,"assert.equal(await page.locator('#companionHost .sq-mascot__wings').count(),1);","assert.equal(await page.locator('#companionHost .sq-mascot__wings').count(),0);\n    assert.equal(await page.locator('#companionHost .sq-mascot__journey-crest').count(),1);\n    assert.equal(await page.locator('#companionHost .sq-mascot--journey-3').count(),1);");
  s=one(s,'/feathered wings.*five comet tails/','/Long-eared juvenile fox/');
  s=one(s,"assert.equal(await page.locator('#companionHost .sq-companion__progress').evaluate(el=>el.value),1);","assert.ok(Math.abs(await page.locator('#companionHost .sq-companion__progress').evaluate(el=>el.value)-0.28)<0.00001);");
 }else{
  // Restrict replacement to the reviewed seed helper, not arbitrary page actions.
  const start=s.indexOf('async function '+(path.includes('motion')?'stage':'seedStage')+'(page,xp)'),end=s.indexOf('\n}',start);
  if(start<0||end<0)throw Error('Missing stage fixture');
  let f=s.slice(start,end);
  const begin=f.indexOf('await page.evaluate(xp=>{'),finish=f.indexOf('  },xp);',begin);
  if(begin<0||finish<0||!f.slice(begin,finish).includes('SQ_CORE.reduce'))throw Error('Unrecognized fixture');
  f=f.slice(0,begin)+"await page.evaluate(require('./quest-renewal-fixture.cjs').seed,xp);"+f.slice(finish+9);
  s=s.slice(0,start)+f+s.slice(end);
  if(path.endsWith('companion-roles-browser.cjs')||path.endsWith('mascot-tap-browser.cjs')){
   s=one(s,"[[0,'rookie'],[50,'scout'],[150,'ranger'],[375,'keeper'],[500,'voyager']]",values+".map((xp,i)=>[xp,'journey-'+i])");
   s=all(s,'.sq-mascot--rookie','.sq-mascot--journey-0');
   s=all(s,'seedStage(page,500)','seedStage(page,3000)');
   if(path.endsWith('companion-roles-browser.cjs')){
    s=one(s,'assert.equal(max,500);','assert.equal(max,3000);');
    s=one(s,'assert.match(result.toast,/Lumi evolved into Signal Scout/);','assert.match(result.toast,/Milestone unlocked:/);assert.doesNotMatch(result.toast,/Lumi evolved/);');
    s=one(s,'all five stages synchronize through final500','all ten stages synchronize through final3000');
    s=all(s,'390-final500.png','390-final3000.png');
   }else{
    s=all(s,'.sq-mascot--voyager','.sq-mascot--journey-9');
    s=one(s,"h.context==='quests'&&xp===500","h.context==='quests'&&xp===3000");
   }
  }else{
   s=one(s,'[0,50,150,375,500]',values);
   s=all(s,'stage(page,375)','stage(page,1400)');
   if(path.endsWith('mascot-motion-browser.cjs')){
    s=one(s,'xp===375','xp===1400');
    s=one(s,'controller.update(500)','controller.update(3000)');
    s=one(s,'stage(x.page,375)','stage(x.page,1400)');
   }else s=one(s,'xp===500','xp===3000');
   s=all(s,'-375xp','-1400xp');
  }
 }
 fs.writeFileSync(path,s);cp.execFileSync(process.execPath,['--check',path]);
}
fs.appendFileSync('QUEST-RENEWAL-REVIEW.md','\n## Expanded regression expectations\nThe composed app uses ten slower ranks, so the existing five-rank browser fixtures now seed valid core plus expedition awards at all ten boundaries. The initial 50 XP award deliberately remains Spark; 500 XP remains 500 earned points but is Navigator, not the terminal look. Existing checks for privacy, duplicate awards, exact inputs, visible controls, native artwork interactions and zero-motion preferences remain in force. Legacy five-look library unit checks are unchanged.\n');
console.log('Expanded retained browser fixtures to all ten ranks; safety and behavior assertions retained.');
module.exports={paths};
