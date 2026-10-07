'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const M=require('../mascot.js');
const path=require('node:path');
const output=path.join(__dirname,'../test-results/mascot');
fs.mkdirSync(output,{recursive:true});
let assertions=0;
function eq(actual,expected){assert.deepEqual(actual,expected);assertions++;}
for(const [x,i] of [[-1,0],[0,0],[49,0],[49.9,0],[50,1],[149,1],[150,2],[299,2],[300,3],[499,3],[500,4],[501,4],[Number.MAX_VALUE,4],[Number.MAX_SAFE_INTEGER,4],[NaN,0],[Infinity,0],[-Infinity,0],[undefined,0],[null,0],[{},0],['',0],['150',2],['garbage',0],[true,0],[Symbol('x'),0],[100n,0]])eq(M.stageForXp(x).index,i);
eq(M.normalizeXp(Number.MAX_VALUE),Number.MAX_SAFE_INTEGER);
eq(M.progressForXp(150).fraction,0);eq(M.progressForXp(225).fraction,.5);eq(M.progressForXp(299).remaining,1);eq(M.progressForXp(500).fraction,1);eq(M.progressForXp(600).next,null);
for(const s of M.STAGES){
 const svg=M.renderSvg(s.minXp,{idPrefix:s.id});
 fs.writeFileSync(`${output}/${s.id}.svg`,svg);
 assert(svg.includes('role="img"')&&svg.includes('<title')&&svg.includes('<desc'));assertions++;
 assert(!svg.includes('<script')&&!svg.includes('onload=')&&!svg.includes('<image')&&!svg.includes('href='));assertions++;
 eq(M.stageForXp(s.minXp),s);
 assert(Object.isFrozen(s));assertions++;
}
const defaultA=M.renderSvg(0),defaultB=M.renderSvg(0);
assert(defaultA!==defaultB,'Default IDs must be unique');assertions++;
const hostile=M.renderSvg(50,{idPrefix:'"><script onload=x>',size:'50" onload="x',state:'bad" onload=x'});
assert(!hostile.includes('<script')&&!hostile.includes(' onload=')&&!hostile.includes('undefined'));assertions++;
assert(hostile.includes('width="120"'));assertions++;
assert(M.renderSvg(0,{static:true}).includes('sq-mascot--static'));assertions++;
const css=fs.readFileSync(`${__dirname}/../mascot.css`,'utf8');
assert(css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('animation:none!important'));assertions++;
assert(/sq-mascot-reward 1.2s ease-out 1/.test(css)&&/sq-mascot-reward 1.4s ease-out 1/.test(css));assertions++;
assert(!/https?:|@import|url\(/.test(css));assertions++;
assert(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|Audio\(/.test(fs.readFileSync(`${__dirname}/../mascot.js`,'utf8')));assertions++;
eq(M.renderCard(500).includes('All five looks discovered'),true);
for (const s of M.STAGES) {
 const svg=M.renderSvg(s.minXp,{idPrefix:'aura-test-'+s.id});
 eq(svg.includes('class="sq-mascot__aura"'),s.index===4);
 eq(svg.includes('aura-ring'),s.index===4);
}
assert(css.includes('sq-mascot-aura 5.6s ease-in-out infinite'));assertions++;
assert(css.includes('opacity:.72')&&css.includes('scale(1.008)'));assertions++;
const formKeys=M.STAGES.map(s=>M.renderSvg(s.minXp).match(/data-creature-form="([^"]+)"/)[1]);
eq(new Set(formKeys).size,5);
for(const s of M.STAGES){
 const svg=M.renderSvg(s.minXp,{idPrefix:'form-test-'+s.id});
 assert(svg.includes(s.form));assertions++;
 eq(svg.includes('class="sq-mascot__wings"'),s.index===4);
}
assert(!M.renderSvg(500).includes('translate(-2.7'));
assertions++;
console.log(`PASS: ${assertions} assertions (XP boundaries, invalid values, ID isolation, accessible labels, bounded motion, reduced motion, dependency isolation).`);
