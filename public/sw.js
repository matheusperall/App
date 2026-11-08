// Service worker da Sempre Zero: recebe as notificações e abre o app ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: "Sempre Zero", corpo: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(dados.titulo || "Sempre Zero", {
      body: dados.corpo || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { link: dados.link || "/notificacoes" },
      lang: "pt-BR",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || "/notificacoes", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          await janela.focus();
          return janela.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
