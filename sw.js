// Service worker mínimo: deixa o site instalável e não guarda nada em cache,
// assim cada deploy novo chega na hora e os dados financeiros sempre vêm da rede.
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (evento) {
  evento.respondWith(fetch(evento.request));
});
