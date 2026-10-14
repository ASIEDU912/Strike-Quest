/* Owner-authorized public guest-preview candidate. Never deploys or updates a ref. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version='10.2.0-preview.1';
const source=process.env.REVIEW_HEAD_SHA||process.env.GITHUB_SHA;
const rollback='7966836b4a0460e4b9dd97907fa374e8c9018d8b';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function one(s,from,to){if(s.split(from).length!==2)throw Error('Public build integration anchor changed');return s.replace(from,to);}
function build(out,inspection){
 if(!/^[a-f0-9]{40}$/.test(source||''))throw Error('An exact source commit is required');
 const record=JSON.parse(fs.readFileSync(path.join(inspection,'report.json'),'utf8'));
 if(record.source!=='cf0d635d071f89e8f66e56a4fe536a18faf74636'||record.main!==rollback||record.rollback!==rollback||record.pages?.source?.branch!=='main'||record.pages?.cname!=='strikequests.com')throw Error('Release inspection mismatch');
 require('./evidence-shell.cjs').packageReview(out);
 const f=name=>path.join(out,name),read=name=>fs.readFileSync(f(name),'utf8'),put=(name,text)=>fs.writeFileSync(f(name),text);
 let html=read('index.html');html=one(html,'</body>','<script src="./public-preview.js"></script>\n</body>');put('index.html',html);
 let studio=read('studio.js');studio=one(studio,"const VERSION='10.2.0-review.2';","const VERSION='"+version+"';");
 studio=studio.replaceAll('Research Studio · Review','Research Studio · Preview').replaceAll('REVIEW BUILD','PUBLIC PREVIEW').replaceAll('You are exploring a review build. These changes are not published to the live site.','This public preview includes the updated research workspace and original evidence tools. Accounts remain unavailable until live sign-in and recovery are verified.').replaceAll('This is a review build, not a production release. Optional development accounts are under review.','This is a public guest preview. Live account sign-in and recovery are not available.').replaceAll('review build · hypothetical scenarios','public preview · hypothetical scenarios');put('studio.js',studio);
 let evidence=read('research-evidence.js');
 evidence=one(evidence,'fetch(`./research-data/sec?symbol=${encodeURIComponent(s)}`','fetch(`./research-data/sec/${encodeURIComponent(s)}.json`');
 evidence=evidence.replaceAll('This review uses a separate, keyless SEC relay in the local development server. It does not change the public market-data Worker. Loading sends only the selected ticker to that relay. No valuation score or investment verdict.','This public preview serves dated SEC annual-filing snapshots for AAPL, MSFT, NVDA, AMZN, GOOGL and TSLA, retrieved on 14 October 2026. It is not a live refresh or quarterly/TTM feed. Unsupported companies stay unavailable. The public market-data Worker is unchanged.').replaceAll('through the development relay…','from the dated public SEC snapshot…').replaceAll('The development SEC relay is unavailable at this origin. Start the local review server; no direct browser call or third-party proxy is substituted.','No dated SEC snapshot is available for this ticker in the public preview. Supported companies: AAPL, MSFT, NVDA, AMZN, GOOGL and TSLA. No company or facts were guessed.').replaceAll('annual facts loaded. Reported facts and StrikeQuests calculations are distinguished below.','dated annual SEC snapshot loaded (retrieved 14 October 2026; not a live refresh). Reported facts and StrikeQuests calculations are distinguished below.').replaceAll('The development SEC relay could not be reached. Existing research is unchanged.','The dated SEC snapshot could not be reached. Existing research is unchanged.');put('research-evidence.js',evidence);
 const dataDir=f('research-data/sec');fs.mkdirSync(dataDir,{recursive:true});
 for(const symbol of ['AAPL','MSFT','NVDA','AMZN','GOOGL','TSLA']){
  const item=record.sec.find(x=>x.symbol===symbol&&x.status==='verified'),bytes=fs.readFileSync(path.join(inspection,'sec',symbol+'.json'));
  if(!item||sha(bytes)!==item.sha256)throw Error('SEC inspection hash mismatch');
  const data=JSON.parse(bytes);if(!data.ok||data.symbol!==symbol||!data.model?.period||data.model.cik!==item.cik||data.source!==item.source||data.delivery!=='dated-public-snapshot')throw Error('SEC snapshot identity mismatch');
  fs.writeFileSync(path.join(dataDir,symbol+'.json'),bytes);
 }
 fs.copyFileSync(path.join(root,'public-preview.js'),f('public-preview.js'));
 put('research-evidence-entry.js',read('research-evidence-entry.js').replaceAll('DEVELOPMENT REVIEW · EVIDENCE TOOLS','PUBLIC PREVIEW · EVIDENCE TOOLS').replaceAll('SEC annual fundamentals through the separate development relay','dated SEC annual fundamentals for six supported companies'));
 let sw=read('sw.js').replace(/^const CACHE='[^']+';/m,"const CACHE='strikequests-v10-2-public-preview-20261014-1';");
 sw=sw.replace(/^(const CORE=\[[^\n]+)\];/m,(_,a)=>a+',"./public-preview.js"];');put('sw.js',sw);
 fs.copyFileSync(path.join(root,'CNAME'),f('CNAME'));put('.nojekyll','');
 fs.rmSync(f('REVIEW-README.txt'));
 const config=fs.readFileSync(f('config.json'));if(sha(config)!==record.publishedFiles.find(x=>x.file==='config.json').sha256)throw Error('Market-data backend configuration would change');
 const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else files.push({path:path.relative(out,p).split(path.sep).join('/'),bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))});}}walk(out);
 const manifest={version,sourceCommit:source,rollbackCommit:rollback,rollbackBranch:'rollback/pre-evidence-release-2026-10-14',audience:'public guest preview',accounts:'unavailable; real sign-in/recovery not verified',sec:'dated six-company annual snapshots; retrieved 2026-10-14',files};put('release-manifest.json',JSON.stringify(manifest,null,2));
 return manifest;
}
async function loadInspection(destination){
 const token=process.env.GITHUB_TOKEN;if(!token)throw Error('Authorized artifact read required');
 const url='https://api.github.com/repos/ASIEDU912/Strike-Quest/actions/artifacts/11921698551/zip';
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Inspection artifact request failed');const bytes=Buffer.from(await r.arrayBuffer());
 if(sha(bytes)!=='9a75e5b636845747c1b2dbc21f2f2c2f571afdf506b96c3e160fd8d6b359dfb4')throw Error('Inspection archive digest mismatch');
 const zip=path.join(root,'test-results/release-inspection.zip');fs.mkdirSync(path.dirname(zip),{recursive:true});fs.writeFileSync(zip,bytes);
 const names=cp.execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');if(names.some(x=>!/^report\.json$|^sec\/(AAPL|MSFT|NVDA|AMZN|GOOGL|TSLA)\.json$/.test(x)))throw Error('Unexpected inspection file');fs.mkdirSync(destination,{recursive:true});cp.execFileSync('unzip',['-q',zip,'-d',destination]);
}
module.exports={build,loadInspection};
if(require.main===module)(async()=>{const out=path.resolve(process.argv[2]||'test-results/public-candidate'),inspection=process.argv[3]?path.resolve(process.argv[3]):path.join(root,'test-results/verified-inspection');if(!process.argv[3])await loadInspection(inspection);console.log(JSON.stringify(build(out,inspection)));})().catch(e=>{console.error(e.message);process.exitCode=1});
