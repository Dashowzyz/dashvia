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

// Notificações push: a função avisos-push manda { titulo, corpo, url, tag }
self.addEventListener("push", function (evento) {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (falha) {
    dados = { titulo: "Dashvia", corpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(self.registration.showNotification(dados.titulo || "Dashvia", {
    body: dados.corpo || "",
    icon: "img/icone-192.png",
    badge: "img/icone-192.png",
    tag: dados.tag || "dashvia",
    data: { url: dados.url || "dashboard.html" }
  }));
});

// Tocar na notificação abre (ou traz para frente) o Dashvia na página certa
self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();
  const destino = new URL(evento.notification.data && evento.notification.data.url || "dashboard.html", self.registration.scope).href;
  evento.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (janelas) {
    for (const janela of janelas) {
      if (janela.url.startsWith(self.registration.scope) && "navigate" in janela) {
        return janela.navigate(destino).then(function (j) { return j && j.focus(); });
      }
    }
    return self.clients.openWindow(destino);
  }));
});
