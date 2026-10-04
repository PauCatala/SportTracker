// Punto de entrada: login, navegación entre bloques/pestañas y estado de la conexión.
import { supabase, cargarTodo, vaciarCola, pendientes, limpiarLocal } from './db.js';
import { renderRegistrar, renderHistorial } from './gym.js';
import { renderProgreso } from './progreso.js';
import { renderEjercicios, renderMesociclos } from './catalogo.js';
import { renderRutina } from './rutina.js';
import { renderSemanaRun, renderRegistrarRun, renderProgresoRun } from './running.js';
import { renderFlexHoy, renderFlexProgreso } from './flex.js';
import { aviso, capitalizar } from './utils.js';
import { icono } from './iconos.js';

// Cada bloque tiene sus pestañas: [id, nombre visible, función que la pinta]
const BLOQUES = {
  gym: {
    titulo: 'Gimnasio', icono: 'gym',
    vistas: [
      ['rutina', 'Rutina', renderRutina],
      ['entrenar', 'Entreno', renderRegistrar],
      ['progreso', 'Progreso', renderProgreso],
      ['ejercicios', 'Ejercicios', renderEjercicios],
      ['mesociclos', 'Mesociclos', renderMesociclos],
      ['historial', 'Historial', renderHistorial],
    ],
  },
  running: {
    titulo: 'Running', icono: 'running',
    vistas: [
      ['semana', 'Semana', renderSemanaRun],
      ['registrar', 'Registrar', renderRegistrarRun],
      ['progreso', 'Progreso', renderProgresoRun],
    ],
  },
  flex: {
    titulo: 'Flexibilidad', icono: 'flex',
    vistas: [
      ['hoy', 'Hoy', renderFlexHoy],
      ['progreso', 'Progreso', renderFlexProgreso],
    ],
  },
  bici:      { titulo: 'Bici', icono: 'bici', vistas: [] },
  nutricion: { titulo: 'Nutrición', icono: 'nutricion', vistas: [] },
};
let bloque = 'gym';
const vistaDe = { gym: 'entrenar', running: 'semana', flex: 'hoy' };   // recuerda la pestaña de cada bloque
const $ = id => document.getElementById(id);

function pintar() {
  const b = BLOQUES[bloque];
  $('titulo-bloque').textContent = b.titulo;
  $('fecha-hoy').textContent = capitalizar(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  $('barra').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x.dataset.bloque === bloque));

  let vista = vistaDe[bloque];
  if (!b.vistas.some(v => v[0] === vista)) vista = vistaDe[bloque] = b.vistas[0]?.[0];
  $('tabs').innerHTML = b.vistas
    .map(([id, nombre]) => `<button data-vista="${id}" class="${id === vista ? 'activo' : ''}">${nombre}</button>`).join('');
  $('tabs').classList.toggle('oculto', !b.vistas.length);

  const cont = $('vista');
  cont.onclick = cont.oninput = cont.onchange = null;   // quitamos los "escuchadores" de la vista anterior
  if (!b.vistas.length) {
    cont.innerHTML = `
      <div class="vacio">
        <h3>${b.titulo}, en la siguiente fase</h3>
        <p>${bloque === 'bici'
          ? 'Aquí entrarán tus salidas en bici con los datos del Garmin: distancia, potencia, pulso y desnivel.'
          : 'Aquí llevarás creatina, proteína, kcal, agua y tus fases de volumen y definición.'}</p>
      </div>`;
    return;
  }
  b.vistas.find(v => v[0] === vista)[2](cont);
}

// ---------- Navegación ----------
$('barra').innerHTML = Object.entries(BLOQUES).map(([id, b]) =>
  `<button data-bloque="${id}"><span class="pastilla">${icono(b.icono)}</span>${b.titulo}</button>`).join('');
$('btn-salir').innerHTML = icono('salir');

$('barra').onclick = ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  bloque = b.dataset.bloque;
  pintar();
  window.scrollTo(0, 0);
};
$('tabs').onclick = ev => {
  const b = ev.target.closest('button[data-vista]');
  if (!b) return;
  vistaDe[bloque] = b.dataset.vista;
  pintar();
  window.scrollTo(0, 0);
};
// Otras partes de la app pueden pedir ir a una pestaña: { bloque, vista }
window.addEventListener('navegar', ev => {
  const d = typeof ev.detail === 'string' ? { bloque: 'gym', vista: ev.detail } : ev.detail;
  bloque = d.bloque;
  vistaDe[bloque] = d.vista;
  pintar();
  window.scrollTo(0, 0);
});

// ---------- Conexión ----------
function pintarRed() {
  const n = pendientes().length;
  const el = $('estado-red');
  if (!navigator.onLine) {
    el.innerHTML = `${icono('nube')}Sin conexión${n ? `, ${n} por subir` : ''}`;
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
  if (n) { aviso(`Subidas ${n} ${n === 1 ? 'sesión pendiente' : 'sesiones pendientes'}`); pintar(); }
  pintarRed();
});
window.addEventListener('offline', pintarRed);
window.addEventListener('estado-red', pintarRed);

// ---------- Login ----------
async function entrar() {
  $('login').classList.add('oculto');
  $('app').classList.remove('oculto');
  $('vista').innerHTML = '<p class="tenue" style="text-align:center;padding:40px 0">Cargando tus datos…</p>';
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
      : 'El email o la contraseña no son correctos.';
    return;
  }
  entrar();
};

$('btn-salir').onclick = async () => {
  const n = pendientes().length;
  if (!confirm(n ? `Tienes ${n} sesiones sin subir. Se quedarán en este móvil hasta que vuelvas a entrar. ¿Cerrar sesión?` : '¿Cerrar sesión?')) return;
  await supabase.auth.signOut();
  limpiarLocal();
  location.reload();
};

// ---------- Arranque ----------
const { data: { session } } = await supabase.auth.getSession();
if (session) entrar();
else $('login').classList.remove('oculto');

// Service worker: permite instalarla y abrirla sin internet
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
