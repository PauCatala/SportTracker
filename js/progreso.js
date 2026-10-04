// Bloque GIMNASIO: pestaña "Progreso". Por defecto, por ejercicio.
import { state } from './db.js';
import { historialEjercicio, ejercicioPorId, mesocicloDe, rutinaDe, ordenEjercicios } from './consultas.js';
import { hoyISO, sumarDias, lunesDe, fmtCorta, fmtKg, fmtEntero, esc, metricas, textoSet } from './utils.js';
import { grafica, hayChart, ejeX, ejeY, mezcla, C } from './graficos.js';

const VISTAS = [
  ['cargareps', 'Kg y reps'],
  ['nube', 'Nube'],
  ['e1rm', '1RM'],
  ['volumen', 'Volumen'],
];
const prog = { modo: 'ejercicio', ejId: null, vista: 'cargareps', rango: 'todo' };

const media = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt1 = n => fmtKg(Math.round(n * 10) / 10);

export function renderProgreso(cont) {
  cont.innerHTML = `
    <div class="segmento">
      <button data-modo="ejercicio" class="${prog.modo === 'ejercicio' ? 'activo' : ''}">Por ejercicio</button>
      <button data-modo="entreno" class="${prog.modo === 'entreno' ? 'activo' : ''}">Por entreno</button>
    </div>
    <div id="prog-cuerpo" style="display:contents"></div>`;
  cont.onclick = ev => {
    const b = ev.target.closest('[data-modo],[data-vista]');
    if (!b) return;
    if (b.dataset.modo) prog.modo = b.dataset.modo;
    if (b.dataset.vista) prog.vista = b.dataset.vista;
    renderProgreso(cont);
  };
  cont.onchange = ev => {
    if (ev.target.id === 'p-ej') prog.ejId = Number(ev.target.value);
    if (ev.target.id === 'p-rango') prog.rango = ev.target.value;
    renderProgreso(cont);
  };
  const cuerpo = cont.querySelector('#prog-cuerpo');
  prog.modo === 'ejercicio' ? porEjercicio(cuerpo) : porEntreno(cuerpo);
}

// Filtro de fechas compartido
function enRango(ses) {
  if (prog.rango === '3m') return ses.fecha >= sumarDias(hoyISO(), -90);
  if (prog.rango === 'meso') { const m = mesocicloDe(hoyISO()); return !!m && ses.mesociclo_id === m.id; }
  return true;
}
const selectorRango = () => `
  <select id="p-rango" aria-label="Periodo">
    <option value="todo" ${prog.rango === 'todo' ? 'selected' : ''}>Todo el historial</option>
    <option value="meso" ${prog.rango === 'meso' ? 'selected' : ''}>Mesociclo actual</option>
    <option value="3m" ${prog.rango === '3m' ? 'selected' : ''}>Últimos 3 meses</option>
  </select>`;

/* =========================== POR EJERCICIO =========================== */
function porEjercicio(cont) {
  const conDatos = state.ejercicios.filter(e => state.series.some(s => s.ejercicio_id === e.id));
  if (!conDatos.length) {
    cont.innerHTML = '<div class="vacio"><h3>Aún no hay datos</h3><p>Guarda tu primera sesión en Entrenar y aquí verás tu progreso.</p></div>';
    return;
  }
  if (!conDatos.some(e => e.id === prog.ejId)) prog.ejId = conDatos.sort(ordenEjercicios)[0].id;
  const e = ejercicioPorId(prog.ejId);

  // Agrupar el desplegable por los días de la rutina actual
  const meso = mesocicloDe(hoyISO());
  const diaDe = id => (meso && state.rutinas.find(r => r.mesociclo_id === meso.id && r.ejercicio_id === id)?.dia) || state.ejercicios.find(x => x.id === id)?.dia || 'Otros';
  const grupos = {};
  [...conDatos].sort((a, b) => diaDe(a.id).localeCompare(diaDe(b.id), 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre))
    .forEach(x => (grupos[diaDe(x.id)] ??= []).push(x));

  // Una fila por sesión con todas sus métricas
  const puntos = historialEjercicio(e.id).filter(h => enRango(h.sesion)).map(h => {
    const principales = h.sets.map(p => p[0]);
    const m = metricas(h.sets, e.por_lado);
    return {
      fecha: h.sesion.fecha, sets: h.sets, ...m,
      kgMedia: media(principales.map(p => Number(p.kg))),
      repsMedia: media(principales.map(p => Number(p.reps))),
      maxKgPrincipal: Math.max(...principales.map(p => Number(p.kg))),
    };
  });

  // KPIs
  const todasPrincipales = puntos.flatMap(p => p.sets.map(s => s[0]));
  const mejorSerie = todasPrincipales.reduce((m, s) => (!m || s.kg > m.kg || (s.kg === m.kg && s.reps > m.reps) ? s : m), null);
  const e1 = puntos.map(p => p.e1rm);
  const cambio = e1.length > 1 && e1[0] > 0 ? ((e1.at(-1) - e1[0]) / e1[0]) * 100 : null;

  cont.innerHTML = `
    <section class="panel campos">
      <label class="campo">Ejercicio
        <select id="p-ej">
          ${Object.entries(grupos).map(([dia, lista]) => `<optgroup label="${esc(dia)}">
            ${lista.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          </optgroup>`).join('')}
        </select>
      </label>
      ${selectorRango()}
    </section>

    <div class="kpis">
      <div class="kpi"><span>Mejor serie</span><b>${mejorSerie ? `${fmtKg(mejorSerie.kg)}` : '–'}</b><small>${mejorSerie ? `kg × ${mejorSerie.reps} reps` : ''}</small></div>
      <div class="kpi"><span>1RM estimado</span><b>${e1.length ? fmt1(e1.at(-1)) : '–'}</b>
        <small class="${cambio > 0 ? 'positivo' : cambio < 0 ? 'negativo' : ''}">${cambio == null ? 'kg' : `${cambio > 0 ? '+' : ''}${cambio.toLocaleString('es-ES', { maximumFractionDigits: 1 })} % vs. inicio`}</small></div>
      <div class="kpi"><span>Sesiones</span><b>${puntos.length}</b><small>${puntos.length ? `desde ${fmtCorta(puntos[0].fecha).toLowerCase()}` : ''}</small></div>
    </div>

    <section class="panel">
      <div class="segmento">${VISTAS.map(([k, t]) => `<button data-vista="${k}" class="${prog.vista === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
      ${hayChart() ? '<div class="grafico alto"><canvas id="g-ej"></canvas></div>' : '<p class="nota-grafico">No se han podido cargar las gráficas. Abre la app con conexión una vez.</p>'}
      ${explicacion(prog.vista)}
    </section>

    ${tablaRecords(puntos)}

    <section class="panel">
      <h3>Sesión a sesión</h3>
      <div class="tabla-scroll" style="margin-top:12px">
        <table class="tabla">
          <thead><tr><th>Fecha</th><th>Series</th><th>Carga media</th><th>1RM est.</th></tr></thead>
          <tbody>${[...puntos].reverse().map(p => `
            <tr><td>${fmtCorta(p.fecha)}</td><td>${p.sets.map(textoSet).join('<br>')}</td><td>${fmt1(p.kgMedia)} kg</td><td>${fmt1(p.e1rm)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  dibujarEjercicio(cont.querySelector('#g-ej'), puntos, e);
}

function explicacion(vista) {
  return {
    cargareps: `
      <div class="leyenda-grafico">
        <span><i style="background:${C.electrico}"></i>Carga media por serie</span>
        <span><i class="punteada"></i>Carga máxima</span>
        <span><i class="barra-l" style="background:${C.pervinca}"></i>Reps medias por serie</span>
      </div>
      <p class="nota-grafico">Separa los dos caminos de progreso: si la línea sube aunque las barras bajen, estás moviendo más kilos con menos reps. Eso también es progresar.</p>`,
    nube: `
      <div class="leyenda-grafico"><span>Más antiguo <span class="degradado"></span> más reciente</span></div>
      <p class="nota-grafico">Cada punto es una serie: reps en horizontal, kg en vertical. Si con el tiempo los puntos azules quedan arriba (más kg) o a la derecha (más reps), progresas. Es la forma legible de ver reps, kg y fecha a la vez, sin un gráfico 3D.</p>`,
    e1rm: `<p class="nota-grafico">Une carga y reps en un solo número (fórmula de Epley): cuánto podrías levantar a una repetición. Si sube, progresas aunque cambies de rango.</p>`,
    volumen: `<p class="nota-grafico">Kilos totales movidos en el ejercicio (kg × reps de todas las series). Útil en fases de volumen, engañoso cuando bajas reps para subir carga.</p>`,
  }[vista];
}

function dibujarEjercicio(canvas, puntos, e) {
  if (!canvas || !puntos.length) return;
  const etiquetas = puntos.map(p => fmtCorta(p.fecha));
  const tooltipSesion = i => puntos[i].sets.map(textoSet).join(' · ');

  if (prog.vista === 'cargareps') {
    return grafica(canvas, {
      data: {
        labels: etiquetas,
        datasets: [
          { type: 'line', label: 'Carga media', data: puntos.map(p => +p.kgMedia.toFixed(1)), yAxisID: 'y',
            borderColor: C.electrico, backgroundColor: C.electrico, borderWidth: 2.5, pointRadius: 3.5, tension: .25, order: 1 },
          { type: 'line', label: 'Carga máxima', data: puntos.map(p => p.maxKgPrincipal), yAxisID: 'y',
            borderColor: C.electrico, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, tension: .25, order: 1 },
          { type: 'bar', label: 'Reps medias', data: puntos.map(p => +p.repsMedia.toFixed(1)), yAxisID: 'y1',
            backgroundColor: C.pervinca, borderRadius: 6, maxBarThickness: 26, order: 2 },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { tooltip: { callbacks: {
          label: c => c.dataset.yAxisID === 'y1' ? `${c.dataset.label}: ${fmtKg(c.parsed.y)}` : `${c.dataset.label}: ${fmtKg(c.parsed.y)} kg`,
          footer: items => tooltipSesion(items[0].dataIndex),
        } } },
        scales: {
          x: ejeX(),
          y: ejeY({ position: 'left', title: { display: true, text: 'kg' }, grace: '10%' }),
          y1: ejeY({ position: 'right', beginAtZero: true, grid: { display: false }, title: { display: true, text: 'reps' },
            suggestedMax: Math.max(...puntos.map(p => p.repsMedia)) * 2.2 }),
        },
      },
    });
  }

  if (prog.vista === 'nube') {
    const n = puntos.length;
    const pts = puntos.flatMap((p, i) => p.sets.map(s => ({
      x: Number(s[0].reps), y: Number(s[0].kg), fecha: p.fecha, i,
    })));
    const colores = pts.map(pt => mezcla(C.pervinca, C.electrico, n > 1 ? pt.i / (n - 1) : 1));
    return grafica(canvas, {
      type: 'scatter',
      data: { datasets: [{
        data: pts, backgroundColor: colores, borderColor: colores,
        pointRadius: pts.map(pt => (pt.i === n - 1 ? 7 : 5)), pointHoverRadius: 8,
        pointBorderWidth: pts.map(pt => (pt.i === n - 1 ? 2 : 0)),
      }] },
      options: {
        plugins: { tooltip: { callbacks: { label: c => `${c.raw.x} × ${fmtKg(c.raw.y)} kg, ${fmtCorta(c.raw.fecha).toLowerCase()}` } } },
        scales: {
          x: ejeY({ title: { display: true, text: 'repeticiones' }, ticks: { stepSize: 1 }, suggestedMin: Math.min(...pts.map(p => p.x)) - 1, suggestedMax: Math.max(...pts.map(p => p.x)) + 1 }),
          y: ejeY({ title: { display: true, text: 'kg' }, grace: '10%' }),
        },
      },
    });
  }

  const vol = prog.vista === 'volumen';
  return grafica(canvas, {
    type: vol ? 'bar' : 'line',
    data: { labels: etiquetas, datasets: [{
      data: puntos.map(p => +(vol ? p.volumen : p.e1rm).toFixed(1)),
      borderColor: C.electrico, backgroundColor: vol ? C.electrico : C.electricoSuave,
      fill: !vol, borderWidth: 2.5, pointRadius: 3.5, tension: .25, borderRadius: 6, maxBarThickness: 28,
    }] },
    options: {
      plugins: { tooltip: { callbacks: {
        label: c => `${vol ? 'Volumen' : '1RM estimado'}: ${vol ? fmtEntero(c.parsed.y) : fmtKg(c.parsed.y)} kg`,
        footer: items => tooltipSesion(items[0].dataIndex),
      } } },
      scales: { x: ejeX(), y: ejeY({ beginAtZero: vol }) },
    },
  });
}

// Mejor carga conseguida a cada número de repeticiones (tus "RM")
function tablaRecords(puntos) {
  const mejor = new Map();
  puntos.forEach(p => p.sets.forEach(partes => {
    const s = partes[0];
    const r = Number(s.reps), kg = Number(s.kg);
    const actual = mejor.get(r);
    if (!actual || kg > actual.kg) mejor.set(r, { kg, fecha: p.fecha });
  }));
  if (!mejor.size) return '';
  const ultimaFecha = puntos.at(-1)?.fecha;
  const filas = [...mejor.entries()].sort((a, b) => a[0] - b[0]);
  return `
    <section class="panel">
      <h3>Récords por repeticiones</h3>
      <p class="sub" style="margin-top:4px">Tu mejor carga a cada número de reps. Así un 8 × 220 cuenta como récord aunque antes hicieras 10 × 200.</p>
      <div class="tabla-scroll" style="margin-top:12px">
        <table class="tabla">
          <thead><tr><th>Reps</th><th>Mejor carga</th><th>Fecha</th></tr></thead>
          <tbody>${filas.map(([r, v]) => `
            <tr><td>${r}</td><td class="${v.fecha === ultimaFecha ? 'destacado' : ''}">${fmtKg(v.kg)} kg${v.fecha === ultimaFecha && puntos.length > 1 ? ' <span class="etiqueta ok">Nuevo</span>' : ''}</td><td>${fmtCorta(v.fecha)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

/* ============================ POR ENTRENO ============================ */
function porEntreno(cont) {
  const sesiones = state.sesiones.filter(enRango);
  if (!sesiones.length) {
    cont.innerHTML = `${selectorRango()}<div class="vacio"><h3>Aún no hay sesiones</h3><p>Cuando guardes entrenos, aquí verás tu constancia y el volumen semana a semana.</p></div>`;
    return;
  }
  const porSemana = new Map();
  for (const s of sesiones) {
    const w = lunesDe(s.fecha);
    const v = porSemana.get(w) || { sesiones: 0, volumen: 0 };
    v.sesiones++;
    v.volumen += state.series.filter(x => x.sesion_id === s.id)
      .reduce((t, x) => t + x.reps * x.kg * (ejercicioPorId(x.ejercicio_id)?.por_lado ? 2 : 1), 0);
    porSemana.set(w, v);
  }
  const semanas = [...porSemana.keys()].sort();
  const estaSemana = porSemana.get(lunesDe(hoyISO()));
  const pasada = porSemana.get(lunesDe(sumarDias(hoyISO(), -7)));
  const meso = mesocicloDe(hoyISO());
  const objetivo = meso ? new Set(state.rutinas.filter(r => r.mesociclo_id === meso.id).map(r => r.dia)).size : 0;
  const cambioVol = estaSemana && pasada?.volumen ? ((estaSemana.volumen - pasada.volumen) / pasada.volumen) * 100 : null;

  cont.innerHTML = `
    ${selectorRango()}
    <div class="kpis">
      <div class="kpi"><span>Esta semana</span><b>${estaSemana?.sesiones ?? 0}${objetivo ? ` / ${objetivo}` : ''}</b><small>sesiones</small></div>
      <div class="kpi"><span>Volumen semana</span><b>${fmt1((estaSemana?.volumen ?? 0) / 1000)} t</b>
        <small class="${cambioVol > 0 ? 'positivo' : cambioVol < 0 ? 'negativo' : ''}">${cambioVol == null ? 'kg × reps' : `${cambioVol > 0 ? '+' : ''}${Math.round(cambioVol)} % vs anterior`}</small></div>
      <div class="kpi"><span>Total</span><b>${sesiones.length}</b><small>sesiones</small></div>
    </div>
    <section class="panel">
      <h3>Sesiones por semana</h3>
      <div class="grafico"><canvas id="g-sem"></canvas></div>
      ${objetivo ? `<p class="nota-grafico">La línea marca tu objetivo del mesociclo: ${objetivo} días.</p>` : ''}
    </section>
    <section class="panel">
      <h3>Volumen total por semana</h3>
      <div class="grafico"><canvas id="g-vol"></canvas></div>
      <p class="nota-grafico">Toneladas movidas sumando todos los ejercicios. Debería bajar en las semanas de descarga.</p>
    </section>`;

  const etiquetas = semanas.map(w => fmtCorta(w));
  grafica(cont.querySelector('#g-sem'), {
    data: {
      labels: etiquetas,
      datasets: [
        { type: 'bar', data: semanas.map(w => porSemana.get(w).sesiones), backgroundColor: C.electrico, borderRadius: 6, maxBarThickness: 26 },
        ...(objetivo ? [{ type: 'line', data: semanas.map(() => objetivo), borderColor: C.tinta3, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 }] : []),
      ],
    },
    options: {
      plugins: { tooltip: { callbacks: { title: i => `Semana del ${i[0].label.toLowerCase()}`, label: c => `${c.parsed.y} sesiones` } } },
      scales: { x: ejeX(), y: ejeY({ beginAtZero: true, suggestedMax: Math.max(objetivo, 1) + 1, ticks: { stepSize: 1 } }) },
    },
  });
  grafica(cont.querySelector('#g-vol'), {
    type: 'bar',
    data: { labels: etiquetas, datasets: [{ data: semanas.map(w => +(porSemana.get(w).volumen / 1000).toFixed(2)), backgroundColor: C.pervinca, hoverBackgroundColor: C.electrico, borderRadius: 6, maxBarThickness: 26 }] },
    options: {
      plugins: { tooltip: { callbacks: { title: i => `Semana del ${i[0].label.toLowerCase()}`, label: c => `${fmtKg(c.parsed.y)} toneladas` } } },
      scales: { x: ejeX(), y: ejeY({ beginAtZero: true, title: { display: true, text: 'toneladas' } }) },
    },
  });
}
