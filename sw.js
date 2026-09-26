const CACHE = "dark-sky-birds-v20260926";

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isStatic =
    path.includes("/birds/") ||
    path.includes("/assets/") ||
    path.includes("/fonts/") ||
    /\.(?:jpg|jpeg|png|svg|webp|css|js|woff2?|webmanifest)$/i.test(path);

  if (isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(networkFirst(req));
});

async function precache() {
  const cache = await caches.open(CACHE);
  let list = [];
  try {
    const res = await fetch(new URL("precache.json", self.location.href));
    if (res.ok) list = await res.json();
    else console.warn("precache miss", "precache.json", res.status);
  } catch (err) {
    console.warn("precache miss", "precache.json", err);
  }
  const urls = Array.isArray(list) && list.length ? list : fallbackList();
  await Promise.all(urls.map((url) => safePut(cache, url)));
}

function fallbackList() {
  return [
    "./",
    "./index.html",
    "./guide",
    "./list",
    "./identify",
    "./manifest.webmanifest",
    "./favicon.svg",
    "./offline.html",
    "./dark-sky-birds-seal.jpg",
    "./region-warrumbungle.jpg",
    "./region-pilliga.jpg",
    "./icon-180.png",
    "./icon-192.png",
    "./icon-512.png",
  ];
}

async function safePut(cache, url) {
  try {
    const abs = new URL(url, self.location.href).href;
    const res = await fetch(abs, { cache: "reload" });
    const type = res.headers.get("content-type") || "";
    const htmlShell = res.status === 404 && type.includes("text/html");
    if (!res.ok && !htmlShell) {
      console.warn("precache miss", abs, res.status);
      return;
    }
    await cache.put(abs, res);
  } catch (err) {
    console.warn("precache miss", url, err);
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      const cache = await caches.open(CACHE);
      await cache.put(req, copy);
    }
    return res;
  } catch (err) {
    console.warn("cache miss", req.url, err);
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      const cache = await caches.open(CACHE);
      await cache.put(req, copy);
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell =
        (await caches.match(new URL("./index.html", self.location.href))) ||
        (await caches.match(new URL("./", self.location.href)));
      if (shell) return shell;
      const offline = await caches.match(new URL("./offline.html", self.location.href));
      if (offline) return offline;
    }
    return new Response(
      "No service just now. This guide is on your phone. Try again when you next have signal.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
}
