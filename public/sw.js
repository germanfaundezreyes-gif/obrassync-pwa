// Service worker de ObrasSync. Solo maneja notificaciones push: no cachea nada,
// porque la app necesita datos frescos de terreno y un caché mal invalidado
// mostraría partidas o gastos viejos sin que nadie se dé cuenta.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = { title: "ObrasSync", body: "", url: "/" };
  try { if (event.data) d = { ...d, ...event.data.json() }; } catch { d.body = event.data ? event.data.text() : ""; }
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: d.url || "/" },
      // Sin tag: cada aviso es distinto y no debe reemplazar al anterior.
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      // Si la app ya está abierta se reusa esa ventana en vez de abrir otra.
      for (const c of lista) if ("focus" in c) return c.focus();
      return self.clients.openWindow(destino);
    })
  );
});
