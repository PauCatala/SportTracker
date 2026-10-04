// Bloque GIMNASIO: pestaña "Rutina". El diseño de cada mesociclo: qué ejercicios
// tocan cada día, con sus series y repeticiones. Entreno lo usa como punto de partida.
import { state, supabase, ejecutar, cargarTodo } from './db.js';
import { mesocicloDe, mesoConRutina, rutinaDe, ejercicioPorId } from './consultas.js';
import { resetForm, bannerMigracion, navegar } from './gym.js';
import { hoyISO, fmtCorta, esc, num, aviso, mensajeError, requiereConexion } from './utils.js';
import { icono } from './iconos.js';

const compararTexto = (a, b) => a.localeCompare(b, 'es', { numeric: true });
const rango = (min, max) => (min && max && min !== max ? `${min}–${max}` : `${min || max || ''}`);

let mesoSel = null;     // mesociclo que estás viendo
let edicion = null;     // { dia, nuevo, filas: [{ejercicio_id, series, reps_min, reps_max}], propagar }

export const seleccionarMeso = id => { mesoSel = id; edicion = null; };

const diasDe = mesoId => [...new Set(state.rutinas.filter(r => r.mesociclo_id === mesoId).map(r => r.dia))].sort(compararTexto);

function empezarEdicion(dia, nuevo = false) {
  edicion = {
    dia, nuevo, propagar: false,
    filas: rutinaDe(mesoSel, dia).map(r => ({ ejercicio_id: r.ejercicio_id, series: r.series, reps_min: r.reps_min, reps_max: r.reps_max })),
  };
}

export function renderRutina(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const mesos = [...state.mesociclos].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  if (!mesos.length) {
    cont.innerHTML = `
      <div class="vacio">
        <h3>Aún no hay rutina</h3>
        <p>Carga tu plan de 6 meses o crea un mesociclo, y aquí diseñarás qué hacer cada día.</p>
        <button class="btn primario" id="ir-mesos">Ir a Mesociclos</button>
      </div>`;
    cont.onclick = ev => ev.target.closest('#ir-mesos') && navegar('mesociclos');
    return;
  }
  if (!mesos.some(m => m.id === mesoSel)) {
    const hoy = hoyISO();
    mesoSel = (mesocicloDe(hoy) && diasDe(mesocicloDe(hoy).id).length ? mesocicloDe(hoy) : mesoConRutina(hoy) || mesos[0]).id;
    edicion = null;
  }
  const meso = mesos.find(m => m.id === mesoSel);
  const dias = diasDe(meso.id);
  if (edicion?.nuevo && !dias.includes(edicion.dia)) dias.push(edicion.dia);
  const actual = mesocicloDe(hoyISO());

  cont.innerHTML = `
    <div class="chips" role="tablist" aria-label="Mesociclos">
      ${mesos.map(m => `<button class="chip ${m.id === meso.id ? 'activo' : ''}" data-meso="${m.id}">
        ${m.numero ? `M${m.numero}` : esc(m.nombre)}${m.id === actual?.id ? '<span class="marca"></span>' : ''}</button>`).join('')}
    </div>

    <section class="hero">
      <p class="hero-sup">${meso.numero ? `Mesociclo ${meso.numero} de 6` : 'Mesociclo'}, ${fmtCorta(meso.fecha_inicio).toLowerCase()}${meso.fecha_fin ? ` – ${fmtCorta(meso.fecha_fin).toLowerCase()}` : ''}</p>
      <h2>${esc(meso.nombre)}</h2>
      ${meso.descripcion ? `<p>${esc(meso.descripcion)}</p>` : ''}
    </section>

    ${dias.length ? dias.map(d => edicion?.dia === d ? editorDia(d, meso, mesos) : vistaDia(d)).join('')
      : '<div class="vacio"><h3>Mesociclo sin rutina</h3><p>Añade el primer día y elige sus ejercicios.</p></div>'}

    ${edicion ? '' : `<button class="btn ancho" id="r-nuevo-dia">${icono('mas')} Añadir día</button>`}
    <p class="tenue">Lo que diseñes aquí es lo que aparece por defecto en Entreno ese día. En Entreno puedes quitar o añadir ejercicios solo para esa sesión, sin cambiar la rutina.</p>`;

  cont.oninput = ev => {
    const t = ev.target;
    if (t.dataset.r == null || !edicion) return;
    edicion.filas[Number(t.closest('.rutina-fila').dataset.i)][t.dataset.r] = num(t.value) || null;
  };
  cont.onchange = ev => {
    const t = ev.target;
    if (t.id === 'r-anadir' && t.value) {
      edicion.filas.push({ ejercicio_id: Number(t.value), series: 3, reps_min: 8, reps_max: 12 });
      renderRutina(cont);
    }
    if (t.id === 'r-propagar') edicion.propagar = t.checked;
  };
  cont.onclick = ev => alPulsar(ev, cont, meso, mesos);
}

function vistaDia(dia) {
  const filas = rutinaDe(mesoSel, dia);
  const [corto, ...resto] = dia.split(' · ');
  const totalSeries = filas.reduce((t, r) => t + r.series, 0);
  return `
    <section class="panel">
      <div class="panel-cab">
        <div><h3>${esc(corto)}</h3>${resto.length ? `<p class="sub">${esc(resto.join(' · '))}</p>` : ''}</div>
        <button class="btn chico" data-editar="${esc(dia)}">Editar</button>
      </div>
      <div class="rutina-lista">
        ${filas.map((r, i) => `
          <div class="rutina-linea">
            <span class="pos">${i + 1}</span>
            <span class="nombre">${esc(ejercicioPorId(r.ejercicio_id)?.nombre ?? '¿?')}</span>
            <span class="presc">${r.series} × ${rango(r.reps_min, r.reps_max)}</span>
          </div>`).join('')}
      </div>
      <p class="tenue" style="margin-top:10px">${filas.length} ejercicios, ${totalSeries} series</p>
    </section>`;
}

function editorDia(dia, meso, mesos) {
  const enRutina = new Set(edicion.filas.map(f => f.ejercicio_id));
  const siguientes = mesos.filter(m => m.fecha_inicio > meso.fecha_inicio).length;
  return `
    <section class="panel campos editando">
      <div class="panel-cab">
        <div><h3>${esc(dia.split(' · ')[0])}</h3><p class="sub">${esc(dia.split(' · ').slice(1).join(' · ') || 'Editando')}</p></div>
        <button class="btn-texto" data-renombrar>Renombrar</button>
      </div>
      <div>
        <div class="cab-rutina"><span>Ejercicio</span><span>Series</span><span>Reps</span><span></span></div>
        ${edicion.filas.map((f, i) => `
          <div class="rutina-fila" data-i="${i}">
            <span class="nombre" style="display:flex;align-items:center;gap:4px">
              <span class="orden">
                <button class="btn-icono" data-racc="subir" aria-label="Subir">${icono('arriba')}</button>
                <button class="btn-icono" data-racc="bajar" aria-label="Bajar">${icono('abajo')}</button>
              </span>${esc(ejercicioPorId(f.ejercicio_id)?.nombre ?? '¿?')}
            </span>
            <input data-r="series" inputmode="numeric" value="${f.series ?? ''}" aria-label="Series">
            <span class="rango">
              <input data-r="reps_min" inputmode="numeric" value="${f.reps_min ?? ''}" aria-label="Reps mínimas">–<input data-r="reps_max" inputmode="numeric" value="${f.reps_max ?? ''}" aria-label="Reps máximas">
            </span>
            <button class="btn-icono" data-racc="quitar" aria-label="Quitar">${icono('x')}</button>
          </div>`).join('')}
      </div>
      <select id="r-anadir" aria-label="Añadir ejercicio">
        <option value="">Añadir ejercicio…</option>
        ${state.ejercicios.filter(e => e.activo && !enRutina.has(e.id)).sort((a, b) => compararTexto(a.nombre, b.nombre))
          .map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}
      </select>
      ${siguientes ? `<label class="check"><input type="checkbox" id="r-propagar" ${edicion.propagar ? 'checked' : ''}>
        Aplicar los ejercicios añadidos, quitados y el orden a los ${siguientes} mesociclos siguientes (cada uno conserva sus series y reps)</label>` : ''}
      <div class="acciones-sesion">
        <button class="btn primario" data-guardar>Guardar día</button>
        <button class="btn" data-cancelar>Cancelar</button>
      </div>
      ${edicion.nuevo ? '' : '<button class="btn-texto" data-borrar-dia style="color:var(--mal)">Borrar este día del mesociclo</button>'}
    </section>`;
}

// Guarda las filas de un día en un mesociclo (borra las anteriores y escribe las nuevas)
async function escribirDia(mesoId, dia, filas) {
  await ejecutar(supabase.from('rutinas').delete().eq('mesociclo_id', mesoId).eq('dia', dia));
  if (filas.length) await ejecutar(supabase.from('rutinas').insert(filas.map((f, orden) => ({
    mesociclo_id: mesoId, dia, orden, ejercicio_id: f.ejercicio_id,
    series: f.series, reps_min: f.reps_min || null, reps_max: f.reps_max || f.reps_min || null,
  }))));
}

async function guardarCambios(cont, fn, mensaje) {
  if (!requiereConexion()) return;
  try {
    await fn();
    await cargarTodo();
    resetForm();
    edicion = null;
    aviso(mensaje);
    renderRutina(cont);
  } catch (e) { aviso(mensajeError(e), 'error'); }
}

function alPulsar(ev, cont, meso, mesos) {
  const b = ev.target.closest('button');
  if (!b) return;

  if (b.dataset.meso) {
    if (edicion && !confirm('Hay un día en edición sin guardar. ¿Descartar los cambios?')) return;
    seleccionarMeso(Number(b.dataset.meso));
    return renderRutina(cont);
  }
  if (b.dataset.editar) {
    if (edicion && !confirm('Hay otro día en edición sin guardar. ¿Descartar los cambios?')) return;
    empezarEdicion(b.dataset.editar);
    return renderRutina(cont);
  }
  if (b.id === 'r-nuevo-dia') {
    const n = diasDe(meso.id).length + 1;
    const nombre = prompt('Nombre del día', `Día ${n} · `)?.trim();
    if (!nombre) return;
    edicion = { dia: nombre, nuevo: true, propagar: false, filas: [] };
    return renderRutina(cont);
  }
  if (!edicion) return;

  if (b.dataset.racc) {
    const i = Number(b.closest('.rutina-fila').dataset.i);
    const f = edicion.filas;
    if (b.dataset.racc === 'quitar') f.splice(i, 1);
    if (b.dataset.racc === 'subir' && i > 0) [f[i - 1], f[i]] = [f[i], f[i - 1]];
    if (b.dataset.racc === 'bajar' && i < f.length - 1) [f[i + 1], f[i]] = [f[i], f[i + 1]];
    return renderRutina(cont);
  }
  if (b.hasAttribute('data-cancelar')) { edicion = null; return renderRutina(cont); }

  if (b.hasAttribute('data-renombrar')) {
    const viejo = edicion.dia;
    const nuevo = prompt('Nuevo nombre del día', viejo)?.trim();
    if (!nuevo || nuevo === viejo) return;
    if (edicion.nuevo) { edicion.dia = nuevo; return renderRutina(cont); }
    // Renombra el día en todos los mesociclos y en las sesiones ya registradas
    return guardarCambios(cont, async () => {
      await ejecutar(supabase.from('rutinas').update({ dia: nuevo }).eq('dia', viejo));
      await ejecutar(supabase.from('sesiones').update({ dia: nuevo }).eq('dia', viejo));
    }, 'Día renombrado');
  }

  if (b.hasAttribute('data-borrar-dia')) {
    if (!confirm(`¿Quitar "${edicion.dia}" de este mesociclo? Las sesiones registradas no se borran.`)) return;
    return guardarCambios(cont, () => ejecutar(supabase.from('rutinas').delete().eq('mesociclo_id', meso.id).eq('dia', edicion.dia)), 'Día borrado');
  }

  if (b.hasAttribute('data-guardar')) {
    const { dia, filas, propagar } = edicion;
    if (!filas.length) return aviso('Añade al menos un ejercicio', 'error');
    if (filas.some(f => !(f.series > 0))) return aviso('Cada ejercicio necesita al menos 1 serie', 'error');
    return guardarCambios(cont, async () => {
      await escribirDia(meso.id, dia, filas);
      if (propagar) {
        for (const m of mesos.filter(m => m.fecha_inicio > meso.fecha_inicio)) {
          const antes = rutinaDe(m.id, dia);
          // Mismo orden y ejercicios; cada mesociclo conserva sus propias series y reps
          await escribirDia(m.id, dia, filas.map(f => {
            const r = antes.find(x => x.ejercicio_id === f.ejercicio_id);
            return r ? { ejercicio_id: f.ejercicio_id, series: r.series, reps_min: r.reps_min, reps_max: r.reps_max } : f;
          }));
        }
      }
    }, propagar ? 'Día guardado en este mesociclo y los siguientes' : 'Día guardado');
  }
}
