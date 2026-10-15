/* Prepare a review-only immutable commit from checksum-verified source transport.
 * No ref updates, deployment, provider calls, billing or user records.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const REPO='ASIEDU912/Strike-Quest',REF='refs/heads/feat/research-studio';
const parts=['09caf993b7d2b17b195c3609d90d45cfeabf037b','f645eca43c2bd179ef7727b6f912a0c37365824e','cb6b6038bb19f7cf22503f6cdb66317d61378ba5'];
const digest='2ac1f1a79730b4db756c4f6a7904adb9852cc52981b6610e66777b24998fb29f';
const sourcePaths=['quest-src/renewal.js','quest-src/renewal.css','scripts/quest-renewal-build.cjs','test/quest-renewal.cjs','test/quest-renewal-browser.cjs','QUEST-RENEWAL-REVIEW.md'];
async function gh(endpoint,method='GET',body){
 if(!/^\/(git\/(blobs|trees|commits)(\/[a-f0-9]{40})?|git\/ref\/heads\/(main|feat\/research-studio))$/.test(endpoint)&&endpoint!=='')throw Error('Unapproved API path');
 if(method!=='GET'&&!['/git/blobs','/git/trees','/git/commits'].includes(endpoint))throw Error('Reference writes are forbidden');
 const r=await fetch('https://api.github.com/repos/'+REPO+endpoint,{method,redirect:'error',headers:{'Authorization':'Bearer '+process.env.GITHUB_TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Git object request failed: '+r.status);return r.json();
}
(async()=>{
 if(process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_REF!==REF)throw Error('Wrong repository or branch');
 const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();if(head!==process.env.GITHUB_SHA)throw Error('Unexpected source head');
 const repo=await gh('');if(repo.private||repo.full_name!==REPO)throw Error('Free standard public-runner scope required');
 const mainBefore=(await gh('/git/ref/heads/main')).object.sha;
 const input=[];for(const sha of parts){const b=await gh('/git/blobs/'+sha);if(b.encoding!=='base64'||b.sha!==sha)throw Error('Wrong source object');input.push(Buffer.from(b.content,'base64').toString('utf8'));}
 const bytes=zlib.gunzipSync(Buffer.from(input.join(''),'base64'),{maxOutputLength:100000});
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==digest)throw Error('Source transport checksum mismatch');
 const files=JSON.parse(bytes);if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify([...sourcePaths].sort()))throw Error('Unexpected source paths');
 for(const name of sourcePaths){if(typeof files[name]!=='string')throw Error('Invalid source');fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,files[name]);}
 cp.execFileSync(process.execPath,['scripts/quest-renewal-build.cjs'],{stdio:'inherit'});
 cp.execFileSync(process.execPath,['test/quest-renewal.cjs'],{stdio:'inherit'});
 const log='RESEARCH-STUDIO-WORKLOG.md';
 fs.appendFileSync(log,'\n\n## '+new Date().toISOString().slice(0,10)+' Quest Renewal review implementation\n- The owner requested stronger blue/gold gamification, a fast 2Y/10% path and Seasonality access, more expressive Lumi, slower ten-stage progression and more research badges. Work stays on feat/research-studio; this is not authorization to publish.\n- Built on the current source at '+head+'; preserved all existing account, evidence, comparison, journal, backup and provider code. The original five-form mascot API is retained for compatibility, with a separate ten-rank runtime model and distinct crests. Previously earned badge dates/XP and unlocked legacy looks remain available.\n- Added 24 explicit-review expedition badges and a 0–3000 XP ten-rank ladder. No repeated-click, trading, journal-entry or market-performance rewards. New badges are device-local and guest/account isolated; they are explicitly excluded from existing cloud sync.\n- Added contextual Home/Research shortcuts, confirmation before changing working assumptions, stronger scenario colors, finite saved/season/earned reactions, a journey map, readable requirements and versioned implemented-only release notes. Existing saved scenarios and specific-year controls remain authoritative.\n- Checksum-verified readable source was integrated by the preparation script, not by replacing large files with an older ZIP. All 33 new unit checks passed during preparation. Local earlier tests used the old supplied prototype and Chromium inline storage emulation; they are not current-source hosted browser proof.\n- Hosted new and retained browser suites must validate the prepared immutable commit before readiness. Screenshots use synthetic fixtures only. No private records, keys, paid services, new subscriptions, main/ref updates, Pages deployment, DNS/CNAME or market-data backend changes were made by preparation.\n- Production main observed before preparation: '+mainBefore+'. Optional real-owner email/recovery and physical-device account verification remain separate gates; this design update does not claim them complete.\n');
 const allowed=[...sourcePaths,'mascot.js','studio.js','sw.js',log],tree=[];
 for(const name of allowed){const text=fs.readFileSync(name,'utf8');const b=await gh('/git/blobs','POST',{content:text,encoding:'utf-8'});tree.push({path:name,mode:'100644',type:'blob',sha:b.sha});}
 const base=await gh('/git/commits/'+head),t=await gh('/git/trees','POST',{base_tree:base.tree.sha,tree});
 const commit=await gh('/git/commits','POST',{message:'Implement Quest Renewal: expressive Lumi, ten stages and research milestones',tree:t.sha,parents:[head]});
 console.log('PREPARED_QUEST_COMMIT='+commit.sha);console.log('QUEST_PRODUCTION_UNCHANGED='+String(mainBefore===(await gh('/git/ref/heads/main')).object.sha));
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'commit='+commit.sha+'\n');
})().catch(()=>{console.error('Quest preparation failed. No branch update or deployment was attempted. Inspect the preceding non-secret checks.');process.exitCode=1;});
