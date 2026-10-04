// Bloque FLEXIBILIDAD: pestañas "Hoy" y "Progreso".
import { state, supabase, ejecutar, uid } from './db.js';
import { hoyISO, sumarDias, lunesDe, parseISO, fmtCorta, capitalizar, esc, aviso, mensajeError, requiereConexion } from './utils.js';
import { FLEX, MEDIDAS_FLEX, flexDelDia } from './plan.js';
import { bannerMigracion } from './gym.js';
import { grafica, hayChart, ejeX, ejeY, C } from './graficos.js';
import { icono } from './iconos.js';

let fechaFlex = null;

const filaDe = fecha => state.flex_dias.find(f => f.fecha === fecha) || null;
// Fracción del día completada (0..1) según lo que tocaba ese día
export function cumplimiento(fecha) {
  const items = flexDelDia(fecha).map(f => f.id);
  const hechos = new Set(filaDe(fecha)?.completados || []);
  return items.filter(i => hechos.has(i)).length / items.length;
}

// Guarda un día (crea la fila si no existe). Actualiza primero en pantalla y luego en Supabase.
async function guardarDia(fecha, cambios) {
  if (!requiereConexion()) return false;
  let fila = filaDe(fecha);
  const anterior = fila ? { ...fila } : null;
  if (!fila) { fila = { fecha, completados: [], medida: null }; state.flex_dias.push(fila); }
  Object.assign(fila, cambios);
  try {
    const guardada = await ejecutar(supabase.from('flex_dias')
      .upsert({ user_id: uid, fecha, completados: fila.completados, medida: fila.medida }, { onConflict: 'user_id,fecha' })
      .select().single());
    Object.assign(fila, guardada);
    return true;
  } catch (e) {
    if (anterior) Object.assign(fila, anterior); else state.flex_dias = state.flex_dias.filter(f => f !== fila);
    aviso(mensajeError(e), 'error');
    return false;
  }
}

function racha() {
  let dia = hoyISO();
  if (cumplimiento(dia) < 1) dia = sumarDias(dia, -1);
  let n = 0;
  while (cumplimiento(dia) >= 1) { n++; dia = sumarDias(dia, -1); }
  return n;
}

/* =============================== HOY =============================== */
export function renderFlexHoy(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const hoy = hoyISO();
  const fecha = fechaFlex || hoy;
  const items = flexDelDia(fecha);
  const hechos = new Set(filaDe(fecha)?.completados || []);
  const nHechos = items.filter(i => hechos.has(i.id)).length;
  const frac = nHechos / items.length;
  const extra = items.some(i => i.id === 'hipo') ? 'hipopresivos' : items.some(i => i.id.startsWith('cuello')) ? 'cuello' : null;
  const medidaSemana = state.flex_dias.filter(f => f.medida != null && lunesDe(f.fecha) === lunesDe(fecha)).at(-1);
  const R = 34, L = 2 * Math.PI * R;
  const titulo = fecha === hoy ? 'Hoy' : fecha === sumarDias(hoy, -1) ? 'Ayer'
    : capitalizar(parseISO(fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }));

  cont.innerHTML = `
    <section class="hero">
      <div class="hoy-flex">
        <div class="anillo" aria-label="${nHechos} de ${items.length}">
          <svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="8"/>
            <circle cx="42" cy="42" r="${R}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - frac)}"/></svg>
          <b>${nHechos}/${items.length}</b>
        </div>
        <div>
          <p class="hero-sup">${frac >= 1 ? 'Completado' : extra ? `Flexibilidad y ${extra}` : 'Flexibilidad suave'}</p>
          <h2>${titulo}</h2>
          <p>${racha() ? `Llevas ${racha()} ${racha() === 1 ? 'día' : 'días'} seguidos.` : 'Objetivo a 6 meses: cabeza a las rodillas.'}</p>
        </div>
      </div>
    </section>

    <div class="navegador">
      <button class="btn-icono" data-dia="-1" aria-label="Día anterior">${icono('izq')}</button>
      <span>${fmtCorta(fecha)}</span>
      <button class="btn-icono" data-dia="1" aria-label="Día siguiente" ${fecha >= hoy ? 'disabled style="opacity:.3"' : ''}>${icono('der')}</button>
    </div>

    <section class="panel">
      <div class="panel-cab">
        <h3>Rutina de la mañana</h3>
        <button class="btn-texto" id="f-todo">${frac >= 1 ? 'Desmarcar todo' : 'Marcar todo'}</button>
      </div>
      <div class="lista-check">
        ${items.map(i => `
          <button class="check-item ${hechos.has(i.id) ? 'hecho' : ''}" data-item="${i.id}" aria-pressed="${hechos.has(i.id)}">
            <span class="caja">${icono('check')}</span>
            <span><span class="nombre">${esc(i.nombre)}</span><span class="como">${esc(i.como)}</span></span>
            <span class="dosis">${esc(i.dosis)}</span>
          </button>`).join('')}
      </div>
    </section>

    <section class="panel">
      <h3>Medida de la semana</h3>
      <p class="sub" style="margin:4px 0 12px">Una vez por semana, en el pliegue sentado: ¿hasta dónde llegas?</p>
      <div class="escala">
        ${MEDIDAS_FLEX.map((m, k) => `<button data-medida="${k}" class="${medidaSemana?.medida === k ? 'activo' : ''}"><span class="nivel">${k + 1}</span>${m}</button>`).join('')}
      </div>
    </section>`;

  cont.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.dia) {
      const nueva = sumarDias(fecha, Number(b.dataset.dia));
      if (nueva > hoy) return;
      fechaFlex = nueva;
      return renderFlexHoy(cont);
    }
    if (b.dataset.item) {
      const set = new Set(filaDe(fecha)?.completados || []);
      set.has(b.dataset.item) ? set.delete(b.dataset.item) : set.add(b.dataset.item);
      b.classList.toggle('hecho');                         // respuesta inmediata al toque
      await guardarDia(fecha, { completados: [...set] });
      const antes = frac;
      renderFlexHoy(cont);
      if (antes < 1 && cumplimiento(fecha) >= 1) aviso('Rutina completada');
    }
    if (b.id === 'f-todo') {
      await guardarDia(fecha, { completados: frac >= 1 ? [] : items.map(i => i.id) });
      renderFlexHoy(cont);
    }
    if (b.dataset.medida != null) {
      const k = Number(b.dataset.medida);
      // Si ya había medida esta semana en otro día, se quita para que quede una por semana
      if (medidaSemana && medidaSemana.fecha !== fecha) await guardarDia(medidaSemana.fecha, { medida: null });
      if (await guardarDia(fecha, { medida: k })) aviso('Medida guardada');
      renderFlexHoy(cont);
    }
  };
}

/* ============================= PROGRESO ============================= */
export function renderFlexProgreso(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const hoy = hoyISO();
  const SEMANAS = 12;
  const inicioCal = sumarDias(lunesDe(hoy), -7 * (SEMANAS - 1));

  // Racha más larga y cumplimiento del mes
  let mejor = 0, actualR = 0;
  const primeros = state.flex_dias.map(f => f.fecha).sort()[0];
  for (let d = primeros || hoy; d <= hoy; d = sumarDias(d, 1)) {
    actualR = cumplimiento(d) >= 1 ? actualR + 1 : 0;
    mejor = Math.max(mejor, actualR);
  }
  const diasMes = Number(hoy.slice(8, 10));
  let completosMes = 0;
  for (let i = 0; i < diasMes; i++) if (cumplimiento(sumarDias(hoy, -i)) >= 1) completosMes++;

  const nivel = f => (f >= 1 ? 'n4' : f >= .66 ? 'n3' : f >= .33 ? 'n2' : f > 0 ? 'n1' : '');
  const filasDias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const medidas = state.flex_dias.filter(f => f.medida != null).sort((a, b) => a.fecha.localeCompare(b.fecha));

  cont.innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>Racha</span><b>${racha()}</b><small>días seguidos</small></div>
      <div class="kpi"><span>Mejor racha</span><b>${mejor}</b><small>días</small></div>
      <div class="kpi"><span>Este mes</span><b>${completosMes}/${diasMes}</b><small>días completos</small></div>
    </div>

    <section class="panel">
      <h3>Últimas 12 semanas</h3>
      <p class="sub" style="margin:4px 0 14px">Cada casilla es un día. Más azul, más rutina hecha.</p>
      <div class="calendario" style="--semanas:${SEMANAS}">
        ${filasDias.map((l, fila) => `
          <span class="dia-l">${l}</span>
          ${Array.from({ length: SEMANAS }, (_, w) => {
            const d = sumarDias(inicioCal, w * 7 + fila);
            return d > hoy ? '<span class="celda futuro"></span>'
              : `<span class="celda ${nivel(cumplimiento(d))} ${d === hoy ? 'hoy' : ''}" title="${fmtCorta(d)}"></span>`;
          }).join('')}`).join('')}
      </div>
    </section>

    <section class="panel">
      <h3>Pliegue sentado</h3>
      ${medidas.length ? `
        <p class="sub" style="margin-top:4px">Ahora: <b>${MEDIDAS_FLEX[medidas.at(-1).medida]}</b>. Meta: ${MEDIDAS_FLEX.at(-1).toLowerCase()}.</p>
        ${hayChart() ? '<div class="grafico"><canvas id="g-medida"></canvas></div>' : ''}`
      : '<p class="sub" style="margin-top:4px">Aún no has registrado ninguna medida. Hazlo una vez por semana desde la pestaña Hoy.</p>'}
    </section>`;

  if (medidas.length && hayChart()) {
    grafica(cont.querySelector('#g-medida'), {
      type: 'line',
      data: { labels: medidas.map(m => fmtCorta(m.fecha)), datasets: [{
        data: medidas.map(m => m.medida), stepped: true, borderColor: C.electrico, backgroundColor: C.electricoSuave,
        fill: true, borderWidth: 2.5, pointRadius: 4,
      }] },
      options: {
        plugins: { tooltip: { callbacks: { label: c => MEDIDAS_FLEX[c.parsed.y] } } },
        scales: { x: ejeX(), y: ejeY({ min: 0, max: 3, ticks: { stepSize: 1, callback: v => ['Espinilla', 'Tobillo', 'Pies', 'Rodillas'][v] } }) },
      },
    });
  }
  cont.onclick = null;
}

export const TOTAL_FLEX = FLEX.length;
