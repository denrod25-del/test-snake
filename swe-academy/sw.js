/* Offline shell — network-first while online so you always pick up edits; cache is fallback offline. */

const CACHE = 'swe-academy-v4';

const ASSETS = [

  './',

  './index.html',

  './styles.css',

  './app.js',

  './curriculum.js',

  './challenges.js',

  './flashcards.js',

  './cheatsheets.js',

  './projects.js',

  './resources.js',

  './community.js',

  './capstones.js',

  './badges.js',

  './manifest.json',

  './icon-192.svg',

  './icon-512.svg',

];



self.addEventListener('install', event => {

  event.waitUntil(

    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())

  );

});



self.addEventListener('activate', event => {

  event.waitUntil(

    caches

      .keys()

      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))

      .then(() => self.clients.claim())

  );

});



function putInCache(req, response) {

  try {

    if (response && response.ok && req.method === 'GET') {

      const copy = response.clone();

      caches.open(CACHE).then(c => c.put(req, copy));

    }

  } catch (_) {}

}



self.addEventListener('fetch', event => {

  const req = event.request;

  const u = new URL(req.url);

  if (u.origin !== location.origin || req.method !== 'GET') return;



  event.respondWith(

    fetch(req)

      .then(res => {

        putInCache(req, res);

        return res;

      })

      .catch(async () => {

        const hit = await caches.match(req);

        if (hit) return hit;

        if (req.mode === 'navigate' || req.destination === 'document') {

          const shell = await caches.match('./index.html');

          if (shell) return shell;

        }

        return caches.match('./');

      })

  );

});


