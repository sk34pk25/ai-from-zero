/* Cache exclusivement public : ni sessions, ni Supabase, ni notes ou requêtes POST. */
const MANIFEST = "offline-manifest.json";
let manifest;
async function inventory() {
  if (!manifest) {
    let response;
    try {
      response = await fetch(new URL(MANIFEST, self.registration.scope), {
        cache: "no-store",
      });
    } catch {
      response = await caches.match(
        new URL(MANIFEST, self.registration.scope).href,
      );
    }
    if (!response?.ok) throw new Error("Catalogue hors connexion indisponible");
    manifest = await response.json();
  }
  return manifest;
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const m = await inventory();
      const cache = await caches.open(`afz-public-${m.version}`);
      await cache.addAll(
        m.shell.map((p) => new URL(p, self.registration.scope).href),
      );
    })(),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const m = await inventory();
      for (const key of await caches.keys())
        if (key.startsWith("afz-public-") && key !== `afz-public-${m.version}`)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_COURSE")
    event.waitUntil(
      (async () => {
        try {
          const m = await inventory();
          const cache = await caches.open(`afz-public-${m.version}`);
          const paths = [
            ...m.shell,
            ...m.course,
            ...(event.data.models ? m.models : []),
          ];
          for (const p of paths)
            await cache.add(new URL(p, self.registration.scope).href);
          event.ports[0]?.postMessage({ count: paths.length });
        } catch {
          event.ports[0]?.postMessage({
            error: "Téléchargement incomplet. Reconnecte-toi puis réessaie.",
          });
        }
      })(),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope) ||
    url.searchParams.has("t") ||
    url.pathname.endsWith("version.json")
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(
        `afz-public-${(await inventory()).version}`,
      );
      try {
        const response = await fetch(event.request);
        return response;
      } catch {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === "navigate")
          return (
            (await cache.match(
              new URL("index.html", self.registration.scope).href,
            )) || Response.error()
          );
        return Response.error();
      }
    })(),
  );
});
