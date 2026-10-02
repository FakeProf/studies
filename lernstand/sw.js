/**
 * Service Worker — macht die Seite installierbar und offline lesbar.
 *
 * Zwei Regeln, mehr braucht es hier nicht:
 *
 *   1. Nur eigene Dateien werden angefasst. Alles Fremde — Schriften, das
 *      Neon-SDK, vor allem die Datenbank selbst — geht unberührt ins Netz.
 *      Eine zwischengespeicherte Antwort der Data API wäre ein falscher
 *      Lernstand, und zwar einer, den niemand mehr loswird.
 *   2. Erst Netz, dann Ablage. Die App ist eine einzige HTML-Datei; würde
 *      der Cache gewinnen, liefe nach einem Push noch tagelang die alte
 *      Fassung. Offline springt die Ablage ein, online nie.
 *
 * Beim Veroeffentlichen einer neuen Fassung VERSION hochzaehlen.
 */
const VERSION = "studylane-v4";
const SCHALE = [
  "./",
  "./index.html",
  "./daten/fragen.json",
  "./manifest.webmanifest",
  "./symbole/symbol-192.png",
  "./symbole/symbol-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // Einzeln, damit eine fehlende Datei nicht die ganze Installation kippt.
      .then((c) => Promise.allSettled(SCHALE.map((p) => c.add(p))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin !== self.location.origin) return;          // fremde Server: nicht anfassen

  e.respondWith((async () => {
    try {
      const frisch = await fetch(e.request);
      if (frisch && frisch.ok) {
        const ablage = await caches.open(VERSION);
        ablage.put(e.request, frisch.clone());
      }
      return frisch;
    } catch (fehler) {
      const alt = await caches.match(e.request);
      if (alt) return alt;
      // Navigation ohne Netz und ohne Treffer: die Startseite tut es auch.
      if (e.request.mode === "navigate") {
        const start = await caches.match("./index.html");
        if (start) return start;
      }
      throw fehler;
    }
  })());
});
