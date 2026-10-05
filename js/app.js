// Punto de entrada: login, navegación entre bloques/pestañas y estado de la conexión.
import { supabase, cargarTodo, vaciarCola, pendientes, limpiarLocal } from './db.js';
import { renderRegistrar, renderHistorial } from './gym.js';
import { renderProgreso } from './progreso.js';
import { renderEjercicios, renderMesociclos } from './catalogo.js';
import { renderRutina } from './rutina.js';
import { renderSemanaRun, renderRegistrarRun, renderProgresoRun } from './running.js';
import { renderFlexHoy, renderFlexProgreso } from './flex.js';
import { renderPerfil, PERFIL_VACIO } from './perfil.js';
import { renderNutriHoy, renderNutriObjetivos, renderNutriIdeas, objetivosDelDia, totalesDe } from './nutricion.js';
import { renderTablero, renderNotasEstudios, tareasPendientes } from './estudios.js';
import { renderHabitos, renderLista, renderNotasPersonal, habitosDeHoy, pendientesLista } from './personal.js';
import { leer, sincronizar, olvidar, hoyISO } from './almacen.js';
import { aviso, capitalizar } from './utils.js';
import { icono } from './iconos.js';

// =====================================================================
// LUMEN: Hoy + cuatro secciones.
// Cada grupo tiene pestañas: [id, nombre visible, función que la pinta].
// "cuenta: true" = necesita haber entrado (usa las tablas de entreno de Supabase).
// =====================================================================

// Apartados de Salud
const BLOQUES = {
  perfil: {
    titulo: 'Perfil', icono: 'perfil',
    vistas: [['datos', 'Tus datos', renderPerfil]],
  },
  gym: {
    titulo: 'Gimnasio', icono: 'gym', cuenta: true,
    vistas: [
      ['rutina', 'Rutina', renderRutina],
      ['entrenar', 'Entreno', renderRegistrar],
      ['progreso', 'Progreso', renderProgreso],
      ['ejercicios', 'Ejercicios', renderEjercicios],
      ['mesociclos', 'Mesociclos', renderMesociclos],
      ['historial', 'Historial', renderHistorial],
    ],
  },
  nutricion: {
    titulo: 'Nutrición', icono: 'nutricion',
    vistas: [
      ['hoy', 'Hoy', renderNutriHoy],
      ['objetivos', 'Objetivos', renderNutriObjetivos],
      ['ideas', 'Ideas de comidas', renderNutriIdeas],
    ],
  },
  running: {
    titulo: 'Running', icono: 'running', cuenta: true,
    vistas: [
      ['semana', 'Semana', renderSemanaRun],
      ['registrar', 'Registrar', renderRegistrarRun],
      ['progreso', 'Progreso', renderProgresoRun],
    ],
  },
  flex: {
    titulo: 'Flexibilidad', icono: 'flex', cuenta: true,
    vistas: [
      ['hoy', 'Hoy', renderFlexHoy],
      ['progreso', 'Progreso', renderFlexProgreso],
    ],
  },
};

// Secciones principales. "c" es su color (de css/tokens.css).
const SECCIONES = {
  hoy:      { titulo: 'Hoy', icono: 'hoy', c: 'marca' },
  salud:    { titulo: 'Salud', icono: 'salud', c: 'deporte' },
  estudios: {
    titulo: 'Estudios y trabajo', corto: 'Estudios', icono: 'estudios', c: 'estudio',
    vistas: [['tablero', 'Tareas', renderTablero], ['notas', 'Notas', renderNotasEstudios]],
  },
  personal: {
    titulo: 'Personal', icono: 'organizacion', c: 'personal',
    vistas: [['habitos', 'Hábitos', renderHabitos], ['lista', 'Lista', renderLista], ['notas', 'Notas', renderNotasPersonal]],
  },
  imagen:   { titulo: 'Imagen', icono: 'imagen', c: 'diario' },
};
const colorFuerte = c => c === 'marca' ? 'var(--marca)' : `var(--${c}-fuerte)`;
const colorSuave = c => c === 'marca' ? 'var(--azul-pastel)' : `var(--${c})`;

let seccion = 'hoy';
let bloque = 'nutricion';
// Recuerda la pestaña abierta de cada grupo (apartados de Salud y secciones)
const vistaDe = { gym: 'entrenar', running: 'semana', flex: 'hoy', nutricion: 'hoy' };
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
  cont.ondragstart = cont.ondragend = cont.ondragover = cont.ondrop = null;

  const esSalud = seccion === 'salud';
  $('subbloques').classList.toggle('oculto', !esSalud);
  $('tabs').classList.add('oculto');
  $('titulo-bloque').textContent = sec.titulo;

  if (seccion === 'hoy') return renderHoy(cont);
  if (seccion === 'imagen') return renderProximamente(cont, seccion);

  // El "grupo" es el apartado de Salud elegido, o la propia sección
  const claveGrupo = esSalud ? bloque : seccion;
  const grupo = esSalud ? BLOQUES[bloque] : sec;
  if (esSalud) $('subbloques').querySelectorAll('button').forEach(x => x.classList.toggle('activo', x.dataset.bloque === bloque));

  if (grupo.cuenta && !sesionIniciada) return renderPideEntrar(cont, `Entra para ver tu ${grupo.titulo.toLowerCase()}: lo guardamos en tu cuenta.`);
  if (grupo.cuenta && !datosCargados) {
    cont.innerHTML = '<p class="tenue" style="text-align:center;padding:40px 0">Cargando tus datos…</p>';
    return;
  }

  let vista = vistaDe[claveGrupo];
  if (!grupo.vistas.some(v => v[0] === vista)) vista = vistaDe[claveGrupo] = grupo.vistas[0][0];
  $('tabs').innerHTML = grupo.vistas
    .map(([id, nombre]) => `<button data-vista="${id}" class="${id === vista ? 'activo' : ''}">${nombre}</button>`).join('');
  $('tabs').classList.toggle('oculto', grupo.vistas.length < 2);
  grupo.vistas.find(v => v[0] === vista)[2](cont);
}
const grupoActual = () => (seccion === 'salud' ? bloque : seccion);

// ---------- Hoy: el resumen de tu día, con datos reales ----------
function renderHoy(cont) {
  const hoy = hoyISO();
  const perfil = leer('perfil', PERFIL_VACIO);
  const obj = objetivosDelDia();
  const kcal = Math.round(totalesDe(hoy).kcal);
  const hab = habitosDeHoy();
  const tareas = tareasPendientes();
  const enCurso = tareas.filter(t => t.estado === 'curso');
  const vencenHoy = tareas.filter(t => t.fecha && t.fecha <= hoy);
  const lista = pendientesLista();

  const tarjeta = (sec, cifra, texto, acciones) => {
    const s = SECCIONES[sec];
    return `
      <article class="tarjeta-hoy" style="--c-fuerte: ${colorFuerte(s.c)}; --c-suave: ${colorSuave(s.c)}">
        <header>${icono(s.icono)}<h3>${s.titulo}</h3></header>
        ${cifra ? `<p class="cifra-hoy">${cifra}</p>` : ''}
        <p>${texto}</p>
        <div class="acciones-hoy">${acciones}</div>
      </article>`;
  };
  const ir = (sec, grupo, vista, nombre, principal = false) =>
    `<button class="btn ${principal ? 'primario' : 'suave'} chico" data-ir="${sec}|${grupo || ''}|${vista || ''}">${nombre}</button>`;

  const saludo = (() => { const h = new Date().getHours(); return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'; })();

  cont.innerHTML = `
    <p class="saludo-hoy">${saludo}. Esto es lo que tienes hoy.</p>
    ${sesionIniciada ? '' : `
      <div class="hoy-aviso">
        <p>Estás usando Lumen sin cuenta: tus datos se guardan en este navegador. Entra para tenerlos en todos tus dispositivos.</p>
        <button class="btn primario chico" data-entrar>Entrar</button>
      </div>`}
    <div class="hoy-grid">
      ${tarjeta('salud',
        obj ? `${kcal.toLocaleString('es-ES')} <small>de ${obj.kcal.toLocaleString('es-ES')} kcal</small>` : '',
        obj ? `Peso actual ${perfil.peso} kg${perfil.pesoObjetivo ? ` · objetivo ${perfil.pesoObjetivo} kg` : ''}.` : 'Completa tu perfil para calcular tus calorías y macros.',
        (obj ? ir('salud', 'nutricion', 'hoy', 'Añadir comida', true) : ir('salud', 'perfil', 'datos', 'Completar perfil', true))
          + ir('salud', 'gym', 'entrenar', 'Entreno') + ir('salud', 'running', 'registrar', 'Carrera'))}
      ${tarjeta('estudios',
        `${tareas.length} <small>${tareas.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}</small>`,
        tareas.length ? `${enCurso.length} en curso${vencenHoy.length ? ` · <b class="texto-error">${vencenHoy.length} para hoy o atrasadas</b>` : ''}.` : 'Sin tareas pendientes. Añade tus entregas y exámenes.',
        ir('estudios', 'estudios', 'tablero', 'Ver tareas', true) + ir('estudios', 'estudios', 'notas', 'Notas'))}
      ${tarjeta('personal',
        hab.total ? `${hab.hechos} <small>de ${hab.total} hábitos hoy</small>` : '',
        hab.total ? `${lista ? `${lista} ${lista === 1 ? 'cosa' : 'cosas'} en tu lista.` : 'Tu lista está al día.'}` : 'Crea tus hábitos y márcalos cada día en verde o rojo.',
        ir('personal', 'personal', 'habitos', 'Marcar hábitos', true) + ir('personal', 'personal', 'lista', 'Lista'))}
      ${tarjeta('imagen', '', 'Tu diario visual: fotos de progreso físico, comidas y momentos del día.', '<span class="pronto">Muy pronto</span>')}
    </div>`;

  cont.onclick = ev => {
    if (ev.target.closest('[data-entrar]')) return abrirLogin();
    const b = ev.target.closest('[data-ir]');
    if (!b) return;
    const [sec, grupo, vista] = b.dataset.ir.split('|');
    seccion = sec;
    if (sec === 'salud' && grupo) bloque = grupo;
    if (vista) vistaDe[sec === 'salud' ? bloque : sec] = vista;
    pintar();
    window.scrollTo(0, 0);
  };
}

// ---------- Imagen: aún en construcción ----------
function renderProximamente(cont, sec) {
  const s = SECCIONES[sec];
  cont.innerHTML = `
    <div class="proximamente" style="--c-fuerte: ${colorFuerte(s.c)}; --c-suave: ${colorSuave(s.c)}">
      ${icono(s.icono)}
      <h3>Tu diario visual</h3>
      <p>Guarda fotos de tu progreso físico, tus comidas y tu día, y compara mes a mes con un antes y después.</p>
      <ul><li>Fotos de progreso con fecha y peso</li><li>Antes y después automático cada mes</li><li>Fotos de comidas enlazadas con Nutrición</li></ul>
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
  `<button data-seccion="${id}" style="--c: ${colorFuerte(s.c)}">${conPastilla ? `<span class="pastilla">${icono(s.icono)}</span>${s.corto || s.titulo}` : `${icono(s.icono)}${s.titulo}`}</button>`;
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
  vistaDe[grupoActual()] = b.dataset.vista;
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
  const { data: { session } } = await supabase.auth.getSession();
  // Datos de las secciones nuevas (perfil, nutrición, tareas, hábitos, notas) + datos de entreno
  await Promise.all([sincronizar(session.user.id), cargarTodo()]);
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
  olvidar();
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
