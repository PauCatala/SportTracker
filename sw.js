// SERVICE WORKER: un pequeño programa que el navegador ejecuta "por detrás".
// Guarda una copia de la app en el móvil para que se abra aunque no haya internet.

const CACHE = 'lumen-v18';
// Recursos del avatar (modelos, texturas, animaciones): no cambian dentro de una versión
const CACHE_AVATAR = 'lumen-avatar-1';
const ARCHIVOS = [
  './', './index.html', './manifest.json', './css/tokens.css', './css/styles.css', './css/app.css', './css/pulido.css', './css/v2.css',
  './js/app.js', './js/config.js', './js/db.js', './js/utils.js', './js/consultas.js',
  './js/gym.js', './js/progreso.js', './js/catalogo.js', './js/plan.js', './js/running.js',
  './js/flex.js', './js/graficos.js', './js/iconos.js', './js/rutina.js',
  './js/almacen.js', './js/perfil.js', './js/nutricion.js', './js/notas.js', './js/estudios.js', './js/personal.js',
  './js/fotos.js', './js/imagen.js', './js/interaccion.js', './js/intros.js', './js/ical.js', './js/agenda.js', './js/calendario.js',
  './js/inicio.js', './js/social.js', './js/inicio/rueda.js', './js/inicio/publicaciones.js', './js/inicio/avatar.js',
  './js/avatar/motor.js', './js/avatar/parametros.js', './js/avatar/animacion.js', './js/avatar/creador.js',
  './vendor/three/three.module.min.js', './vendor/three/addons/loaders/GLTFLoader.js', './vendor/three/addons/utils/BufferGeometryUtils.js',
  './vendor/three/addons/utils/SkeletonUtils.js', './vendor/three/addons/environments/RoomEnvironment.js',
  './js/intro-base.js', './js/intro-nutricion.js', './js/intro-gym.js', './js/intro-flex.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/logo.svg',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE && k !== CACHE_AVATAR).map(k => caches.delete(k))))
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
  if (url.pathname.startsWith('/media/avatar/')) {
    // Avatar: primero la copia (se descarga una vez y queda en el dispositivo)
    ev.respondWith(caches.open(CACHE_AVATAR).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;   // calendarios y vídeos: siempre directo, sin copia

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
