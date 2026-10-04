// Bloque GIMNASIO: pestañas "Entrenar" e "Historial".
import { state, supabase, ejecutar, guardarSesion, cargarTodo } from './db.js';
import {
  diasPara, ejerciciosDelDia, ejercicioPorId, mesocicloDe, semanaDeMeso, semanasDeMeso, rutinaDe,
  sesionDe, seriesDe, ultimaVez, ordenEjercicios,
} from './consultas.js';
import {
  hoyISO, sumarDias, lunesDe, sumarMeses, finDeMes, parseISO, fmtCorta, fmtKg, fmtEntero, capitalizar,
  esc, num, agruparSeries, textoSet, metricas, aviso, mensajeError, requiereConexion,
} from './utils.js';
import { SEMANAS_MESO, diaSugerido, planCargado } from './plan.js';
import { icono } from './iconos.js';

export const navegar = (vista, bloque = 'gym') =>
  window.dispatchEvent(new CustomEvent('navegar', { detail: { bloque, vista } }));

const nombreCorto = dia => dia.split(' · ')[0];
const restoNombre = dia => dia.split(' · ').slice(1).join(' · ');
const rango = (min, max) => (min && max && min !== max ? `${min}–${max}` : `${min || max || ''}`);

/* =====================================================================
   ENTRENAR
   "form" guarda lo que vas escribiendo antes de pulsar Guardar:
   form.ej[idEjercicio] = [ [principal, drop, ...], [principal], ... ]
   ===================================================================== */
let form = null;
export const resetForm = () => (form = null);
export const abrirSesion = (fecha, dia) => (form = nuevoForm(fecha, dia));

const vacia = () => ({ reps: '', kg: '', tecnica: '' });

// Contexto del día: mesociclo, semana y prescripción de cada ejercicio
function contexto(fecha, dia) {
  const meso = mesocicloDe(fecha);
  const semana = meso ? semanaDeMeso(meso, fecha) : null;
  const descarga = !!(meso?.numero && semana === 4);
  const rutina = meso ? rutinaDe(meso.id, dia) : [];
  const presc = new Map(rutina.map(r => [r.ejercicio_id, { ...r, series: descarga ? Math.max(1, r.series - 1) : r.series }]));
  return { meso, semana, descarga, rutina, presc };
}

function nuevoForm(fecha, dia) {
  const f = { fecha, dia, notas: '', orden: [], ej: {}, sucio: false };
  const { rutina, presc } = contexto(fecha, dia);
  const ses = sesionDe(fecha, dia);
  const base = rutina.length ? rutina.map(r => r.ejercicio_id) : ejerciciosDelDia(dia).map(e => e.id);
  const enSesion = ses ? [...new Set(seriesDe(ses.id).map(s => s.ejercicio_id))] : [];
  f.orden = [...base, ...enSesion.filter(id => !base.includes(id))];
  if (ses) f.notas = ses.notas || '';

  for (const id of f.orden) {
    const sets = ses ? agruparSeries(seriesDe(ses.id, id)) : [];
    if (sets.length) {
      f.ej[id] = sets.map(partes => partes.map(p => ({ reps: p.reps, kg: p.kg, tecnica: p.tecnica || '' })));
    } else {
      const n = presc.get(id)?.series ?? ultimaVez(id, fecha)?.sets.length ?? 3;
      f.ej[id] = Array.from({ length: n }, () => [vacia()]);
    }
  }
  return f;
}

// ¿Superas la última vez? Regla: misma carga con más reps, o más carga
function comparar(p, prev) {
  const r = num(p.reps), k = num(p.kg);
  if (!prev || !(r > 0) || isNaN(k)) return '';
  const pk = Number(prev.kg), pr = Number(prev.reps);
  if (k > pk || (k === pk && r > pr)) return 'mejor';
  if (k === pk && r === pr) return 'igual';
  return 'peor';
}

export function renderRegistrar(cont) {
  if (!state.ejercicios.length) {
    cont.innerHTML = `
      ${bannerMigracion()}
      <div class="vacio">
        <h3>Empieza por tu plan</h3>
        <p>Carga los 6 mesociclos de tu plan y cada día verás qué ejercicios tocan, con sus series y repeticiones.</p>
        <button class="btn primario" id="ir-plan">Cargar el plan de 6 meses</button>
      </div>`;
    cont.onclick = ev => ev.target.closest('#ir-plan') && navegar('mesociclos');
    return;
  }
  if (!form) {
    const hoy = hoyISO();
    const dias = diasPara(hoy);
    form = nuevoForm(hoy, planCargado() ? diaSugerido(hoy, dias) : dias[0]);
  }
  pintarRegistrar(cont);
}

export function bannerMigracion() {
  return state.faltaMigracion ? `
    <div class="banner">${icono('rayo')}<div><b>Falta actualizar tu base de datos.</b>
    Ejecuta <b>schema_v2.sql</b> en Supabase (SQL Editor) para activar rutinas por mesociclo, running y flexibilidad.</div></div>` : '';
}

function heroGym(ctx) {
  const { meso, semana } = ctx;
  if (!meso) return `
    <section class="hero">
      <p class="hero-sup">Sin mesociclo</p>
      <h2>Entreno libre</h2>
      <p>Carga tu plan de 6 meses y aquí verás cada semana qué toca hacer.</p>
      <button class="btn" id="ir-plan">Ver mesociclos</button>
    </section>`;
  const total = semanasDeMeso(meso) || 4;
  const guia = meso.numero && SEMANAS_MESO[semana - 1];
  return `
    <section class="hero">
      <p class="hero-sup">${meso.numero ? `Mesociclo ${meso.numero} de 6` : 'Mesociclo'}</p>
      <h2>${esc(meso.nombre)}</h2>
      <div class="hero-semana"><b>Semana ${semana}</b><span>de ${total}</span></div>
      <div class="segmentos">${Array.from({ length: total }, (_, i) =>
        `<i class="${i + 1 < semana ? 'hecho' : i + 1 === semana ? 'actual' : ''}"></i>`).join('')}</div>
      ${guia ? `<div class="instruccion"><b>${guia.titulo}.</b> ${guia.texto}</div>` : ''}
      ${meso.descripcion ? `<p>${esc(meso.descripcion)}</p>` : ''}
    </section>`;
}

function pintarRegistrar(cont) {
  const ctx = contexto(form.fecha, form.dia);
  const dias = diasPara(form.fecha);
  if (!dias.includes(form.dia)) dias.push(form.dia);
  const ses = sesionDe(form.fecha, form.dia);
  const otros = state.ejercicios.filter(e => e.activo && !form.orden.includes(e.id)).sort(ordenEjercicios);

  cont.innerHTML = `
    ${bannerMigracion()}
    ${heroGym(ctx)}

    <section class="campos">
      <div class="barra-sesion">
        <div class="chips" role="tablist">
          ${dias.map(d => `<button class="chip ${d === form.dia ? 'activo' : ''}" data-dia="${esc(d)}">${esc(nombreCorto(d))}${sesionDe(form.fecha, d) ? '<span class="marca"></span>' : ''}</button>`).join('')}
        </div>
        <input type="date" id="f-fecha" value="${form.fecha}" aria-label="Fecha">
      </div>
      <div class="panel-cab">
        <div>
          <h3>${esc(restoNombre(form.dia) || form.dia)}</h3>
          <p class="tenue">${capitalizar(parseISO(form.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        </div>
        ${ses ? `<span class="etiqueta ${ses.pendiente ? 'pend' : 'ok'}">${ses.pendiente ? 'Pendiente de subir' : 'Guardada'}</span>` : ''}
      </div>
      <div class="leyenda">
        <span><i class="estado mejor"></i> Superas la última vez</span>
        <span><i class="estado igual"></i> Igualas</span>
        <span><i class="estado peor"></i> Por debajo</span>
      </div>
    </section>

    ${form.orden.map(id => tarjetaEjercicio(id, ctx)).join('')}

    <select id="f-anadir" aria-label="Añadir ejercicio">
      <option value="">Añadir otro ejercicio a esta sesión…</option>
      ${otros.map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}
      <option value="nuevo">Crear un ejercicio nuevo…</option>
    </select>

    <label class="campo">Notas de la sesión
      <textarea id="f-notas" rows="2" placeholder="Sensaciones, molestias, cambios…">${esc(form.notas)}</textarea>
    </label>
    <div class="acciones-sesion">
      <button id="f-guardar" class="btn primario">${ses ? 'Guardar cambios' : 'Guardar sesión'}</button>
      ${ses ? `<button id="f-borrar" class="btn peligro" aria-label="Borrar sesión">${icono('papelera')}</button>` : ''}
    </div>`;

  cont.oninput = ev => actualizarCampo(ev.target);
  cont.onchange = ev => alCambiar(ev.target, cont);
  cont.onclick = ev => alPulsar(ev, cont);
}

function tarjetaEjercicio(id, ctx) {
  const e = ejercicioPorId(id);
  const u = ultimaVez(id, form.fecha);
  const p = ctx.presc.get(id);
  const sets = form.ej[id];
  const setsUltima = u ? u.sets.map(partes => partes.map((x, j) =>
    `<span class="${j ? 'drop' : ''}">${j ? '+ ' : ''}${x.reps} × ${fmtKg(x.kg)}</span>`).join(' ')).join('') : '';
  return `
  <article class="panel ej" data-ej="${id}">
    <div class="ej-cab">
      <div>
        <h3>${esc(e?.nombre ?? 'Ejercicio borrado')}</h3>
        <div class="ej-meta">
          ${p ? `<span class="etiqueta objetivo">${p.series} × ${rango(p.reps_min, p.reps_max)} reps</span>` : ''}
          ${p && ctx.descarga ? '<span class="etiqueta descarga">Descarga</span>' : ''}
          ${e?.por_lado ? '<span class="etiqueta">Kg por lado</span>' : ''}
        </div>
      </div>
      ${u ? `<button class="btn-icono" data-acc="copiar" aria-label="Copiar la última vez" title="Copiar la última vez">${icono('copiar')}</button>` : ''}
    </div>
    ${u ? `
      <div class="ultima">
        <div class="ultima-cab">La última vez, ${fmtCorta(u.sesion.fecha).toLowerCase()}</div>
        <div class="ultima-sets num">${setsUltima}</div>
      </div>` : '<p class="tenue" style="margin-top:10px">Primera vez con este ejercicio: hoy marcas la referencia.</p>'}
    <div class="cab-series"><span></span><span>Reps</span><span>Kg</span><span>Técnica</span><span></span><span></span></div>
    ${sets.map((partes, i) => partes.map((pt, j) => fila(pt, i, j, u?.sets[i]?.[j], u?.sets[i]?.[0])).join('')).join('')}
    <div class="ej-pie">
      <button class="btn chico" data-acc="serie">${icono('mas')} Serie</button>
    </div>
  </article>`;
}

function fila(p, i, j, ref, prevPrincipal) {
  const principal = j === 0;
  const tec = [['', '—'], ['mala', 'Mala'], ['regular', 'Regular'], ['bien', 'Buena']];
  return `
  <div class="fila ${principal ? '' : 'drop'}" data-i="${i}" data-j="${j}">
    <span class="n">${principal ? i + 1 : '↳'}</span>
    <input data-campo="reps" inputmode="numeric" value="${esc(p.reps)}" placeholder="${ref ? ref.reps : '–'}" aria-label="Repeticiones serie ${i + 1}">
    <input data-campo="kg" inputmode="decimal" value="${esc(p.kg)}" placeholder="${ref ? fmtKg(ref.kg) : 'kg'}" aria-label="Kilos serie ${i + 1}">
    ${principal
      ? `<select data-campo="tecnica" aria-label="Técnica">${tec.map(([v, t]) => `<option value="${v}" ${p.tecnica === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`
      : '<span></span>'}
    <span class="estado ${principal ? comparar(p, prevPrincipal) : ''}"></span>
    <span class="acciones">
      ${principal ? `<button class="btn-icono" data-acc="drop" title="Añadir drop" aria-label="Añadir drop">${icono('abajo')}</button>` : ''}
      <button class="btn-icono" data-acc="quitar" title="Quitar" aria-label="Quitar">${icono('x')}</button>
    </span>
  </div>`;
}

function actualizarCampo(t) {
  if (t.id === 'f-notas') { form.notas = t.value; form.sucio = true; return; }
  const campo = t.dataset.campo;
  if (!campo) return;
  const filaEl = t.closest('.fila');
  const id = Number(t.closest('.ej').dataset.ej);
  const i = +filaEl.dataset.i, j = +filaEl.dataset.j;
  form.ej[id][i][j][campo] = t.value;
  form.sucio = true;
  if (j === 0) {
    const u = ultimaVez(id, form.fecha);
    filaEl.querySelector('.estado').className = 'estado ' + comparar(form.ej[id][i][0], u?.sets[i]?.[0]);
  }
}

function cambiarSesion(cont, fecha, dia) {
  if (form.sucio && !confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return false;
  form = nuevoForm(fecha, dia);
  pintarRegistrar(cont);
  return true;
}

async function alCambiar(t, cont) {
  if (t.dataset.campo) return actualizarCampo(t);

  if (t.id === 'f-fecha') {
    const fecha = t.value || hoyISO();
    const dias = diasPara(fecha);
    if (!cambiarSesion(cont, fecha, dias.includes(form.dia) ? form.dia : diaSugerido(fecha, dias))) t.value = form.fecha;
  }

  if (t.id === 'f-anadir') {
    const v = t.value;
    t.value = '';
    let id;
    if (v === 'nuevo') {
      const nombre = prompt('Nombre del nuevo ejercicio')?.trim();
      if (!nombre || !requiereConexion()) return;
      const porLado = confirm('¿Apuntas la carga por lado (por brazo o mancuerna)?\n\nAceptar = sí · Cancelar = no');
      try {
        const e = await ejecutar(supabase.from('ejercicios')
          .insert({ nombre, dia: form.dia, por_lado: porLado, orden: 999 }).select().single());
        await cargarTodo();
        id = e.id;
      } catch (err) { return aviso(mensajeError(err), 'error'); }
    } else if (v) {
      id = Number(v);
    } else return;

    if (!form.orden.includes(id)) {
      form.orden.push(id);
      const n = ultimaVez(id, form.fecha)?.sets.length ?? 3;
      form.ej[id] = Array.from({ length: n }, () => [vacia()]);
    }
    pintarRegistrar(cont);
  }
}

async function alPulsar(ev, cont) {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.id === 'ir-plan') return navegar('mesociclos');
  if (b.id === 'f-guardar') return guardar(cont, b);
  if (b.id === 'f-borrar') return borrar(cont);
  if (b.dataset.dia) return cambiarSesion(cont, form.fecha, b.dataset.dia);

  const acc = b.dataset.acc;
  if (!acc) return;
  const id = Number(b.closest('.ej').dataset.ej);
  const filaEl = b.closest('.fila');
  const i = filaEl ? +filaEl.dataset.i : -1, j = filaEl ? +filaEl.dataset.j : -1;
  const sets = form.ej[id];

  if (acc === 'serie') {
    const anterior = sets.at(-1)?.[0];
    sets.push([{ reps: '', kg: anterior?.kg ?? '', tecnica: '' }]);   // misma carga que la serie anterior
  }
  if (acc === 'drop') sets[i].push(vacia());
  if (acc === 'quitar') j === 0 ? sets.splice(i, 1) : sets[i].splice(j, 1);
  if (acc === 'copiar') {
    const u = ultimaVez(id, form.fecha);
    if (u) form.ej[id] = u.sets.map(partes => partes.map(p => ({ reps: p.reps, kg: p.kg, tecnica: '' })));
  }
  form.sucio = true;
  pintarRegistrar(cont);
}

// Convierte el formulario en filas para la tabla "series" (ignora las incompletas)
function construirSeries() {
  const filas = [];
  for (const id of form.orden) {
    let n = 0;
    for (const partes of form.ej[id] || []) {
      const validas = partes.filter(p => num(p.reps) > 0 && num(p.kg) >= 0);
      if (!validas.length) continue;
      n++;
      validas.forEach((p, j) => filas.push({
        ejercicio_id: id, numero_serie: n, drop_idx: j,
        reps: Math.round(num(p.reps)), kg: num(p.kg), tecnica: p.tecnica || null,
      }));
    }
  }
  return filas;
}

async function guardar(cont, boton) {
  const series = construirSeries();
  if (!series.length) return aviso('Rellena al menos una serie con reps y kg', 'error');
  boton.disabled = true;
  try {
    const r = await guardarSesion({
      fecha: form.fecha, dia: form.dia, notas: form.notas.trim() || null,
      mesociclo_id: mesocicloDe(form.fecha)?.id ?? null, series,
    });
    aviso(r === 'guardado' ? 'Sesión guardada' : 'Sin conexión: guardada en el móvil, se subirá sola');
    form = nuevoForm(form.fecha, form.dia);
    pintarRegistrar(cont);
    window.dispatchEvent(new Event('estado-red'));
  } catch (e) {
    aviso(mensajeError(e), 'error');
    boton.disabled = false;
  }
}

async function borrar(cont) {
  if (!confirm('¿Borrar esta sesión entera?')) return;
  try {
    await guardarSesion({ fecha: form.fecha, dia: form.dia, notas: null, mesociclo_id: null, series: [] });
    aviso('Sesión borrada');
    form = nuevoForm(form.fecha, form.dia);
    pintarRegistrar(cont);
    window.dispatchEvent(new Event('estado-red'));
  } catch (e) { aviso(mensajeError(e), 'error'); }
}

/* =====================================================================
   HISTORIAL: tabla tipo Excel por semana, mes o mesociclo
   ===================================================================== */
const hist = { modo: 'semana', ref: null, mesoId: null, dia: '' };

export function renderHistorial(cont) {
  if (!hist.ref) hist.ref = hoyISO();
  const mesos = [...state.mesociclos].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  let etiqueta, sesiones;

  if (hist.modo === 'meso') {
    const m = mesos.find(x => x.id === hist.mesoId) || mesocicloDe(hoyISO()) || mesos.at(-1);
    hist.mesoId = m?.id ?? null;
    etiqueta = m ? (m.numero ? `${m.numero}. ${m.nombre}` : m.nombre) : 'Sin mesociclos';
    sesiones = state.sesiones.filter(s => m && s.mesociclo_id === m.id);
  } else {
    let ini, fin;
    if (hist.modo === 'semana') {
      ini = lunesDe(hist.ref); fin = sumarDias(ini, 6);
      etiqueta = `${fmtCorta(ini)} – ${fmtCorta(fin).toLowerCase()}`;
    } else {
      ini = hist.ref.slice(0, 8) + '01'; fin = finDeMes(ini);
      etiqueta = capitalizar(parseISO(ini).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
    }
    sesiones = state.sesiones.filter(s => s.fecha >= ini && s.fecha <= fin);
  }
  if (hist.dia) sesiones = sesiones.filter(s => s.dia === hist.dia);
  sesiones = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const idsSes = new Set(sesiones.map(s => s.id));
  const seriesP = state.series.filter(s => idsSes.has(s.sesion_id));
  const ejercicios = [...new Set(seriesP.map(s => s.ejercicio_id))].map(ejercicioPorId).filter(Boolean).sort(ordenEjercicios);
  const diasTodos = [...new Set(state.sesiones.map(s => s.dia).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  const celda = (e, s) => {
    const sets = agruparSeries(seriesP.filter(x => x.sesion_id === s.id && x.ejercicio_id === e.id));
    if (!sets.length) return '<td class="vacia">–</td>';
    const ahora = metricas(sets, e.por_lado).e1rm;
    const u = ultimaVez(e.id, s.fecha);
    const antes = u ? metricas(u.sets, e.por_lado).e1rm : null;
    const cls = antes == null ? '' : ahora > antes + 0.05 ? 'sube' : ahora < antes - 0.05 ? 'baja' : '';
    return `<td class="${cls}">${sets.map(p => `<div>${textoSet(p)}</div>`).join('')}</td>`;
  };
  const volumenSesion = s => seriesP.filter(x => x.sesion_id === s.id)
    .reduce((t, x) => t + x.reps * x.kg * (ejercicioPorId(x.ejercicio_id)?.por_lado ? 2 : 1), 0);

  cont.innerHTML = `
    <div class="segmento">
      ${[['semana', 'Semana'], ['mes', 'Mes'], ['meso', 'Mesociclo']].map(([m, t]) =>
        `<button data-modo="${m}" class="${hist.modo === m ? 'activo' : ''}">${t}</button>`).join('')}
    </div>
    <div class="navegador">
      <button class="btn-icono" data-nav="-1" aria-label="Anterior">${icono('izq')}</button>
      <span>${esc(etiqueta)}</span>
      <button class="btn-icono" data-nav="1" aria-label="Siguiente">${icono('der')}</button>
    </div>
    <select id="h-dia" aria-label="Filtrar por día">
      <option value="">Todos los días</option>
      ${diasTodos.map(d => `<option value="${esc(d)}" ${d === hist.dia ? 'selected' : ''}>${esc(d)}</option>`).join('')}
    </select>

    ${!sesiones.length ? '<div class="vacio"><h3>Sin sesiones</h3><p>No hay entrenos en este periodo.</p></div>' : `
    <p class="tenue">${sesiones.length} ${sesiones.length > 1 ? 'sesiones' : 'sesión'}. Toca una fecha para abrirla. El color compara el 1RM estimado con la vez anterior.</p>
    <div class="tabla-scroll">
      <table class="tabla">
        <thead><tr>
          <th class="col-ej">Ejercicio</th>
          ${sesiones.map(s => `<th class="clicable" data-fecha="${s.fecha}" data-dia="${esc(s.dia)}">${fmtCorta(s.fecha)}<br><small>${esc(nombreCorto(s.dia || ''))}</small></th>`).join('')}
        </tr></thead>
        <tbody>
          ${ejercicios.map(e => `<tr><td class="col-ej">${esc(e.nombre)}${e.por_lado ? '<small>kg por lado</small>' : ''}</td>${sesiones.map(s => celda(e, s)).join('')}</tr>`).join('')}
          <tr class="total"><td class="col-ej">Volumen total</td>${sesiones.map(s => `<td>${fmtEntero(volumenSesion(s))} kg</td>`).join('')}</tr>
        </tbody>
      </table>
    </div>`}`;

  cont.onchange = ev => {
    if (ev.target.id === 'h-dia') { hist.dia = ev.target.value; renderHistorial(cont); }
  };
  cont.onclick = ev => {
    const b = ev.target.closest('[data-modo],[data-nav],[data-fecha]');
    if (!b) return;
    if (b.dataset.modo) hist.modo = b.dataset.modo;
    if (b.dataset.nav) {
      const n = Number(b.dataset.nav);
      if (hist.modo === 'semana') hist.ref = sumarDias(hist.ref, 7 * n);
      else if (hist.modo === 'mes') hist.ref = sumarMeses(hist.ref, n);
      else {
        const idx = mesos.findIndex(m => m.id === hist.mesoId);
        const sig = mesos[idx + n];
        if (sig) hist.mesoId = sig.id;
      }
    }
    if (b.dataset.fecha) {
      abrirSesion(b.dataset.fecha, b.dataset.dia);
      return navegar('entrenar');
    }
    renderHistorial(cont);
  };
}
