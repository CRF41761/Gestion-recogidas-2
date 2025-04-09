const CACHE_NAME = "gestion-recogidas-v1";
const urlsToCache = [
    "/Gestion-recogidas-2/",  // Asegura que coincide con tu repositorio
    "/Gestion-recogidas-2/index.html",
    "/Gestion-recogidas-2/styles.css",
    "/Gestion-recogidas-2/script.js",
    "/Gestion-recogidas-2/manifest.json",
    "/Gestion-recogidas-2/icons/icon-192x192.png",
    "/Gestion-recogidas-2/icons/icon-512x512.png",
    "/Gestion-recogidas-2/municipios.json" // Añadimos el archivo JSON de municipios
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cache => cache !== CACHE_NAME).map(cache => caches.delete(cache))
            );
        })
    );
});


