const CACHE='strikequests-v10-3-quest-renewal-20261015-1';
const CORE=['./','./index.html','./manifest.webmanifest','./config.json','./icon-180.png','./icon-192.png','./icon-512.png','./mascot.js','./mascot.css','./studio.js','./studio.css','./account-core.js','./account.js','./account.css','./vendor/supabase.js',"./research-evidence-core.js","./research-evidence.js","./research-evidence-entry.js","./research-evidence.css","./public-preview.js"];
const CORE_URLS=new Set(CORE.map(path=>new URL(path,self.location.href).href));
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  // Cache only the app shell. Provider requests can contain API keys in the URL.
  const url=new URL(e.request.url);url.hash='';
  const cacheUrl=url.href;
  if(e.request.method!=='GET'||!CORE_URLS.has(cacheUrl))return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(cacheUrl,copy)))}
    return r;
  }).catch(()=>caches.match(cacheUrl)));
});
