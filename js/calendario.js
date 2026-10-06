// CALENDARIO: todo tu tiempo en un solo sitio, al estilo del Calendario de Apple.
//  - Vistas: Día, Semana, Mes y Agenda (lista de los próximos 30 días)
//  - Toca un hueco para crear algo a esa hora; arrastra un evento para moverlo
//  - Filtros por tipo (clases, estudio, trabajo, deporte, hogar, personal, imagen)
//  - Sincronizar: importa Google Calendar, PoliformaT, Outlook… (enlace iCal o archivo .ics)
//    y crea un enlace para ver Lumen dentro de Google Calendar.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { lunesDe, sumarDias, capitalizar } from './utils.js';
import { icono } from './iconos.js';
import { abrirModal, indicador } from './interaccion.js';
import { aviso } from './utils.js';
import { leerICS, crearICS } from './ical.js';
import { fotosDe, domingoDe } from './fotos.js';
import {
  CATEGORIAS, COLORES_CAL, eventosEntre, ajustesCal, guardarDesdeFormulario, datosDe, alternarHecho,
  borrar, mover, minutos, sumarMin, marcarSemanasConFoto,
} from './agenda.js';

const H = 48;                                   // alto de una hora en las vistas Día y Semana (px)
const esMovil = () => matchMedia('(max-width: 720px)').matches;
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let vista = esMovil() ? 'dia' : 'semana';
let ref = hoyISO();
let scrollGuardado = null;
const actuales = new Map();                     // id → evento pintado (para abrir su detalle)
let conCuenta = false;                          // lo indica app.js (el enlace para Google necesita cuenta)
export const avisarCuenta = v => { conCuenta = v; };

const VISTAS = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['agenda', 'Agenda']];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const fecha = iso => new Date(`${iso}T12:00`);
const fmt = (iso, op) => fecha(iso).toLocaleDateString('es-ES', op);
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ocultas = () => new Set(leer('cal-ocultas', []));
const visibles = (desde, hasta) => { const o = ocultas(); return eventosEntre(desde, hasta).filter(e => !o.has(e.cat)); };

/* ============================== PANTALLA ============================== */
export function renderCalendario(cont) {
  cont.innerHTML = `
    <div class="cal">
      <div class="cal-barra">
        <div class="cal-nav">
          <button class="btn-icono" data-paso="-1" aria-label="Anterior">${icono('izq')}</button>
          <button class="btn suave chico" data-hoy>Hoy</button>
          <button class="btn-icono" data-paso="1" aria-label="Siguiente">${icono('der')}</button>
          <h2 class="cal-titulo" id="cal-titulo"></h2>
        </div>
        <nav class="segmento" id="cal-vistas" aria-label="Vista">
          ${VISTAS.map(([id, n]) => `<button data-vista-cal="${id}" class="${id === vista ? 'activo' : ''}">${n}</button>`).join('')}
        </nav>
        <div class="cal-acciones">
          <button class="btn suave chico" data-sync>${icono('nube-ok')}<span>Sincronizar</span></button>
          <button class="btn primario chico" data-nuevo>${icono('mas')}<span>Nuevo</span></button>
        </div>
      </div>
      <div class="cal-filtros" id="cal-filtros"></div>
      <div class="cal-cuerpo" id="cal-cuerpo"></div>
    </div>`;
  const raiz = cont.querySelector('.cal');
  pintarFiltros(raiz);
  pintarCuerpo(raiz);
  requestAnimationFrame(() => indicador(raiz.querySelector('#cal-vistas')));
  conectar(raiz);

  // En segundo plano: fotos de progreso hechas, calendarios importados y enlace para Google
  cargarFotos().then(() => raiz.isConnected && pintarCuerpo(raiz));
  refrescarImportados().then(cambio => cambio && raiz.isConnected && pintarCuerpo(raiz));
  actualizarExportacion();
}

function pintarFiltros(raiz) {
  const o = ocultas();
  raiz.querySelector('#cal-filtros').innerHTML = Object.entries(CATEGORIAS).map(([id, c]) =>
    `<button class="cal-filtro ${o.has(id) ? 'apagado' : ''}" data-filtro-cal="${id}" style="--c:${c.color}" aria-pressed="${!o.has(id)}"><i></i>${c.nombre}</button>`).join('');
}

// Fechas que cubre la vista actual
function rango() {
  if (vista === 'dia') return [ref, ref];
  if (vista === 'semana') { const l = lunesDe(ref); return [l, sumarDias(l, 6)]; }
  if (vista === 'mes') { const l = lunesDe(`${ref.slice(0, 7)}-01`); return [l, sumarDias(l, 41)]; }
  return [ref, sumarDias(ref, 29)];
}

function titulo() {
  if (vista === 'dia') return capitalizar(fmt(ref, { weekday: 'long', day: 'numeric', month: 'long' }));
  if (vista === 'mes') return capitalizar(fmt(ref, { month: 'long', year: 'numeric' }));
  if (vista === 'agenda') return ref === hoyISO() ? 'Próximos 30 días' : `Desde el ${fmt(ref, { day: 'numeric', month: 'long' })}`;
  const [a, b] = rango();
  const mismoMes = a.slice(0, 7) === b.slice(0, 7);
  return capitalizar(mismoMes ? fmt(a, { month: 'long', year: 'numeric' }) : `${fmt(a, { month: 'short' })} – ${fmt(b, { month: 'short', year: 'numeric' })}`);
}

function pintarCuerpo(raiz, { animar = 0 } = {}) {
  const cuerpo = raiz.querySelector('#cal-cuerpo');
  const scrollPrevio = cuerpo.querySelector('.cs-scroll')?.scrollTop;
  if (scrollPrevio != null) scrollGuardado = scrollPrevio;
  raiz.querySelector('#cal-titulo').textContent = titulo();
  const [desde, hasta] = rango();
  const eventos = visibles(desde, hasta);
  actuales.clear();
  eventos.forEach(e => actuales.set(e.id, e));

  if (vista === 'dia') {
    const l = lunesDe(ref);
    const semana = Array.from({ length: 7 }, (_, i) => sumarDias(l, i));
    const deSemana = visibles(l, sumarDias(l, 6));
    cuerpo.innerHTML = tira(semana, deSemana) + rejilla([ref], eventos, false);
  } else if (vista === 'semana') {
    const l = lunesDe(ref);
    cuerpo.innerHTML = rejilla(Array.from({ length: 7 }, (_, i) => sumarDias(l, i)), eventos, true);
  } else if (vista === 'mes') {
    cuerpo.innerHTML = mes(desde, eventos);
  } else {
    cuerpo.innerHTML = agenda(desde, hasta, eventos);
  }

  // Al abrir, la vista horaria empieza a las 7:30 (o un poco antes de la hora actual si es hoy)
  const scroll = cuerpo.querySelector('.cs-scroll');
  if (scroll) {
    const ahora = new Date();
    const hoyVisible = eventos.length >= 0 && cuerpo.querySelector('.cs-col.hoy');
    scroll.scrollTop = scrollGuardado ?? (hoyVisible && ahora.getHours() >= 9 ? (ahora.getHours() - 1.5) * H : 7.5 * H);
  }
  if (animar && !sinMovimiento()) {
    cuerpo.animate([{ opacity: 0, transform: `translateX(${animar * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

/* ---------- Tira de la semana (vista Día) ---------- */
function tira(fechas, eventos) {
  const hoy = hoyISO();
  return `<div class="cal-tira">${fechas.map(f => {
    const cats = [...new Set(eventos.filter(e => e.fecha === f).map(e => e.color))].slice(0, 4);
    return `<button class="ct-dia ${f === hoy ? 'hoy' : ''} ${f === ref ? 'sel' : ''}" data-dia="${f}">
      <small>${DIAS_CORTOS[fecha(f).getDay()]}</small><b>${Number(f.slice(8))}</b>
      <span class="ct-puntos">${cats.map(c => `<i style="background:${c}"></i>`).join('')}</span></button>`;
  }).join('')}</div>`;
}

/* ---------- Vistas Día y Semana: columnas por horas ---------- */
function rejilla(fechas, eventos, conCabecera) {
  const hoy = hoyISO();
  const ahora = new Date();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const todoDia = fechas.map(f => eventos.filter(e => e.fecha === f && e.todoElDia));
  const hayTodoDia = todoDia.some(l => l.length);
  return `
    <div class="cal-rejilla ${fechas.length === 1 ? 'un-dia' : ''}" style="--n:${fechas.length}; --h:${H}px">
      ${conCabecera ? `<div class="cs-cab"><span></span>${fechas.map(f => `
        <button class="cs-dia ${f === hoy ? 'hoy' : ''}" data-dia="${f}"><small>${DIAS_CORTOS[fecha(f).getDay()]}</small><b>${Number(f.slice(8))}</b></button>`).join('')}</div>` : ''}
      <div class="cs-todo ${hayTodoDia ? '' : 'sin-nada'}"><span class="cs-etq">todo el día</span>${todoDia.map((l, i) => `
        <div class="cs-td" data-fecha="${fechas[i]}">${l.map(chip).join('')}</div>`).join('')}</div>
      <div class="cs-scroll">
        <div class="cs-cuerpo">
          <div class="cs-horas">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * H}px">${h ? `${h}:00` : ''}</span>`).join('')}</div>
          ${fechas.map(f => `
            <div class="cs-col ${f === hoy ? 'hoy' : ''}" data-fecha="${f}">
              ${bloques(eventos.filter(e => e.fecha === f && !e.todoElDia))}
              ${f === hoy ? `<div class="cs-ahora" style="top:${(minAhora / 60) * H}px"></div>` : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// Coloca los eventos de un día; los que se solapan se reparten el ancho
function bloques(lista) {
  const items = lista.map(e => {
    const a = minutos(e.inicio);
    return { e, a, b: Math.max(a + 20, e.fin ? minutos(e.fin) : a + 60) };
  }).sort((x, y) => x.a - y.a || y.b - x.b);
  const grupos = [];
  let grupo = [], fin = -1;
  for (const it of items) {
    if (grupo.length && it.a >= fin) { grupos.push(grupo); grupo = []; fin = -1; }
    grupo.push(it); fin = Math.max(fin, it.b);
  }
  if (grupo.length) grupos.push(grupo);
  for (const g of grupos) {
    const columnas = [];
    for (const it of g) {
      let c = columnas.findIndex(finCol => finCol <= it.a);
      if (c < 0) { c = columnas.length; columnas.push(0); }
      columnas[c] = it.b; it.col = c;
    }
    g.forEach(it => { it.n = columnas.length; });
  }
  return items.map(({ e, a, b, col, n }) => {
    const alto = ((b - a) / 60) * H - 2;
    return `<button class="cal-ev ${e.hecho ? 'hecho' : ''} ${alto < 34 ? 'corto' : ''} ${e.editable && !e.repite ? 'movible' : ''}" data-ev="${escapar(e.id)}"
      style="top:${(a / 60) * H}px; height:${alto}px; left:calc(${(col / n) * 100}% + 1px); width:calc(${100 / n}% - 3px); --c:${e.color}">
      <b>${e.hecho ? icono('check') : ''}${escapar(e.titulo)}</b>
      <small>${e.inicio}${e.fin ? ` – ${e.fin}` : ''}${e.lugar ? ` · ${escapar(e.lugar)}` : ''}</small>
    </button>`;
  }).join('');
}

const chip = e => `<button class="cal-chip ${e.hecho ? 'hecho' : ''}" data-ev="${escapar(e.id)}" style="--c:${e.color}">${e.hecho ? icono('check') : '<i></i>'}<span>${!e.todoElDia && e.inicio ? `<em>${e.inicio}</em> ` : ''}${escapar(e.titulo)}</span></button>`;

/* ---------- Vista Mes ---------- */
function mes(desde, eventos) {
  const hoy = hoyISO(), mesActual = ref.slice(0, 7);
  return `
    <div class="cal-mes">
      <div class="cm-dias">${INICIALES.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cm-rejilla">${Array.from({ length: 42 }, (_, i) => {
        const f = sumarDias(desde, i);
        // En el mes, primero lo que no es rutina (entregas, clases, planes); el entreno y la foto, al final
        const rutina = e => (['gym', 'run', 'flex', 'foto'].includes(e.fuente) ? 1 : 0);
        const del = eventos.filter(e => e.fecha === f).sort((a, b) => rutina(a) - rutina(b));
        const muestra = del.slice(0, 3);
        return `<div class="cm-celda ${f.slice(0, 7) !== mesActual ? 'fuera' : ''} ${f === hoy ? 'hoy' : ''}" data-fecha="${f}">
          <button class="cm-num" data-dia="${f}">${Number(f.slice(8))}</button>
          <div class="cm-evs">${muestra.map(chip).join('')}${del.length > 3 ? `<button class="cm-mas" data-dia="${f}">+${del.length - 3} más</button>` : ''}</div>
          <div class="cm-puntos">${[...new Set(del.map(e => e.color))].slice(0, 4).map(c => `<i style="background:${c}"></i>`).join('')}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
}

/* ---------- Vista Agenda ---------- */
function agenda(desde, hasta, eventos) {
  const hoy = hoyISO();
  const dias = [...new Set(eventos.map(e => e.fecha))];
  if (!dias.length) return `<div class="vacio"><h3>Nada a la vista</h3><p>No tienes nada en estos 30 días. Toca «Nuevo» para añadir algo.</p></div>`;
  return `<div class="cal-agenda">${dias.map(f => `
    <section class="ag-dia ${f === hoy ? 'hoy' : ''}">
      <h4 data-dia="${f}"><b>${Number(f.slice(8))}</b><span>${f === hoy ? 'Hoy' : f === sumarDias(hoy, 1) ? 'Mañana' : capitalizar(fmt(f, { weekday: 'long' }))}<small>${fmt(f, { month: 'long' })}</small></span></h4>
      <ul>${eventos.filter(e => e.fecha === f).map(filaAgenda).join('')}</ul>
    </section>`).join('')}</div>`;
}
const MARCABLE = ['tarea', 'lista', 'evento'];
export const filaAgenda = e => `
  <li class="ag-ev ${e.hecho ? 'hecho' : ''}" style="--c:${e.color}">
    <span class="ag-hora">${e.todoElDia ? (e.etiqueta || 'Todo el día') : `${e.inicio}${e.fin ? `<small>${e.fin}</small>` : ''}`}</span>
    <button class="ag-cuerpo" data-ev="${escapar(e.id)}"><b>${escapar(e.titulo)}</b>${e.lugar || e.calendario ? `<small>${escapar([e.lugar, e.calendario].filter(Boolean).join(' · '))}</small>` : ''}</button>
    ${e.hecho === null || e.hecho === undefined ? ''
      : MARCABLE.includes(e.fuente) ? `<button class="ag-check" data-check="${escapar(e.id)}" aria-pressed="${!!e.hecho}" aria-label="${e.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}">${icono('check')}</button>`
      : `<span class="ag-check fijo" title="${e.hecho ? 'Hecho' : 'Se marca al registrarlo en Salud o Imagen'}">${icono('check')}</span>`}
  </li>`;

/* ============================== INTERACCIÓN ============================== */
function conectar(raiz) {
  const repintar = (animar = 0) => pintarCuerpo(raiz, { animar });
  let suprimirClic = false;

  raiz.addEventListener('click', ev => {
    if (suprimirClic) { suprimirClic = false; return; }
    const t = ev.target;
    const paso = t.closest('[data-paso]');
    if (paso) return avanzar(Number(paso.dataset.paso), repintar);
    if (t.closest('[data-hoy]')) { ref = hoyISO(); scrollGuardado = null; return repintar(); }
    const v = t.closest('[data-vista-cal]');
    if (v) {
      vista = v.dataset.vistaCal;
      raiz.querySelectorAll('[data-vista-cal]').forEach(b => b.classList.toggle('activo', b === v));
      indicador(raiz.querySelector('#cal-vistas'));
      scrollGuardado = null;
      return repintar();
    }
    const fil = t.closest('[data-filtro-cal]');
    if (fil) {
      const o = ocultas();
      o.has(fil.dataset.filtroCal) ? o.delete(fil.dataset.filtroCal) : o.add(fil.dataset.filtroCal);
      guardar('cal-ocultas', [...o]);
      pintarFiltros(raiz);
      return repintar();
    }
    if (t.closest('[data-sync]')) return abrirSincronizar(t.closest('[data-sync]'), () => repintar());
    if (t.closest('[data-nuevo]')) {
      const ahora = new Date();
      const inicio = hhmm(Math.min(22 * 60, (ahora.getHours() + 1) * 60));
      return abrirFormulario({ fecha: vista === 'dia' ? ref : hoyISO(), inicio, fin: sumarMin(inicio, 60) }, t.closest('[data-nuevo]'), () => repintar());
    }
    const check = t.closest('[data-check]');
    if (check) { const e = actuales.get(check.dataset.check); if (e) { alternarHecho(e); actualizarExportacion(); repintar(); } return; }
    const evb = t.closest('[data-ev]');
    if (evb) { const e = actuales.get(evb.dataset.ev); if (e) abrirDetalle(e, evb, () => repintar()); return; }
    const dia = t.closest('[data-dia]');
    if (dia) { ref = dia.dataset.dia; vista = 'dia'; raiz.querySelectorAll('[data-vista-cal]').forEach(b => b.classList.toggle('activo', b.dataset.vistaCal === 'dia')); indicador(raiz.querySelector('#cal-vistas')); return repintar(); }

    // Toque en un hueco vacío: crear ahí
    const col = t.closest('.cs-col');
    if (col) {
      const y = ev.clientY - col.getBoundingClientRect().top;
      const m = Math.max(0, Math.min(23 * 60, Math.floor((y / H) * 2) * 30));
      const fantasma = document.createElement('div');
      fantasma.className = 'cal-fantasma';
      fantasma.style.cssText = `top:${(m / 60) * H}px; height:${H - 2}px`;
      fantasma.textContent = `${hhmm(m)} – ${hhmm(m + 60)}`;
      col.appendChild(fantasma);
      abrirFormulario({ fecha: col.dataset.fecha, inicio: hhmm(m), fin: hhmm(Math.min(m + 60, 23 * 60 + 59)) }, fantasma, () => repintar());
      setTimeout(() => fantasma.remove(), 700);
      return;
    }
    const td = t.closest('.cs-td');
    if (td) return abrirFormulario({ fecha: td.dataset.fecha, todoElDia: true }, td, () => repintar());
    const celda = t.closest('.cm-celda');
    if (celda) return abrirFormulario({ fecha: celda.dataset.fecha, inicio: '10:00', fin: '11:00' }, celda, () => repintar());
  });

  // Arrastrar un evento para cambiarlo de hora o de día (en el móvil: mantener pulsado)
  let arr = null;
  const terminar = () => { clearTimeout(arr?.espera); arr?.b.classList.remove('arrastrando'); arr = null; };
  raiz.addEventListener('pointerdown', ev => {
    const b = ev.target.closest('.cal-ev.movible');
    if (!b || ev.button > 0) return;
    const e = actuales.get(b.dataset.ev);
    if (!e) return;
    arr = { b, e, x0: ev.clientX, y0: ev.clientY, top0: parseFloat(b.style.top), activo: ev.pointerType !== 'touch', movido: false, id: ev.pointerId, col: b.parentElement };
    if (!arr.activo) arr.espera = setTimeout(() => { if (arr) { arr.activo = true; b.classList.add('arrastrando'); navigator.vibrate?.(10); } }, 380);
  });
  raiz.addEventListener('pointermove', ev => {
    if (!arr || ev.pointerId !== arr.id) return;
    const dx = ev.clientX - arr.x0, dy = ev.clientY - arr.y0;
    if (!arr.activo) { if (Math.hypot(dx, dy) > 8) terminar(); return; }
    if (!arr.movido && Math.hypot(dx, dy) < 5) return;
    if (!arr.movido) { arr.movido = true; arr.b.classList.add('arrastrando'); arr.b.setPointerCapture?.(ev.pointerId); }
    const delta = Math.round(((dy / H) * 60) / 15) * 15;
    const inicio = Math.max(0, Math.min(24 * 60 - 15, minutos(arr.e.inicio) + delta));
    arr.inicio = inicio;
    arr.b.style.top = `${(inicio / 60) * H}px`;
    arr.b.querySelector('small').textContent = `${hhmm(inicio)} – ${hhmm(Math.min(24 * 60 - 1, inicio + (minutos(arr.e.fin || arr.e.inicio) - minutos(arr.e.inicio) || 60)))}`;
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cs-col');
    if (bajo && bajo !== arr.b.parentElement) { bajo.appendChild(arr.b); arr.b.style.left = '1px'; arr.b.style.width = 'calc(100% - 3px)'; }
  });
  const soltar = ev => {
    if (!arr || ev.pointerId !== arr.id) return;
    const { e, b, movido, inicio } = arr;
    terminar();
    if (!movido) return;
    suprimirClic = true;
    setTimeout(() => { suprimirClic = false; }, 50);
    const nuevaFecha = b.parentElement?.dataset.fecha || e.fecha;
    if (nuevaFecha === e.fecha && hhmm(inicio) === e.inicio) return repintar();
    mover(e, nuevaFecha, hhmm(inicio));
    actualizarExportacion();
    aviso(`Movido al ${fmt(nuevaFecha, { weekday: 'long', day: 'numeric' })} a las ${hhmm(inicio)}`);
    repintar();
  };
  raiz.addEventListener('pointerup', soltar);
  raiz.addEventListener('pointercancel', terminar);
  // En el móvil, mientras arrastras no se desplaza la pantalla
  raiz.addEventListener('touchmove', ev => { if (arr?.activo) ev.preventDefault(); }, { passive: false });

  // Deslizar a los lados para pasar de día / semana / mes
  let toque = null;
  raiz.addEventListener('touchstart', ev => { if (ev.touches.length === 1) toque = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() }; }, { passive: true });
  raiz.addEventListener('touchend', ev => {
    if (!toque || arr) { toque = null; return; }
    const dx = ev.changedTouches[0].clientX - toque.x, dy = ev.changedTouches[0].clientY - toque.y;
    const rapido = Date.now() - toque.t < 600;
    toque = null;
    if (rapido && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && ev.target.closest('#cal-cuerpo')) avanzar(dx < 0 ? 1 : -1, repintar);
  });

  // La línea de "ahora" avanza sola
  const reloj = setInterval(() => {
    if (!raiz.isConnected) return clearInterval(reloj);
    const linea = raiz.querySelector('.cs-ahora');
    if (linea) { const a = new Date(); linea.style.top = `${((a.getHours() * 60 + a.getMinutes()) / 60) * H}px`; }
  }, 60000);
}

function avanzar(n, repintar) {
  if (vista === 'dia') ref = sumarDias(ref, n);
  else if (vista === 'semana') ref = sumarDias(ref, 7 * n);
  else if (vista === 'agenda') ref = sumarDias(ref, 30 * n);
  else { const d = fecha(`${ref.slice(0, 7)}-01`); d.setMonth(d.getMonth() + n); ref = d.toLocaleDateString('sv-SE'); }
  repintar(n);
}

/* ============================== DETALLE DE UN EVENTO ============================== */
const REPITE = { semanal: 'Se repite cada semana', anual: 'Se repite cada año' };
const FUENTE = { gym: 'Tu plan de gimnasio', run: 'Tu plan de running', flex: 'Tu rutina de flexibilidad', foto: 'Recordatorio de Imagen', tarea: 'Tablero de Estudios y trabajo', lista: 'Tu lista de Personal' };

export function abrirDetalle(e, origen, alCambiar) {
  const cuando = `${capitalizar(fmt(e.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}${e.todoElDia ? ' · todo el día' : ` · ${e.inicio}${e.fin ? ` – ${e.fin}` : ''}`}`;
  abrirModal({
    origen,
    titulo: escapar(e.titulo),
    subtitulo: `<span class="ev-tipo" style="--c:${e.color}"><i></i>${CATEGORIAS[e.cat]?.nombre || 'Evento'}</span>`,
    contenido: `
      <div class="ev-detalle">
        <p class="ev-linea">${icono('calendario')}<span>${cuando}${e.repite ? `<small>${REPITE[e.repite]}</small>` : ''}</span></p>
        ${e.lugar ? `<p class="ev-linea">${icono('lugar')}<span>${escapar(e.lugar)}</span></p>` : ''}
        ${e.nota ? `<p class="ev-nota">${escapar(e.nota).replace(/\n/g, '<br>')}</p>` : ''}
        <p class="tenue">${e.calendario ? `De tu calendario «${escapar(e.calendario)}». Para cambiarlo, hazlo en su aplicación.` : FUENTE[e.fuente] ? `${FUENTE[e.fuente]}.` : ''}</p>
        <div class="ev-acciones">
          ${e.hecho !== null && e.hecho !== undefined && ['tarea', 'lista', 'evento'].includes(e.fuente) ? `<button class="btn primario" data-a="hecho">${icono('check')}${e.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}</button>` : ''}
          ${e.editable ? `<button class="btn suave" data-a="editar">Editar</button>` : ''}
          ${e.ir ? `<button class="btn suave" data-a="ir">Abrir en Lumen ${icono('der')}</button>` : ''}
          ${e.fuente !== 'importado' ? `<a class="btn suave" href="${enlaceGoogle(e)}" target="_blank" rel="noopener">Añadir a Google Calendar</a>` : ''}
        </div>
        ${e.editable ? `<div class="ev-borrar">${e.repite
          ? `<button class="btn-texto peligro" data-a="borrar-dia">Borrar solo este día</button><button class="btn-texto peligro" data-a="borrar">Borrar toda la serie</button>`
          : `<button class="btn-texto peligro" data-a="borrar">Borrar</button>`}</div>` : ''}
      </div>`,
    alAbrir: (cuerpo, cerrar) => cuerpo.addEventListener('click', async ev => {
      const a = ev.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'hecho') { alternarHecho(e); actualizarExportacion(); await cerrar(); return alCambiar?.(); }
      if (a === 'editar') { await cerrar(); return abrirFormulario({ ...datosDe(e), previo: e }, null, alCambiar); }
      if (a === 'ir') { await cerrar(); return dispatchEvent(new CustomEvent('ir-a', { detail: e.ir })); }
      if (a === 'borrar' || a === 'borrar-dia') {
        if (a === 'borrar' && !confirm(e.repite ? '¿Borrar todas las repeticiones?' : '¿Borrar este evento?')) return;
        borrar(e, a === 'borrar-dia');
        actualizarExportacion();
        await cerrar();
        aviso('Borrado');
        alCambiar?.();
      }
    }),
  });
}

// Enlace para añadir un evento suelto a Google Calendar
function enlaceGoogle(e) {
  const f = e.fecha.replaceAll('-', '');
  const dates = e.todoElDia || !e.inicio
    ? `${f}/${sumarDias(e.fecha, 1).replaceAll('-', '')}`
    : `${f}T${e.inicio.replace(':', '')}00/${f}T${(e.fin || sumarMin(e.inicio, 60)).replace(':', '')}00`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.titulo, dates, ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid' });
  if (e.lugar) p.set('location', e.lugar);
  if (e.nota) p.set('details', e.nota);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/* ============================== CREAR / EDITAR ============================== */
const CATS_FORM = ['clase', 'estudio', 'trabajo', 'deporte', 'hogar', 'personal'];
const DESTINO = {
  tarea: 'Se guarda también en tu tablero de Estudios y trabajo.',
  lista: 'Se guarda también en tu lista de Personal.',
  evento: '',
};

export function abrirFormulario(inicial, origen, alGuardar) {
  const previo = inicial.previo || null;
  const d = {
    titulo: '', cat: previo ? inicial.cat : (leer('cal-ultima-cat', 'clase')), fecha: hoyISO(), todoElDia: false,
    inicio: '10:00', fin: '11:00', repetir: 'no', dias: [], hasta: '', lugar: '', nota: '', ...inicial,
  };
  if (!d.inicio) d.inicio = '10:00';
  if (!d.fin) d.fin = sumarMin(d.inicio, 60);
  const dowDe = iso => fecha(iso).getDay();
  if (!d.dias?.length) d.dias = [dowDe(d.fecha)];

  abrirModal({
    origen,
    titulo: previo ? 'Editar' : 'Nuevo',
    subtitulo: 'Calendario',
    contenido: `
      <form class="ev-form" autocomplete="off" novalidate>
        <input class="ev-titulo" name="titulo" placeholder="¿Qué tienes?" value="${escapar(d.titulo)}" required>
        <div class="ev-cats" role="radiogroup" aria-label="Tipo">
          ${CATS_FORM.map(c => `<label class="ev-cat" style="--c:${CATEGORIAS[c].color}"><input type="radio" name="cat" value="${c}" ${d.cat === c ? 'checked' : ''}><span><i></i>${CATEGORIAS[c].nombre}</span></label>`).join('')}
        </div>
        <div class="ev-fila">
          <label class="campo">Día <input type="date" name="fecha" value="${d.fecha}" required></label>
          <label class="interruptor"><input type="checkbox" name="todoElDia" ${d.todoElDia ? 'checked' : ''}><span class="pista"></span>Todo el día</label>
        </div>
        <div class="ev-fila ev-horas">
          <label class="campo">Empieza <input type="time" name="inicio" value="${d.inicio}" step="300"></label>
          <label class="campo">Termina <input type="time" name="fin" value="${d.fin}" step="300"></label>
        </div>
        <label class="campo">Repetir
          <select name="repetir">
            <option value="no" ${d.repetir === 'no' ? 'selected' : ''}>No se repite</option>
            <option value="semanal" ${d.repetir === 'semanal' ? 'selected' : ''}>Cada semana (horario de clases, trabajo…)</option>
            <option value="anual" ${d.repetir === 'anual' ? 'selected' : ''}>Cada año (cumpleaños, aniversarios…)</option>
          </select>
        </label>
        <div class="ev-semanal">
          <div class="ev-dias" aria-label="Qué días">${[1, 2, 3, 4, 5, 6, 0].map((n, i) => `<label><input type="checkbox" name="dias" value="${n}" ${d.dias.includes(n) ? 'checked' : ''}><span>${INICIALES[i]}</span></label>`).join('')}</div>
          <label class="campo">Hasta <input type="date" name="hasta" value="${d.hasta || ''}"><small class="tenue">Por ejemplo, el último día del cuatrimestre. Vacío = sin fin.</small></label>
        </div>
        <label class="campo"><span class="ev-lugar-txt">Lugar</span><input name="lugar" value="${escapar(d.lugar || '')}" placeholder="Aula, dirección o enlace"></label>
        <label class="campo">Notas <textarea name="nota" rows="2">${escapar(d.nota || '')}</textarea></label>
        <p class="ev-destino"></p>
        <p class="error" id="ev-error"></p>
        <div class="ev-acciones fin">
          <button type="button" class="btn suave" data-cerrar-modal>Cancelar</button>
          <button class="btn primario" type="submit">${previo ? 'Guardar cambios' : 'Añadir al calendario'}</button>
        </div>
      </form>`,
    alAbrir: (cuerpo, cerrar) => {
      const form = cuerpo.querySelector('form');
      const campo = n => form.elements[n];
      let repetirTocado = !!previo;
      let diasTocados = !!previo && d.repetir === 'semanal';
      // Si no has elegido días a mano, la clase se repite el mismo día de la semana que la fecha
      const sincronizarDias = () => {
        if (diasTocados || !campo('fecha').value) return;
        form.querySelectorAll('[name=dias]').forEach(x => { x.checked = Number(x.value) === dowDe(campo('fecha').value); });
      };
      let duracion = Math.max(15, minutos(d.fin) - minutos(d.inicio));
      const actualizar = () => {
        const cat = form.querySelector('[name=cat]:checked')?.value;
        const rep = campo('repetir').value;
        form.classList.toggle('sin-horas', campo('todoElDia').checked);
        form.classList.toggle('con-semanal', rep === 'semanal');
        cuerpo.querySelector('.ev-lugar-txt').textContent = ['estudio', 'trabajo'].includes(cat) && rep === 'no' ? 'Asignatura o proyecto' : 'Lugar';
        const destino = rep === 'no' && ['estudio', 'trabajo'].includes(cat) ? 'tarea' : rep === 'no' && cat === 'hogar' ? 'lista' : 'evento';
        cuerpo.querySelector('.ev-destino').textContent = DESTINO[destino];
      };
      form.addEventListener('change', ev => {
        if (ev.target.name === 'repetir') repetirTocado = true;
        if (ev.target.name === 'cat' && !repetirTocado) {
          // Las clases suelen repetirse cada semana; lo demás, no
          campo('repetir').value = ev.target.value === 'clase' ? 'semanal' : 'no';
        }
        if (ev.target.name === 'dias') diasTocados = true;
        if (ev.target.name === 'fecha' || ev.target.name === 'repetir') sincronizarDias();
        if (ev.target.name === 'inicio' && campo('inicio').value) campo('fin').value = sumarMin(campo('inicio').value, duracion);
        if (ev.target.name === 'fin' && campo('fin').value) duracion = Math.max(15, minutos(campo('fin').value) - minutos(campo('inicio').value));
        actualizar();
      });
      // Un cumpleaños: cada año y todo el día
      campo('titulo').addEventListener('input', () => {
        if (!repetirTocado && /cumple|aniversario/i.test(campo('titulo').value)) {
          form.querySelector('[name=cat][value=personal]').checked = true;
          campo('repetir').value = 'anual';
          campo('todoElDia').checked = true;
          actualizar();
        }
      });
      if (!previo && d.cat === 'clase' && !inicial.repetir) campo('repetir').value = 'semanal';
      actualizar();
      setTimeout(() => campo('titulo').focus({ preventScroll: true }), sinMovimiento() ? 0 : 320);

      form.onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(form);
        const datos = {
          titulo: f.get('titulo').trim(), cat: f.get('cat'), fecha: f.get('fecha'), todoElDia: !!f.get('todoElDia'),
          inicio: f.get('inicio'), fin: f.get('fin'), repetir: f.get('repetir'), dias: f.getAll('dias').map(Number),
          hasta: f.get('hasta'), lugar: f.get('lugar').trim(), nota: f.get('nota').trim(),
        };
        const error = cuerpo.querySelector('#ev-error');
        if (!datos.titulo) { error.textContent = 'Ponle un título.'; return campo('titulo').focus(); }
        if (!datos.fecha) { error.textContent = 'Elige el día.'; return; }
        if (!datos.todoElDia && !datos.inicio) { error.textContent = 'Pon la hora de inicio o marca «Todo el día».'; return; }
        if (!datos.todoElDia && (!datos.fin || datos.fin <= datos.inicio)) datos.fin = sumarMin(datos.inicio, 60);
        if (datos.repetir === 'semanal' && !datos.dias.length) datos.dias = [dowDe(datos.fecha)];
        if (datos.hasta && datos.hasta < datos.fecha) { error.textContent = '«Hasta» no puede ser antes del primer día.'; return; }
        guardarDesdeFormulario(datos, previo);
        guardar('cal-ultima-cat', datos.cat);
        actualizarExportacion();
        await cerrar();
        aviso(previo ? 'Cambios guardados' : 'Añadido al calendario');
        alGuardar?.();
      };
    },
  });
}

/* ============================== SINCRONIZAR ============================== */
const API = '/api/calendario';

async function descargar(url) {
  const r = await fetch(`${API}?url=${encodeURIComponent(url)}`);
  const t = await r.text();
  if (!r.ok) throw new Error(t || 'No se pudo descargar el calendario.');
  return t;
}
// Se guardan los eventos de 2 meses atrás a 1 año adelante
const ventana = () => [sumarDias(hoyISO(), -60), sumarDias(hoyISO(), 365)];
const compactar = lista => lista.slice(0, 4000).map(({ uid, titulo, fecha, inicio, fin, todoElDia, lugar, nota }) =>
  ({ uid, titulo, fecha, inicio, fin, todoElDia, lugar: lugar || undefined, nota: nota ? nota.slice(0, 300) : undefined }));

async function importar(cal, texto) {
  const lista = leerICS(texto, ...ventana());
  guardar(`cal-cache:${cal.id}`, compactar(lista));
  const cals = leer('calendarios', []);
  const actualizado = { ...cal, nombre: cal.nombre || lista.nombre || 'Calendario', ultimo: Date.now(), n: lista.length, error: null };
  guardar('calendarios', cals.some(c => c.id === cal.id) ? cals.map(c => (c.id === cal.id ? actualizado : c)) : [...cals, actualizado]);
  return actualizado;
}

// Vuelve a descargar los calendarios con enlace que lleven más de 3 horas sin actualizarse
let refrescando = null;
export function refrescarImportados(forzar = false) {
  if (refrescando) return refrescando;
  const viejos = leer('calendarios', []).filter(c => c.url && (forzar || !c.ultimo || Date.now() - c.ultimo > 3 * 3600e3));
  if (!viejos.length || !navigator.onLine) return Promise.resolve(false);
  refrescando = (async () => {
    let cambio = false;
    for (const c of viejos) {
      try { await importar(c, await descargar(c.url)); cambio = true; } catch (e) {
        guardar('calendarios', leer('calendarios', []).map(x => (x.id === c.id ? { ...x, error: e.message } : x)));
      }
    }
    refrescando = null;
    return cambio;
  })();
  return refrescando;
}

async function cargarFotos() {
  try {
    const fotos = await fotosDe('progreso');
    marcarSemanasConFoto(fotos.map(f => domingoDe(f.fecha)));
  } catch { /* sin fotos */ }
}

// ---------- Ver Lumen en Google Calendar ----------
const URL_FEED = token => `${location.origin}${API}?feed=${token}`;
function icsDeLumen() {
  const hoy = hoyISO();
  const eventos = eventosEntre(sumarDias(hoy, -30), sumarDias(hoy, 180), { conImportados: false });
  return crearICS(eventos.map(e => ({
    uid: e.id, titulo: `${e.hecho ? '✓ ' : ''}${e.titulo}`, fecha: e.fecha, inicio: e.inicio, fin: e.fin,
    todoElDia: e.todoElDia, lugar: e.lugar, nota: e.nota,
  })), 'Lumen');
}
let temporizadorExport = null;
// Mantiene al día el calendario que lee Google (si has creado el enlace)
export function actualizarExportacion() {
  clearTimeout(temporizadorExport);
  temporizadorExport = setTimeout(() => {
    const ex = leer('cal-exportar', null);
    if (!ex?.token) return;
    const ics = icsDeLumen();
    const sinMarca = t => t.replace(/^DTSTAMP:.*$/gm, '');
    if (sinMarca(ics) !== sinMarca(ex.ics || '')) guardar('cal-exportar', { token: ex.token, ics, actualizado: Date.now() });
  }, 800);
}
const nuevoToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 57]).join('');

function descargarArchivo(nombre, texto) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/calendar' }));
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const haceCuanto = t => {
  if (!t) return 'sin actualizar';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'actualizado ahora' : m < 60 ? `actualizado hace ${m} min` : m < 1440 ? `actualizado hace ${Math.round(m / 60)} h` : `actualizado hace ${Math.round(m / 1440)} días`;
};

export function abrirSincronizar(origen, alCambiar) {
  const cfg = ajustesCal();
  const DIAS_SEL = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
  const selDia = (nombre, v) => `<select name="${nombre}">${DIAS_SEL.map(([n, t]) => `<option value="${n}" ${n === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;

  abrirModal({
    origen,
    titulo: 'Sincronizar',
    subtitulo: 'Calendario',
    contenido: `
      <div class="sync">
        <section class="sync-bloque">
          <h3 class="modal-h3">Trae tus calendarios</h3>
          <p class="sync-txt">Clases, entregas y exámenes de <b>PoliformaT</b>, tu <b>Google Calendar</b>, Outlook o cualquier calendario con enlace iCal (.ics). Se actualizan solos cada vez que abres Lumen.</p>
          <ul class="sync-lista" id="sync-lista"></ul>
          <form class="campos" id="sync-form" autocomplete="off">
            <label class="campo">Enlace del calendario <input name="url" inputmode="url" placeholder="https://…/calendario.ics  o  webcal://…" required></label>
            <div class="campos-3">
              <label class="campo">Nombre <input name="nombre" placeholder="PoliformaT"></label>
              <label class="campo">Es de <select name="cat">${CATS_FORM.map(c => `<option value="${c}">${CATEGORIAS[c].nombre}</option>`).join('')}</select></label>
              <div class="campo">Color <div class="sync-colores">${COLORES_CAL.map((c, i) => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${i === 0 ? 'checked' : ''}><i></i></label>`).join('')}</div></div>
            </div>
            <div class="fila-botones">
              <button class="btn primario" type="submit">Añadir calendario</button>
              <label class="btn suave">Subir archivo .ics<input type="file" accept=".ics,text/calendar" id="sync-archivo" hidden></label>
            </div>
            <p class="error" id="sync-error"></p>
          </form>
          <details class="sync-ayuda">
            <summary>¿Dónde está el enlace de PoliformaT?</summary>
            <ol>
              <li>Entra en <b>poliformat.upv.es</b> y abre tu espacio personal (o el de una asignatura).</li>
              <li>Abre la herramienta <b>Calendario</b>.</li>
              <li>Busca <b>Suscribirse / Exportar</b> (iCal) y genera la dirección.</li>
              <li>Copia el enlace (empieza por https:// o webcal://) y pégalo arriba.</li>
            </ol>
            <p class="tenue">Si tu horario de clases solo está en la intranet sin enlace iCal, descarga el archivo .ics si te lo deja, o créalo aquí una vez con «Nuevo → Cada semana».</p>
          </details>
          <details class="sync-ayuda">
            <summary>¿Y el de Google Calendar?</summary>
            <ol>
              <li>En el ordenador, abre <b>calendar.google.com</b> → ⚙️ <b>Configuración</b>.</li>
              <li>A la izquierda, elige tu calendario en <b>Configuración de mis calendarios</b>.</li>
              <li>Baja a <b>Integrar el calendario</b> y copia la <b>Dirección secreta en formato iCal</b>.</li>
              <li>Pégala arriba. Es privada: no la compartas.</li>
            </ol>
          </details>
        </section>

        <section class="sync-bloque" id="sync-export"></section>

        <section class="sync-bloque">
          <h3 class="modal-h3">Horas de tu entreno</h3>
          <p class="sync-txt">Para colocar tu plan en el calendario. Puedes cambiarlas cuando quieras.</p>
          <form class="sync-horas" id="sync-horas">
            <div class="sh-fila"><b>Gimnasio</b><span>Lunes a viernes</span><input type="time" name="gymHora" value="${cfg.gymHora}"><label><input type="number" name="gymMin" value="${cfg.gymMin}" min="15" max="240" step="5"> min</label></div>
            ${[['series', 'Running · series'], ['easy', 'Running · easy'], ['larga', 'Running · tirada larga']].map(([k, n]) => `
              <div class="sh-fila"><b>${n}</b>${selDia(`run-${k}-dia`, cfg.run[k].dia)}<input type="time" name="run-${k}-hora" value="${cfg.run[k].hora}"><label><input type="number" name="run-${k}-min" value="${cfg.run[k].min}" min="15" max="240" step="5"> min</label></div>`).join('')}
            <div class="sh-fila"><b>Flexibilidad</b><label class="interruptor"><input type="checkbox" name="flexActiva" ${cfg.flexActiva ? 'checked' : ''}><span class="pista"></span>Cada día</label><input type="time" name="flexHora" value="${cfg.flexHora}"><label><input type="number" name="flexMin" value="${cfg.flexMin}" min="5" max="120" step="5"> min</label></div>
            <div class="sh-fila"><b>Foto de progreso</b><span>Domingos</span><input type="time" name="fotoHora" value="${cfg.fotoHora}"><span></span></div>
          </form>
        </section>
      </div>`,
    alAbrir: cuerpo => {
      const pintarLista = () => {
        const cals = leer('calendarios', []);
        cuerpo.querySelector('#sync-lista').innerHTML = cals.map(c => `
          <li style="--c:${c.color}">
            <i class="sync-punto"></i>
            <div><b>${escapar(c.nombre)}</b><small>${CATEGORIAS[c.cat]?.nombre || ''} · ${c.n ?? 0} eventos · ${c.url ? haceCuanto(c.ultimo) : 'subido como archivo'}${c.error ? ` · <span class="texto-error">${escapar(c.error)}</span>` : ''}</small></div>
            ${c.url ? `<button class="btn-icono" data-refrescar="${c.id}" aria-label="Actualizar">${icono('refrescar')}</button>` : ''}
            <button class="btn-icono" data-quitar="${c.id}" aria-label="Quitar">${icono('papelera')}</button>
          </li>`).join('') || '<li class="tenue sync-vacio">Aún no has añadido ningún calendario.</li>';
      };
      const pintarExport = () => {
        const ex = leer('cal-exportar', null);
        const caja = cuerpo.querySelector('#sync-export');
        const enlace = ex?.token ? URL_FEED(ex.token) : '';
        caja.innerHTML = `
          <h3 class="modal-h3">Ver Lumen en Google Calendar</h3>
          <p class="sync-txt">Tus clases, tareas, entrenos y recordatorios de Lumen aparecerán en Google Calendar (y en el calendario del móvil) como un calendario más.</p>
          ${!conCuenta ? '<p class="tenue">Entra en tu cuenta para crear tu enlace. Mientras tanto, puedes descargar el archivo e importarlo.</p>'
            : ex?.token ? `
              <div class="sync-enlace"><input readonly value="${enlace}" aria-label="Tu enlace"><button class="btn suave chico" data-copiar>${icono('copiar')}Copiar</button></div>
              <div class="fila-botones">
                <a class="btn primario" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(enlace.replace(/^https?:/, 'webcal:'))}" target="_blank" rel="noopener">Añadir a Google Calendar</a>
                <button class="btn-texto peligro" data-exportar-quitar>Desactivar enlace</button>
              </div>
              <p class="tenue">Google lo vuelve a leer cada pocas horas. Los calendarios que importas no se incluyen, para no verlos repetidos. En el iPhone: Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → Calendario suscrito, y pega el enlace.</p>`
            : '<div class="fila-botones"><button class="btn primario" data-exportar-activar>Crear mi enlace</button></div>'}
          <div class="fila-botones"><button class="btn suave" data-descargar>Descargar .ics</button></div>`;
      };
      pintarLista();
      pintarExport();

      const error = cuerpo.querySelector('#sync-error');
      const form = cuerpo.querySelector('#sync-form');
      form.onsubmit = async ev => {
        ev.preventDefault();
        const f = new FormData(form);
        const url = f.get('url').trim();
        if (!/^(https?|webcals?):\/\//i.test(url)) { error.textContent = 'Pega el enlace completo (empieza por https:// o webcal://).'; return; }
        const boton = form.querySelector('[type=submit]');
        boton.disabled = true; boton.textContent = 'Descargando…'; error.textContent = '';
        try {
          const cal = await importar({ id: nuevoId(), url, nombre: f.get('nombre').trim(), cat: f.get('cat'), color: f.get('color') }, await descargar(url));
          form.reset();
          aviso(`«${cal.nombre}» añadido: ${cal.n} eventos`);
          pintarLista(); alCambiar?.();
        } catch (e) {
          error.textContent = e.message;
        } finally {
          boton.disabled = false; boton.textContent = 'Añadir calendario';
        }
      };
      cuerpo.querySelector('#sync-archivo').onchange = async ev => {
        const archivo = ev.target.files[0];
        if (!archivo) return;
        error.textContent = '';
        try {
          const f = new FormData(form);
          const cal = await importar({ id: nuevoId(), url: null, nombre: f.get('nombre').trim() || archivo.name.replace(/\.ics$/i, ''), cat: f.get('cat'), color: f.get('color') }, await archivo.text());
          aviso(`«${cal.nombre}» añadido: ${cal.n} eventos`);
          pintarLista(); alCambiar?.();
        } catch (e) { error.textContent = e.message; }
        ev.target.value = '';
      };

      cuerpo.addEventListener('click', async ev => {
        const r = ev.target.closest('[data-refrescar]');
        if (r) {
          const cal = leer('calendarios', []).find(c => c.id === r.dataset.refrescar);
          r.classList.add('girando');
          try { await importar(cal, await descargar(cal.url)); aviso('Actualizado'); } catch (e) {
            guardar('calendarios', leer('calendarios', []).map(x => (x.id === cal.id ? { ...x, error: e.message } : x)));
          }
          pintarLista(); alCambiar?.();
          return;
        }
        const q = ev.target.closest('[data-quitar]');
        if (q) {
          if (!confirm('¿Quitar este calendario de Lumen? (No se borra de su aplicación)')) return;
          guardar('calendarios', leer('calendarios', []).filter(c => c.id !== q.dataset.quitar));
          guardar(`cal-cache:${q.dataset.quitar}`, []);
          pintarLista(); alCambiar?.();
          return;
        }
        if (ev.target.closest('[data-exportar-activar]')) {
          guardar('cal-exportar', { token: nuevoToken(), ics: icsDeLumen(), actualizado: Date.now() });
          return pintarExport();
        }
        if (ev.target.closest('[data-exportar-quitar]')) {
          if (!confirm('El enlace dejará de funcionar y Google Calendar ya no verá Lumen. ¿Desactivarlo?')) return;
          guardar('cal-exportar', null);
          return pintarExport();
        }
        if (ev.target.closest('[data-copiar]')) {
          const input = cuerpo.querySelector('.sync-enlace input');
          try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
          return aviso('Enlace copiado');
        }
        if (ev.target.closest('[data-descargar]')) return descargarArchivo('lumen.ics', icsDeLumen());
      });

      // Horas del entreno: se guardan al cambiarlas
      cuerpo.querySelector('#sync-horas').addEventListener('change', ev => {
        const f = new FormData(ev.currentTarget);
        const n = (k, def) => Number(f.get(k)) || def;
        const run = {};
        for (const k of ['series', 'easy', 'larga']) run[k] = { dia: Number(f.get(`run-${k}-dia`)), hora: f.get(`run-${k}-hora`) || cfg.run[k].hora, min: n(`run-${k}-min`, cfg.run[k].min) };
        guardar('cal-ajustes', {
          gymHora: f.get('gymHora') || cfg.gymHora, gymMin: n('gymMin', cfg.gymMin),
          flexActiva: !!f.get('flexActiva'), flexHora: f.get('flexHora') || cfg.flexHora, flexMin: n('flexMin', cfg.flexMin),
          fotoHora: f.get('fotoHora') || cfg.fotoHora, run,
        });
        actualizarExportacion();
        alCambiar?.();
      });
    },
  });
}

/* ============================== RESUMEN ============================== */
// La tarjeta "Agenda" del Resumen: los próximos 7 días, con lo de cada día
let diaResumen = null;
export function pintarAgendaResumen(caja) {
  const hoy = hoyISO();
  if (!diaResumen || diaResumen < hoy || diaResumen > sumarDias(hoy, 6)) diaResumen = hoy;
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i));
  const o = ocultas();
  const eventos = eventosEntre(hoy, sumarDias(hoy, 6)).filter(e => !o.has(e.cat));
  actuales.clear();
  eventos.forEach(e => actuales.set(e.id, e));
  const delDia = eventos.filter(e => e.fecha === diaResumen);
  caja.innerHTML = `
    <div class="ra-tira">${fechas.map(f => {
      const colores = [...new Set(eventos.filter(e => e.fecha === f).map(e => e.color))].slice(0, 4);
      return `<button class="ct-dia ${f === hoy ? 'hoy' : ''} ${f === diaResumen ? 'sel' : ''}" data-ra-dia="${f}">
        <small>${f === hoy ? 'hoy' : DIAS_CORTOS[fecha(f).getDay()]}</small><b>${Number(f.slice(8))}</b>
        <span class="ct-puntos">${colores.map(c => `<i style="background:${c}"></i>`).join('')}</span></button>`;
    }).join('')}</div>
    <ul class="ra-lista">${delDia.map(filaAgenda).join('') || `<li class="tenue ra-vacio">${diaResumen === hoy ? 'Nada más por hoy.' : 'Día libre.'}</li>`}</ul>
    <div class="ra-pie">
      <button class="btn suave chico" data-ra-nuevo>${icono('mas')}Añadir</button>
      <button class="btn-texto" data-ra-sync>Sincronizar calendarios</button>
    </div>`;
  if (!caja.dataset.listo) {
    caja.dataset.listo = '1';
    caja.addEventListener('click', ev => {
      ev.stopPropagation();
      const repintar = () => pintarAgendaResumen(caja);
      const d = ev.target.closest('[data-ra-dia]');
      if (d) { diaResumen = d.dataset.raDia; return repintar(); }
      const check = ev.target.closest('[data-check]');
      if (check) { const e = actuales.get(check.dataset.check); if (e) { alternarHecho(e); actualizarExportacion(); repintar(); } return; }
      const evb = ev.target.closest('[data-ev]');
      if (evb) { const e = actuales.get(evb.dataset.ev); if (e) abrirDetalle(e, evb, repintar); return; }
      if (ev.target.closest('[data-ra-nuevo]')) {
        const ahora = new Date();
        const inicio = hhmm(Math.min(22 * 60, (ahora.getHours() + 1) * 60));
        return abrirFormulario({ fecha: diaResumen, inicio, fin: sumarMin(inicio, 60) }, ev.target.closest('[data-ra-nuevo]'), repintar);
      }
      if (ev.target.closest('[data-ra-sync]')) return abrirSincronizar(ev.target.closest('[data-ra-sync]'), repintar);
    });
    cargarFotos().then(() => caja.isConnected && pintarAgendaResumen(caja));
    refrescarImportados().then(c => c && caja.isConnected && pintarAgendaResumen(caja));
  }
}
