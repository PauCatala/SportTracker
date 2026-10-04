// Bloque GIMNASIO: pestaña "Progreso" (gráficas con Chart.js)
import { state } from './db.js';
import { historialEjercicio, ejercicioPorId, mesocicloDe, ordenEjercicios } from './consultas.js';
import { hoyISO, sumarDias, lunesDe, fmtCorta, fmtKg, fmtEntero, esc, metricas, textoSet } from './utils.js';

const METRICAS = {
  e1rm:    { nombre: '1RM estimado', unidad: 'kg', valor: m => m.e1rm },
  maxKg:   { nombre: 'Carga máxima', unidad: 'kg', valor: m => m.maxKg },
  volumen: { nombre: 'Volumen',      unidad: 'kg', valor: m => m.volumen },
  reps:    { nombre: 'Reps totales', unidad: 'reps', valor: m => m.reps },
};
const prog = { ejId: null, metrica: 'e1rm', rango: 'todo' };
let graficoEj = null, graficoVol = null;   // guardamos las gráficas para poder borrarlas al repintar

export function renderProgreso(cont) {
  const conDatos = state.ejercicios
    .filter(e => state.series.some(s => s.ejercicio_id === e.id))
    .sort(ordenEjercicios);
  if (!conDatos.length) {
    cont.innerHTML = '<p class="vacio">Aún no hay datos. Registra tu primera sesión en <b>Entrenar</b>.</p>';
    return;
  }
  if (!conDatos.some(e => e.id === prog.ejId)) prog.ejId = conDatos[0].id;
  const e = ejercicioPorId(prog.ejId);
  const met = METRICAS[prog.metrica];

  // Filtro de rango de fechas
  const mesoActual = mesocicloDe(hoyISO());
  const desde = prog.rango === '3m' ? sumarDias(hoyISO(), -90) : null;
  const enRango = ses =>
    (!desde || ses.fecha >= desde) &&
    (prog.rango !== 'meso' || (mesoActual && ses.mesociclo_id === mesoActual.id));

  const puntos = historialEjercicio(e.id)
    .filter(h => enRango(h.sesion))
    .map(h => ({ fecha: h.sesion.fecha, sets: h.sets, valor: met.valor(metricas(h.sets, e.por_lado)) }));

  const valores = puntos.map(p => p.valor);
  const mejor = valores.length ? Math.max(...valores) : null;
  const ultimo = valores.at(-1) ?? null;
  const cambio = valores.length > 1 && valores[0] > 0 ? ((ultimo - valores[0]) / valores[0]) * 100 : null;

  // Agrupar por días de rutina para el desplegable
  const grupos = {};
  conDatos.forEach(x => (grupos[x.dia || 'Sin día'] ??= []).push(x));

  const hayChart = typeof Chart !== 'undefined';
  cont.innerHTML = `
    <label>Ejercicio
      <select id="p-ej">
        ${Object.entries(grupos).map(([dia, lista]) => `<optgroup label="${esc(dia)}">
          ${lista.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
        </optgroup>`).join('')}
      </select>
    </label>
    <div class="dos-col">
      <label>Métrica
        <select id="p-met">${Object.entries(METRICAS).map(([k, m]) => `<option value="${k}" ${k === prog.metrica ? 'selected' : ''}>${m.nombre}</option>`).join('')}</select>
      </label>
      <label>Periodo
        <select id="p-rango">
          <option value="todo" ${prog.rango === 'todo' ? 'selected' : ''}>Todo</option>
          <option value="meso" ${prog.rango === 'meso' ? 'selected' : ''}>Mesociclo actual</option>
          <option value="3m" ${prog.rango === '3m' ? 'selected' : ''}>Últimos 3 meses</option>
        </select>
      </label>
    </div>

    <div class="kpis">
      <div class="kpi"><span>Mejor</span><b>${mejor == null ? '–' : fmtKg(mejor.toFixed(1))}</b><small>${met.unidad}</small></div>
      <div class="kpi"><span>Última</span><b>${ultimo == null ? '–' : fmtKg(ultimo.toFixed(1))}</b><small>${met.unidad}</small></div>
      <div class="kpi"><span>Cambio</span><b class="${cambio > 0 ? 'positivo' : cambio < 0 ? 'negativo' : ''}">${cambio == null ? '–' : (cambio > 0 ? '+' : '') + cambio.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + '%'}</b><small>desde el inicio</small></div>
    </div>

    ${hayChart ? '<div class="grafico"><canvas id="g-ej"></canvas></div>' : '<p class="vacio">No se pudieron cargar las gráficas (¿sin conexión la primera vez?).</p>'}
    ${met.nombre === '1RM estimado' ? '<p class="ayuda">El 1RM estimado combina carga y reps en un solo número (fórmula de Epley): si sube, estás progresando aunque cambies de rango de repeticiones.</p>' : ''}

    <div class="tabla-scroll">
      <table class="tabla">
        <thead><tr><th>Fecha</th><th>Series</th><th>${met.nombre}</th></tr></thead>
        <tbody>${[...puntos].reverse().map(p => `
          <tr><td>${fmtCorta(p.fecha)}</td><td>${p.sets.map(textoSet).join('<br>')}</td><td>${fmtKg(p.valor.toFixed(1))}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h3 class="seccion">Volumen total por semana</h3>
    <p class="ayuda">Todos los ejercicios sumados (kg × reps). Te dice si entrenas más o menos que otras semanas.</p>
    ${hayChart ? '<div class="grafico"><canvas id="g-vol"></canvas></div>' : ''}`;

  if (hayChart) dibujar(cont, puntos, met, enRango);

  cont.onchange = ev => {
    if (ev.target.id === 'p-ej') prog.ejId = Number(ev.target.value);
    if (ev.target.id === 'p-met') prog.metrica = ev.target.value;
    if (ev.target.id === 'p-rango') prog.rango = ev.target.value;
    renderProgreso(cont);
  };
}

function dibujar(cont, puntos, met, enRango) {
  Chart.defaults.locale = 'es-ES';   // números con formato español (40.000)
  const css = getComputedStyle(document.documentElement);
  const color = v => css.getPropertyValue(v).trim();
  const ejes = {
    x: { ticks: { color: color('--tenue') }, grid: { color: color('--borde') } },
    y: { ticks: { color: color('--tenue') }, grid: { color: color('--borde') }, beginAtZero: false },
  };

  graficoEj?.destroy();
  graficoEj = new Chart(cont.querySelector('#g-ej'), {
    type: 'line',
    data: {
      labels: puntos.map(p => fmtCorta(p.fecha)),
      datasets: [{
        data: puntos.map(p => +p.valor.toFixed(1)),
        borderColor: color('--acento'), backgroundColor: color('--acento'),
        borderWidth: 2.5, pointRadius: 4, tension: 0.25,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: c => `${met.nombre}: ${fmtKg(c.parsed.y)} ${met.unidad}`,
          afterLabel: c => puntos[c.dataIndex].sets.map(textoSet).join(' · '),
        } },
      },
      scales: ejes,
    },
  });

  // Volumen semanal de todos los ejercicios
  const porSemana = new Map();
  for (const s of state.series) {
    const ses = state.sesiones.find(x => x.id === s.sesion_id);
    if (!ses || !enRango(ses)) continue;
    const lunes = lunesDe(ses.fecha);
    const factor = ejercicioPorId(s.ejercicio_id)?.por_lado ? 2 : 1;
    porSemana.set(lunes, (porSemana.get(lunes) || 0) + s.reps * s.kg * factor);
  }
  const semanas = [...porSemana.keys()].sort();

  graficoVol?.destroy();
  graficoVol = new Chart(cont.querySelector('#g-vol'), {
    type: 'bar',
    data: {
      labels: semanas.map(fmtCorta),
      datasets: [{ data: semanas.map(w => Math.round(porSemana.get(w))), backgroundColor: color('--acento'), borderRadius: 4, maxBarThickness: 28 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmtEntero(c.parsed.y)} kg` } } },
      scales: { ...ejes, y: { ...ejes.y, beginAtZero: true } },
    },
  });
}
