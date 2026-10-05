// ESTUDIOS Y TRABAJO: tablero de tareas (Por hacer · En curso · Hecho) y notas.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { renderPostits } from './notas.js';
import { icono } from './iconos.js';
import { fmtCorta, diasEntre } from './utils.js';

const COLUMNAS = [
  ['todo', 'Por hacer'],
  ['curso', 'En curso'],
  ['hecho', 'Hecho'],
];
const TIPOS = { estudio: 'Estudio', trabajo: 'Trabajo' };
let filtro = 'todas';

export const tareasPendientes = () => leer('tareas', []).filter(t => t.estado !== 'hecho');

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
        <datalist id="t-areas">${areas.map(a => `<option value="${escapar(a)}">`).join('')}</datalist>
        <button class="btn primario" type="submit">${icono('mas')}Añadir tarea</button>
      </form>
    </section>
    <section class="panel" id="t-postits"></section>
    </div>

    <div class="chips">
      ${[['todas', 'Todas'], ...Object.entries(TIPOS)].map(([k, v]) => `<button class="chip ${filtro === k ? 'activo' : ''}" data-filtro="${k}">${v}</button>`).join('')}
    </div>

    <div class="tablero">
      ${COLUMNAS.map(([id, nombre], i) => {
        const de = visibles.filter(t => t.estado === id);
        return `
        <section class="columna" data-columna="${id}">
          <header><h3>${nombre}</h3><span class="contador">${de.length}</span></header>
          <div class="tarjetas">
            ${de.map(t => `
              <article class="tarea ${id}" draggable="true" data-id="${t.id}">
                <p>${escapar(t.titulo)}</p>
                <div class="tarea-meta">
                  <span class="etiqueta-tipo">${TIPOS[t.tipo]}${t.area ? ` · ${escapar(t.area)}` : ''}</span>
                  ${etiquetaFecha(t.fecha, t.estado)}
                </div>
                <div class="tarea-acciones">
                  ${i > 0 ? `<button class="btn-icono" data-mover="-1" aria-label="Mover a ${COLUMNAS[i - 1][1]}">${icono('izq')}</button>` : '<span></span>'}
                  <button class="btn-icono" data-borrar aria-label="Borrar">${icono('papelera')}</button>
                  ${i < 2 ? `<button class="btn-icono" data-mover="1" aria-label="Mover a ${COLUMNAS[i + 1][1]}">${icono('der')}</button>` : '<span></span>'}
                </div>
              </article>`).join('') || '<p class="tenue vacio-col">Nada por aquí</p>'}
          </div>
        </section>`;
      }).join('')}
    </div>`;

  renderPostits(cont.querySelector('#t-postits'), 'notas-estudios');

  const cambiar = (id, fn) => { guardar('tareas', leer('tareas', []).map(t => (t.id === id ? fn(t) : t))); renderTablero(cont); };

  cont.querySelector('#t-form').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    guardar('tareas', [...leer('tareas', []), { id: nuevoId(), titulo: d.titulo, tipo: d.tipo, area: d.area.trim(), fecha: d.fecha, estado: 'todo', creada: Date.now() }]);
    renderTablero(cont);
    cont.querySelector('#t-form [name=titulo]').focus();
  };

  cont.onclick = ev => {
    const f = ev.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; return renderTablero(cont); }
    const tarjeta = ev.target.closest('.tarea');
    if (!tarjeta) return;
    const id = tarjeta.dataset.id;
    const m = ev.target.closest('[data-mover]');
    if (m) {
      return cambiar(id, t => {
        const i = COLUMNAS.findIndex(c => c[0] === t.estado) + Number(m.dataset.mover);
        return { ...t, estado: COLUMNAS[i][0] };
      });
    }
    if (ev.target.closest('[data-borrar]') && confirm('¿Borrar esta tarea?')) {
      guardar('tareas', leer('tareas', []).filter(t => t.id !== id));
      renderTablero(cont);
    }
  };

  // Arrastrar y soltar entre columnas (ordenador)
  cont.ondragstart = ev => {
    const t = ev.target.closest('.tarea');
    if (!t) return;
    ev.dataTransfer.setData('text/plain', t.dataset.id);
    t.classList.add('arrastrando');
  };
  cont.ondragend = ev => ev.target.closest('.tarea')?.classList.remove('arrastrando');
  cont.ondragover = ev => {
    const col = ev.target.closest('.columna');
    if (!col) return;
    ev.preventDefault();
    cont.querySelectorAll('.columna').forEach(c => c.classList.toggle('encima', c === col));
  };
  cont.ondrop = ev => {
    const col = ev.target.closest('.columna');
    if (!col) return;
    ev.preventDefault();
    cambiar(ev.dataTransfer.getData('text/plain'), t => ({ ...t, estado: col.dataset.columna }));
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
