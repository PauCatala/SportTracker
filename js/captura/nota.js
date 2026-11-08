// NOTA RÁPIDA: escribes o dictas lo que sea y SYNCO lo apunta donde toca
// (calendario, tareas, tu lista, gimnasio o running). Antes de guardar ves cómo lo ha entendido
// y puedes corregirlo. Las notas quedan guardadas, como en las Notas del móvil.
// Se abre con el botón flotante, o con el enlace #nota (también #nota?t=texto, para Siri / Atajos).
import { analizar } from './analizar.js';
import { leer, guardar, nuevoId, hoyISO, escapar } from '../almacen.js';
import { state, guardarSesion, supabase, ejecutar, cargarTodo } from '../db.js';
import { mesocicloDe } from '../consultas.js';
import { aviso, fmtTiempo, parseTiempo, fmtCorta, mensajeError } from '../utils.js';
import { CATEGORIAS } from '../agenda.js';

const CLAVE = 'notas-rapidas';
const TIPOS = {
  evento: { nombre: 'Calendario', icono: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>' },
  tarea: { nombre: 'Tarea', icono: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>' },
  compra: { nombre: 'Compra', icono: '<path d="M4 5h2l2.2 10.2a1.5 1.5 0 001.5 1.2h7.6a1.5 1.5 0 001.5-1.1L20 9H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>' },
  lista: { nombre: 'Tu lista', icono: '<path d="M9 7h10M9 12h10M9 17h10"/><circle cx="5" cy="7" r=".9"/><circle cx="5" cy="12" r=".9"/><circle cx="5" cy="17" r=".9"/>' },
  gym: { nombre: 'Gimnasio', icono: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>' },
  run: { nombre: 'Running', icono: '<circle cx="15" cy="4.5" r="1.8"/><path d="M9 20l3-5.5 3 2.5V21M6 12.5l3-3.5 4 1 2.5 3.5 3 .5"/>' },
  nota: { nombre: 'Solo nota', icono: '<path d="M6 4.5h9l3 3v12H6z"/><path d="M9 11h6M9 14.5h6"/>' },
};
const TIPOS_RUN = { easy: 'Rodaje suave', larga: 'Tirada larga', series: 'Series', tempo: 'Umbral / tempo' };
const PRIOS = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
const EJEMPLOS = ['Mañana a las 17 reunión con Laura', 'Lista de la compra: leche, huevos y pan', 'Press banca 3x10 80 kg', 'He corrido 8 km en 42 min', 'Entregar la práctica el viernes, urgente', 'Comprar leche'];
const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONO_NOTA = '<path d="M5 19.5l1-4L15.5 6a2.1 2.1 0 013 3L9 18.5z"/><path d="M13.5 8l3 3"/><path d="M19 15.5v4M17 17.5h4"/>';
const ICONO_MIC = '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5"/>';

/* ---------------- Botón flotante ---------------- */
export function montarCaptura() {
  if (document.querySelector('.nr-fab')) return;
  const b = document.createElement('button');
  b.className = 'nr-fab'; b.type = 'button';
  b.setAttribute('aria-label', 'Nota rápida');
  b.title = 'Nota rápida: escribe o dicta y lo apunto donde toca';
  b.innerHTML = svg(ICONO_NOTA);
  b.onclick = () => abrirCaptura();
  document.body.append(b);
  // Enlaces #nota y #nota?t=… (p. ej. desde un atajo de Siri)
  const revisar = () => {
    const h = location.hash;
    if (!h.startsWith('#nota')) return;
    const iphone = h.startsWith('#nota-iphone');    // viene del QR del ordenador
    const t = iphone ? '' : new URLSearchParams(h.split('?')[1] || '').get('t') || '';
    history.replaceState(null, '', location.pathname + location.search);
    abrirCaptura(t);
    if (iphone) document.querySelector('.nr [data-pest="iphone"]')?.click();
  };
  addEventListener('hashchange', revisar);
  revisar();
}

/* ---------------- Hoja de captura ---------------- */
let abierta = null;
export function abrirCaptura(textoInicial = '') {
  if (abierta) { abierta.ponerTexto(textoInicial); return; }
  const capa = document.createElement('div');
  capa.className = 'nr';
  capa.innerHTML = `
    <div class="nr-hoja" role="dialog" aria-modal="true" aria-label="Nota rápida">
      <header class="nr-cab">
        <div class="nr-pestanas" role="tablist">
          <button role="tab" aria-selected="true" data-pest="nueva">Nueva</button>
          <button role="tab" aria-selected="false" data-pest="notas">Mis notas <b data-n></b></button>
          <button role="tab" aria-selected="false" data-pest="iphone">En el iPhone</button>
        </div>
        <button class="nr-x" data-cerrar aria-label="Cerrar">${svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>')}</button>
      </header>
      <section class="nr-nueva" data-vista="nueva">
        <div class="nr-escribir">
          <textarea rows="3" placeholder="Escribe o dicta lo que sea…&#10;Ej.: mañana a las 17 reunión con Laura" aria-label="Nota"></textarea>
          <button class="nr-mic" type="button" aria-label="Dictar" aria-pressed="false">${svg(ICONO_MIC)}</button>
        </div>
        <div class="nr-ejemplos">${EJEMPLOS.map(e => `<button type="button" data-ejemplo="${escapar(e)}">${escapar(e)}</button>`).join('')}</div>
        <div class="nr-prev" aria-live="polite"></div>
        <footer class="nr-pie">
          <button class="btn" type="button" data-solo-nota>Guardar solo la nota</button>
          <button class="btn primario" type="button" data-apuntar disabled>Apuntar</button>
        </footer>
      </section>
      <section class="nr-lista" data-vista="notas" hidden></section>
      <section class="nr-iphone" data-vista="iphone" hidden></section>
    </div>`;
  document.body.append(capa);
  document.documentElement.classList.add('sin-scroll');
  requestAnimationFrame(() => capa.classList.add('ver'));
  const $ = s => capa.querySelector(s);
  const area = $('textarea'), prev = $('.nr-prev'), apuntar = $('[data-apuntar]');
  let acciones = [];

  const cerrar = () => {
    dictado?.stop();
    removeEventListener('keydown', tecla);
    capa.classList.remove('ver');
    document.documentElement.classList.remove('sin-scroll');
    setTimeout(() => capa.remove(), 260);
    abierta = null;
  };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', tecla);
  capa.addEventListener('click', e => { if (e.target === capa || e.target.closest('[data-cerrar]')) cerrar(); });

  // ----- Interpretar mientras escribes -----
  let espera = null;
  const interpretar = () => {
    acciones = analizar(area.value, { hoy: hoyISO(), ejercicios: state.ejercicios || [] });
    pintarPrevia();
  };
  const crecer = () => { area.style.height = 'auto'; area.style.height = `${Math.min(area.scrollHeight + 2, 240)}px`; };
  area.addEventListener('input', () => { crecer(); clearTimeout(espera); espera = setTimeout(interpretar, 250); });
  area.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apuntar.click(); });

  function pintarPrevia() {
    const utiles = acciones.filter(a => a.tipo !== 'nota').length;
    apuntar.disabled = !acciones.length;
    apuntar.textContent = !acciones.length ? 'Apuntar' : utiles ? `Apuntar ${utiles > 1 ? `(${utiles})` : ''}`.trim() : 'Guardar nota';
    $('.nr-ejemplos').hidden = !!area.value.trim();
    crecer();
    prev.innerHTML = acciones.length ? `<p class="nr-titulo">Lo apunto así</p>${acciones.map(tarjeta).join('')}` : '';
  }

  // Cambios en las tarjetas (corregir lo que se ha entendido)
  prev.addEventListener('input', e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const a = acciones[Number(el.closest('[data-i]').dataset.i)];
    const k = el.dataset.k, v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'tipo') return;
    if (k === 'ejercicio') { const ej = state.ejercicios.find(x => String(x.id) === v); a.ejercicio = ej ? { id: ej.id, nombre: ej.nombre } : null; }
    else if (k === 'series') a.series = leerSeriesTexto(v);
    else if (k === 'duracion') a.duracion_seg = parseTiempo(v, 'min') || null;
    else if (k === 'distancia_km') a.distancia_km = Number(String(v).replace(',', '.')) || null;
    else if (k === 'todoElDia') { a.todoElDia = v; if (!v && !a.inicio) { a.inicio = '10:00'; a.fin = '11:00'; } pintarPrevia(); }
    else a[k] = v;
  });
  prev.addEventListener('change', e => {
    const el = e.target.closest('[data-k="tipo"]'); if (!el) return;
    const i = Number(el.closest('[data-i]').dataset.i);
    acciones[i] = convertir(acciones[i], el.value);
    pintarPrevia();
  });
  prev.addEventListener('click', e => {
    const q = e.target.closest('[data-quitar]'); if (!q) return;
    acciones.splice(Number(q.closest('[data-i]').dataset.i), 1);
    pintarPrevia();
  });
  $('.nr-ejemplos').onclick = e => {
    const b = e.target.closest('[data-ejemplo]'); if (!b) return;
    area.value = b.dataset.ejemplo; interpretar(); area.focus();
  };

  // ----- Guardar -----
  apuntar.onclick = async () => {
    if (!area.value.trim()) return;
    apuntar.disabled = true;
    try {
      const hechos = await aplicar(acciones);
      guardarNota(area.value.trim(), hechos);
      aviso(hechos.length ? `Apuntado: ${hechos.join(' · ')}` : 'Nota guardada');
      dispatchEvent(new Event('synco:datos'));
      area.value = ''; acciones = []; pintarPrevia(); contar();
      area.focus();
    } catch (e) {
      console.warn('Nota rápida', e);
      aviso(e.message || mensajeError(e), 'error');
      apuntar.disabled = false;
    }
  };
  $('[data-solo-nota]').onclick = () => {
    if (!area.value.trim()) return area.focus();
    guardarNota(area.value.trim(), []);
    aviso('Nota guardada');
    area.value = ''; acciones = []; pintarPrevia(); contar();
  };

  // ----- Dictado (gratis: el reconocimiento de voz del propio navegador) -----
  const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('.nr-mic');
  let dictado = null;
  if (!Reconocer) {
    mic.title = 'Tu navegador no deja dictar aquí: usa el micrófono del teclado';
    mic.onclick = () => { aviso('Usa el micrófono del teclado para dictar'); area.focus(); };
  } else {
    mic.onclick = () => {
      if (dictado) return dictado.stop();
      const r = new Reconocer();
      r.lang = 'es-ES'; r.interimResults = true; r.continuous = true;
      const base = area.value ? `${area.value.replace(/\s+$/, '')}\n` : '';
      r.onresult = ev => {
        let t = '';
        for (const res of ev.results) t += res[0].transcript;
        area.value = base + t.trim();
        clearTimeout(espera); espera = setTimeout(interpretar, 200);
      };
      r.onerror = ev => { if (ev.error === 'not-allowed') aviso('Da permiso al micrófono para dictar', 'error'); };
      r.onend = () => { dictado = null; mic.classList.remove('activo'); mic.setAttribute('aria-pressed', 'false'); interpretar(); };
      r.start();
      dictado = r;
      mic.classList.add('activo'); mic.setAttribute('aria-pressed', 'true');
    };
  }

  // ----- Pestañas: nueva / mis notas -----
  const contar = () => { const n = leer(CLAVE, []).length; $('[data-n]').textContent = n || ''; };
  capa.querySelector('.nr-pestanas').onclick = e => {
    const b = e.target.closest('[data-pest]'); if (!b) return;
    capa.querySelectorAll('[data-pest]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    capa.querySelectorAll('[data-vista]').forEach(v => { v.hidden = v.dataset.vista !== b.dataset.pest; });
    if (b.dataset.pest === 'notas') pintarNotas();
    else if (b.dataset.pest === 'iphone') import('./bandeja.js').then(m => m.pintarGuiaIphone($('.nr-iphone')));
    else area.focus();
  };
  function pintarNotas() {
    const notas = leer(CLAVE, []);
    const lista = $('.nr-lista');
    lista.innerHTML = notas.length ? notas.map(n => {
      const [primera, ...resto] = n.texto.split('\n');
      return `
      <article class="nr-nota${n.revisar ? ' revisar' : ''}" data-id="${n.id}">
        <h4>${escapar(primera)}</h4>
        <p><time>${cuando(n.creada)}</time>${n.desde === 'iphone' ? ' <span class="nr-origen">desde el iPhone</span>' : ''} ${escapar(resto.join(' ').slice(0, 90))}</p>
        ${n.revisar ? '<div class="nr-hechos"><span class="nr-revisar">No la he entendido del todo: ábrela y pulsa «Volver a apuntar» para corregirla</span></div>' : ''}
        ${n.hechos?.length ? `<div class="nr-hechos">${n.hechos.map(h => `<span>${escapar(h)}</span>`).join('')}</div>` : ''}
        <div class="nr-nota-acc">
          <button type="button" class="btn-texto" data-reusar>Volver a apuntar</button>
          <button type="button" class="btn-texto" data-borrar-nota>Borrar</button>
        </div>
      </article>`;
    }).join('') : '<p class="nr-vacio">Aún no tienes notas. Lo que escribas o dictes se guarda aquí.</p>';
  }
  $('.nr-lista').onclick = e => {
    const art = e.target.closest('.nr-nota'); if (!art) return;
    const nota = leer(CLAVE, []).find(n => n.id === art.dataset.id);
    if (e.target.closest('[data-borrar-nota]')) {
      guardar(CLAVE, leer(CLAVE, []).filter(n => n.id !== art.dataset.id)); pintarNotas(); contar(); return;
    }
    if (e.target.closest('[data-reusar]') && nota) {
      if (nota.revisar) guardar(CLAVE, leer(CLAVE, []).map(n => (n.id === nota.id ? { ...n, revisar: false } : n)));
      capa.querySelector('[data-pest="nueva"]').click();
      area.value = nota.texto; interpretar();
      return;
    }
    art.classList.toggle('abierta');
    if (art.classList.contains('abierta') && nota) art.querySelector('p').innerHTML = `<time>${cuando(nota.creada)}</time> ${escapar(nota.texto.split('\n').slice(1).join('\n')).replace(/\n/g, '<br>')}`;
  };

  abierta = { ponerTexto(t) { if (t) { area.value = t; interpretar(); } area.focus(); } };
  contar();
  abierta.ponerTexto(textoInicial);
  setTimeout(() => area.focus(), 60);
}

/* ---------------- Tarjetas de la vista previa ---------------- */
function tarjeta(a, i) {
  const opciones = Object.entries(TIPOS).filter(([k]) => (k !== 'gym' && k !== 'run') || k === a.tipo || a.original === k)
    .map(([k, t]) => `<option value="${k}" ${k === a.tipo ? 'selected' : ''}>${t.nombre}</option>`).join('');
  const campo = (etq, html, clase = '') => `<label class="nr-campo ${clase}"><span>${etq}</span>${html}</label>`;
  const inp = (k, v, attrs = '') => `<input data-k="${k}" value="${escapar(v ?? '')}" ${attrs}>`;
  let cuerpo = '';
  if (a.tipo === 'evento') {
    cuerpo = campo('Qué', inp('titulo', a.titulo), 'ancho') + campo('Día', inp('fecha', a.fecha, 'type="date"'))
      + (a.todoElDia ? '' : campo('De', inp('inicio', a.inicio, 'type="time"')) + campo('A', inp('fin', a.fin, 'type="time"')))
      + campo('Tipo', `<select data-k="cat">${Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}" ${k === a.cat ? 'selected' : ''}>${c.nombre}</option>`).join('')}</select>`)
      + `<label class="nr-check"><input type="checkbox" data-k="todoElDia" ${a.todoElDia ? 'checked' : ''}> Todo el día</label>`;
  } else if (a.tipo === 'tarea') {
    cuerpo = campo('Qué', inp('titulo', a.titulo), 'ancho') + campo('Para', inp('fecha', a.fecha, 'type="date"'))
      + campo('Prioridad', `<select data-k="prioridad">${PRIOS.map(([k, n]) => `<option value="${k}" ${k === a.prioridad ? 'selected' : ''}>${n}</option>`).join('')}</select>`)
      + campo('De', `<select data-k="tipoTarea"><option value="estudio" ${a.tipoTarea === 'estudio' ? 'selected' : ''}>Estudio</option><option value="trabajo" ${a.tipoTarea === 'trabajo' ? 'selected' : ''}>Trabajo</option></select>`);
  } else if (a.tipo === 'lista') {
    cuerpo = campo('Qué', inp('texto', a.texto), 'ancho') + campo('Día', inp('fecha', a.fecha, 'type="date"'));
  } else if (a.tipo === 'compra') {
    cuerpo = campo('Qué', inp('texto', a.texto), 'ancho');
  } else if (a.tipo === 'gym') {
    const ejs = (state.ejercicios || []).filter(e => e.activo !== false);
    cuerpo = campo('Ejercicio', ejs.length
      ? `<select data-k="ejercicio"><option value="">${a.nombreLeido ? `¿«${escapar(a.nombreLeido)}»? Elige…` : 'Elige…'}</option>${ejs.map(e => `<option value="${e.id}" ${a.ejercicio?.id === e.id ? 'selected' : ''}>${escapar(e.nombre)}</option>`).join('')}</select>`
      : '<span class="nr-aviso">Entra en tu cuenta para apuntar en tu gimnasio</span>', 'ancho')
      + campo('Día', inp('fecha', a.fecha, 'type="date"'))
      + campo('Series (reps × kg)', inp('series', a.series.map(s => `${s.reps}×${s.kg}`).join(', '), 'inputmode="text"'), 'ancho');
  } else if (a.tipo === 'run') {
    cuerpo = campo('Tipo', `<select data-k="tipoRun">${Object.entries(TIPOS_RUN).map(([k, n]) => `<option value="${k}" ${k === a.tipoRun ? 'selected' : ''}>${n}</option>`).join('')}</select>`)
      + campo('Día', inp('fecha', a.fecha, 'type="date"'))
      + campo('Km', inp('distancia_km', a.distancia_km, 'inputmode="decimal"'))
      + campo('Tiempo', inp('duracion', a.duracion_seg ? fmtTiempo(a.duracion_seg) : '', 'placeholder="mm:ss" inputmode="numeric"'))
      + (a.tipoRun === 'series' && a.reps ? `<p class="nr-detalle">${a.reps} × ${a.metros_rep} m${a.seg_rep ? ` a ${fmtTiempo(a.seg_rep)}` : ''}${a.rec_seg ? ` · rec. ${fmtTiempo(a.rec_seg)}` : ''}</p>` : '');
  } else {
    cuerpo = `<p class="nr-detalle">${escapar(a.texto)}</p>`;
  }
  return `
    <article class="nr-accion ${a.tipo}" data-i="${i}">
      <div class="nr-accion-cab">
        <span class="nr-ico">${svg(TIPOS[a.tipo].icono)}</span>
        <select data-k="tipo" aria-label="Apuntar como">${opciones}</select>
        <button type="button" class="nr-quitar" data-quitar aria-label="No apuntar esto">${svg('<path d="M7 7l10 10M17 7L7 17"/>')}</button>
      </div>
      <div class="nr-campos">${cuerpo}</div>
    </article>`;
}

// Cambiar el tipo de una acción (si lo ha entendido mal)
function convertir(a, tipo) {
  const texto = a.titulo || a.texto || a.nombreLeido || '';
  const fecha = a.fecha || '';
  const original = a.original || (a.tipo === 'gym' || a.tipo === 'run' ? a.tipo : undefined);
  if (tipo === a.original && a.guardada) return { ...a.guardada, original };
  const guardada = original && (a.tipo === original) ? a : a.guardada;
  const base = { original, guardada };
  if (tipo === 'evento') return { ...base, tipo, titulo: texto, fecha: fecha || hoyISO(), todoElDia: false, inicio: '10:00', fin: '11:00', cat: 'personal' };
  if (tipo === 'tarea') return { ...base, tipo, titulo: texto, fecha, prioridad: 'media', tipoTarea: 'estudio' };
  if (tipo === 'lista') return { ...base, tipo, texto, fecha };
  if (tipo === 'compra') return { ...base, tipo, texto };
  return { ...base, tipo: 'nota', texto: a.texto || texto };
}

// «10×80, 8×85» o «3x10 80» → [{reps, kg}]
function leerSeriesTexto(v) {
  const t = String(v).toLowerCase().replace(/kg/g, '');
  const parejas = [...t.matchAll(/(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/g)];
  return parejas.map(p => ({ reps: Number(p[1]), kg: Number(p[2].replace(',', '.')) })).filter(s => s.reps > 0);
}

/* ---------------- Guardar en cada sitio ---------------- */
export async function aplicar(acciones) {
  const hechos = [];
  const pendGym = [];
  // Lista de la compra (Nutrición → Plan y compra): un artículo por cosa, sin repetir los que ya están
  const compra = acciones.filter(a => a.tipo === 'compra' && a.texto?.trim());
  if (compra.length) {
    const lista = leer('nutri-compra', []);
    const ya = new Set(lista.filter(x => !x.hecho).map(x => String(x.ing).toLowerCase()));
    const nuevos = compra.map(a => a.texto.trim()).filter(t => !ya.has(t.toLowerCase()));
    guardar('nutri-compra', [...lista, ...nuevos.map(t => ({ id: nuevoId(), ing: t, g: null, hecho: false }))]);
    hechos.push(`Compra: ${compra.map(a => a.texto.trim()).join(', ')}`);
  }
  for (const a of acciones) {
    if (a.tipo === 'evento') {
      if (!a.titulo || !a.fecha) throw new Error('Al evento le falta el título o el día');
      guardar('eventos', [...leer('eventos', []), {
        id: nuevoId(), titulo: a.titulo, cat: a.cat || 'personal', fecha: a.fecha, todoElDia: !!a.todoElDia,
        inicio: a.todoElDia ? null : a.inicio, fin: a.todoElDia ? null : a.fin, repetir: 'no', dias: [], hasta: null, lugar: '', nota: '',
      }]);
      hechos.push(`${a.titulo} (${fmtCorta(a.fecha)}${a.todoElDia ? '' : `, ${a.inicio}`})`);
    } else if (a.tipo === 'tarea') {
      guardar('tareas', [...leer('tareas', []), { id: nuevoId(), titulo: a.titulo, tipo: a.tipoTarea || 'estudio', area: '', fecha: a.fecha || '', estado: 'todo', prioridad: a.prioridad || 'media', creada: Date.now() }]);
      hechos.push(`Tarea: ${a.titulo}`);
    } else if (a.tipo === 'lista') {
      guardar('lista', [...leer('lista', []), { id: nuevoId(), texto: a.texto, hecho: false, fecha: a.fecha || '' }]);
      hechos.push(`Lista: ${a.texto}`);
    } else if (a.tipo === 'gym') {
      if (!a.ejercicio) throw new Error(`Elige el ejercicio de «${a.nombreLeido || a.texto}»`);
      if (!a.series.length) throw new Error(`Faltan las series de ${a.ejercicio.nombre}`);
      pendGym.push(a);
    } else if (a.tipo === 'run') {
      if (!a.distancia_km && !a.duracion_seg) throw new Error('A la salida le falta la distancia o el tiempo');
      await ejecutar(supabase.from('carreras').insert({
        fecha: a.fecha, tipo: a.tipoRun, distancia_km: a.distancia_km, duracion_seg: a.duracion_seg,
        reps: a.reps, metros_rep: a.metros_rep, seg_rep: a.seg_rep, rec_seg: a.rec_seg, fc_media: null, fc_max: null, notas: a.texto || null,
      }));
      hechos.push(`${TIPOS_RUN[a.tipoRun]}${a.distancia_km ? ` ${String(a.distancia_km).replace('.', ',')} km` : ''}`);
    }
  }
  if (pendGym.length) hechos.push(...await apuntarGym(pendGym));
  if (acciones.some(a => a.tipo === 'run')) await cargarTodo().catch(() => {});
  return hechos;
}

// Añade las series a la sesión de ese día (la que ya tenga ese ejercicio, la de su día de rutina,
// la que haya ese día o una nueva). Una sola escritura por sesión, porque se reescribe entera.
async function apuntarGym(lista) {
  const sesiones = new Map();   // "fecha|dia" → { fecha, dia, base, nuevas: [] }
  for (const a of lista) {
    const ej = state.ejercicios.find(e => e.id === a.ejercicio.id);
    const delDia = state.sesiones.filter(s => s.fecha === a.fecha);
    const conEj = delDia.find(s => state.series.some(x => x.sesion_id === s.id && x.ejercicio_id === a.ejercicio.id));
    const ses = conEj || delDia.find(s => s.dia === (ej?.dia || 'Sin día')) || delDia[0] || null;
    const dia = ses?.dia || [...sesiones.values()].find(x => x.fecha === a.fecha)?.dia || ej?.dia || 'Sin día';
    const k = `${a.fecha}|${dia}`;
    if (!sesiones.has(k)) {
      const previa = state.sesiones.find(s => s.fecha === a.fecha && s.dia === dia);
      sesiones.set(k, {
        fecha: a.fecha, dia, notas: previa?.notas ?? null,
        series: previa ? state.series.filter(x => x.sesion_id === previa.id).map(x => ({ ejercicio_id: x.ejercicio_id, numero_serie: x.numero_serie, drop_idx: x.drop_idx ?? 0, reps: x.reps, kg: x.kg, tecnica: x.tecnica ?? null })) : [],
        resumen: [],
      });
    }
    const s = sesiones.get(k);
    let n = Math.max(0, ...s.series.filter(x => x.ejercicio_id === a.ejercicio.id).map(x => x.numero_serie));
    for (const serie of a.series) s.series.push({ ejercicio_id: a.ejercicio.id, numero_serie: ++n, drop_idx: 0, reps: serie.reps, kg: serie.kg, tecnica: null });
    const iguales = a.series.every(x => x.reps === a.series[0].reps && x.kg === a.series[0].kg);
    s.resumen.push(`${a.ejercicio.nombre} ${iguales ? `${a.series.length}×${a.series[0].reps}${a.series[0].kg ? ` ${String(a.series[0].kg).replace('.', ',')} kg` : ''}` : a.series.map(x => `${x.reps}×${x.kg}`).join(', ')}`);
  }
  const hechos = [];
  for (const s of sesiones.values()) {
    const r = await guardarSesion({ fecha: s.fecha, dia: s.dia, notas: s.notas, mesociclo_id: mesocicloDe(s.fecha)?.id ?? null, series: s.series });
    hechos.push(...s.resumen.map(x => (r === 'pendiente' ? `${x} (se sube al tener conexión)` : x)));
  }
  dispatchEvent(new Event('estado-red'));
  return hechos;
}

// extra: { desde: 'iphone', creada } para las notas que llegan del Atajo del iPhone
export function guardarNota(texto, hechos, extra = {}) {
  guardar(CLAVE, [{ id: nuevoId(), texto, creada: new Date().toISOString(), hechos, ...extra }, ...leer(CLAVE, [])].slice(0, 300));
}
function cuando(isoFecha) {
  const d = new Date(isoFecha), hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
