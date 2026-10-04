// Bloque GIMNASIO: pestañas "Ejercicios" y "Mesociclos" (lo que configuras tú)
import { state, supabase, ejecutar, cargarTodo, uid } from './db.js';
import { mesocicloDe, semanaPlan } from './consultas.js';
import { resetForm, bannerMigracion, navegar } from './gym.js';
import { seleccionarMeso } from './rutina.js';
import { hoyISO, sumarDias, fmtCorta, esc, num, aviso, mensajeError, requiereConexion } from './utils.js';
import { cargarPlan, planCargado, proximoLunes, MESOS_PLAN } from './plan.js';
import { icono } from './iconos.js';

const compararTexto = (a, b) => a.localeCompare(b, 'es', { numeric: true });

// Ejecuta un cambio en Supabase, recarga los datos y repinta la vista
async function cambiar(cont, render, fn, mensaje) {
  if (!requiereConexion()) return false;
  try {
    await fn();
    await cargarTodo();
    resetForm();
    aviso(mensaje);
    render(cont);
    return true;
  } catch (e) { aviso(mensajeError(e), 'error'); return false; }
}

/* ============================ EJERCICIOS ============================ */
let filtro = '';

export function renderEjercicios(cont) {
  const dias = [...new Set(state.ejercicios.map(e => e.dia).filter(Boolean))].sort(compararTexto);
  const lista = [...state.ejercicios].sort((a, b) => (b.activo - a.activo) || compararTexto(a.nombre, b.nombre));
  const usos = id => [...new Set(state.rutinas.filter(r => r.ejercicio_id === id).map(r => {
    const m = state.mesociclos.find(x => x.id === r.mesociclo_id);
    return m?.numero ? `M${m.numero}` : m?.nombre;
  }))].filter(Boolean);

  cont.innerHTML = `
    <datalist id="lista-dias">${dias.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
    <section class="panel campos">
      <h3>Nuevo ejercicio</h3>
      <label class="campo">Nombre <input id="n-nombre" placeholder="Por ejemplo, hip thrust en máquina"></label>
      <label class="check"><input type="checkbox" id="n-lado"> Apunto la carga por lado</label>
      <button id="n-anadir" class="btn primario">Añadir ejercicio</button>
      <p class="tenue">Para que aparezca un día concreto, añádelo a la rutina del mesociclo en la pestaña Mesociclos.</p>
    </section>

    <input id="n-buscar" type="search" placeholder="Buscar ejercicio" value="${esc(filtro)}" aria-label="Buscar ejercicio">

    <div class="lista">
      ${lista.map(e => `
        <details class="${e.activo ? '' : 'inactivo'}" data-id="${e.id}" data-nombre="${esc(e.nombre.toLowerCase())}">
          <summary>
            <span>${esc(e.nombre)}</span>
            <span class="der">${!e.activo ? '<span class="etiqueta">Oculto</span>' : e.por_lado ? '<span class="etiqueta">Por lado</span>' : ''}${icono('der', 'flecha')}</span>
          </summary>
          <div class="cuerpo">
            <label class="campo">Nombre <input data-c="nombre" value="${esc(e.nombre)}"></label>
            <label class="campo">Día por defecto (si no usas mesociclos) <input data-c="dia" list="lista-dias" value="${esc(e.dia || '')}"></label>
            <label class="check"><input data-c="por_lado" type="checkbox" ${e.por_lado ? 'checked' : ''}> Carga por lado</label>
            <label class="check"><input data-c="activo" type="checkbox" ${e.activo ? 'checked' : ''}> Activo (si lo desmarcas, conserva su historial)</label>
            ${usos(e.id).length ? `<p class="tenue">En la rutina de: ${usos(e.id).join(', ')}</p>` : ''}
            <div class="acciones-sesion">
              <button class="btn primario" data-acc="guardar">Guardar</button>
              <button class="btn peligro" data-acc="borrar" aria-label="Borrar ejercicio">${icono('papelera')}</button>
            </div>
          </div>
        </details>`).join('')}
    </div>`;

  const aplicarFiltro = () => cont.querySelectorAll('.lista details').forEach(d =>
    d.classList.toggle('oculto', !!filtro && !d.dataset.nombre.includes(filtro.toLowerCase())));
  aplicarFiltro();

  cont.oninput = ev => { if (ev.target.id === 'n-buscar') { filtro = ev.target.value.trim(); aplicarFiltro(); } };
  cont.onclick = ev => {
    const b = ev.target.closest('button');
    if (!b) return;

    if (b.id === 'n-anadir') {
      const nombre = cont.querySelector('#n-nombre').value.trim();
      if (!nombre) return aviso('Escribe el nombre del ejercicio', 'error');
      return cambiar(cont, renderEjercicios, () => ejecutar(supabase.from('ejercicios')
        .insert({ nombre, orden: 999, por_lado: cont.querySelector('#n-lado').checked })), 'Ejercicio añadido');
    }

    const det = b.closest('details');
    if (!det) return;
    const id = Number(det.dataset.id);
    const valor = c => det.querySelector(`[data-c="${c}"]`);

    if (b.dataset.acc === 'guardar') {
      const datos = {
        nombre: valor('nombre').value.trim(),
        dia: valor('dia').value.trim() || null,
        por_lado: valor('por_lado').checked,
        activo: valor('activo').checked,
      };
      if (!datos.nombre) return aviso('El nombre no puede quedar vacío', 'error');
      return cambiar(cont, renderEjercicios, () => ejecutar(supabase.from('ejercicios').update(datos).eq('id', id)), 'Ejercicio guardado');
    }
    if (b.dataset.acc === 'borrar') {
      if (!confirm('Se borrará el ejercicio y TODO su historial.\n\nSi solo quieres que deje de salir, desmarca "Activo".\n\n¿Borrar igualmente?')) return;
      return cambiar(cont, renderEjercicios, () => ejecutar(supabase.from('ejercicios').delete().eq('id', id)), 'Ejercicio borrado');
    }
  };
}

/* ============================ MESOCICLOS ============================ */
// Edición de la rutina de un día: se guarda todo junto al pulsar "Guardar rutina"
let abierto = null;     // id del mesociclo desplegado

async function reasignarSesiones(m) {
  let q = supabase.from('sesiones').update({ mesociclo_id: m.id }).gte('fecha', m.fecha_inicio);
  if (m.fecha_fin) q = q.lte('fecha', m.fecha_fin);
  await ejecutar(q);
}

export function renderMesociclos(cont) {
  const hoy = hoyISO();
  const mesos = [...state.mesociclos].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  const actual = mesocicloDe(hoy);
  if (abierto == null) abierto = actual?.id ?? null;

  cont.innerHTML = `
    ${bannerMigracion()}
    ${panelPlan(hoy)}
    ${mesos.length ? `
      <div class="titulo-seccion"><h3>Tus mesociclos</h3><span class="tenue">${mesos.length}</span></div>
      <div class="lista">${mesos.map(m => itemMeso(m, actual)).join('')}</div>` : ''}
    <section class="panel campos">
      <h3>Nuevo mesociclo</h3>
      <label class="campo">Nombre <input id="m-nombre" value="Mesociclo ${mesos.length + 1}"></label>
      <div class="campos-2">
        <label class="campo">Empieza <input type="date" id="m-inicio" value="${hoy}"></label>
        <label class="campo">Semanas <input id="m-semanas" inputmode="numeric" value="4"></label>
      </div>
      <label class="campo">Copiar la rutina de
        <select id="m-copiar">
          <option value="">No copiar (rutina vacía)</option>
          ${mesos.map(m => `<option value="${m.id}" ${m.id === actual?.id ? 'selected' : ''}>${esc(m.numero ? `${m.numero}. ${m.nombre}` : m.nombre)}</option>`).join('')}
        </select>
      </label>
      <p class="tenue">El mesociclo en curso se cerrará el día anterior. Su rutina se diseña en la pestaña Rutina.</p>
      <button id="m-crear" class="btn">Crear mesociclo</button>
    </section>`;

  // Abrir/cerrar un mesociclo recuerda cuál está desplegado
  cont.querySelectorAll('.lista details').forEach(d => d.addEventListener('toggle', () => {
    const id = Number(d.dataset.id);
    if (d.open && abierto !== id) {
      abierto = id;
      renderMesociclos(cont);            // pinta el contenido del mesociclo abierto
    } else if (!d.open && abierto === id) {
      abierto = null;
    }
  }));

  cont.onclick = ev => alPulsarMeso(ev, cont, mesos);
}

function panelPlan(hoy) {
  if (!planCargado()) {
    return `
      <section class="hero">
        <p class="hero-sup">Tu plan</p>
        <h2>Seis mesociclos, cinco días</h2>
        <p>Carga la rutina completa del PDF: 24 semanas de gimnasio en 6 bloques de 4, la preparación de 15K y la flexibilidad diaria. Lo que ya hayas registrado se conserva.</p>
        <label class="campo" style="margin-top:16px;color:rgba(255,255,255,.8)">Empieza el lunes
          <input type="date" id="p-inicio" value="${proximoLunes(hoy)}">
        </label>
        <button class="btn ancho" id="p-cargar">Cargar el plan</button>
      </section>`;
  }
  const n = semanaPlan(hoy);
  return `
    <section class="banner">${icono('calendario')}<div>
      <b>Plan de 6 meses cargado.</b> Empezó el ${fmtCorta(state.ajustes.inicio_plan).toLowerCase()}${n >= 1 ? `, vas por la semana ${n}` : n != null ? `, empieza en ${1 - n} ${1 - n === 1 ? 'semana' : 'semanas'}` : ''}.
      <button class="btn-texto" id="p-recargar">Volver a cargarlo</button>
    </div></section>`;
}

function itemMeso(m, actual) {
  const nSes = state.sesiones.filter(s => s.mesociclo_id === m.id).length;
  const dias = [...new Set(state.rutinas.filter(r => r.mesociclo_id === m.id).map(r => r.dia))].sort(compararTexto);
  const abiertoAqui = abierto === m.id;

  return `
    <details data-id="${m.id}" ${abiertoAqui ? 'open' : ''}>
      <summary>
        <span class="meso-item ${m.id === actual?.id ? 'actual' : ''}">
          <span class="meso-num">${m.numero ?? '–'}</span>
          <span><span style="display:block">${esc(m.nombre)}</span>
            <span class="fechas">${fmtCorta(m.fecha_inicio)}${m.fecha_fin ? ` – ${fmtCorta(m.fecha_fin).toLowerCase()}` : ', en curso'}, ${nSes} ${nSes === 1 ? 'sesión' : 'sesiones'}</span></span>
        </span>
        <span class="der">${m.id === actual?.id ? '<span class="etiqueta objetivo">Ahora</span>' : ''}${icono('der', 'flecha')}</span>
      </summary>
      ${abiertoAqui ? `
      <div class="cuerpo">
        ${m.descripcion ? `<p class="sub">${esc(m.descripcion)}</p>` : ''}
        <div class="panel-cab"><h4>Rutina</h4><button class="btn chico suave" data-ver-rutina>Diseñar rutina</button></div>
        <p class="sub">${dias.length ? dias.map(d => esc(d.split(' · ')[0])).join(', ') : 'Sin rutina todavía'}${dias.length ? `, ${state.rutinas.filter(r => r.mesociclo_id === m.id).length} ejercicios en total` : ''}</p>

        <hr class="separador">
        <h4>Datos del mesociclo</h4>
        <label class="campo">Nombre <input data-m="nombre" value="${esc(m.nombre)}"></label>
        <div class="campos-2">
          <label class="campo">Inicio <input type="date" data-m="fecha_inicio" value="${m.fecha_inicio}"></label>
          <label class="campo">Fin <input type="date" data-m="fecha_fin" value="${m.fecha_fin || ''}"></label>
        </div>
        <label class="campo">Objetivo <textarea data-m="descripcion" rows="2">${esc(m.descripcion || '')}</textarea></label>
        <div class="acciones-sesion">
          <button class="btn" data-guardar-meso>Guardar datos</button>
          <button class="btn peligro" data-borrar-meso aria-label="Borrar mesociclo">${icono('papelera')}</button>
        </div>
      </div>` : ''}
    </details>`;
}

async function alPulsarMeso(ev, cont, mesos) {
  const b = ev.target.closest('button');
  if (!b) return;

  // ---- Plan de 6 meses ----
  if (b.id === 'p-cargar' || b.id === 'p-recargar') {
    if (b.id === 'p-recargar' && !confirm('Se volverán a crear los 6 mesociclos del plan con su rutina original (perderás los cambios que hayas hecho en sus rutinas). Tus sesiones registradas se conservan. ¿Continuar?')) return;
    let inicio = cont.querySelector('#p-inicio')?.value;
    if (!inicio) inicio = prompt('Fecha de inicio del plan (AAAA-MM-DD)', state.ajustes?.inicio_plan || proximoLunes(hoyISO()));
    if (!inicio) return;
    if (state.faltaMigracion) return aviso('Primero ejecuta schema_v2.sql en Supabase', 'error');
    b.disabled = true;
    abierto = null;
    const ok = await cambiar(cont, renderMesociclos, () => cargarPlan(inicio, uid), 'Plan cargado: 6 mesociclos listos');
    if (!ok) b.disabled = false;
    return;
  }

  // ---- Nuevo mesociclo ----
  if (b.id === 'm-crear') {
    const nombre = cont.querySelector('#m-nombre').value.trim() || `Mesociclo ${mesos.length + 1}`;
    const inicio = cont.querySelector('#m-inicio').value || hoyISO();
    const semanas = Math.max(1, num(cont.querySelector('#m-semanas').value) || 4);
    const copiar = Number(cont.querySelector('#m-copiar').value) || null;
    return cambiar(cont, renderMesociclos, async () => {
      for (const m of state.mesociclos.filter(m => (!m.fecha_fin || m.fecha_fin >= inicio) && m.fecha_inicio < inicio)) {
        await ejecutar(supabase.from('mesociclos').update({ fecha_fin: sumarDias(inicio, -1) }).eq('id', m.id));
      }
      const nuevo = await ejecutar(supabase.from('mesociclos')
        .insert({ nombre, fecha_inicio: inicio, fecha_fin: sumarDias(inicio, semanas * 7 - 1) }).select().single());
      if (copiar) {
        const filas = state.rutinas.filter(r => r.mesociclo_id === copiar).map(({ dia, ejercicio_id, orden, series, reps_min, reps_max, notas }) =>
          ({ mesociclo_id: nuevo.id, dia, ejercicio_id, orden, series, reps_min, reps_max, notas }));
        if (filas.length) await ejecutar(supabase.from('rutinas').insert(filas));
      }
      await reasignarSesiones(nuevo);
      abierto = nuevo.id;
    }, 'Mesociclo creado');
  }

  const det = b.closest('details');
  if (!det) return;
  const id = Number(det.dataset.id);

  if (b.hasAttribute('data-ver-rutina')) {
    seleccionarMeso(id);
    return navegar('rutina');
  }

  // ---- Datos del mesociclo ----
  if (b.hasAttribute('data-guardar-meso')) {
    const v = c => det.querySelector(`[data-m="${c}"]`).value;
    const datos = { nombre: v('nombre').trim(), fecha_inicio: v('fecha_inicio'), fecha_fin: v('fecha_fin') || null, descripcion: v('descripcion').trim() || null };
    if (!datos.nombre || !datos.fecha_inicio) return aviso('Falta el nombre o la fecha de inicio', 'error');
    if (datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) return aviso('El fin no puede ser antes del inicio', 'error');
    return cambiar(cont, renderMesociclos, async () => {
      await ejecutar(supabase.from('mesociclos').update(datos).eq('id', id));
      await reasignarSesiones({ id, ...datos });
    }, 'Mesociclo guardado');
  }
  if (b.hasAttribute('data-borrar-meso')) {
    if (!confirm('¿Borrar este mesociclo y su rutina? Las sesiones registradas NO se borran.')) return;
    abierto = null;
    return cambiar(cont, renderMesociclos, () => ejecutar(supabase.from('mesociclos').delete().eq('id', id)), 'Mesociclo borrado');
  }
}

export const NUM_MESOS_PLAN = MESOS_PLAN.length;
