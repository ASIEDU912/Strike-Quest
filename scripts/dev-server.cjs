// Development-only static server; credentials and repository internals are never served.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
if(fs.existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const url=process.env.SQ_SUPABASE_URL,publishableKey=process.env.SQ_SUPABASE_PUBLISHABLE_KEY;
const configured=url==='https://vjxroixeqhtswzgqfcpk.supabase.co'&&/^sb_publishable_[a-zA-Z0-9_-]+$/.test(publishableKey||'');
const files=new Set(['index.html','account-core.js','account.js','account.css','vendor/supabase.js','mascot.js','mascot.css','studio.js','studio.css','research-evidence.js','research-evidence-core.js','research-evidence-entry.js','research-evidence.css','config.json','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png']);
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const sec=require('./sec-research.cjs').createSecHandler();
const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/research-data/sec'){sec(req,res);return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(pathname==='/account-config.json'){
    if(!configured){res.writeHead(404);res.end('{}');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({environment:'development',supabaseUrl:url,publishableKey}));return;
  }
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!files.has(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  const bytes=fs.readFileSync(path.join(root,file));
  const data=file==='index.html'?require('./evidence-shell.cjs').reviewHtml(bytes.toString('utf8')):file==='sw.js'?require('./evidence-shell.cjs').reviewWorker(bytes.toString('utf8')):bytes;res.end(req.method==='HEAD'?undefined:data);
});
module.exports=server;
if(require.main===module){const port=Number(process.env.SQ_DEV_PORT||3000);server.listen(port,'127.0.0.1',()=>console.log(`StrikeQuests development review: http://localhost:${port} · accounts ${configured?'configured':'unconfigured'} · no deployment`));}
