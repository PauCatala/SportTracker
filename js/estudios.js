// ESTUDIOS Y TRABAJO: tablero de tareas (Por hacer · En curso · Hecho) y concentración (métodos de estudio).
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { renderFoco } from './foco.js';
import { icono } from './iconos.js';
import { fmtCorta, diasEntre } from './utils.js';

const COLUMNAS = [
  ['todo', 'Por hacer'],
  ['curso', 'En curso'],
  ['hecho', 'Hecho'],
];
const TIPOS = { estudio: 'Estudio', trabajo: 'Trabajo' };
const PRIORIDADES = [['alta', 'Prioridad alta'], ['media', 'Prioridad media'], ['baja', 'Prioridad baja']];
const prioridadDe = t => (PRIORIDADES.some(p => p[0] === t.prioridad) ? t.prioridad : 'media');
let filtro = 'todas';
let colMovil = 'todo';   // en el móvil se ve una columna cada vez

const SIN_PROYECTO = '';
const ORDEN_PR = { alta: 0, media: 1, baja: 2 };

// Proyectos (filas del tablero): los guardados + los que aparezcan en alguna tarea
function proyectosDe(tareas) {
  const guardados = leer('proyectos', []);
  const deTareas = tareas.map(t => (t.area || '').trim()).filter(Boolean);
  return [...new Set([...guardados, ...deTareas])];
}

// Tarjeta de una tarea. Al tocarla se despliegan estado, prioridad, proyecto y borrar
function tarjetaTarea(t, proyectos) {
  const pr = prioridadDe(t);
  return `
    <article class="pr-tarjeta ${t.estado}" draggable="true" data-id="${t.id}" tabindex="0">
      <p><i class="pr-dot ${pr}" title="Prioridad ${pr}"></i>${escapar(t.titulo)}</p>
      <div class="tarea-meta">
        <span class="etiqueta-tipo">${TIPOS[t.tipo] || 'Tarea'}</span>
        ${etiquetaFecha(t.fecha, t.estado)}
      </div>
      <div class="pr-opciones">
        <div class="pr-grupo" aria-label="Estado">${COLUMNAS.map(([id, n]) => `<button type="button" class="${t.estado === id ? 'activo' : ''}" data-estado="${id}">${n}</button>`).join('')}</div>
        <div class="pr-grupo" aria-label="Prioridad">${PRIORIDADES.map(([id]) => `<button type="button" class="pr-p ${id} ${pr === id ? 'activo' : ''}" data-prio="${id}">${id[0].toUpperCase() + id.slice(1)}</button>`).join('')}</div>
        <select class="pr-mover" data-mover aria-label="Proyecto">
          <option value="">Sin proyecto</option>
          ${proyectos.map(p => `<option value="${escapar(p)}" ${(t.area || '') === p ? 'selected' : ''}>${escapar(p)}</option>`).join('')}
        </select>
        <button type="button" class="btn-icono" data-borrar aria-label="Borrar">${icono('papelera')}</button>
      </div>
    </article>`;
}

export const tareasPendientes = () => leer('tareas', []).filter(t => t.estado !== 'hecho');
export { PRIORIDADES, prioridadDe };

function etiquetaFecha(fecha, estado) {
  if (!fecha) return '';
  const d = diasEntre(hoyISO(), fecha);
  const clase = estado !== 'hecho' && d < 0 ? 'vencida' : estado !== 'hecho' && d <= 1 ? 'pronto' : '';
  const texto = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d === -1 ? 'Ayer' : fmtCorta(fecha);
  return `<span class="fecha-tarea ${clase}">${icono('calendario')}${texto}</span>`;
}

// ============================== TABLERO ==============================
// Filas = proyectos (asignatura, TFM, prácticas…), columnas = estado. Dentro de cada celda, por prioridad.
export function renderTablero(cont) {
  const tareas = leer('tareas', []);
  const visibles = tareas.filter(t => filtro === 'todas' || t.tipo === filtro);
  const proyectos = proyectosDe(tareas);
  const hayHuerfanas = visibles.some(t => !(t.area || '').trim());
  const filas = [...proyectos, ...(hayHuerfanas || !proyectos.length ? [SIN_PROYECTO] : [])];
  const deFila = p => visibles.filter(t => (t.area || '').trim() === p);

  cont.innerHTML = `
    <div class="doble">
    <section class="panel">
      <div class="panel-cab"><h3>Nueva tarea</h3></div>
      <form class="campos" id="t-form" autocomplete="off">
        <input name="titulo" placeholder="Ej.: entregar práctica de Bioestadística" aria-label="Tarea" required>
        <div class="campos-3">
          <label class="campo">Tipo
            <select name="tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </label>
          <label class="campo">Proyecto <input name="area" list="t-areas" placeholder="Asignatura, TFM, prácticas…"></label>
          <label class="campo">Fecha límite <input name="fecha" type="date"></label>
        </div>
        <div class="pr-elegir" role="radiogroup" aria-label="Prioridad">
          ${PRIORIDADES.map(([id, n], i) => `<label class="pr-p ${id}"><input type="radio" name="prioridad" value="${id}" ${i === 1 ? 'checked' : ''}><span>${n}</span></label>`).join('')}
        </div>
        <datalist id="t-areas">${proyectos.map(a => `<option value="${escapar(a)}">`).join('')}</datalist>
        <button class="btn primario" type="submit">${icono('mas')}Añadir tarea</button>
      </form>
    </section>
    <section class="panel" id="t-foco"></section>
    </div>

    <div class="pr-barra">
      <div class="chips">
        ${[['todas', 'Todas'], ...Object.entries(TIPOS)].map(([k, v]) => `<button class="chip ${filtro === k ? 'activo' : ''}" data-filtro="${k}">${v}</button>`).join('')}
      </div>
      <div class="pr-pestanas" role="tablist" aria-label="Columna">
        ${COLUMNAS.map(([id, nombre]) => `<button role="tab" class="pr-pest ${id}" aria-selected="${colMovil === id}" data-col-movil="${id}">${nombre} <b>${visibles.filter(t => t.estado === id).length}</b></button>`).join('')}
      </div>
    </div>

    <div class="pr-tablero" data-ver="${colMovil}">
      <div class="pr-esquina">Proyecto</div>
      ${COLUMNAS.map(([id, nombre]) => `<header class="pr-cab ${id}"><h3>${nombre}</h3><span>${visibles.filter(t => t.estado === id).length}</span></header>`).join('')}
      ${filas.map((p, i) => {
        const fila = deFila(p);
        const hechas = fila.filter(t => t.estado === 'hecho').length;
        const pct = fila.length ? Math.round((hechas / fila.length) * 100) : 0;
        const nombre = p || 'Sin proyecto';
        return `
        <div class="pr-fila-nombre ${p ? '' : 'sin'}">
          <span>${escapar(nombre)}</span>
          <small>${hechas}/${fila.length} hechas</small>
          <div class="pr-progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de ${escapar(nombre)}"><i style="width:${pct}%"></i></div>
          ${p && !tareas.some(t => (t.area || '').trim() === p) ? `<button type="button" class="pr-quitar" data-quitar="${i}" aria-label="Quitar proyecto ${escapar(p)}">Quitar</button>` : ''}
        </div>
        ${COLUMNAS.map(([id, nombreCol]) => {
          const de = fila.filter(t => t.estado === id).sort((a, b) => ORDEN_PR[prioridadDe(a)] - ORDEN_PR[prioridadDe(b)]);
          return `
          <section class="pr-celda ${id}" data-columna="${id}" data-fila="${i}" aria-label="${escapar(nombre)}, ${nombreCol}">
            <span class="pr-celda-pr">${escapar(nombre)}</span>
            ${de.map(t => tarjetaTarea(t, proyectos)).join('')}
            <button class="pr-mas" data-anadir aria-label="Añadir tarea aquí">${icono('mas')}</button>
          </section>`;
        }).join('')}`;
      }).join('')}
      <form class="pr-nuevo-proyecto" id="t-proyecto" autocomplete="off">
        <input name="nombre" placeholder="+ Nuevo proyecto (asignatura, TFM, prácticas…)" aria-label="Nuevo proyecto" required>
      </form>
    </div>`;

  renderFoco(cont.querySelector('#t-foco'));

  const cambiar = (id, fn) => { guardar('tareas', leer('tareas', []).map(t => (t.id === id ? fn(t) : t))); renderTablero(cont); };
  const proyectoDeCelda = celda => filas[+celda.dataset.fila] ?? SIN_PROYECTO;

  cont.querySelector('#t-form').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    guardar('tareas', [...leer('tareas', []), { id: nuevoId(), titulo: d.titulo, tipo: d.tipo, area: d.area.trim(), fecha: d.fecha, estado: 'todo', prioridad: d.prioridad || 'media', creada: Date.now() }]);
    renderTablero(cont);
    cont.querySelector('#t-form [name=titulo]').focus();
  };

  cont.querySelector('#t-proyecto').onsubmit = ev => {
    ev.preventDefault();
    const nombre = ev.target.nombre.value.trim();
    if (!nombre) return;
    const guardados = leer('proyectos', []);
    if (!proyectos.includes(nombre)) guardar('proyectos', [...guardados, nombre]);
    renderTablero(cont);
  };

  cont.onchange = ev => {
    const sel = ev.target.closest('[data-mover]');
    if (!sel) return;
    const valor = sel.value;
    cambiar(sel.closest('.pr-tarjeta').dataset.id, t => ({ ...t, area: valor }));
  };

  cont.onclick = ev => {
    const f = ev.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; return renderTablero(cont); }
    const cm = ev.target.closest('[data-col-movil]');
    if (cm) { colMovil = cm.dataset.colMovil; return renderTablero(cont); }
    const q = ev.target.closest('[data-quitar]');
    if (q) {
      const p = filas[+q.dataset.quitar];
      guardar('proyectos', leer('proyectos', []).filter(x => x !== p));
      return renderTablero(cont);
    }
    // «+» de una celda: escribir la tarea ahí mismo
    const mas = ev.target.closest('[data-anadir]');
    if (mas) return anadirEn(mas.closest('.pr-celda'));
    const tarjeta = ev.target.closest('.pr-tarjeta');
    if (!tarjeta || ev.target.closest('[data-mover]')) return;
    const id = tarjeta.dataset.id;
    const e = ev.target.closest('[data-estado]'), p = ev.target.closest('[data-prio]');
    if (e) return cambiar(id, t => ({ ...t, estado: e.dataset.estado }));
    if (p) return cambiar(id, t => ({ ...t, prioridad: p.dataset.prio }));
    if (ev.target.closest('[data-borrar]')) {
      if (confirm('¿Borrar esta tarea?')) { guardar('tareas', leer('tareas', []).filter(t => t.id !== id)); renderTablero(cont); }
      return;
    }
    const abierta = tarjeta.classList.contains('abierta');
    cont.querySelectorAll('.pr-tarjeta.abierta').forEach(x => x.classList.remove('abierta'));
    tarjeta.classList.toggle('abierta', !abierta);
  };
  cont.onkeydown = ev => {
    if (ev.key === 'Enter' && ev.target.matches('.pr-tarjeta')) ev.target.click();
  };

  function anadirEn(celda) {
    if (celda.querySelector('.pr-nueva')) return celda.querySelector('.pr-nueva input').focus();
    const f = document.createElement('form');
    f.className = 'pr-nueva';
    f.innerHTML = '<input placeholder="Nueva tarea" aria-label="Nueva tarea" required>';
    celda.querySelector('[data-anadir]').before(f);
    const inp = f.querySelector('input'); inp.focus();
    f.onsubmit = ev => {
      ev.preventDefault();
      const titulo = inp.value.trim(); if (!titulo) return;
      guardar('tareas', [...leer('tareas', []), { id: nuevoId(), titulo, tipo: filtro === 'todas' ? 'estudio' : filtro, area: proyectoDeCelda(celda), fecha: '',
        estado: celda.dataset.columna, prioridad: 'media', creada: Date.now() }]);
      renderTablero(cont);
      cont.querySelector(`.pr-celda[data-columna="${celda.dataset.columna}"][data-fila="${celda.dataset.fila}"] [data-anadir]`)?.click();
    };
    inp.onblur = () => setTimeout(() => { if (!inp.value.trim()) f.remove(); }, 120);
    inp.onkeydown = ev => { if (ev.key === 'Escape') f.remove(); };
  }

  // Arrastrar y soltar entre celdas (ordenador): cambia estado y proyecto a la vez
  cont.ondragstart = ev => {
    const t = ev.target.closest('.pr-tarjeta');
    if (!t) return;
    ev.dataTransfer.setData('text/plain', t.dataset.id);
    ev.dataTransfer.effectAllowed = 'move';
    t.classList.add('arrastrando');
  };
  cont.ondragend = ev => {
    ev.target.closest('.pr-tarjeta')?.classList.remove('arrastrando');
    cont.querySelectorAll('.pr-celda.encima').forEach(c => c.classList.remove('encima'));
  };
  cont.ondragover = ev => {
    const celda = ev.target.closest('.pr-celda');
    if (!celda) return;
    ev.preventDefault();
    cont.querySelectorAll('.pr-celda').forEach(c => c.classList.toggle('encima', c === celda));
  };
  cont.ondrop = ev => {
    const celda = ev.target.closest('.pr-celda');
    if (!celda) return;
    ev.preventDefault();
    const area = proyectoDeCelda(celda);
    cambiar(ev.dataTransfer.getData('text/plain'), t => ({ ...t, estado: celda.dataset.columna, area }));
  };
}

// Tareas sin terminar que vencen en los próximos 7 días (o ya vencidas), por fecha
export function tareasDeLaSemana() {
  const limite = new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv-SE');
  return leer('tareas', [])
    .filter(t => t.estado !== 'hecho' && t.fecha && t.fecha <= limite)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
export { etiquetaFecha };
