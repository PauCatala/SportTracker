// SERVICE WORKER: un pequeño programa que el navegador ejecuta "por detrás".
// Guarda una copia de la app en el móvil para que se abra aunque no haya internet.

const CACHE = 'lumen-v6';
const ARCHIVOS = [
  './', './index.html', './manifest.json', './css/tokens.css', './css/styles.css', './css/app.css',
  './js/app.js', './js/config.js', './js/db.js', './js/utils.js', './js/consultas.js',
  './js/gym.js', './js/progreso.js', './js/catalogo.js', './js/plan.js', './js/running.js',
  './js/flex.js', './js/graficos.js', './js/iconos.js', './js/rutina.js',
  './js/almacen.js', './js/perfil.js', './js/nutricion.js', './js/notas.js', './js/estudios.js', './js/personal.js',
  './js/fotos.js', './js/imagen.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const guardarCopia = (req, res) => {
  if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
  return res;
};

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;   // tus datos: siempre directo a Supabase

  if (url.origin === location.origin) {
    // Archivos de la app: primero internet (para ver siempre la última versión), si falla, la copia
    ev.respondWith(
      fetch(req).then(res => guardarCopia(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
  } else {
    // Librerías y tipografía externas (Supabase, Chart.js, Google Fonts): primero la copia, que no cambian
    ev.respondWith(caches.match(req).then(r => r || fetch(req).then(res => guardarCopia(req, res))));
  }
});
