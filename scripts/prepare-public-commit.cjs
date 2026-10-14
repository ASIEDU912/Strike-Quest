/* Prepare an immutable, tested public tree. Connected owner action moves main later. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repository='ASIEDU912/Strike-Quest',root=path.resolve('test-results/public-candidate'),out=path.resolve('test-results/public-prepared');
async function api(endpoint,body){const r=await fetch('https://api.github.com/repos/'+repository+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Public preparation failed: HTTP '+r.status);return r.json();}
(async()=>{
 if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/release/evidence-preview-2026-10-14')throw Error('Not the owner-authorized release branch');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8')),verified=JSON.parse(fs.readFileSync('test-results/public-verification/results.json','utf8'));
 if(manifest.sourceCommit!==process.env.GITHUB_SHA||verified.sourceCommit!==manifest.sourceCommit||verified.checks<66)throw Error('Exact candidate verification is missing');
 const meta=await api(''),ref=await api('/git/ref/heads/main'),rollback=await api('/git/ref/heads/rollback/pre-evidence-release-2026-10-14');
 if(meta.private!==false||ref.object.sha!==manifest.rollbackCommit||rollback.object.sha!==ref.object.sha)throw Error('Production moved or free/rollback verification failed; no ref updated');
 const base=await api('/git/commits/'+ref.object.sha),tree=[];
 for(const file of [...manifest.files,{path:'release-manifest.json'}]){
  if(!/^(index\.html|sw\.js|manifest\.webmanifest|CNAME|\.nojekyll|release-manifest\.json|(studio|mascot|account|account-core|public-preview|research-evidence|research-evidence-core|research-evidence-entry)\.js|(studio|mascot|account|research-evidence)\.css|config\.json|icon-(180|192|512)\.png|vendor\/supabase\.js|research-data\/sec\/(AAPL|MSFT|NVDA|AMZN|GOOGL|TSLA)\.json)$/.test(file.path))throw Error('Disallowed public file');
  const bytes=fs.readFileSync(path.join(root,file.path));if(file.sha256&&crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Changed public file');
  const blob=await api('/git/blobs',{content:bytes.toString('base64'),encoding:'base64'});tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
 }
 const t=await api('/git/trees',{base_tree:base.tree.sha,tree});const c=await api('/git/commits',{message:'Release Research Studio 10.2 public guest preview with rollback snapshot',tree:t.sha,parents:[ref.object.sha,process.env.GITHUB_SHA]});
 const result={commit:c.sha,tree:t.sha,previousMain:ref.object.sha,sourceCommit:process.env.GITHUB_SHA,version:manifest.version,files:tree,refUpdated:false,deployed:false};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'release.json'),JSON.stringify(result,null,2));console.log('PREPARED_PUBLIC_RELEASE '+JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
