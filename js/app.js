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
import { avisoProgreso, fotosDe } from './fotos.js';
import { state } from './db.js';
import { semanaPlan } from './consultas.js';
import { DIAS_PLAN, diaSugerido, flexDelDia, SEMANAS_RUN, faseDeSemana } from './plan.js';
import { leer, guardar, sincronizar, olvidar, hoyISO, escapar } from './almacen.js';
import { aviso, capitalizar, lunesDe, sumarDias } from './utils.js';
import { icono } from './iconos.js';
import { revelar, indicador, abrirModal, carruseles, transicion } from './interaccion.js';
import { introNutricion, introRunning, introGimnasio, introFlexibilidad } from './intros.js';
import { renderCalendario, pintarAgendaResumen, avisarCuenta, actualizarExportacion } from './calendario.js';
import { activarPlan } from './agenda.js';

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
  hoy:      { titulo: 'Resumen', lema: 'Lo importante de hoy, de un vistazo.', icono: 'hoy', c: 'marca' },
  calendario: {
    titulo: 'Calendario', lema: 'Todo tu tiempo, en un solo sitio.', icono: 'calendario', c: 'marca',
    vistas: [['mes', 'Calendario', renderCalendario]],
  },
  salud:    { titulo: 'Salud', lema: 'Tu cuerpo, en orden.', icono: 'salud', c: 'deporte' },
  estudios: {
    titulo: 'Estudios y trabajo', lema: 'Cada entrega, a su tiempo.', corto: 'Estudios', icono: 'estudios', c: 'estudio',
    vistas: [['tablero', 'Tareas', renderTablero]],
  },
  personal: {
    titulo: 'Personal', lema: 'Pequeños hábitos, grandes cambios.', icono: 'organizacion', c: 'personal',
    vistas: [['habitos', 'Hábitos', renderHabitos], ['lista', 'Tareas', renderLista]],
  },
  imagen: {
    titulo: 'Imagen', lema: 'Tu progreso, en fotos.', icono: 'imagen', c: 'diario',
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
// Películas de entrada de cada apartado (solo al entrar, no al cambiar de pestaña)
const INTROS = {
  nutricion: introNutricion,
  running: introRunning,
  gym: introGimnasio,
  flex: introFlexibilidad,
};
let ultimoGrupo = null;
let turno = 0;

// Pinta la sección y después añade las interacciones (intro, apariciones, píldoras, carruseles)
function pintar() {
  const resultado = pintarVista();
  indicador($('secciones'));
  indicador($('subbloques'));
  indicador($('tabs'));
  const grupo = grupoActual();
  const conDatos = !BLOQUES[grupo]?.cuenta || (sesionIniciada && datosCargados);
  const intro = seccion === 'salud' && grupo !== ultimoGrupo && INTROS[grupo] && conDatos;
  ultimoGrupo = grupo;
  const mio = ++turno;
  Promise.resolve(resultado).then(async () => {
    if (intro) await INTROS[grupo]($('vista'));
    if (mio !== turno) return;   // ya se ha cambiado de sección
    revelar($('vista'));
    carruseles($('vista'));
  });
}

function pintarVista() {
  const sec = SECCIONES[seccion];
  $('fecha-hoy').textContent = capitalizar(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  document.querySelectorAll('[data-seccion]').forEach(x => x.classList.toggle('activo', x.dataset.seccion === seccion));
  history.replaceState(null, '', `#${seccion}`);

  const cont = $('vista');
  cont.onclick = cont.oninput = cont.onchange = null;   // quitamos los "escuchadores" de la vista anterior
  cont.ondragstart = cont.ondragend = cont.ondragover = cont.ondrop = cont.onkeydown = null;

  const esSalud = seccion === 'salud';
  $('subbloques').classList.toggle('oculto', !esSalud);
  $('tabs').classList.add('oculto');
  // El título y el lema entran con suavidad cada vez que cambias de sección
  if ($('titulo-bloque').textContent !== sec.titulo) {
    for (const el of [$('titulo-bloque'), $('lema')]) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  }
  $('titulo-bloque').textContent = sec.titulo;
  $('lema').textContent = sec.lema || '';

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
  return grupo.vistas.find(v => v[0] === vista)[2](cont);
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

const fechaCorta = f => new Date(`${f}T12:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
let urlsResumen = [];
async function pintarVentanasImagen(cont) {
  urlsResumen.forEach(u => URL.revokeObjectURL(u));
  urlsResumen = [];
  const img = (blob, alt) => { const u = URL.createObjectURL(blob); urlsResumen.push(u); return `<img src="${u}" alt="${alt}">`; };
  try {
    const [progreso, comidas, dia] = await Promise.all(['progreso', 'comidas', 'dia'].map(c => fotosDe(c)));
    if (seccion !== 'hoy') return;
    // Progreso: la primera foto y la última, lado a lado
    if (progreso.length) {
      const primera = progreso.at(-1), ultima = progreso[0];
      cont.querySelector('#rv-progreso').innerHTML = progreso.length > 1
        ? `<span class="par"><span>${img(primera.blob, 'Primera foto')}<em>${fechaCorta(primera.fecha)}</em></span><span>${img(ultima.blob, 'Última foto')}<em>${fechaCorta(ultima.fecha)}</em></span></span>`
        : img(ultima.blob, 'Foto de progreso');
      if (!cont.querySelector('#rv-progreso-txt b')) cont.querySelector('#rv-progreso-txt').textContent = progreso.length > 1 ? 'Primera y última' : `Desde el ${fechaCorta(ultima.fecha)}`;
    }
    const ultimaDe = (lista, id, vacio) => {
      if (!lista.length) return;
      const f = lista[0];
      cont.querySelector(`#rv-${id}`).innerHTML = img(f.blob, f.nota || 'Foto');
      cont.querySelector(`#rv-${id}-txt`).textContent = f.nota || `${fechaCorta(f.fecha)}`;
    };
    ultimaDe(comidas, 'comidas');
    ultimaDe(dia, 'dia');
  } catch (e) { console.warn(e); }
}

// ---------- Ventanas ampliadas del Resumen (el "+" de cada mosaico) ----------
function irA(destino) {
  const [sec, grupo, vista] = destino.split('|');
  seccion = sec;
  if (sec === 'salud' && grupo) bloque = grupo;
  if (vista) vistaDe[sec === 'salud' ? bloque : sec] = vista;
  transicion(() => { pintar(); window.scrollTo(0, 0); });
}
const enlaceModal = (destino, texto) => `<button class="enlace-flecha" data-ir-modal="${destino}">${texto} ${icono('der')}</button>`;

function abrirDetalle(tipo, origen) {
  const hoy = hoyISO();
  let titulo, subtitulo, contenido;
  if (tipo === 'salud') {
    const obj = objetivosDelDia(), t = totalesDe(hoy);
    const comidas = leer(`comidas:${hoy}`, []);
    const fila = (n, h, m, u) => `<tr><td>${n}</td><td>${Math.round(h)} ${u}</td><td>${m} ${u}</td><td class="${h >= m ? 'texto-ok' : ''}">${h >= m ? 'Cumplido' : `Faltan ${Math.round(m - h)} ${u}`}</td></tr>`;
    titulo = 'Tu salud hoy';
    subtitulo = 'Salud';
    contenido = `
      ${obj ? `<table class="tabla modal-tabla"><tr><th></th><th>Llevas</th><th>Objetivo</th><th></th></tr>
        ${fila('Calorías', t.kcal, obj.kcal, 'kcal')}${fila('Proteína', t.p, obj.p, 'g')}${fila('Carbohidratos', t.c, obj.c, 'g')}${fila('Grasas', t.g, obj.g, 'g')}</table>`
        : '<p>Completa tu perfil para calcular tus objetivos.</p>'}
      <h3 class="modal-h3">Lo que has comido</h3>
      ${comidas.length ? `<ul class="modal-lista">${comidas.map(c => `<li><span>${escapar(c.nombre)}</span><b>${c.kcal} kcal</b></li>`).join('')}</ul>` : '<p class="tenue">Aún no has registrado comidas hoy.</p>'}
      <h3 class="modal-h3">Entreno de hoy</h3>
      <ul class="r-lista">${entrenoDeHoy().map(l => `<li class="${l.estado}"><i class="punto"></i><span>${l.texto}</span></li>`).join('')}</ul>
      <div class="modal-enlaces">${enlaceModal('salud|nutricion|hoy', 'Ir a Nutrición')}${enlaceModal('salud|gym|entrenar', 'Ir al entreno')}${enlaceModal('salud|perfil|datos', 'Tu perfil')}</div>`;
  }
  if (tipo === 'estudios') {
    const todas = leer('tareas', []).filter(x => x.estado !== 'hecho');
    const limite = sumarDias(hoy, 7);
    const grupos = [
      ['Atrasadas', todas.filter(x => x.fecha && x.fecha < hoy)],
      ['Esta semana', todas.filter(x => x.fecha && x.fecha >= hoy && x.fecha <= limite)],
      ['Más adelante', todas.filter(x => x.fecha && x.fecha > limite)],
      ['Sin fecha', todas.filter(x => !x.fecha)],
    ].filter(([, l]) => l.length);
    titulo = 'Todas tus tareas';
    subtitulo = 'Estudios y trabajo';
    contenido = `
      ${grupos.length ? grupos.map(([n, l]) => `
        <h3 class="modal-h3">${n} <span class="tenue">${l.length}</span></h3>
        <ul class="r-lista">${l.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(x => `
          <li class="${x.estado === 'curso' ? 'curso' : ''}"><i class="punto"></i><span>${escapar(x.titulo)}${x.area ? `<small>${escapar(x.area)} · ${x.estado === 'curso' ? 'En curso' : 'Por hacer'}</small>` : ''}</span>${x.fecha ? etiquetaFecha(x.fecha, x.estado) : ''}</li>`).join('')}</ul>`).join('')
        : '<p>No tienes tareas pendientes.</p>'}
      <div class="modal-enlaces">${enlaceModal('estudios|estudios|tablero', 'Abrir el tablero')}</div>`;
  }
  if (tipo === 'personal') {
    const lista = pendientesLista();
    const habitos = leer('habitos', []);
    const dias = leer('habitos-dias', {});
    titulo = 'Tu lista y tus hábitos';
    subtitulo = 'Personal';
    contenido = `
      <h3 class="modal-h3">Por hacer <span class="tenue">${lista.length}</span></h3>
      ${lista.length ? `<ul class="modal-lista">${lista.map(x => `<li><span>${escapar(x.texto)}</span></li>`).join('')}</ul>` : '<p class="tenue">Tu lista está al día.</p>'}
      <h3 class="modal-h3">Hábitos de hoy</h3>
      ${habitos.length ? `<ul class="modal-lista">${habitos.map(h => {
        const e = dias[h.id]?.[hoy];
        return `<li><span>${escapar(h.nombre)}</span><b class="${e === 'si' ? 'texto-ok' : e === 'no' ? 'texto-error' : 'tenue'}">${e === 'si' ? 'Hecho' : e === 'no' ? 'No hecho' : 'Sin marcar'}</b></li>`;
      }).join('')}</ul>` : '<p class="tenue">Aún no tienes hábitos.</p>'}
      <div class="modal-enlaces">${enlaceModal('personal|personal|lista', 'Abrir tu lista')}${enlaceModal('personal|personal|habitos', 'Ver tus hábitos')}</div>`;
  }
  abrirModal({
    origen, titulo, subtitulo, contenido,
    alAbrir: (cuerpo, cerrar) => {
      cuerpo.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-ir-modal]');
        if (!b) return;
        await cerrar();
        irA(b.dataset.irModal);
      });
    },
  });
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
    <p class="saludo-hoy">${saludo}.</p>
    <div id="aviso-foto"></div>
    ${sesionIniciada ? '' : `
      <div class="hoy-aviso">
        <p>Estás usando Lumen sin cuenta: tus datos se guardan en este navegador. Entra para tenerlos en todos tus dispositivos.</p>
        <button class="btn primario chico" data-entrar>Entrar</button>
      </div>`}

    <div class="resumen-grid">
      <article class="tarjeta-hoy r-agenda" style="--c-fuerte: var(--marca); --c-suave: var(--azul-pastel)">
        ${cab('calendario', 'calendario')}
        <div class="ra-cuerpo" id="ra-cuerpo"></div>
      </article>

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
        <button class="mas-info" data-modal="salud" aria-label="Ver tu día de salud completo">${icono('mas')}</button>
      </article>

      <article class="tarjeta-hoy r-estudios" style="${estilo('estudios')}">
        ${cab('estudios', 'estudios|estudios|tablero')}
        <h4 class="r-sub">Próximos 7 días</h4>
        ${semana.length ? `<ul class="r-lista">${semana.slice(0, 7).map(x => `
          <li class="${x.estado === 'curso' ? 'curso' : ''}"><i class="punto"></i><span>${escapar(x.titulo)}${x.area ? `<small>${escapar(x.area)}</small>` : ''}</span>${etiquetaFecha(x.fecha, x.estado)}</li>`).join('')}</ul>
          ${semana.length > 7 ? `<small class="tenue">y ${semana.length - 7} más</small>` : ''}`
          : '<p>Nada que entregar en los próximos 7 días.</p>'}
        <button class="mas-info" data-modal="estudios" aria-label="Ver todas tus tareas">${icono('mas')}</button>
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
        <button class="mas-info" data-modal="personal" aria-label="Ver tu lista y tus hábitos">${icono('mas')}</button>
      </article>

      <article class="tarjeta-hoy r-imagen" style="${estilo('imagen')}">
        ${cab('imagen', 'imagen|imagen|progreso')}
        <div class="r-ventanas">
          <button class="r-ventana" data-ir="imagen|imagen|progreso">
            <span class="r-ventana-fotos" id="rv-progreso"><span class="r-vacia">${icono('imagen')}</span></span>
            <span class="r-ventana-pie"><b>Progreso físico</b><small id="rv-progreso-txt">Cada domingo, en ayunas</small></span>
          </button>
          <button class="r-ventana" data-ir="imagen|imagen|comidas">
            <span class="r-ventana-fotos" id="rv-comidas"><span class="r-vacia">${icono('imagen')}</span></span>
            <span class="r-ventana-pie"><b>Última comida</b><small id="rv-comidas-txt">Aún no hay fotos</small></span>
          </button>
          <button class="r-ventana" data-ir="imagen|imagen|dia">
            <span class="r-ventana-fotos" id="rv-dia"><span class="r-vacia">${icono('imagen')}</span></span>
            <span class="r-ventana-pie"><b>Tu día</b><small id="rv-dia-txt">Aún no hay recuerdos</small></span>
          </button>
        </div>
      </article>
    </div>`;

  // La agenda de los próximos 7 días (interactiva)
  pintarAgendaResumen(cont.querySelector('#ra-cuerpo'));

  // Las tres ventanas de Imagen (las fotos se leen del dispositivo)
  pintarVentanasImagen(cont);

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
    const t = cont.querySelector('#rv-progreso-txt');
    if (t) t.innerHTML = `<b class="texto-marca">${estado === 'hoy' ? 'Hoy toca foto' : 'Falta la del domingo'}</b>`;
  });

  cont.onclick = ev => {
    if (ev.target.closest('[data-entrar]')) return abrirLogin();
    const mod = ev.target.closest('[data-modal]');
    if (mod) return abrirDetalle(mod.dataset.modal, mod.closest('.tarjeta-hoy'));
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
    transicion(() => { pintar(); window.scrollTo(0, 0); });
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
  if (b.dataset.seccion === seccion) return;
  seccion = b.dataset.seccion;
  transicion(() => { pintar(); window.scrollTo(0, 0); });
};
$('secciones').onclick = alElegirSeccion;
$('barra').onclick = alElegirSeccion;
$('subbloques').onclick = ev => {
  const b = ev.target.closest('button[data-bloque]');
  if (!b) return;
  bloque = b.dataset.bloque;
  transicion(() => pintar());
};
$('tabs').onclick = ev => {
  const b = ev.target.closest('button[data-vista]');
  if (!b) return;
  vistaDe[grupoActual()] = b.dataset.vista;
  transicion(() => pintar());
};
// Otras partes de la app pueden pedir ir a cualquier sitio: "sección|grupo|pestaña"
window.addEventListener('ir-a', ev => irA(ev.detail));
// Otras partes de la app pueden pedir ir a una pestaña: { bloque, vista }
window.addEventListener('navegar', ev => {
  const d = typeof ev.detail === 'string' ? { bloque: 'gym', vista: ev.detail } : ev.detail;
  seccion = 'salud';
  bloque = d.bloque;
  vistaDe[bloque] = d.vista;
  transicion(() => { pintar(); window.scrollTo(0, 0); });
});

// Al hacer scroll, la cabecera se compacta (como los títulos grandes de iOS)
addEventListener('scroll', () => document.querySelector('.cabecera').classList.toggle('compacta', scrollY > 30), { passive: true });
addEventListener('resize', () => { indicador($('secciones')); indicador($('subbloques')); indicador($('tabs')); });

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
  avisarCuenta(true);
  cerrarLogin();
  pintarCuenta();
  pintar();
  const { data: { session } } = await supabase.auth.getSession();
  // Datos de las secciones nuevas (perfil, nutrición, tareas, hábitos, notas) + datos de entreno
  await Promise.all([sincronizar(session.user.id), cargarTodo()]);
  await vaciarCola();
  datosCargados = true;
  activarPlan(true);
  actualizarExportacion();
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
