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
import { renderTablero, tareasDeLaSemana, etiquetaFecha } from './estudios.js';
import { renderHabitos, renderLista, pendientesLista } from './personal.js';
import { renderProgresoFisico, renderFotosComidas, renderFotosDia } from './imagen.js';
import { avisoProgreso } from './fotos.js';
import { state } from './db.js';
import { semanaPlan } from './consultas.js';
import { DIAS_PLAN, diaSugerido, flexDelDia, SEMANAS_RUN, faseDeSemana } from './plan.js';
import { leer, guardar, sincronizar, olvidar, hoyISO, escapar } from './almacen.js';
import { aviso, capitalizar, lunesDe, sumarDias } from './utils.js';
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
  hoy:      { titulo: 'Resumen', icono: 'hoy', c: 'marca' },
  salud:    { titulo: 'Salud', icono: 'salud', c: 'deporte' },
  estudios: {
    titulo: 'Estudios y trabajo', corto: 'Estudios', icono: 'estudios', c: 'estudio',
    vistas: [['tablero', 'Tareas', renderTablero]],
  },
  personal: {
    titulo: 'Personal', icono: 'organizacion', c: 'personal',
    vistas: [['habitos', 'Hábitos', renderHabitos], ['lista', 'Tareas y post-its', renderLista]],
  },
  imagen: {
    titulo: 'Imagen', icono: 'imagen', c: 'diario',
    vistas: [['progreso', 'Progreso físico', renderProgresoFisico], ['comidas', 'Comidas', renderFotosComidas], ['dia', 'Tu día', renderFotosDia]],
  },
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

// ---------- Resumen: lo importante de hoy, sencillo ----------

// Entreno de hoy según tu plan (solo con cuenta y plan cargado)
function entrenoDeHoy() {
  if (!sesionIniciada) return [{ texto: 'Entra para ver el entreno que te toca hoy.', estado: '' }];
  if (!datosCargados) return [{ texto: 'Cargando tu plan…', estado: '' }];
  const hoy = hoyISO();
  const lineas = [];
  // Gimnasio: lunes a viernes, un día del plan
  const dow = new Date().getDay();
  if (dow >= 1 && dow <= 5) {
    const dia = diaSugerido(hoy, DIAS_PLAN.map(d => d.nombre));
    const hecho = state.sesiones.some(x => x.fecha === hoy);
    lineas.push({ texto: `<b>Gimnasio</b> · ${escapar(dia.split('·')[1]?.trim() || dia)}`, estado: hecho ? 'hecho' : 'pendiente', ir: 'salud|gym|entrenar' });
  } else {
    lineas.push({ texto: '<b>Gimnasio</b> · descanso', estado: '' });
  }
  // Running: entrenos de la semana del plan
  const n = semanaPlan(hoy);
  if (n >= 1 && n <= SEMANAS_RUN) {
    const lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6);
    const semana = state.carreras.filter(c => c.fecha >= lunes && c.fecha <= domingo);
    const faltan = [['series', 'series'], ['larga', 'tirada larga'], [['easy', 'tempo'], 'easy']]
      .filter(([t]) => !semana.some(c => [].concat(t).includes(c.tipo))).map(([, nombre]) => nombre);
    lineas.push({
      texto: `<b>Running</b> · semana ${n}, ${faseDeSemana(n).nombre.toLowerCase()}${faltan.length ? ` · te falta ${faltan.join(', ')}` : ''}`,
      estado: faltan.length ? 'pendiente' : 'hecho', ir: 'salud|running|semana',
    });
  }
  // Flexibilidad: rutina de la mañana
  const items = flexDelDia(hoy);
  const hechos = new Set(state.flex_dias.find(f => f.fecha === hoy)?.completados || []);
  const nHechos = items.filter(i => hechos.has(i.id)).length;
  lineas.push({ texto: `<b>Flexibilidad</b> · ${nHechos} de ${items.length} ejercicios`, estado: nHechos === items.length ? 'hecho' : 'pendiente', ir: 'salud|flex|hoy' });
  return lineas;
}

function renderHoy(cont) {
  const hoy = hoyISO();
  const obj = objetivosDelDia();
  const t = totalesDe(hoy);
  const semana = tareasDeLaSemana();
  const lista = pendientesLista();
  const habitos = leer('habitos', []);
  const diasHab = leer('habitos-dias', {});

  const estilo = sec => { const c = SECCIONES[sec].c; return `--c-fuerte: ${colorFuerte(c)}; --c-suave: ${colorSuave(c)}`; };
  const cab = (sec, ir) => `<header>${icono(SECCIONES[sec].icono)}<h3>${SECCIONES[sec].titulo}</h3><button class="btn-texto" data-ir="${ir}">Abrir ${icono('der')}</button></header>`;
  const macro = (nombre, hecho, meta) => {
    const ok = hecho >= meta * 0.95;
    return `<div class="r-macro ${ok ? 'ok' : ''}"><span>${nombre}</span><div class="progreso"><i style="width:${Math.min(100, (hecho / meta) * 100)}%"></i></div><small>${Math.round(hecho)}/${meta} g${ok ? ' ✓' : ''}</small></div>`;
  };

  const saludo = (() => { const h = new Date().getHours(); return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'; })();

  cont.innerHTML = `
    <p class="saludo-hoy">${saludo}. Esto es lo importante de hoy.</p>
    <div id="aviso-foto"></div>
    ${sesionIniciada ? '' : `
      <div class="hoy-aviso">
        <p>Estás usando Lumen sin cuenta: tus datos se guardan en este navegador. Entra para tenerlos en todos tus dispositivos.</p>
        <button class="btn primario chico" data-entrar>Entrar</button>
      </div>`}

    <div class="resumen-grid">
      <article class="tarjeta-hoy r-salud" style="${estilo('salud')}">
        ${cab('salud', 'salud|nutricion|hoy')}
        <h4 class="r-sub">Comida</h4>
        ${obj ? `
          <div class="r-kcal">
            <p class="cifra-hoy">${Math.round(t.kcal).toLocaleString('es-ES')} <small>de ${obj.kcal.toLocaleString('es-ES')} kcal</small></p>
            <div class="progreso grueso"><i style="width:${Math.min(100, (t.kcal / obj.kcal) * 100)}%"></i></div>
            <small class="tenue">${t.kcal >= obj.kcal ? 'Calorías del día completadas' : `Te quedan ${Math.round(obj.kcal - t.kcal).toLocaleString('es-ES')} kcal`}</small>
          </div>
          <div class="r-macros">${macro('Proteína', t.p, obj.p)}${macro('Carbos', t.c, obj.c)}${macro('Grasas', t.g, obj.g)}</div>`
          : `<p>Completa tu perfil para calcular tus calorías y macros.</p><button class="btn primario chico" data-ir="salud|perfil|datos">Completar perfil</button>`}
        <h4 class="r-sub">Entreno de hoy</h4>
        <ul class="r-lista">${entrenoDeHoy().map(l => `
          <li class="${l.estado}" ${l.ir ? `data-ir="${l.ir}"` : ''}><i class="punto"></i><span>${l.texto}</span></li>`).join('')}</ul>
      </article>

      <article class="tarjeta-hoy r-estudios" style="${estilo('estudios')}">
        ${cab('estudios', 'estudios|estudios|tablero')}
        <h4 class="r-sub">Próximos 7 días</h4>
        ${semana.length ? `<ul class="r-lista">${semana.slice(0, 7).map(x => `
          <li class="${x.estado === 'curso' ? 'curso' : ''}"><i class="punto"></i><span>${escapar(x.titulo)}${x.area ? `<small>${escapar(x.area)}</small>` : ''}</span>${etiquetaFecha(x.fecha, x.estado)}</li>`).join('')}</ul>
          ${semana.length > 7 ? `<small class="tenue">y ${semana.length - 7} más</small>` : ''}`
          : '<p>Nada que entregar en los próximos 7 días.</p>'}
      </article>

      <article class="tarjeta-hoy r-personal" style="${estilo('personal')}">
        ${cab('personal', 'personal|personal|lista')}
        <h4 class="r-sub">Lo principal</h4>
        ${lista.length ? `<ul class="r-check">${lista.slice(0, 6).map(x => `
          <li><button class="caja-lista" data-hecho-lista="${x.id}" aria-label="Marcar como hecha">${icono('check')}</button><span>${escapar(x.texto)}</span></li>`).join('')}</ul>`
          : '<p>Tu lista está al día.</p>'}
        ${habitos.length ? `
          <h4 class="r-sub">Hábitos de hoy</h4>
          <div class="r-habitos">${habitos.map(h => {
            const e = diasHab[h.id]?.[hoy] || '';
            return `<button class="r-habito ${e}" data-habito-hoy="${h.id}">${e === 'si' ? icono('check') : e === 'no' ? icono('x') : ''}${escapar(h.nombre)}</button>`;
          }).join('')}</div>` : ''}
      </article>

      <article class="tarjeta-hoy r-imagen" style="${estilo('imagen')}">
        ${cab('imagen', 'imagen|imagen|progreso')}
        <p id="r-imagen-texto">Tu foto de progreso es cada domingo por la mañana, en ayunas.</p>
        <div class="acciones-hoy">
          <button class="btn suave chico" data-ir="imagen|imagen|progreso">Progreso físico</button>
          <button class="btn suave chico" data-ir="imagen|imagen|comidas">Comidas</button>
          <button class="btn suave chico" data-ir="imagen|imagen|dia">Tu día</button>
        </div>
      </article>
    </div>`;

  // Aviso de la foto de progreso (se comprueba aparte porque las fotos se leen del dispositivo)
  avisoProgreso().then(estado => {
    if (!estado || seccion !== 'hoy') return;
    const caja = cont.querySelector('#aviso-foto');
    if (!caja) return;
    caja.innerHTML = `
      <div class="aviso-foto">
        ${icono('imagen')}
        <p><b>${estado === 'hoy' ? 'Hoy toca tu foto de progreso.' : 'Te faltó la foto de progreso del domingo.'}</b> Por la mañana, en ayunas y antes de hacer ejercicio.</p>
        <button class="btn primario chico" data-ir="imagen|imagen|progreso">Subir foto</button>
      </div>`;
    cont.querySelector('#r-imagen-texto').innerHTML = `<b class="texto-marca">${estado === 'hoy' ? 'Hoy toca foto de progreso.' : 'Te falta la foto del domingo.'}</b>`;
  });

  cont.onclick = ev => {
    if (ev.target.closest('[data-entrar]')) return abrirLogin();
    const hl = ev.target.closest('[data-hecho-lista]');
    if (hl) {
      guardar('lista', leer('lista', []).map(x => (x.id === hl.dataset.hechoLista ? { ...x, hecho: true } : x)));
      return renderHoy(cont);
    }
    const hh = ev.target.closest('[data-habito-hoy]');
    if (hh) {
      const todos = leer('habitos-dias', {});
      const actual = todos[hh.dataset.habitoHoy]?.[hoy] || '';
      const siguiente = { '': 'si', si: 'no', no: '' }[actual];
      todos[hh.dataset.habitoHoy] = { ...(todos[hh.dataset.habitoHoy] || {}), [hoy]: siguiente };
      if (!siguiente) delete todos[hh.dataset.habitoHoy][hoy];
      guardar('habitos-dias', todos);
      return renderHoy(cont);
    }
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
