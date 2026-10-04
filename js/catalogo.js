// Bloque GIMNASIO: pestañas "Ejercicios" y "Mesociclos" (lo que configuras tú)
import { state, supabase, ejecutar, cargarTodo } from './db.js';
import { ordenEjercicios } from './consultas.js';
import { resetForm } from './gym.js';
import { hoyISO, sumarDias, esc, aviso, mensajeError, requiereConexion } from './utils.js';

// Ejecuta un cambio en Supabase, recarga los datos y repinta la vista
async function cambiar(cont, render, fn, mensaje) {
  if (!requiereConexion()) return;
  try {
    await fn();
    await cargarTodo();
    resetForm();
    aviso(mensaje);
    render(cont);
  } catch (e) { aviso(mensajeError(e), 'error'); }
}

/* ============================ EJERCICIOS ============================ */
export function renderEjercicios(cont) {
  const dias = [...new Set(state.ejercicios.map(e => e.dia || 'Sin día'))]
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const activos = state.ejercicios.filter(e => e.activo).sort(ordenEjercicios);
  const ocultos = state.ejercicios.filter(e => !e.activo).sort(ordenEjercicios);

  const filaEj = e => `
    <div class="tarjeta fila-ej" data-id="${e.id}">
      <input data-c="nombre" class="ej-nombre" value="${esc(e.nombre)}" aria-label="Nombre">
      <div class="fila-ej-opciones">
        <label>Día <input data-c="dia" list="lista-dias" value="${esc(e.dia || '')}"></label>
        <label>Orden <input data-c="orden" type="number" inputmode="numeric" value="${e.orden}"></label>
      </div>
      <div class="fila-ej-opciones">
        <label class="chk"><input data-c="por_lado" type="checkbox" ${e.por_lado ? 'checked' : ''}> Carga por lado</label>
        <label class="chk"><input data-c="activo" type="checkbox" ${e.activo ? 'checked' : ''}> Activo</label>
      </div>
      <div class="fila-ej-botones">
        <button class="btn" data-acc="guardar">Guardar</button>
        <button class="btn peligro" data-acc="borrar">Borrar</button>
      </div>
    </div>`;

  const porDia = {};
  activos.forEach(e => (porDia[e.dia || 'Sin día'] ??= []).push(e));

  cont.innerHTML = `
    <datalist id="lista-dias">${dias.map(d => `<option value="${esc(d)}">`).join('')}</datalist>

    <div class="tarjeta">
      <h3>Nuevo ejercicio</h3>
      <label>Nombre <input id="n-nombre" placeholder="Ej.: Hip thrust"></label>
      <div class="dos-col">
        <label>Día <input id="n-dia" list="lista-dias" value="${esc(dias[0] || 'Día 1')}"></label>
        <label class="chk alto"><input type="checkbox" id="n-lado"> Carga por lado</label>
      </div>
      <button id="n-anadir" class="btn primario">Añadir</button>
    </div>

    ${Object.entries(porDia).map(([dia, lista]) => `
      <div class="titulo-dia">
        <h3>${esc(dia)}</h3>
        <button class="btn-texto" data-renombrar="${esc(dia)}">Renombrar día</button>
      </div>
      ${lista.map(filaEj).join('')}`).join('')}

    ${ocultos.length ? `<h3 class="seccion">Ocultos (no salen al entrenar, conservan su historial)</h3>${ocultos.map(filaEj).join('')}` : ''}`;

  cont.onclick = ev => {
    const b = ev.target.closest('button');
    if (!b) return;

    if (b.id === 'n-anadir') {
      const nombre = cont.querySelector('#n-nombre').value.trim();
      const dia = cont.querySelector('#n-dia').value.trim() || 'Día 1';
      if (!nombre) return aviso('Ponle un nombre', 'error');
      const orden = Math.max(-1, ...state.ejercicios.filter(e => e.dia === dia).map(e => e.orden)) + 1;
      return cambiar(cont, renderEjercicios, () => ejecutar(supabase.from('ejercicios')
        .insert({ nombre, dia, orden, por_lado: cont.querySelector('#n-lado').checked })), 'Ejercicio añadido ✔');
    }

    if (b.dataset.renombrar) {
      const viejo = b.dataset.renombrar;
      const nuevo = prompt(`Nuevo nombre para "${viejo}"`, viejo)?.trim();
      if (!nuevo || nuevo === viejo) return;
      return cambiar(cont, renderEjercicios, async () => {
        await ejecutar(supabase.from('ejercicios').update({ dia: nuevo }).eq('dia', viejo));
        await ejecutar(supabase.from('sesiones').update({ dia: nuevo }).eq('dia', viejo));
      }, 'Día renombrado ✔');
    }

    const filaEl = b.closest('.fila-ej');
    if (!filaEl) return;
    const id = Number(filaEl.dataset.id);
    const valor = c => filaEl.querySelector(`[data-c="${c}"]`);

    if (b.dataset.acc === 'guardar') {
      const datos = {
        nombre: valor('nombre').value.trim(),
        dia: valor('dia').value.trim() || null,
        orden: Number(valor('orden').value) || 0,
        por_lado: valor('por_lado').checked,
        activo: valor('activo').checked,
      };
      if (!datos.nombre) return aviso('El nombre no puede estar vacío', 'error');
      return cambiar(cont, renderEjercicios, () => ejecutar(supabase.from('ejercicios').update(datos).eq('id', id)), 'Guardado ✔');
    }

    if (b.dataset.acc === 'borrar') {
      if (!confirm('Se borrará el ejercicio Y TODO su historial.\n\nSi solo quieres que deje de salir, desmarca "Activo".\n\n¿Borrar igualmente?')) return;
      return cambiar(cont, renderEjercicios, () => ejecutar(supabase.from('ejercicios').delete().eq('id', id)), 'Ejercicio borrado');
    }
  };
}

/* ============================ MESOCICLOS ============================ */
// Asigna a un mesociclo las sesiones que caen dentro de sus fechas
async function reasignarSesiones(m) {
  let q = supabase.from('sesiones').update({ mesociclo_id: m.id }).gte('fecha', m.fecha_inicio);
  if (m.fecha_fin) q = q.lte('fecha', m.fecha_fin);
  await ejecutar(q);
}

export function renderMesociclos(cont) {
  const mesos = [...state.mesociclos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  const nSesiones = id => state.sesiones.filter(s => s.mesociclo_id === id).length;

  cont.innerHTML = `
    <div class="tarjeta">
      <h3>Nuevo mesociclo</h3>
      <label>Nombre <input id="m-nombre" value="Mesociclo ${mesos.length + 1}"></label>
      <label>Empieza el <input type="date" id="m-inicio" value="${hoyISO()}"></label>
      <p class="ayuda">El mesociclo en curso se cerrará automáticamente el día anterior.</p>
      <button id="m-crear" class="btn primario">Empezar mesociclo</button>
    </div>

    ${mesos.map(m => `
      <div class="tarjeta fila-meso" data-id="${m.id}">
        <div class="titulo-dia">
          <input data-c="nombre" class="ej-nombre" value="${esc(m.nombre)}" aria-label="Nombre">
          ${m.fecha_fin ? '' : '<span class="tag tag-ok">en curso</span>'}
        </div>
        <div class="dos-col">
          <label>Inicio <input type="date" data-c="fecha_inicio" value="${m.fecha_inicio}"></label>
          <label>Fin <input type="date" data-c="fecha_fin" value="${m.fecha_fin || ''}"></label>
        </div>
        <p class="meta">${nSesiones(m.id)} sesiones</p>
        <div class="fila-ej-botones">
          <button class="btn" data-acc="guardar">Guardar</button>
          <button class="btn peligro" data-acc="borrar">Borrar</button>
        </div>
      </div>`).join('')}`;

  cont.onclick = ev => {
    const b = ev.target.closest('button');
    if (!b) return;

    if (b.id === 'm-crear') {
      const nombre = cont.querySelector('#m-nombre').value.trim() || `Mesociclo ${mesos.length + 1}`;
      const inicio = cont.querySelector('#m-inicio').value || hoyISO();
      return cambiar(cont, renderMesociclos, async () => {
        for (const m of state.mesociclos.filter(m => !m.fecha_fin && m.fecha_inicio < inicio)) {
          await ejecutar(supabase.from('mesociclos').update({ fecha_fin: sumarDias(inicio, -1) }).eq('id', m.id));
        }
        const nuevo = await ejecutar(supabase.from('mesociclos').insert({ nombre, fecha_inicio: inicio }).select().single());
        await reasignarSesiones(nuevo);
      }, 'Mesociclo creado ✔');
    }

    const tarjeta = b.closest('.fila-meso');
    if (!tarjeta) return;
    const id = Number(tarjeta.dataset.id);
    const valor = c => tarjeta.querySelector(`[data-c="${c}"]`).value;

    if (b.dataset.acc === 'guardar') {
      const datos = { id, nombre: valor('nombre').trim(), fecha_inicio: valor('fecha_inicio'), fecha_fin: valor('fecha_fin') || null };
      if (!datos.nombre || !datos.fecha_inicio) return aviso('Falta el nombre o la fecha de inicio', 'error');
      if (datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) return aviso('El fin no puede ser antes del inicio', 'error');
      return cambiar(cont, renderMesociclos, async () => {
        const { id: _, ...cambios } = datos;
        await ejecutar(supabase.from('mesociclos').update(cambios).eq('id', id));
        await reasignarSesiones(datos);
      }, 'Guardado ✔');
    }

    if (b.dataset.acc === 'borrar') {
      if (!confirm('¿Borrar este mesociclo? Las sesiones NO se borran, solo quedan sin mesociclo.')) return;
      return cambiar(cont, renderMesociclos, () => ejecutar(supabase.from('mesociclos').delete().eq('id', id)), 'Mesociclo borrado');
    }
  };
}
