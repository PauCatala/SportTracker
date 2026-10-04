// Punto de entrada: login, navegación entre bloques/pestañas y estado de la conexión.
import { supabase, cargarTodo, vaciarCola, pendientes, limpiarLocal } from './db.js';
import { renderRegistrar, renderHistorial } from './gym.js';
import { renderProgreso } from './progreso.js';
import { renderEjercicios, renderMesociclos } from './catalogo.js';
import { aviso } from './utils.js';

// Cada bloque tiene sus pestañas: [id, nombre visible, función que la pinta]
const BLOQUES = {
  gym: {
    titulo: 'Gimnasio',
    vistas: [
      ['entrenar', 'Entrenar', renderRegistrar],
      ['historial', 'Historial', renderHistorial],
      ['progreso', 'Progreso', renderProgreso],
      ['ejercicios', 'Ejercicios', renderEjercicios],
      ['mesociclos', 'Mesociclos', renderMesociclos],
    ],
  },
  running:   { titulo: 'Running', vistas: [] },
  flex:      { titulo: 'Flexibilidad', vistas: [] },
  bici:      { titulo: 'Bici', vistas: [] },
  nutricion: { titulo: 'Nutrición', vistas: [] },
};
let bloque = 'gym', vista = 'entrenar';
const $ = id => document.getElementById(id);

function pintar() {
  const b = BLOQUES[bloque];
  $('titulo-bloque').textContent = b.titulo;
  document.querySelectorAll('.bloques button').forEach(x => x.classList.toggle('activo', x.dataset.bloque === bloque));
  $('subnav').innerHTML = b.vistas
    .map(([id, nombre]) => `<button data-vista="${id}" class="${id === vista ? 'activo' : ''}">${nombre}</button>`).join('');
  $('subnav').classList.toggle('oculto', !b.vistas.length);

  const cont = $('vista');
  cont.onclick = cont.oninput = cont.onchange = null;   // quitamos los "escuchadores" de la vista anterior
  if (!b.vistas.length) {
    cont.innerHTML = `<div class="proximamente"><p class="emoji">🚧</p><p><b>${b.titulo}</b> llegará en las próximas fases.</p></div>`;
    return;
  }
  const v = b.vistas.find(x => x[0] === vista) || b.vistas[0];
  vista = v[0];
  v[2](cont);
}

// ---------- Navegación ----------
document.querySelector('.bloques').onclick = ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  bloque = b.dataset.bloque;
  vista = BLOQUES[bloque].vistas[0]?.[0];
  pintar();
  window.scrollTo(0, 0);
};
$('subnav').onclick = ev => {
  const b = ev.target.closest('button[data-vista]');
  if (!b) return;
  vista = b.dataset.vista;
  pintar();
  window.scrollTo(0, 0);
};
window.addEventListener('navegar', ev => { bloque = 'gym'; vista = ev.detail; pintar(); window.scrollTo(0, 0); });

// ---------- Conexión ----------
function pintarRed() {
  const n = pendientes().length;
  const el = $('estado-red');
  if (!navigator.onLine) {
    el.textContent = `Sin conexión${n ? ` · ${n} por subir` : ''}`;
    el.className = 'estado-red off';
  } else if (n) {
    el.textContent = `${n} por subir`;
    el.className = 'estado-red pend';
  } else {
    el.textContent = '';
    el.className = 'estado-red';
  }
}
window.addEventListener('online', async () => {
  pintarRed();
  const n = await vaciarCola();
  if (n) { aviso(`Subidas ${n} sesiones pendientes ✔`); pintar(); }
  pintarRed();
});
window.addEventListener('offline', pintarRed);
window.addEventListener('estado-red', pintarRed);

// ---------- Login ----------
async function entrar() {
  $('login').classList.add('oculto');
  $('app').classList.remove('oculto');
  $('vista').innerHTML = '<p class="vacio">Cargando tus datos…</p>';
  await cargarTodo();
  await vaciarCola();
  pintarRed();
  pintar();
}

$('form-login').onsubmit = async ev => {
  ev.preventDefault();
  const datos = new FormData(ev.target);
  const boton = ev.target.querySelector('button');
  $('login-error').textContent = '';
  boton.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({
    email: datos.get('email'), password: datos.get('password'),
  });
  boton.disabled = false;
  if (error) {
    $('login-error').textContent = /fetch|load failed/i.test(error.message)
      ? 'Sin conexión. Necesitas internet para iniciar sesión.'
      : 'Email o contraseña incorrectos';
    return;
  }
  entrar();
};

$('btn-salir').onclick = async () => {
  const n = pendientes().length;
  if (!confirm(n ? `Tienes ${n} sesiones sin subir. Si sales ahora se quedarán en este móvil hasta que vuelvas a entrar. ¿Salir?` : '¿Cerrar sesión?')) return;
  await supabase.auth.signOut();
  limpiarLocal();
  location.reload();
};

// ---------- Arranque ----------
const { data: { session } } = await supabase.auth.getSession();
if (session) entrar();
else $('login').classList.remove('oculto');

// Registrar el "service worker": lo que permite instalarla y abrirla sin internet
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
