const CACHE = "arjun-v1";
self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"]).catch(function(){});
  }));
});
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET"){ return; }
  e.respondWith(fetch(e.request).catch(function(){ return caches.match(e.request); }));
});
