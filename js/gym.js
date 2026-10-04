// Bloque GIMNASIO: pestañas "Entrenar" e "Historial".
import { state, supabase, ejecutar, guardarSesion, cargarTodo } from './db.js';
import {
  diasRutina, ejerciciosDelDia, ejercicioPorId, mesocicloDe, sesionDe, seriesDe,
  ultimaVez, ordenEjercicios,
} from './consultas.js';
import {
  hoyISO, sumarDias, lunesDe, sumarMeses, finDeMes, parseISO, fmtCorta, fmtKg, fmtEntero,
  esc, num, capitalizar, agruparSeries, textoSet, metricas, aviso, mensajeError, requiereConexion,
} from './utils.js';
import { D1, D2, cargarRutinaInicial } from './seed.js';

const navegar = vista => window.dispatchEvent(new CustomEvent('navegar', { detail: vista }));

/* =====================================================================
   ENTRENAR
   "form" guarda lo que vas escribiendo antes de pulsar Guardar:
   form.ej[idEjercicio] = [ [principal, drop, ...], [principal], ... ]
   ===================================================================== */
let form = null;
export const resetForm = () => (form = null);
export const abrirSesion = (fecha, dia) => (form = nuevoForm(fecha, dia));

const vacia = () => ({ reps: '', kg: '', tecnica: '' });

function nuevoForm(fecha, dia) {
  const f = { fecha, dia, notas: '', orden: [], ej: {}, sucio: false };
  const ses = sesionDe(fecha, dia);
  const delDia = ejerciciosDelDia(dia).map(e => e.id);
  const enSesion = ses ? [...new Set(seriesDe(ses.id).map(s => s.ejercicio_id))] : [];
  f.orden = [...delDia, ...enSesion.filter(id => !delDia.includes(id))];
  if (ses) f.notas = ses.notas || '';

  for (const id of f.orden) {
    const sets = ses ? agruparSeries(seriesDe(ses.id, id)) : [];
    if (sets.length) {
      // sesión ya guardada → cargamos lo que apuntaste
      f.ej[id] = sets.map(partes => partes.map(p => ({ reps: p.reps, kg: p.kg, tecnica: p.tecnica || '' })));
    } else {
      // sesión nueva → tantas series vacías como la última vez
      const u = ultimaVez(id, fecha);
      f.ej[id] = Array.from({ length: u ? u.sets.length : 3 }, () => [vacia()]);
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
  if (!state.ejercicios.length) return renderBienvenida(cont);
  const dias = diasRutina();
  if (!dias.length) {
    cont.innerHTML = `<p class="vacio">No tienes ejercicios activos. Actívalos o crea alguno en <b>Ejercicios</b>.</p>`;
    return;
  }
  if (!form) form = nuevoForm(hoyISO(), dias[0]);
  pintarRegistrar(cont);
}

function pintarRegistrar(cont) {
  const dias = diasRutina();
  if (!dias.includes(form.dia)) dias.push(form.dia);
  const meso = mesocicloDe(form.fecha);
  const ses = sesionDe(form.fecha, form.dia);
  const otros = state.ejercicios.filter(e => e.activo && !form.orden.includes(e.id)).sort(ordenEjercicios);

  cont.innerHTML = `
    <div class="barra-sesion">
      <label>Fecha <input type="date" id="f-fecha" value="${form.fecha}"></label>
      <label>Día <select id="f-dia">${dias.map(d => `<option ${d === form.dia ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
    </div>
    <p class="meta">
      Mesociclo: <b>${meso ? esc(meso.nombre) : 'ninguno'}</b>
      ${ses ? `<span class="tag ${ses.pendiente ? 'tag-pend' : 'tag-ok'}">${ses.pendiente ? 'Pendiente de subir' : 'Sesión guardada'}</span>` : ''}
    </p>
    <p class="leyenda"><span class="estado mejor"></span> superas <span class="estado igual"></span> igualas <span class="estado peor"></span> por debajo de la última vez</p>

    ${form.orden.map(tarjetaEjercicio).join('')}

    <select id="f-anadir" class="anadir">
      <option value="">+ Añadir ejercicio a esta sesión…</option>
      ${otros.map(e => `<option value="${e.id}">${esc(e.nombre)} (${esc(e.dia || 'Sin día')})</option>`).join('')}
      <option value="nuevo">➕ Crear ejercicio nuevo</option>
    </select>

    <label class="notas">Notas de la sesión
      <textarea id="f-notas" rows="2" placeholder="Cómo te has sentido, molestias...">${esc(form.notas)}</textarea>
    </label>
    <div class="acciones-sesion">
      <button id="f-guardar" class="btn primario">${ses ? 'Actualizar sesión' : 'Guardar sesión'}</button>
      ${ses ? '<button id="f-borrar" class="btn peligro">Borrar</button>' : ''}
    </div>`;

  cont.oninput = ev => actualizarCampo(ev.target);
  cont.onchange = ev => alCambiar(ev.target, cont);
  cont.onclick = ev => alPulsar(ev, cont);
}

function tarjetaEjercicio(id) {
  const e = ejercicioPorId(id);
  const u = ultimaVez(id, form.fecha);
  const sets = form.ej[id];
  return `
  <article class="tarjeta" data-ej="${id}">
    <header>
      <h3>${esc(e?.nombre ?? '¿?')}</h3>
      ${e?.por_lado ? '<span class="tag">por lado</span>' : ''}
    </header>
    <p class="ultima">${u
      ? `Última vez · ${fmtCorta(u.sesion.fecha)}: <b>${u.sets.map(textoSet).join(' · ')}</b>`
      : 'Primera vez con este ejercicio'}</p>
    <div class="series">
      ${sets.map((partes, i) => partes.map((p, j) => fila(p, i, j, u?.sets[i]?.[j], u?.sets[i]?.[0])).join('')).join('')}
    </div>
    <div class="botones-tarjeta">
      <button class="btn mini" data-acc="serie">+ Serie</button>
      ${u ? '<button class="btn mini" data-acc="copiar">Copiar última vez</button>' : ''}
    </div>
  </article>`;
}

function fila(p, i, j, ref, prevPrincipal) {
  const principal = j === 0;
  const tec = ['', 'mala', 'regular', 'bien'];
  const tecTxt = { '': 'téc.', mala: 'mala', regular: 'reg.', bien: 'bien' };
  return `
  <div class="fila ${principal ? '' : 'drop'}" data-i="${i}" data-j="${j}">
    <span class="n">${principal ? 'S' + (i + 1) : '↳'}</span>
    <input data-campo="reps" inputmode="numeric" value="${esc(p.reps)}" placeholder="${ref ? ref.reps : 'reps'}" aria-label="Repeticiones">
    <span class="x">×</span>
    <input data-campo="kg" inputmode="decimal" value="${esc(p.kg)}" placeholder="${ref ? fmtKg(ref.kg) : 'kg'}" aria-label="Kilos">
    ${principal
      ? `<select data-campo="tecnica" aria-label="Técnica">${tec.map(t => `<option value="${t}" ${p.tecnica === t ? 'selected' : ''}>${tecTxt[t]}</option>`).join('')}</select>`
      : '<span></span>'}
    <span class="estado ${principal ? comparar(p, prevPrincipal) : ''}"></span>
    ${principal ? '<button class="mini" data-acc="drop" title="Añadir drop">+drop</button>' : '<span></span>'}
    <button class="mini quitar" data-acc="quitar" title="Quitar">✕</button>
  </div>`;
}

function actualizarCampo(t) {
  if (t.id === 'f-notas') { form.notas = t.value; form.sucio = true; return; }
  const campo = t.dataset.campo;
  if (!campo) return;
  const filaEl = t.closest('.fila');
  const id = Number(t.closest('.tarjeta').dataset.ej);
  const i = +filaEl.dataset.i, j = +filaEl.dataset.j;
  form.ej[id][i][j][campo] = t.value;
  form.sucio = true;
  if (j === 0) {
    const u = ultimaVez(id, form.fecha);
    filaEl.querySelector('.estado').className = 'estado ' + comparar(form.ej[id][i][0], u?.sets[i]?.[0]);
  }
}

async function alCambiar(t, cont) {
  if (t.dataset.campo) return actualizarCampo(t);

  if (t.id === 'f-fecha' || t.id === 'f-dia') {
    if (form.sucio && !confirm('Tienes cambios sin guardar. ¿Descartarlos?')) {
      t.value = t.id === 'f-fecha' ? form.fecha : form.dia;
      return;
    }
    form = nuevoForm(cont.querySelector('#f-fecha').value || hoyISO(), cont.querySelector('#f-dia').value);
    pintarRegistrar(cont);
  }

  if (t.id === 'f-anadir') {
    const v = t.value;
    t.value = '';
    let id;
    if (v === 'nuevo') {
      const nombre = prompt('Nombre del nuevo ejercicio')?.trim();
      if (!nombre || !requiereConexion()) return;
      const porLado = confirm('¿La carga se apunta por lado (por brazo/mancuerna)?\n\nAceptar = sí · Cancelar = no');
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
      const u = ultimaVez(id, form.fecha);
      form.ej[id] = Array.from({ length: u ? u.sets.length : 3 }, () => [vacia()]);
    }
    pintarRegistrar(cont);
  }
}

async function alPulsar(ev, cont) {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.id === 'f-guardar') return guardar(cont, b);
  if (b.id === 'f-borrar') return borrar(cont);

  const acc = b.dataset.acc;
  if (!acc) return;
  const id = Number(b.closest('.tarjeta').dataset.ej);
  const filaEl = b.closest('.fila');
  const i = filaEl ? +filaEl.dataset.i : -1, j = filaEl ? +filaEl.dataset.j : -1;
  const sets = form.ej[id];

  if (acc === 'serie') sets.push([vacia()]);
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
  if (!series.length) return aviso('Rellena al menos una serie (reps y kg)', 'error');
  boton.disabled = true;
  try {
    const r = await guardarSesion({
      fecha: form.fecha, dia: form.dia, notas: form.notas.trim() || null,
      mesociclo_id: mesocicloDe(form.fecha)?.id ?? null, series,
    });
    aviso(r === 'guardado' ? 'Sesión guardada ✔' : 'Sin conexión: guardada en el móvil, se subirá sola');
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

// Primera vez: cargar tu rutina con los dos entrenos que apuntaste
function renderBienvenida(cont) {
  const h = hoyISO();
  cont.innerHTML = `
  <div class="tarjeta bienvenida">
    <h2>Empecemos 💪</h2>
    <p>Aún no tienes ejercicios. Puedo cargar tu rutina actual con las series que apuntaste en tus dos últimos entrenos:</p>
    <ul>
      <li><b>${D1}</b>: sentadilla, prensa, extensión, gemelos, core…</li>
      <li><b>${D2}</b>: press militar, elevaciones, curl, tríceps, antebrazo…</li>
    </ul>
    <label>Nombre del mesociclo <input id="b-meso" value="Mesociclo 1"></label>
    <div class="dos-col">
      <label>¿Qué día hiciste el Día 1? <input type="date" id="b-f1" value="${sumarDias(h, -2)}"></label>
      <label>¿Y el Día 2? <input type="date" id="b-f2" value="${sumarDias(h, -1)}"></label>
    </div>
    <button id="b-cargar" class="btn primario">Cargar mi rutina</button>
    <button id="b-cero" class="btn">Prefiero empezar de cero</button>
  </div>`;

  cont.onclick = async ev => {
    if (ev.target.id === 'b-cero') return navegar('ejercicios');
    if (ev.target.id !== 'b-cargar' || !requiereConexion()) return;
    ev.target.disabled = true;
    try {
      await cargarRutinaInicial({
        nombreMeso: cont.querySelector('#b-meso').value.trim() || 'Mesociclo 1',
        fechaD1: cont.querySelector('#b-f1').value || sumarDias(h, -2),
        fechaD2: cont.querySelector('#b-f2').value || sumarDias(h, -1),
      });
      await cargarTodo();
      form = null;
      aviso('Rutina cargada ✔');
      renderRegistrar(cont);
    } catch (e) {
      aviso(mensajeError(e), 'error');
      ev.target.disabled = false;
    }
  };
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
    etiqueta = m ? m.nombre : 'Sin mesociclos';
    sesiones = state.sesiones.filter(s => m && s.mesociclo_id === m.id);
  } else {
    let ini, fin;
    if (hist.modo === 'semana') {
      ini = lunesDe(hist.ref); fin = sumarDias(ini, 6);
      etiqueta = `${fmtCorta(ini)} – ${fmtCorta(fin)}`;
    } else {
      ini = hist.ref.slice(0, 8) + '01'; fin = finDeMes(ini);
      etiqueta = capitalizar(parseISO(ini).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
    }
    sesiones = state.sesiones.filter(s => s.fecha >= ini && s.fecha <= fin);
  }
  if (hist.dia) sesiones = sesiones.filter(s => s.dia === hist.dia);
  sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha) || compararIds(a.id, b.id));

  const idsSes = new Set(sesiones.map(s => s.id));
  const seriesP = state.series.filter(s => idsSes.has(s.sesion_id));
  const ejercicios = [...new Set(seriesP.map(s => s.ejercicio_id))].map(ejercicioPorId).filter(Boolean).sort(ordenEjercicios);
  const diasTodos = [...new Set(state.sesiones.map(s => s.dia).filter(Boolean))].sort();

  const celda = (e, s) => {
    const sets = agruparSeries(seriesP.filter(x => x.sesion_id === s.id && x.ejercicio_id === e.id));
    if (!sets.length) return '<td class="vacia">–</td>';
    const ahora = metricas(sets, e.por_lado).e1rm;
    const u = ultimaVez(e.id, s.fecha);
    const antes = u ? metricas(u.sets, e.por_lado).e1rm : null;
    const cls = antes == null ? '' : ahora > antes + 0.05 ? 'sube' : ahora < antes - 0.05 ? 'baja' : 'igual';
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
      <button data-nav="-1" aria-label="Anterior">‹</button>
      <span>${esc(etiqueta)}</span>
      <button data-nav="1" aria-label="Siguiente">›</button>
    </div>
    <select id="h-dia">
      <option value="">Todos los días</option>
      ${diasTodos.map(d => `<option ${d === hist.dia ? 'selected' : ''}>${esc(d)}</option>`).join('')}
    </select>

    ${!sesiones.length ? '<p class="vacio">No hay sesiones en este periodo.</p>' : `
    <p class="meta">${sesiones.length} sesion${sesiones.length > 1 ? 'es' : ''} · toca una fecha para editarla · ▲▼ = 1RM estimado frente a la vez anterior</p>
    <div class="tabla-scroll">
      <table class="tabla">
        <thead><tr>
          <th class="col-ej">Ejercicio</th>
          ${sesiones.map(s => `<th class="clicable" data-fecha="${s.fecha}" data-dia="${esc(s.dia)}">${fmtCorta(s.fecha)}<br><small>${esc(s.dia || '')}</small></th>`).join('')}
        </tr></thead>
        <tbody>
          ${ejercicios.map(e => `<tr><td class="col-ej">${esc(e.nombre)}${e.por_lado ? ' <small>(por lado)</small>' : ''}</td>${sesiones.map(s => celda(e, s)).join('')}</tr>`).join('')}
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

const compararIds = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });
