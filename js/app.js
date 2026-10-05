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

// =====================================================================
// LUMEN: cuatro secciones + Hoy. Salud contiene los bloques que ya funcionaban.
// =====================================================================

// Bloques de Salud: cada uno tiene sus pestañas [id, nombre visible, función que la pinta]
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
  nutricion: { titulo: 'Nutrición', icono: 'nutricion', vistas: [] },
};

// Secciones principales. "c" es su color (de css/tokens.css).
const SECCIONES = {
  hoy:          { titulo: 'Hoy', icono: 'hoy', c: 'marca' },
  salud:        { titulo: 'Salud', icono: 'salud', c: 'deporte' },
  imagen:       { titulo: 'Imagen', icono: 'imagen', c: 'diario' },
  estudios:     { titulo: 'Estudios', icono: 'estudios', c: 'estudio' },
  organizacion: { titulo: 'Organización', icono: 'organizacion', c: 'nutricion' },
};
const colorFuerte = c => c === 'marca' ? 'var(--marca)' : `var(--${c}-fuerte)`;
const colorSuave = c => c === 'marca' ? '#E6ECFB' : `var(--${c})`;

let seccion = 'hoy';
let bloque = 'gym';
const vistaDe = { gym: 'entrenar', running: 'semana', flex: 'hoy' };   // recuerda la pestaña de cada bloque
let sesionIniciada = false;
let datosCargados = false;
const $ = id => document.getElementById(id);

// ---------- Pintar ----------
function pintar() {
  const sec = SECCIONES[seccion];
  $('fecha-hoy').textContent = capitalizar(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  document.querySelectorAll('[data-seccion]').forEach(x => x.classList.toggle('activo', x.dataset.seccion === seccion));
  history.replaceState(null, '', `#${seccion}`);

  const cont = $('vista');
  cont.onclick = cont.oninput = cont.onchange = null;   // quitamos los "escuchadores" de la vista anterior

  const esSalud = seccion === 'salud';
  $('subbloques').classList.toggle('oculto', !esSalud);
  $('tabs').classList.add('oculto');
  $('titulo-bloque').textContent = sec.titulo;

  if (seccion === 'hoy') return renderHoy(cont);
  if (!esSalud) return renderProximamente(cont, seccion);

  // ----- Salud -----
  $('subbloques').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x.dataset.bloque === bloque));
  if (!sesionIniciada) return renderPideEntrar(cont, 'Entra para ver tus entrenos, carreras y flexibilidad.');
  if (!datosCargados) {
    cont.innerHTML = '<p class="tenue" style="text-align:center;padding:40px 0">Cargando tus datos…</p>';
    return;
  }

  const b = BLOQUES[bloque];
  let vista = vistaDe[bloque];
  if (!b.vistas.some(v => v[0] === vista)) vista = vistaDe[bloque] = b.vistas[0]?.[0];
  $('tabs').innerHTML = b.vistas
    .map(([id, nombre]) => `<button data-vista="${id}" class="${id === vista ? 'activo' : ''}">${nombre}</button>`).join('');
  $('tabs').classList.toggle('oculto', !b.vistas.length);

  if (!b.vistas.length) {
    cont.innerHTML = `
      <div class="vacio">
        <h3>Nutrición, en la siguiente fase</h3>
        <p>Aquí llevarás tus comidas, kcal, proteína, agua y suplementos, conectado con tu plan de entreno.</p>
      </div>`;
    return;
  }
  b.vistas.find(v => v[0] === vista)[2](cont);
}

// ---------- Hoy: el resumen de tu día ----------
function renderHoy(cont) {
  const tarjeta = (sec, texto, acciones = '') => {
    const s = SECCIONES[sec];
    return `
      <article class="tarjeta-hoy" style="--c-fuerte: ${colorFuerte(s.c)}; --c-suave: ${colorSuave(s.c)}">
        <header>${icono(s.icono)}<h3>${s.titulo}</h3></header>
        <p>${texto}</p>
        <div class="acciones-hoy">${acciones}</div>
      </article>`;
  };
  const ir = (sec, bl, vista, nombre, principal = false) =>
    `<button class="btn ${principal ? 'primario' : 'suave'} chico" data-ir="${sec}|${bl || ''}|${vista || ''}">${nombre}</button>`;
  const pronto = '<span class="pronto">Muy pronto</span>';

  cont.innerHTML = `
    ${sesionIniciada ? '' : `
      <div class="hoy-aviso">
        <p>Estás viendo Lumen sin cuenta. Entra para guardar tu progreso.</p>
        <button class="btn primario chico" data-entrar>Entrar</button>
      </div>`}
    <div class="hoy-grid">
      ${tarjeta('salud', 'Tu entreno de hoy, tus carreras y tu rutina de flexibilidad.',
        ir('salud', 'gym', 'entrenar', 'Empezar entreno', true) + ir('salud', 'running', 'registrar', 'Registrar carrera') + ir('salud', 'flex', 'hoy', 'Flexibilidad'))}
      ${tarjeta('estudios', 'Asignaturas, exámenes y horas de estudio, repartidas hasta cada examen.', pronto)}
      ${tarjeta('imagen', 'Tu diario visual: fotos de progreso físico, comidas y momentos del día.', pronto)}
      ${tarjeta('organizacion', 'Calendario, tareas y hábitos para que nada se te escape.', pronto)}
    </div>`;

  cont.onclick = ev => {
    if (ev.target.closest('[data-entrar]')) return abrirLogin();
    const b = ev.target.closest('[data-ir]');
    if (!b) return;
    const [sec, bl, vista] = b.dataset.ir.split('|');
    seccion = sec;
    if (bl) bloque = bl;
    if (vista) vistaDe[bloque] = vista;
    pintar();
    window.scrollTo(0, 0);
  };
}

// ---------- Secciones que aún se están construyendo ----------
const PROXIMAMENTE = {
  imagen: ['Tu diario visual', 'Guarda fotos de tu progreso físico, tus comidas y tu día, y compara mes a mes con un antes y después.',
    ['Fotos de progreso con fecha y medidas', 'Antes y después automático cada mes', 'Fotos de comidas enlazadas con Nutrición']],
  estudios: ['Tus estudios, en orden', 'Asignaturas, exámenes, entregas y horas de estudio, con un planificador que reparte el temario hasta cada examen.',
    ['Calendario de exámenes y entregas', 'Planificador de temario que se reajusta solo', 'Registro de horas y media de notas']],
  organizacion: ['Tu día, organizado', 'Tareas, hábitos y calendario personal en un solo sitio, conectados con el resto de tu vida.',
    ['Tareas del día y de la semana', 'Seguimiento de hábitos', 'Vista de calendario con todo junto']],
};
function renderProximamente(cont, sec) {
  const s = SECCIONES[sec];
  const [titulo, texto, lista] = PROXIMAMENTE[sec];
  cont.innerHTML = `
    <div class="proximamente" style="--c-fuerte: ${colorFuerte(s.c)}; --c-suave: ${colorSuave(s.c)}">
      ${icono(s.icono)}
      <h3>${titulo}</h3>
      <p>${texto}</p>
      <ul>${lista.map(x => `<li>${x}</li>`).join('')}</ul>
      <span class="etiqueta pend">En construcción</span>
    </div>`;
}

function renderPideEntrar(cont, texto) {
  cont.innerHTML = `
    <div class="vacio">
      <h3>Entra en tu cuenta</h3>
      <p>${texto}</p>
      <button class="btn primario" data-entrar>Entrar</button>
    </div>`;
  cont.onclick = ev => { if (ev.target.closest('[data-entrar]')) abrirLogin(); };
}

// ---------- Navegación ----------
const botonSeccion = (id, s, conPastilla) =>
  `<button data-seccion="${id}" style="--c: ${colorFuerte(s.c)}">${conPastilla ? `<span class="pastilla">${icono(s.icono)}</span>` : icono(s.icono)}${s.titulo}</button>`;
$('secciones').innerHTML = Object.entries(SECCIONES).map(([id, s]) => botonSeccion(id, s, false)).join('');
$('barra').innerHTML = Object.entries(SECCIONES).map(([id, s]) => botonSeccion(id, s, true)).join('');
$('subbloques').innerHTML = Object.entries(BLOQUES).map(([id, b]) =>
  `<button data-bloque="${id}">${icono(b.icono)}${b.titulo}</button>`).join('');

const alElegirSeccion = ev => {
  const b = ev.target.closest('button[data-seccion]');
  if (!b) return;
  seccion = b.dataset.seccion;
  pintar();
  window.scrollTo(0, 0);
};
$('secciones').onclick = alElegirSeccion;
$('barra').onclick = alElegirSeccion;
$('subbloques').onclick = ev => {
  const b = ev.target.closest('button[data-bloque]');
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
  seccion = 'salud';
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

// ---------- Entrar ----------
function abrirLogin() {
  $('login').classList.remove('oculto');
  setTimeout(() => $('form-login').querySelector('input').focus(), 50);
}
function cerrarLogin() { $('login').classList.add('oculto'); }
$('btn-entrar').onclick = abrirLogin;
$('btn-entrar-movil').onclick = abrirLogin;
$('login-cerrar').onclick = cerrarLogin;
$('login').onclick = ev => { if (ev.target === $('login')) cerrarLogin(); };
addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrarLogin(); });

function pintarCuenta() {
  $('btn-entrar').classList.toggle('oculto', sesionIniciada);
  $('btn-entrar-movil').classList.toggle('oculto', sesionIniciada);
  $('btn-salir').classList.toggle('oculto', !sesionIniciada);
}

async function entrar() {
  sesionIniciada = true;
  cerrarLogin();
  pintarCuenta();
  pintar();
  await cargarTodo();
  await vaciarCola();
  datosCargados = true;
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
const enlace = location.hash.slice(1);
if (SECCIONES[enlace]) seccion = enlace;
const { data: { session } } = await supabase.auth.getSession();
pintarCuenta();
if (session) entrar();
else pintar();

// Service worker: permite instalarla y abrirla sin internet
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
