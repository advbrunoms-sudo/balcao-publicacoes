const CACHE_NAME = "balcao-publicacoes-v1";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  // deixa passar direto pra rede as chamadas ao Firebase/Firestore — nunca vêm do cache
  if (url.includes("firestore.googleapis.com") || url.includes("firebaseio.com") || url.includes("googleapis.com")) {
    return;
  }
  event.respondWith(caches.match(event.request).then((resposta) => resposta || fetch(event.request)));
});
