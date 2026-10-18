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

// Tarjeta de una tarea. Al tocarla se despliegan estado, prioridad y borrar
function tarjetaTarea(t) {
  const pr = prioridadDe(t);
  return `
    <article class="pr-tarjeta ${t.estado}" draggable="true" data-id="${t.id}" tabindex="0">
      <p>${escapar(t.titulo)}</p>
      <div class="tarea-meta">
        <span class="etiqueta-tipo">${TIPOS[t.tipo] || 'Tarea'}${t.area ? ` · ${escapar(t.area)}` : ''}</span>
        ${etiquetaFecha(t.fecha, t.estado)}
      </div>
      <div class="pr-opciones">
        <div class="pr-grupo" aria-label="Estado">${COLUMNAS.map(([id, n]) => `<button type="button" class="${t.estado === id ? 'activo' : ''}" data-estado="${id}">${n}</button>`).join('')}</div>
        <div class="pr-grupo" aria-label="Prioridad">${PRIORIDADES.map(([id]) => `<button type="button" class="pr-p ${id} ${pr === id ? 'activo' : ''}" data-prio="${id}">${id[0].toUpperCase() + id.slice(1)}</button>`).join('')}</div>
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
export function renderTablero(cont) {
  const tareas = leer('tareas', []);
  const visibles = tareas.filter(t => filtro === 'todas' || t.tipo === filtro);
  const areas = [...new Set(tareas.map(t => t.area).filter(Boolean))];

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
          <label class="campo">Asignatura o proyecto <input name="area" list="t-areas" placeholder="Opcional"></label>
          <label class="campo">Fecha límite <input name="fecha" type="date"></label>
        </div>
        <div class="pr-elegir" role="radiogroup" aria-label="Prioridad">
          ${PRIORIDADES.map(([id, n], i) => `<label class="pr-p ${id}"><input type="radio" name="prioridad" value="${id}" ${i === 1 ? 'checked' : ''}><span>${n.replace('Prioridad ', 'Prioridad ')}</span></label>`).join('')}
        </div>
        <datalist id="t-areas">${areas.map(a => `<option value="${escapar(a)}">`).join('')}</datalist>
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
      <div class="pr-esquina"></div>
      ${COLUMNAS.map(([id, nombre]) => `<header class="pr-cab ${id}"><h3>${nombre}</h3><span>${visibles.filter(t => t.estado === id).length}</span></header>`).join('')}
      ${PRIORIDADES.map(([pr, nombrePr]) => {
        const fila = visibles.filter(t => prioridadDe(t) === pr);
        return `
        <div class="pr-fila-nombre ${pr}"><span>${nombrePr}</span><b>${fila.length}</b></div>
        ${COLUMNAS.map(([id]) => {
          const de = fila.filter(t => t.estado === id);
          return `
          <section class="pr-celda ${id}" data-columna="${id}" data-prioridad="${pr}" aria-label="${nombrePr}, ${COLUMNAS.find(c => c[0] === id)[1]}">
            <span class="pr-celda-pr">${nombrePr}</span>
            ${de.map(t => tarjetaTarea(t)).join('')}
            <button class="pr-mas" data-anadir aria-label="Añadir tarea aquí">${icono('mas')}</button>
          </section>`;
        }).join('')}`;
      }).join('')}
    </div>`;

  renderFoco(cont.querySelector('#t-foco'));

  const cambiar = (id, fn) => { guardar('tareas', leer('tareas', []).map(t => (t.id === id ? fn(t) : t))); renderTablero(cont); };

  cont.querySelector('#t-form').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    guardar('tareas', [...leer('tareas', []), { id: nuevoId(), titulo: d.titulo, tipo: d.tipo, area: d.area.trim(), fecha: d.fecha, estado: 'todo', prioridad: d.prioridad || 'media', creada: Date.now() }]);
    renderTablero(cont);
    cont.querySelector('#t-form [name=titulo]').focus();
  };

  cont.onclick = ev => {
    const f = ev.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; return renderTablero(cont); }
    const cm = ev.target.closest('[data-col-movil]');
    if (cm) { colMovil = cm.dataset.colMovil; return renderTablero(cont); }
    // «+» de una celda: escribir la tarea ahí mismo
    const mas = ev.target.closest('[data-anadir]');
    if (mas) return anadirEn(mas.closest('.pr-celda'));
    const tarjeta = ev.target.closest('.pr-tarjeta');
    if (!tarjeta) return;
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
      guardar('tareas', [...leer('tareas', []), { id: nuevoId(), titulo, tipo: filtro === 'todas' ? 'estudio' : filtro, area: '', fecha: '',
        estado: celda.dataset.columna, prioridad: celda.dataset.prioridad, creada: Date.now() }]);
      renderTablero(cont);
      cont.querySelector(`.pr-celda[data-columna="${celda.dataset.columna}"][data-prioridad="${celda.dataset.prioridad}"] [data-anadir]`)?.click();
    };
    inp.onblur = () => setTimeout(() => { if (!inp.value.trim()) f.remove(); }, 120);
    inp.onkeydown = ev => { if (ev.key === 'Escape') f.remove(); };
  }

  // Arrastrar y soltar entre celdas (ordenador): cambia estado y prioridad a la vez
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
    cambiar(ev.dataTransfer.getData('text/plain'), t => ({ ...t, estado: celda.dataset.columna, prioridad: celda.dataset.prioridad }));
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
