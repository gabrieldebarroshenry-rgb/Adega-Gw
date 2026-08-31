// Service Worker do Vinha Real.
// Estratégia: "network-first" pro app em si (index.html) — sempre tenta buscar
// a versão mais nova primeiro, e só usa o cache se estiver offline. Isso evita
// o problema clássico de PWA que fica "preso" numa versão antiga do app.
// Ícones e manifest usam "cache-first" (raramente mudam, carregam na hora).
//
// IMPORTANTE: aumente o número da versão (CACHE_NAME) sempre que publicar uma
// mudança relevante no app, pra forçar a limpeza do cache antigo.
const CACHE_NAME = "vinha-real-v1";
const SHELL_FILES = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nunca cachear chamadas ao Firebase/Firestore — dado precisa ser sempre ao vivo.
  if (url.hostname.includes("firebase") || url.hostname.includes("googleapis")) return;

  const isShellFile = url.origin === self.location.origin;

  if (isShellFile) {
    // network-first: tenta buscar fresco, cai pro cache só se offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // bibliotecas externas (CDN): cache-first, cai pra rede se não tiver.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
