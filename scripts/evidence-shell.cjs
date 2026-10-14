/* Opt-in development entry composed from the unchanged full application shell. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const assets=['research-evidence-core.js','research-evidence.js','research-evidence-entry.js','research-evidence.css'];
function reviewHtml(html){
  if(!html.includes('<script src="./studio.js"></script>')||!html.includes('<script src="./account.js"></script>')||!html.includes('</body>'))throw Error('Review shell changed; verify integration anchors before building.');
  if(html.includes('src="./research-evidence-entry.js"'))throw Error('Evidence entry already present.');
  return html.replace('</body>',assets.filter(x=>x.endsWith('.js')).map(x=>`<script src="./${x}"></script>`).join('\n')+'\n</body>');
}
function reviewWorker(source){
  if(!/^const CACHE='[^']+';/m.test(source)||!/^const CORE=\[[^\n]+\];/m.test(source))throw Error('Review cache changed; inspect before building.');
  return source.replace(/^const CACHE='([^']+)';/m,(_,name)=>`const CACHE='${name}-evidence-1';`).replace(/^(const CORE=\[[^\n]+)\];/m,(_,start)=>start+','+assets.map(x=>JSON.stringify('./'+x)).join(',')+'];');
}
const sourceAssets=['index.html','account-core.js','account.js','account.css','vendor/supabase.js','mascot.js','mascot.css','studio.js','studio.css','config.json','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png',...assets];
function packageReview(destination){
  const root=path.resolve(__dirname,'..'),out=path.resolve(destination);
  if(fs.existsSync(out))throw Error('Output directory must not already exist; no files are overwritten.');
  fs.mkdirSync(out,{recursive:true});for(const file of sourceAssets){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file==='index.html'?reviewHtml(fs.readFileSync(path.join(root,file),'utf8')):file==='sw.js'?reviewWorker(fs.readFileSync(path.join(root,file),'utf8')):fs.readFileSync(path.join(root,file)));}
  fs.writeFileSync(path.join(out,'REVIEW-README.txt'),'Development-only Evidence Studio build. Source and all account/journal behavior are preserved. Serve locally over HTTP; do not publish without owner approval. TradingView is opt-in and remains provider-branded; real-widget compatibility is not established by synthetic tests. SEC fundamentals require the separate scripts/dev-server.cjs relay with SEC_USER_AGENT set. This static package has no SEC relay. No secrets or private records are included.\n');
}
module.exports={assets,sourceAssets,reviewHtml,reviewWorker,packageReview};
if(require.main===module){if(!process.argv[2])throw Error('Provide a new output directory.');packageReview(process.argv[2]);}
