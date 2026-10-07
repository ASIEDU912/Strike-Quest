// Minimal DOM adapter for controller state tests. This is not browser or layout QA.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let scheduled=0,cleared=0,timerCallback=null;
const context={module:{exports:{}},setTimeout:(fn,delay)=>{assert.ok([1000,1500].includes(delay));scheduled++;timerCallback=fn;return scheduled;},clearTimeout:()=>{cleared++;}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/../mascot.js`,'utf8'),context);
const M=context.module.exports;
function node(){const classes=new Set(),attrs=new Map();return {innerHTML:'',textContent:'',value:0,classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(c,b)=>b?classes.add(c):classes.delete(c)},setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k)};}
const selectors=['.sq-companion','.sq-mascot','.sq-companion__art','h3','.sq-companion__ability','.sq-companion__progress-copy','progress','.sq-companion__status','.sq-companion__feedback','.sq-companion__tap-status'];
const nodes=new Map(selectors.map(s=>[s,node()]));const button=node();button.closest=selector=>selector==='[data-mascot-motion]'?button:null;nodes.set('[data-mascot-motion]',button);for(const s of ['.sq-companion__guide','.sq-companion__guide-title','.sq-companion__guide-text','[data-mascot-action]'])nodes.set(s,node());
const tap=node();tap.closest=selector=>selector==='[data-mascot-tap]'?tap:null;nodes.set('[data-mascot-tap]',tap);
const listeners=new Map();
let rootWrites=0;
const container={set innerHTML(html){this.html=html;rootWrites++;},get innerHTML(){return this.html;},querySelector:s=>nodes.get(s),contains:n=>n===button||n===tap,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:(k,v)=>{assert.equal(listeners.get(k),v);listeners.delete(k);}};
const controller=M.mount(container,0,{static:true,idPrefix:'test'});
assert(container.innerHTML.includes('sq-mascot--paused'));
assert.equal(scheduled,0,'Initial mount must not celebrate');
controller.update(0);assert.equal(rootWrites,1);assert.equal(scheduled,0);
listeners.get('click')({target:button});assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.textContent,'Pause motion');assert.equal(button.getAttribute('aria-label'),'Pause companion animation');assert.equal(nodes.get('.sq-mascot').classList.contains('sq-mascot--static'),false);
controller.update(25);assert.equal(scheduled,1);assert(nodes.get('.sq-companion__art').innerHTML.includes('sq-mascot--earn'));assert.equal(nodes.get('.sq-companion__status').textContent,'25 research XP earned.');
controller.update(25);assert.equal(scheduled,1,'Repeated render cannot farm animation or announcements');
controller.update(50);assert.equal(scheduled,2);assert(nodes.get('.sq-companion__art').innerHTML.includes('sq-mascot--levelup'));assert(nodes.get('.sq-companion__status').textContent.includes('Signal Scout'));
timerCallback();assert(nodes.get('.sq-mascot').classList.contains('sq-mascot--idle'));
listeners.get('click')({target:button});assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(button.textContent,'Resume motion');assert.equal(button.getAttribute('aria-label'),'Resume companion animation');assert(nodes.get('.sq-mascot').classList.contains('sq-mascot--static'));
controller.update(150);assert(nodes.get('.sq-companion__art').innerHTML.includes('sq-mascot--static'),'Pause survives a stage change');
listeners.get('click')({target:button});assert.equal(nodes.get('.sq-mascot').classList.contains('sq-mascot--static'),false,'Resuming after update must remove the SVG static class');
const before=scheduled;controller.update(300,{celebrate:false});assert.equal(scheduled,before);assert.equal(nodes.get('.sq-companion__status').textContent,'');
controller.update(0);assert.equal(scheduled,before,'Lower XP should not celebrate');
assert.equal(rootWrites,1,'Updates must preserve pause button/focus');
controller.update(500);assert(nodes.get('.sq-companion__progress-copy').innerHTML.includes('All five looks discovered'));assert.equal(nodes.get('progress').value,1);
controller.setGuide({title:'Inspect the sample',text:'Three historical observations, not a forecast.',label:'Review sample'});assert.equal(nodes.get('.sq-companion__guide-title').textContent,'Inspect the sample');assert.equal(nodes.get('[data-mascot-action]').textContent,'Review sample');controller.setPaused(true);assert.equal(button.getAttribute('aria-pressed'),'true');controller.setPaused(false);assert.equal(button.getAttribute('aria-pressed'),'false');controller.setActive(false);const frozen=scheduled;controller.update(0);controller.update(50);assert.equal(scheduled,frozen,'Inactive instances cannot celebrate');assert.equal(nodes.get('.sq-companion__status').textContent,'');controller.setActive(true);assert.equal(nodes.get('.sq-companion').classList.contains('sq-mascot--inactive'),false);
const greetingBefore=scheduled;controller.setPaused(true);controller.greet();assert.equal(scheduled,greetingBefore);controller.setPaused(false);controller.setActive(false);controller.greet();assert.equal(scheduled,greetingBefore);controller.setActive(true);controller.greet();assert.equal(scheduled,greetingBefore+1);assert(nodes.get('.sq-companion').classList.contains('sq-companion--greeting'));timerCallback();assert.equal(nodes.get('.sq-companion').classList.contains('sq-companion--greeting'),false);assert.equal(nodes.get('.sq-companion__status').textContent,'');
// The native artwork button is independent of the guide/pause controls. All
// reactions are local visual state, finite, replaceable and available when paused.
const clickTap=()=>listeners.get('click')({target:tap});
const card=nodes.get('.sq-companion'),cue=nodes.get('.sq-companion__feedback'),tapStatus=nodes.get('.sq-companion__tap-status');
const reactions=['wave','tilt','tail'];
for(const kind of reactions){
  const n=scheduled;clickTap();assert.equal(scheduled,n+1);assert.equal(cue.hidden,false);assert.ok(cue.textContent);assert.match(tapStatus.textContent,/Lumi/);
  assert.deepEqual(reactions.filter(k=>card.classList.contains('sq-companion--tap-'+k)),[kind]);
}
const staleTap=timerCallback;clickTap();staleTap();assert.equal(cue.hidden,false,'An older callback cannot clear the latest tap');timerCallback();assert.equal(cue.hidden,true);assert.equal(tapStatus.textContent,'');
for(let i=0;i<30;i++)clickTap();assert.equal(cue.hidden,false);timerCallback();assert.equal(cue.hidden,true);assert.ok(reactions.every(k=>!card.classList.contains('sq-companion--tap-'+k)));
controller.setPaused(true);clickTap();assert.equal(cue.hidden,false);assert.ok(nodes.get('.sq-mascot').classList.contains('sq-mascot--static'),'A paused tap cannot resume motion');assert.equal(button.getAttribute('aria-pressed'),'true');
controller.setActive(false);assert.equal(cue.hidden,true);assert.equal(tapStatus.textContent,'');const inactiveSchedules=scheduled;clickTap();assert.equal(scheduled,inactiveSchedules,'Hidden artwork cannot react');
controller.setActive(true);clickTap();controller.update(150,{celebrate:false});assert.equal(cue.hidden,true,'Evolution clears the previous form reaction');assert.equal(tapStatus.textContent,'');assert.equal(rootWrites,1,'Artwork reactions and evolution preserve the native button and focus');
controller.setPaused(false);clickTap();listeners.get('click')({target:button});assert.equal(cue.hidden,true,'Pause is not another artwork tap');assert.equal(button.getAttribute('aria-pressed'),'true');
const unrelatedSchedules=scheduled;listeners.get('click')({target:{closest:()=>null}});assert.equal(scheduled,unrelatedSchedules);assert.equal(cue.hidden,true);
clickTap();
controller.destroy();assert.equal(listeners.size,0);const html=nodes.get('.sq-companion__art').innerHTML;controller.update(25);assert.equal(nodes.get('.sq-companion__art').innerHTML,html);assert(cleared>0);assert.equal(cue.hidden,true);assert.equal(tapStatus.textContent,'');
console.log('PASS: mount adapter flows (initial static, repeated updates, gain, stage-up, 1.5s cleanup, pause/resume after updates, silent hydration, rollback, stable controls, terminal stage, artwork tap cycle/rapid replay/pause/hidden/evolution cleanup, destroy).');
