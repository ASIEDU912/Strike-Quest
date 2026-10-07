/* StrikeQuests research companion. Dependency-free, storage-free, network-free. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StrikeMascot = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STAGES = Object.freeze([
    { id: 'rookie', name: 'Rookie', minXp: 0, ability: 'Curiosity', form: 'Tiny round fox cub with short ears and one curled tail', outfit: 'Starter scarf and patched field satchel', detail: 'A tiny round cub, ready to explore.', color: '#8ce5e9', scale: .80 },
    { id: 'scout', name: 'Signal Scout', minXp: 50, ability: 'Signal scanner', form: 'Long-eared juvenile fox with longer legs and a long plume tail', outfit: 'Teal scout vest and wrist scanner', detail: 'Lumi grows longer ears, taller legs and a flowing tail.', color: '#75e4d9', scale: .86 },
    { id: 'ranger', name: 'Orbit Ranger', minXp: 150, ability: 'Orbital scout', form: 'Lean athletic fox with swept ear tufts and a forked tail', outfit: 'Violet flight harness and companion drone', detail: 'Lumi becomes a lean runner with ear tufts and a forked tail.', color: '#b8a4ff', scale: .92 },
    { id: 'keeper', name: 'Archive Keeper', minXp: 300, ability: 'Archive shield', form: 'Tall guardian fox with powerful paws, a broad mane and three tails', outfit: 'Indigo shoulder mantle, gold chest chain and holographic archive', detail: 'A broad mane, powerful paws and three tails mark a new form.', color: '#a9c9ff', scale: .98 },
    { id: 'voyager', name: 'Insight Voyager', minXp: 500, ability: 'Insight flare', form: 'Majestic celestial fox with feathered wings, crystalline ear crests and five comet tails', outfit: 'Pearl-and-gold mantle and a glowing gold-and-cyan aura', detail: 'Lumi transforms into a winged celestial fox with five comet tails.', color: '#ffe198', scale: 1.03 }
  ].map((s, index) => Object.freeze({ ...s, index, nextXp: index === 4 ? null : [0, 50, 150, 300, 500][index + 1] })));
  let serial = 0;
  function normalizeXp(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n))) : 0;
  }
  function stageForXp(value) {
    const xp = normalizeXp(value);
    for (let i = STAGES.length - 1; i >= 0; i--) if (xp >= STAGES[i].minXp) return STAGES[i];
    return STAGES[0];
  }
  function progressForXp(value) {
    const xp = normalizeXp(value), stage = stageForXp(xp);
    return Object.freeze({ xp, stage, next: STAGES[stage.index + 1] || null, remaining: stage.nextXp === null ? 0 : stage.nextXp - xp, fraction: stage.nextXp === null ? 1 : (xp - stage.minXp) / (stage.nextXp - stage.minXp) });
  }
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const star = (x,y,r,color) => `<path d="M${x} ${y-r}l${r*.28} ${r*.72} ${r*.72} ${r*.28}-${r*.72} ${r*.28}-${r*.28} ${r*.72}-${r*.28}-${r*.72}-${r*.72}-${r*.28} ${r*.72}-${r*.28}Z" fill="${color}"/>`;
  function creatureArt(index, prefix) {
    const ink='#16273f', cream='#fff0d9', warm=`url(#${prefix}-fur)`;
    const path=(d,fill=warm,stroke=ink,width=2.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const oval=(x,y,rx,ry,fill,stroke='none',width=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
    const eyes=(x1,x2,y,rx,ry)=>`<g class="sq-mascot__eyes" style="transform-origin:${(x1+x2)/2}px ${y}px">${oval(x1,y,rx,ry,ink)}${oval(x2,y,rx,ry,ink)}${oval(x1+1,y-2,1.4,1.6,'#fff')}${oval(x2+1,y-2,1.4,1.6,'#fff')}</g>`;
    const smile=(x,y)=>`${path(`M${x-4} ${y}q4-3 8 0l-4 4Z`,ink,'none')}${path(`M${x} ${y+4}v2m-6 0q6 6 12 0`,'none',ink,1.8)}`;
    const toe=(x,y)=>path(`M${x} ${y}v3m4-3v3`,'none','#c59072',1.2);
    // Each form is independently drawn. Proportions, posture, paws, ears, mane and tails evolve.
    const forms=[
      {
        key:'round-cub',
        rear:`<g class="sq-mascot__tail" style="transform-origin:111px 136px">${path('M109 141c24 6 34-11 26-24-2-5-7-8-12-9 3 9 0 13-7 16-9 3-12 12-7 17Z')}${path('M123 108c3 9 0 13-7 16 6 4 13 1 19-6-2-5-7-8-12-10Z',cream,'none')}</g>`,
        body:`${path('M71 107q17-9 32 0 14 14 10 30-3 17-26 17-25 0-27-17-2-17 11-30Z')}${oval(87,133,16,19,cream)}${path('M66 121q-9 8-5 16 5 6 9-1M107 122q9 8 4 14-4 6-9 1')}${oval(70,151,12,7,warm,ink,2.5)}${oval(104,151,12,7,warm,ink,2.5)}${toe(67,151)}${toe(101,151)}`,
        head:`${path('M56 76 54 48q17 3 25 16m20 0q9-15 24-17l-4 32')}${path('m60 57 13 13-10 5m54-18-12 13 10 6','#db8190','none')}${path('M88 64c-25 0-38 10-37 29 1 19 16 29 37 29 22 0 36-12 36-29S112 64 88 64Z')}${path('M51 89q18 0 37 19 17-19 36-19-1 19-15 33H67Q53 109 51 89Z',cream,'none')}${eyes(71,104,89,5,7)}${oval(63,101,5,2.7,'#e79790')}${oval(112,101,5,2.7,'#e79790')}${smile(88,105)}`,
        gear:`${path('M69 120q18 8 37-1l-3 9q-16 7-32-1Z','#78cfcb',ink,1.8)}${path('m76 126-6 15 11-3 4-10','#5aadaa',ink,1.5)}${path('m101 128-23 17','none','#c6a66f',3)}${path('M69 139h17v13H69Z','#8f7354',ink,1.6)}${path('m73 143 4 1m-2-3-1 5','none','#edddbd',1.4)}`
      },
      {
        key:'long-eared-juvenile',
        rear:`<g class="sq-mascot__tail" style="transform-origin:109px 138px">${path('M104 141c34 9 53-14 41-42-4-9-8-17-7-29-20 14-25 25-15 39 4 7-6 9-15 13-11 5-14 14-4 19Z')}${path('M138 70c-15 11-21 19-19 27l14 4 12-2c-4-9-8-17-7-29Z',cream,'none')}</g>`,
        body:`${path('M76 99q14-7 25 2l11 30-9 14H76l-8-14Z')}${path('M78 123 72 151h14l4-26m7 0 2 26h15l-8-26')}${path('M72 150q-8 0-9 7h23v-7m13 0v7h23q-2-7-9-7',cream,ink,2.3)}${path('m73 108-13 22q-2 7 5 7l10-7m27-22 14 17q5 6 0 11l-10-8')}${toe(70,154)}${toe(104,154)}`,
        head:`${path('M65 70 54 25q23 10 28 37m16 0q9-31 25-40l-6 51')}${path('m61 37 15 28-9 3m50-32-13 31 8 2','#d88190','none')}${path('M90 60q-29-3-36 23l7 4-7 5 13 1q7 21 23 21 17-1 23-21l13-1-8-5 7-4q-8-23-35-23Z')}${path('M60 86q17 0 30 15 15-15 29-15-7 28-29 28-20-1-30-28Z',cream,'none')}${eyes(75,104,83,4.6,6.2)}${smile(90,99)}`,
        gear:`${path('M72 109q17 13 35-1l-3 18-13 6-17-7Z','#208f93',ink,2)}${path('m77 114 12 9 12-9','none','#9beddf',2)}${oval(91,124,3,3,'#f6d28c')}${path('M56 127h14v9H56Z','#1b4055','#a1efe1',1.6)}${oval(63,131.5,2.5,2.5,'#8effe3')}`
      },
      {
        key:'tufted-runner',
        rear:`<g class="sq-mascot__tail" style="transform-origin:105px 128px">${path('M106 133c38 10 57-22 44-55-3 15-15 23-25 26 4-16 0-29-12-36 3 18-12 28-5 44-16 3-18 17-2 21Z')}${path('M150 78c-3 15-15 23-25 26 14 5 26 1 29-11Z',cream,'none')}${path('M113 68c3 18-12 28-5 44 5-4 11-6 17-8 4-16 0-29-12-36Z','#e6f5ee','none')}${path('M117 119q21 4 28-14','none','#fbd79d',2)}</g>`,
        body:`${path('M77 88q12-4 24 0l14 23-12 21H74l-11-21Z')}${path('M74 124 62 149l16 2 13-23m7-4 7 25 14-3-11-24')}${path('M62 146q-10 6-7 11h23l1-9m25-2 3 11h22q-2-9-12-12',cream,ink,2.3)}${path('m69 103-14 9-8 14 8 4 14-13m37-15 12 10 8-11 9 5-12 23-18-12')}${path('m45 124 2 10 9-3 1-6m67-24 5-9 9 7-4 9',cream,ink,2)}${toe(62,153)}${toe(110,153)}`,
        head:`${path('M61 63 48 19l13 7 3-12 20 40m14-1 15-37 3 13 14-7-12 43')}${path('m57 32 18 28-10 3m61-30-18 28 9 4','#c3768f','none')}${path('M90 50q-22-1-32 17l-12 5 12 4-11 8 17 1q5 14 26 20 20-5 26-20l16-1-11-8 11-4-13-6q-11-17-29-16Z')}${path('M58 77q14-2 32 17 17-18 31-17l-5 8q-7 16-26 20-17-5-26-20Z',cream,'none')}${eyes(75,106,74,4,5.5)}${smile(91,91)}${path('m85 56 6 7 6-7-6-4Z','#b4e6ed','none')}`,
        gear:`${path('M69 103q22 14 42-1l-4 10q-16 10-34 1Z','#6960a9',ink,2)}${path('m74 112 9 16 13-1 10-16','none','#b6a7f0',3)}${oval(90,117,5,5,'#dbd4ff',ink,1.6)}${star(90,117,3,'#554d8f')}${path('M48 120h13v9H48Z','#253a59','#baaff8',1.5)}${oval(54,124,2,2,'#8ce7df')}`
      },
      {
        key:'three-tail-guardian',
        rear:`<g class="sq-mascot__tail" style="transform-origin:93px 121px">${path('M69 133c-29 10-47-10-38-39 2-12 1-20-4-26 23 7 30 20 25 36-3 10 10 13 17 29Z')}${path('M105 132c22 18 52-2 50-31 0-10 1-19 9-25-25 1-42 11-39 32 1 9-13 9-20 24Z')}${path('M103 124c35-5 45-32 29-60-2 19-17 24-25 33-8 9-9 18-4 27Z')}${path('M27 68c23 7 30 20 25 36-9-1-15-6-21-10 2-12 1-20-4-26Z',cream,'none')}${path('M164 76c-25 1-42 11-39 32 12 1 21-2 30-7 0-10 1-19 9-25Z','#d5e4f8','none')}${path('M132 64c-2 19-17 24-25 33 11 1 21-1 31-7 1-8-1-17-6-26Z',cream,'none')}</g>`,
        body:`${path('M66 87q23-16 47 0l9 37-12 15H69l-15-15Z')}${path('M67 123 62 150h19l8-24m9 0 3 25h20l-9-30')}${path('M62 149q-11 3-9 10h28v-10m20 0v10h30q-2-9-11-10',cream,ink,2.4)}${path('M64 94q-16 5-18 27l-4 18 14 4 14-31m40-18q17 6 19 25l6 18-15 6-15-31')}${path('m44 134-5 13 17 4 3-12m68-4 11 12-17 5-4-12',cream,ink,2)}${toe(61,155)}${toe(107,155)}`,
        mane:`${path('M69 67 53 72l2 12-14 4 12 13-8 12 17-1 3 19 14-9 10 18 13-18 14 9 4-20 16 2-8-13 12-13-15-4 2-12-16-6Z',cream,ink,2.5)}${path('m60 88 8 13-8 6m18-11 11 20 11-20m18-7-8 13 8 6','none','#e7bc82',2)}`,
        head:`${path('M66 57 59 18l17 11 10 22m13 0 8-24 16-12-6 44')}${path('m65 29 13 25-8 2m46-27-12 25 8 3','#ba7b99','none')}${path('M90 42q-21 0-28 18l-10 5 9 6-7 8 16-1q8 20 20 23 16-4 22-23l16 1-7-8 10-6-12-6q-9-17-29-17Z')}${path('M61 68q14 0 29 19 17-19 30-19l-8 13q-10 19-22 20-14-4-20-20Z',cream,'none')}${eyes(77,104,64,4,5)}${smile(91,83)}${path('m83 49 8-6 8 6-8 8Z','#a8d7e7','none')}`,
        gear:`${path('m53 91 17-10 6 14-12 7Z','#454581','#e6c573',1.6)}${path('m121 89-14-8-5 14 13 7Z','#454581','#e6c573',1.6)}${path('m72 102 18 25 19-25','none','#d9b968',3)}${path('m89 111 5 7-5 7-5-7Z','#beeafa',ink,1.4)}${path('m56 138-11-2m75 2 12-3','none','#d9b968',3)}`
      },
      {
        key:'celestial-winged-fox',
        rear:`<g class="sq-mascot__tail" style="transform-origin:94px 119px">${path('M73 132C27 148 13 114 26 86c6 26 26 10 40 25-21-35-7-56 10-58-7 26 11 34 7 58 16-26 5-48 16-60 13 16 11 39 4 58 25-18 13-40 32-51 2 21 16 29 0 53 17-15 18-27 25-34 12 44-16 68-51 62Z','#d5bfe9',ink,2.5)}${path('M26 86c6 26 26 10 40 25-12 7-27 4-38-1Z','#fff1d0','none')}${path('M76 53c-7 26 11 34 7 58-13-12-23-29-7-58Z','#b2edf0','none')}${path('M99 51c13 16 11 39 4 58-8-19-13-38-4-58Z','#fff2cf','none')}${path('M135 58c2 21 16 29 0 53-4-12-10-20-7-34Z','#c4f2eb','none')}${path('M160 77c8 25 2 43-12 52-9-10-17-14-13-18 17-15 18-27 25-34Z','#fff1d0','none')}${path('M37 128q16 13 38 0m42 6q22 4 30-4','none','#fae1ab',2)}</g><g class="sq-mascot__wings" style="transform-origin:90px 102px">${path('M74 105C42 102 15 82 17 53l21 15-7-32 29 27-4-34 25 48Z','#dbe4fa','#79749c',2)}${path('M107 105c32-3 59-23 57-52l-21 15 7-32-29 27 4-34-25 48Z','#dbe4fa','#79749c',2)}${path('m26 64 38 31m-24-49 29 39m-7-43 12 36m82-14-38 31m24-49-29 39m7-43-12 36','none','#9edbdd',2.5)}${path('m40 80 7-1m13-24 7 7m72 18-7-1m-13-24-7 7','none','#ffe4a6',3)}</g>`,
        body:`${path('M75 83q16-8 31 0l8 25-8 20-31 2-10-21Z',warm)}${path('M76 122 67 151h13l11-27m6 0 4 27h14l-9-31',warm)}${path('M68 146q-9 4-9 13h22l1-12m20 0v12h24q-1-9-12-12',cream,ink,2.3)}${path('m72 96-12 20-9 20 12 6 14-25m28-21 15 19 13 16-10 11-20-24',warm)}${path('m52 132-8 13 15 5 7-12m63-8 13 12-15 9-8-12',cream,ink,2)}${toe(65,155)}${toe(108,155)}`,
        mane:`${path('m76 60-17 9 4 11-13 4 13 15-2 17 16-3 13 26 14-26 16 3-1-17 12-15-14-5 4-11-16-9Z','#fff3d9','#bb935e',2)}${path('m70 86 7 13 12-17 13 17 9-13m-33 18 12 18 11-18','none','#e3ca92',2)}`,
        head:`${path('M69 53 57 21l10 4-1-13 16 16 3 19m11 0 6-19 16-16-1 13 10-5-13 36',cream,ink,2.3)}${path('m63 27 14 24-7 2m49-26-15 24 8 2','#b79dd5','none')}${path('M91 38q-20 0-27 17l-10 9 12 2-7 9 14 1q7 16 18 19 13-3 19-19h15l-7-10 12-2-12-9q-7-17-27-17Z',warm)}${path('M65 65q15 2 26 16 12-15 27-16l-8 13q-7 15-19 17-13-3-18-17Z',cream,'none')}${eyes(78,104,60,3.8,5.3)}${smile(92,77)}${path('m91 29 6 10-6 11-6-11Z','#cefbfb','#cfa553',1.4)}${path('m87 51 4 4 4-4','none','#dcab56',1.5)}`,
        gear:`${path('m65 94 11-7 8 9-10 8Z','#e6dcf5','#c9a961',1.7)}${path('m117 94-11-7-8 9 10 8Z','#e6dcf5','#c9a961',1.7)}${path('m75 111 15 20 16-20','none','#e0b863',3)}${path('m90 103 6 10-6 9-6-9Z','#ace8ec','#9e855b',1.5)}${path('m55 134 8 4m61-3 7-4m-60 18h9m24 0h8','none','#ddb963',3)}`
      }
    ];
    const form=forms[index];
    return `<g class="sq-mascot__body" data-creature-form="${form.key}">${form.rear}${form.body}${form.mane||''}${form.head}${form.gear}</g>`;
  }

  function renderSvg(value, options = {}) {
    const s = stageForXp(value), n = s.index;
    const prefix = 'sqm-' + (token(options.idPrefix) || ++serial);
    const state = ['idle','earn','levelup'].includes(options.state) ? options.state : 'idle';
    const size = typeof options.size === 'number' && Number.isFinite(options.size) ? Math.max(48, Math.min(400, options.size)) : 120;
    const label = `Lumi the astro-fox, ${s.name}. ${s.form}. ${s.outfit}. Cosmetic ability: ${s.ability}.`;
    const outline = '#16273f';
    const suit = ['#425979','#167f8a','#6453a7','#343b83','#e4def6'][n];
    const cuff = ['#b7c9d7','#80e2d6','#baaff8','#d7b778','#f3c865'][n];
    // The fifth-stage aura sits behind the whole companion, within the 180px viewBox.
    const auraDefs = n === 4 ? `<linearGradient id="${prefix}-aura-ring" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe7a1"/><stop offset=".42" stop-color="#f4c867"/><stop offset=".72" stop-color="#81edf0"/><stop offset="1" stop-color="#cdfcff"/></linearGradient><radialGradient id="${prefix}-aura-halo"><stop offset=".56" stop-color="#ffe29a" stop-opacity="0"/><stop offset=".80" stop-color="#ffd774" stop-opacity=".08"/><stop offset=".90" stop-color="#79edf3" stop-opacity=".16"/><stop offset="1" stop-color="#79edf3" stop-opacity="0"/></radialGradient><filter id="${prefix}-aura-soft" filterUnits="userSpaceOnUse" x="0" y="0" width="180" height="180"><feGaussianBlur stdDeviation="2.4"/></filter>` : '';
    const aura = n === 4 ? `<g class="sq-mascot__aura" aria-hidden="true"><ellipse cx="90" cy="89" rx="87" ry="87" fill="url(#${prefix}-aura-halo)"/><ellipse cx="90" cy="89" rx="75" ry="79" fill="none" stroke="url(#${prefix}-aura-ring)" stroke-width="7" opacity=".38" filter="url(#${prefix}-aura-soft)"/><ellipse cx="90" cy="89" rx="75" ry="79" fill="none" stroke="url(#${prefix}-aura-ring)" stroke-width="1.5" opacity=".78"/><path d="M38 28a75 79 0 0 1 56-18M154 137a75 79 0 0 1-52 30" fill="none" stroke="#e9fdff" stroke-width="2" stroke-linecap="round" opacity=".58"/></g>` : '';
    const background = n === 4 ? `<path d="M90 35 75 57 49 30 56 80 26 64 45 104 24 117 67 129 90 150 113 129 156 117 135 104 154 64 124 80 131 30 105 57Z" fill="#d5c3ff" opacity=".08"/>${star(36,48,7,'#ffe29a')}${star(145,64,5,'#c8b4ff')}` : '';
    const creature = creatureArt(n, prefix);
    const drone = n>=2?`<g class="sq-mascot__drone"><path d="M138 49v-6" stroke="#b8acff" stroke-width="2"/><circle cx="138" cy="41" r="2.5" fill="#f2d18b"/><ellipse cx="138" cy="56" rx="13" ry="10" fill="#dad7fa" stroke="${outline}" stroke-width="2"/><rect x="130" y="51" width="17" height="8" rx="4" fill="#253a56"/><circle cx="135" cy="55" r="2" fill="#87e8ed"/><circle cx="142" cy="55" r="2" fill="#87e8ed"/><path d="M122 61q16 10 33-1" stroke="#897dbd" stroke-width="2" fill="none" opacity=".7"/></g>`:'';
    const shield = n>=3?`<g class="sq-mascot__archive"><path d="m29 101 17-7 17 7v21q-2 11-17 18-15-7-17-18Z" fill="#8cbcff" fill-opacity=".13" stroke="#9acbfb" stroke-width="1.7"/><path d="M35 110q6-3 11 1 6-4 11-1v15q-6-3-11 1-6-4-11-1Zm11 1v15" fill="#a8ddfa" fill-opacity=".2" stroke="#b2e7fa" stroke-width="1.2"/><path d="M39 115h3m8 0h3m-14 5h3m8 0h3" stroke="#d0efff" stroke-width="1.2"/></g>`:'';
    const flare = n===4?`<g class="sq-mascot__flare">${star(131,107,13,'#ffdf90')}${star(131,107,7,'#fff8d9')}<circle cx="131" cy="107" r="20" fill="none" stroke="#f8d780" stroke-opacity=".38" stroke-width="1.5"/><path d="m131 80 0 5m0 44v5m-28-27h5m46 0h5" stroke="#ffe3a3" stroke-width="1.5"/></g>`:'';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="sq-mascot sq-mascot--${s.id} sq-mascot--${state}${options.static?' sq-mascot--static':''}" width="${size}" height="${size}" viewBox="0 0 180 180" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" focusable="false"><title id="${prefix}-title">${escape(label)}</title><desc id="${prefix}-desc">Research progress changes Lumi's appearance. These cosmetic abilities do not improve forecasts or unlock research tools.</desc><defs><linearGradient id="${prefix}-fur" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#ffd195"/><stop offset="1" stop-color="#e99562"/></linearGradient>${auraDefs}</defs><circle cx="90" cy="87" r="68" fill="${s.color}" opacity=".035"/>${aura}<path d="M36 152h108" stroke="#6081a6" stroke-opacity=".16" stroke-linecap="round" stroke-width="2"/>${background}<ellipse class="sq-mascot__shadow" cx="89" cy="159" rx="39" ry="5" fill="#030d1f" opacity=".45"/>${creature}${drone}${shield}${flare}<g class="sq-mascot__celebration" fill="none" opacity="0"><circle cx="90" cy="89" r="59" stroke="${s.color}" stroke-width="2"/>${star(43,43,6,s.color)}${star(136,37,5,'#ffdf90')}${star(152,133,6,s.color)}${star(33,125,4,'#ffdf90')}</g></svg>`;
  }
  function renderCard(value, options = {}) {
    const p = progressForXp(value), s = p.stage;
    const progress = p.next ? `${p.remaining} XP to ${p.next.name}` : 'All five looks discovered';
    return `<section class="sq-companion${options.static?' sq-mascot--paused':''}" aria-label="Lumi research companion"><div class="sq-companion__art">${renderSvg(p.xp,options)}</div><div class="sq-companion__copy"><p class="sq-companion__eyebrow">Your research companion</p><h3>Lumi <span>· ${s.name}</span></h3><p class="sq-companion__ability">${s.ability}</p><div class="sq-companion__progress-copy"><span>${p.xp.toLocaleString('en-US')} XP</span><span>${progress}</span></div><progress class="sq-companion__progress" value="${p.fraction}" max="1" aria-label="Lumi evolution progress"></progress><p class="sq-companion__note">Grows with research milestones. Abilities are cosmetic.</p></div><button class="sq-companion__motion" type="button" data-mascot-motion aria-pressed="${!!options.static}" aria-label="Pause companion animation">${options.static?'Resume motion':'Pause motion'}</button><span class="sq-companion__status" role="status" aria-live="polite" aria-atomic="true"></span></section>`;
  }
  /** Purely visual. The host owns research eligibility, persistence, and XP. */
  function mount(container, initialXp, options = {}) {
    if (!container || typeof container.querySelector !== 'function') throw new TypeError('A DOM container is required');
    let xp = normalizeXp(initialXp), paused = !!options.static, timer = null, destroyed = false;
    const opts = { ...options, idPrefix: token(options.idPrefix) || `mounted-${++serial}` };
    container.innerHTML = renderCard(xp,{...opts,static:paused});
    function onClick(event) {
      const button = event.target.closest && event.target.closest('[data-mascot-motion]');
      if (!button || !container.contains(button)) return;
      paused = !paused;
      container.querySelector('.sq-companion').classList.toggle('sq-mascot--paused',paused);
      container.querySelector('.sq-mascot').classList.toggle('sq-mascot--static',paused);
      button.setAttribute('aria-pressed',String(paused));
      button.textContent=paused?'Resume motion':'Pause motion';
    }
    container.addEventListener('click',onClick);
    return Object.freeze({
      update(nextXp, updateOptions = {}) {
        if (destroyed) return;
        const value=normalizeXp(nextXp); if(value===xp) return;
        const before=stageForXp(xp), p=progressForXp(value), gained=value>xp;
        const state = gained && updateOptions.celebrate !== false ? (p.stage.index>before.index?'levelup':'earn'):'idle';
        clearTimeout(timer);
        container.querySelector('.sq-companion__art').innerHTML=renderSvg(value,{...opts,state,static:paused});
        container.querySelector('h3').innerHTML=`Lumi <span>· ${p.stage.name}</span>`;
        container.querySelector('.sq-companion__ability').textContent=p.stage.ability;
        container.querySelector('.sq-companion__progress-copy').innerHTML=`<span>${p.xp.toLocaleString('en-US')} XP</span><span>${p.next?`${p.remaining} XP to ${p.next.name}`:'All five looks discovered'}</span>`;
        container.querySelector('progress').value=p.fraction;
        const status=container.querySelector('.sq-companion__status');
        status.textContent=state==='levelup'?`Lumi evolved into ${p.stage.name}. ${p.stage.ability} discovered.`:state==='earn'?`${value-xp} research XP earned.`:'';
        xp=value;
        if(state!=='idle')timer=setTimeout(()=>{const svg=container.querySelector('.sq-mascot');if(svg){svg.classList.remove('sq-mascot--earn','sq-mascot--levelup');svg.classList.add('sq-mascot--idle');}},1500);
      },
      destroy() { destroyed=true;clearTimeout(timer);container.removeEventListener('click',onClick); }
    });
  }
  return Object.freeze({ STAGES, normalizeXp, stageForXp, progressForXp, renderSvg, renderCard, mount });
});
