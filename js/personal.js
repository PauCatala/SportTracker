// PERSONAL: hábitos (verde = hecho, rojo = no hecho), lista general de tareas y notas.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { renderPostits } from './notas.js';
import { icono } from './iconos.js';
import { sumarDias, parseISO, lunesDe } from './utils.js';
import { grafica, ejeX, ejeY } from './graficos.js';

// ============================== HÁBITOS ==============================
// Cada hábito tiene una frecuencia: 7 = cada día, 1-6 = veces por semana.
const FRECUENCIAS = [[7, 'Cada día'], ...[1, 2, 3, 4, 5, 6].map(n => [n, `${n} ${n === 1 ? 'vez' : 'veces'} por semana`])];
const estadoDe = (dias, id, fecha) => dias[id]?.[fecha] || '';
const frecuenciaDe = h => Number(h.frecuencia) || 7;
const textoFrecuencia = h => (frecuenciaDe(h) === 7 ? 'Cada día' : `${frecuenciaDe(h)}× semana`);
let filtroGrafica = 'todos';

// Veces hechas en la semana (lunes a domingo) que contiene "fecha"
function hechosSemana(dias, id, fecha) {
  const lunes = lunesDe(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)).filter(f => estadoDe(dias, id, f) === 'si').length;
}

// Racha: días seguidos (hábitos diarios) o semanas seguidas cumpliendo el objetivo (semanales)
export function racha(dias, h) {
  const hoy = hoyISO();
  if (frecuenciaDe(h) === 7) {
    let fecha = estadoDe(dias, h.id, hoy) === 'si' ? hoy : sumarDias(hoy, -1);
    let n = 0;
    while (estadoDe(dias, h.id, fecha) === 'si') { n++; fecha = sumarDias(fecha, -1); }
    return { n, unidad: n === 1 ? 'día' : 'días' };
  }
  let lunes = lunesDe(hoy);
  if (hechosSemana(dias, h.id, lunes) < frecuenciaDe(h)) lunes = sumarDias(lunes, -7);   // la semana actual aún está en curso
  let n = 0;
  while (hechosSemana(dias, h.id, lunes) >= frecuenciaDe(h)) { n++; lunes = sumarDias(lunes, -7); }
  return { n, unidad: n === 1 ? 'semana' : 'semanas' };
}

export function habitosDeHoy() {
  const habitos = leer('habitos', []);
  const dias = leer('habitos-dias', {});
  const hoy = hoyISO();
  return { total: habitos.length, hechos: habitos.filter(h => estadoDe(dias, h.id, hoy) === 'si').length };
}

// Recuento de hechos y no hechos entre dos fechas (para las gráficas)
function recuento(habitos, dias, desde, hasta) {
  let si = 0, no = 0;
  habitos.forEach(h => Object.entries(dias[h.id] || {}).forEach(([f, e]) => {
    if (f >= desde && f <= hasta) { if (e === 'si') si++; else if (e === 'no') no++; }
  }));
  return { si, no };
}

export function renderHabitos(cont) {
  const habitos = leer('habitos', []);
  const dias = leer('habitos-dias', {});
  const hoy = hoyISO();
  const n = innerWidth < 700 ? 7 : 14;
  const fechas = Array.from({ length: n }, (_, i) => sumarDias(hoy, i - n + 1));
  const letra = f => parseISO(f).toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();

  cont.innerHTML = `
    <section class="panel">
      <div class="panel-cab">
        <h3>Tus hábitos</h3>
        <span class="leyenda-habitos"><i class="si"></i>Hecho <i class="no"></i>No hecho</span>
      </div>
      ${habitos.length ? `
      <div class="habitos" style="--dias:${n}">
        <div class="habitos-fila cabeza">
          <span></span>
          ${fechas.map(f => `<span class="dia-h ${f === hoy ? 'hoy' : ''}">${letra(f)}<small>${parseISO(f).getDate()}</small></span>`).join('')}
          <span>Semana</span>
        </div>
        ${habitos.map(h => {
          const hechos = hechosSemana(dias, h.id, hoy);
          const meta = frecuenciaDe(h);
          const r = racha(dias, h);
          return `
          <div class="habitos-fila">
            <span class="habito-nombre">
              <span>${escapar(h.nombre)}<small>${textoFrecuencia(h)} · racha ${r.n} ${r.unidad}</small></span>
              <button class="btn-icono mini" data-borrar-habito="${h.id}" aria-label="Borrar hábito">${icono('x')}</button>
            </span>
            ${fechas.map(f => {
              const e = estadoDe(dias, h.id, f);
              return `<button class="celda-h ${e} ${f === hoy ? 'hoy' : ''}" data-h="${h.id}" data-f="${f}" aria-label="${escapar(h.nombre)}, ${f}: ${e === 'si' ? 'hecho' : e === 'no' ? 'no hecho' : 'sin marcar'}">${e === 'si' ? icono('check') : e === 'no' ? icono('x') : ''}</button>`;
            }).join('')}
            <span class="semana-h ${hechos >= meta ? 'cumplido' : ''}"><b>${hechos}/${meta}</b></span>
          </div>`;
        }).join('')}
      </div>
      <p class="tenue" style="margin-top:10px">Toca una casilla: una vez para verde, otra para rojo y otra para dejarla vacía. "Semana" cuenta de lunes a domingo.</p>`
      : '<p class="tenue">Aún no tienes hábitos. Prueba con "Beber 2 litros de agua" cada día o "Ir al gimnasio" 4 veces por semana.</p>'}
      <form class="fila-anadir" id="h-form" style="margin-top:14px" autocomplete="off">
        <input name="nombre" placeholder="Nuevo hábito" required>
        <select name="frecuencia" aria-label="Frecuencia">${FRECUENCIAS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
        <button class="btn primario" type="submit">${icono('mas')}Añadir</button>
      </form>
    </section>

    ${habitos.length ? `
    <section class="panel">
      <div class="panel-cab"><h3>Cómo vas</h3><span class="tenue">Hechos y no hechos</span></div>
      <div class="chips">${[['todos', 'Todos'], ...habitos.map(h => [h.id, h.nombre])].map(([k, v]) => `<button class="chip ${filtroGrafica === k ? 'activo' : ''}" data-filtro="${k}">${escapar(v)}</button>`).join('')}</div>
      <div class="dos-graficas">
        <div><h4>Por semana</h4><div class="grafico"><canvas id="g-hab-semana"></canvas></div></div>
        <div><h4>Por mes</h4><div class="grafico"><canvas id="g-hab-mes"></canvas></div></div>
      </div>
    </section>` : ''}`;

  // ---------- Gráficas ----------
  if (habitos.length) {
    const elegidos = filtroGrafica === 'todos' ? habitos : habitos.filter(h => h.id === filtroGrafica);
    const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(lunesDe(hoy), -7 * (7 - i)));
    const porSemana = semanas.map(l => recuento(elegidos, dias, l, sumarDias(l, 6)));
    const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d; });
    const porMes = meses.map(d => {
      const ini = d.toLocaleDateString('sv-SE');
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('sv-SE');
      return recuento(elegidos, dias, ini, fin);
    });
    const barras = (id, etiquetas, datos) => grafica(cont.querySelector(id), {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [
          { label: 'Hechos', data: datos.map(d => d.si), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--ok').trim(), borderRadius: 6, maxBarThickness: 28 },
          { label: 'No hechos', data: datos.map(d => d.no), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--error').trim(), borderRadius: 6, maxBarThickness: 28 },
        ],
      },
      options: {
        scales: { x: { ...ejeX(), stacked: true }, y: { ...ejeY({ beginAtZero: true, ticks: { precision: 0 } }), stacked: true } },
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
      },
    });
    barras('#g-hab-semana', semanas.map(l => parseISO(l).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })), porSemana);
    barras('#g-hab-mes', meses.map(d => d.toLocaleDateString('es-ES', { month: 'short' })), porMes);
  }

  cont.onclick = ev => {
    const c = ev.target.closest('[data-h]');
    if (c) {
      const todos = leer('habitos-dias', {});
      const actual = todos[c.dataset.h]?.[c.dataset.f] || '';
      const siguiente = { '': 'si', si: 'no', no: '' }[actual];
      todos[c.dataset.h] = { ...(todos[c.dataset.h] || {}), [c.dataset.f]: siguiente };
      if (!siguiente) delete todos[c.dataset.h][c.dataset.f];
      guardar('habitos-dias', todos);
      return renderHabitos(cont);
    }
    const f = ev.target.closest('[data-filtro]');
    if (f) { filtroGrafica = f.dataset.filtro; return renderHabitos(cont); }
    const b = ev.target.closest('[data-borrar-habito]');
    if (b && confirm('¿Borrar este hábito y su historial?')) {
      guardar('habitos', leer('habitos', []).filter(h => h.id !== b.dataset.borrarHabito));
      const todos = leer('habitos-dias', {});
      delete todos[b.dataset.borrarHabito];
      guardar('habitos-dias', todos);
      if (filtroGrafica === b.dataset.borrarHabito) filtroGrafica = 'todos';
      renderHabitos(cont);
    }
  };
  cont.querySelector('#h-form').onsubmit = ev => {
    ev.preventDefault();
    const d = new FormData(ev.target);
    const nombre = d.get('nombre').trim();
    if (!nombre) return;
    guardar('habitos', [...leer('habitos', []), { id: nuevoId(), nombre, frecuencia: Number(d.get('frecuencia')) }]);
    renderHabitos(cont);
  };
}

// ============================== LISTA ==============================
export const pendientesLista = () => leer('lista', []).filter(x => !x.hecho);

export function renderLista(cont) {
  const lista = leer('lista', []);
  const pendientes = lista.filter(x => !x.hecho), hechas = lista.filter(x => x.hecho);
  const item = x => `
    <li class="item-lista ${x.hecho ? 'hecho' : ''}">
      <button class="caja-lista" data-marcar="${x.id}" aria-pressed="${x.hecho}" aria-label="${x.hecho ? 'Desmarcar' : 'Marcar como hecha'}">${icono('check')}</button>
      <span>${escapar(x.texto)}</span>
      <button class="btn-icono" data-borrar="${x.id}" aria-label="Borrar">${icono('papelera')}</button>
    </li>`;

  cont.innerHTML = `
    <div class="doble">
    <section class="panel">
      <div class="panel-cab"><h3>Tu lista</h3><span class="tenue">${pendientes.length} por hacer</span></div>
      <form class="fila-anadir" id="l-form" autocomplete="off">
        <input name="texto" placeholder="Casa, compras, recados…" required>
        <button class="btn primario" type="submit">${icono('mas')}Añadir</button>
      </form>
      <ul class="lista-tareas">${pendientes.map(item).join('') || '<li class="tenue" style="padding:14px 0">Todo hecho. Buen trabajo.</li>'}</ul>
    </section>
    <section class="panel" id="l-postits"></section>
    </div>
    ${hechas.length ? `
    <section class="panel">
      <div class="panel-cab"><h3>Hechas</h3><button class="btn-texto" data-limpiar>Borrar hechas</button></div>
      <ul class="lista-tareas">${hechas.map(item).join('')}</ul>
    </section>` : ''}`;

  renderPostits(cont.querySelector('#l-postits'), 'notas-personal');
  const form = cont.querySelector('#l-form');
  form.onsubmit = ev => {
    ev.preventDefault();
    const texto = new FormData(form).get('texto').trim();
    if (!texto) return;
    guardar('lista', [...leer('lista', []), { id: nuevoId(), texto, hecho: false }]);
    renderLista(cont);
    cont.querySelector('#l-form input').focus();
  };
  cont.onclick = ev => {
    if (ev.target.closest('#l-postits')) return;
    const m = ev.target.closest('[data-marcar]');
    if (m) {
      guardar('lista', leer('lista', []).map(x => (x.id === m.dataset.marcar ? { ...x, hecho: !x.hecho } : x)));
      return renderLista(cont);
    }
    const b = ev.target.closest('[data-borrar]');
    if (b) { guardar('lista', leer('lista', []).filter(x => x.id !== b.dataset.borrar)); return renderLista(cont); }
    if (ev.target.closest('[data-limpiar]')) { guardar('lista', leer('lista', []).filter(x => !x.hecho)); renderLista(cont); }
  };
}


