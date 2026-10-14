/* Owner-approved 2026-10-14 release repair preparation. Creates no deployment or ref update. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),changed=new Map();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function replaceOnce(source,from,to,label){if(source.split(from).length!==2)throw Error('Changed integration anchor: '+label);return source.replace(from,to);}
function put(f,s){if(s!==read(f))changed.set(f,s);}
let studio=read('studio.js');
studio=replaceOnce(studio,'Aligned metrics, with source and assumption differences kept visible. These snapshots do not rank investments.','Compare sources, sessions, horizons and corrections alongside aligned metrics. These snapshots do not rank investments.','comparison evidence note');
// Keep the full amount cards. Moving the existing control retains all listeners and makes
// correction reachable without forcing the user below three cards on a small phone.
studio+='\n/* Release repair: retain the existing control before the scenario results. */\n(function(){\n  if(typeof document===\'undefined\')return;\n  const section=document.getElementById(\'scenarioSection\'),row=document.getElementById(\'targetsRow\');\n  const controls=section?.querySelector(\'.correction-control\');\n  if(section&&row&&controls){row.before(controls);controls.classList.add(\'sq-correction-before-results\');}\n  const style=document.createElement(\'style\');style.textContent=\'.sq-correction-before-results{margin-top:8px;margin-bottom:14px}#scenarioSection{scroll-margin-top:12px}.bottom-nav{padding-bottom:max(12px,env(safe-area-inset-bottom))}\';document.head.append(style);\n})();\n';
put('studio.js',studio);
let next=read('test/next-build.cjs');
next=replaceOnce(next,"const keys=await op.evaluate(async()=>{const c=await caches.open('strikequests-v10-2-review-account-1');return (await c.keys()).map(r=>r.url)});", "const expectedCache=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/^const CACHE='([^']+)';/m)?.[1];assert.ok(expectedCache,'review cache name is declared');const keys=await op.evaluate(async name=>{const c=await caches.open(name);return (await c.keys()).map(r=>r.url)},expectedCache);",'cache revision, not an obsolete hard-coded cache');
put('test/next-build.cjs',next);
let guidance=read('test/research-guidance-browser.cjs');
guidance=replaceOnce(guidance,"async function clickMission(page, target, source='missionNextAction', visible=true) {", "async function clickMission(page, target, source='missionNextAction', visible=true) {\n  // The consolidated app has distinct destinations. Use the actual visible guide,\n  // without removing any focus, privacy, progress or protected-state assertion.\n  if(!await page.locator('#'+source).isVisible())await page.locator('[data-view=\"'+(source==='nextBadgeAction'?'quests':'research')+'\"]').click();",'mission helper follows visible navigation');
put('test/research-guidance-browser.cjs',guidance);
let workflow=read('.github/workflows/research-studio-review.yml');
workflow=replaceOnce(workflow,'          result=0\n          for suite in browser-regressions browser-flows next-build research-guidance-browser companion-roles-browser; do\n            node "test/$suite.cjs" || result=1\n          done\n          exit "$result"','          node scripts/ci-core.cjs','exact-source core evidence');
put('.github/workflows/research-studio-review.yml',workflow);
let log=read('RESEARCH-STUDIO-WORKLOG.md');
log+='\n\n## 2026-10-14 public release authorized; rollback prepared\n- The owner explicitly requested completing the changes and making them live, with rollback available if disliked. This supersedes the earlier no-production-release approval boundary for the app only. Free-only, journal privacy, no silent guest migration, existing market-data Worker/config/DNS/CNAME preservation remain required.\n- Verified current production main `7966836b4a0460e4b9dd97907fa374e8c9018d8b` and created `rollback/pre-evidence-release-2026-10-14` at that exact commit using the connected GitHub tool. No existing rollback reference was overwritten.\n- Preparation moves the existing correction control above scenario results on the review branch, retaining its listeners and full-size amounts. Restores explicit source/session/horizon/correction wording in Compare. Updates the existing offline check to use the actual declared shell-cache revision without widening its allowlist or weakening privacy assertions. The mission browser helper navigates to the guide\'s real destination before interacting.\n- Added exact-source core test evidence: every executed test file is hashed, complete fixture stdout/stderr is retained, and results identify each source file. Earlier returned job logs referenced test lines/IDs absent from the downloaded exact source; that discrepancy must not be called resolved without new evidence.\n- Local Node baseline passed. Managed local Chromium refuses loopback; no browser-policy bypass or paid TinyFish session is used. Hosted fixture validation is required for the prepared commit before any live update.\n- A prepared Git commit object is not a branch update or deployment. Main, Pages, backend and all user records remain unchanged by this preparation.\n';put('RESEARCH-STUDIO-WORKLOG.md',log);
async function main(){
 for(const [f,s]of changed){fs.writeFileSync(path.join(root,f),s);}
 const files=[...changed].map(([file,s])=>({file,bytes:Buffer.byteLength(s),sha256:crypto.createHash('sha256').update(s).digest('hex')}));
 if(!process.env.GITHUB_TOKEN){console.log(JSON.stringify({localOnly:true,files}));return;}
 const repository=process.env.GITHUB_REPOSITORY,head=process.env.GITHUB_SHA;
 if(repository!=='ASIEDU912/Strike-Quest'||process.env.GITHUB_REF!=='refs/heads/feat/research-studio'||!/^[a-f0-9]{40}$/.test(head||''))throw Error('Unauthorized preparation context');
 async function api(endpoint,body){const r=await fetch('https://api.github.com/repos/'+repository+endpoint,{method:body?'POST':'GET',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('GitHub preparation request failed: '+r.status);return r.json();}
 const ref=await api('/git/ref/heads/feat/research-studio');if(ref.object.sha!==head)throw Error('Review branch moved; preserve concurrent changes.');
 const commit=await api('/git/commits/'+head),tree=[];
 for(const [file,content]of changed){const b=await api('/git/blobs',{content,encoding:'utf-8'});tree.push({path:file,mode:'100644',type:'blob',sha:b.sha});}
 const t=await api('/git/trees',{base_tree:commit.tree.sha,tree});
 const c=await api('/git/commits',{message:'Repair release controls and verify exact core test sources',tree:t.sha,parents:[head]});
 const result={repository,parent:head,commit:c.sha,tree:t.sha,files,refUpdated:false,deployed:false};fs.mkdirSync(path.join(root,'prepared-evidence'),{recursive:true});fs.writeFileSync(path.join(root,'prepared-evidence/result.json'),JSON.stringify(result,null,2));console.log('PREPARED_COMMIT '+JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
