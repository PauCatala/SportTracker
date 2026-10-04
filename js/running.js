// Bloque RUNNING: pestañas "Semana", "Registrar" y "Progreso".
import { state, supabase, ejecutar, cargarTodo, uid } from './db.js';
import { semanaPlan } from './consultas.js';
import {
  hoyISO, sumarDias, lunesDe, fmtCorta, fmtKg, esc, num, parseTiempo, fmtTiempo, fmtRitmo,
  aviso, mensajeError, requiereConexion,
} from './utils.js';
import { FASES_RUN, SEMANAS_RUN, faseDeSemana, proximoLunes } from './plan.js';
import { bannerMigracion } from './gym.js';
import { grafica, hayChart, ejeX, ejeY, C } from './graficos.js';
import { icono } from './iconos.js';

const TIPOS = { series: 'Series', larga: 'Tirada larga', easy: 'Easy', tempo: 'Tempo' };
const SLOTS = [
  { clave: 'series', titulo: 'Series', tipos: ['series'], plan: f => f.series },
  { clave: 'larga', titulo: 'Tirada larga', tipos: ['larga'], plan: f => f.larga },
  { clave: 'easy', titulo: 'Easy o tempo', tipos: ['easy', 'tempo'], plan: f => f.easy },
];
const ir = vista => window.dispatchEvent(new CustomEvent('navegar', { detail: { bloque: 'running', vista } }));

// ---------- Cálculos ----------
// Ritmo en segundos por km
export function ritmoDe(c) {
  if (c.tipo === 'series' && c.seg_rep && c.metros_rep) return c.seg_rep / (c.metros_rep / 1000);
  if (c.duracion_seg && c.distancia_km) return c.duracion_seg / Number(c.distancia_km);
  return null;
}
// Metros recorridos por cada latido: si sube, tu motor aeróbico mejora
const eficiencia = c => (c.fc_media && c.duracion_seg && c.distancia_km)
  ? (Number(c.distancia_km) * 1000) / (c.duracion_seg / 60) / c.fc_media : null;
const kmDe = c => Number(c.distancia_km) || (c.reps && c.metros_rep ? (c.reps * c.metros_rep) / 1000 : 0);

export function resumen(c) {
  if (c.tipo === 'series' && c.reps) {
    return `${c.reps} × ${c.metros_rep} m a ${fmtRitmo(ritmoDe(c))} /km${c.rec_seg ? `, rec. ${fmtTiempo(c.rec_seg)}` : ''}`;
  }
  const partes = [`${fmtKg(c.distancia_km)} km`];
  if (ritmoDe(c)) partes.push(`a ${fmtRitmo(ritmoDe(c))} /km`);
  if (c.fc_media) partes.push(`${c.fc_media} ppm`);
  return partes.join(', ');
}

// Rango de fechas de una semana del plan
const semanaFechas = n => {
  const ini = sumarDias(state.ajustes.inicio_plan, 7 * (n - 1));
  return [ini, sumarDias(ini, 6)];
};
const carrerasEntre = (a, b) => state.carreras.filter(c => c.fecha >= a && c.fecha <= b);

/* ============================== SEMANA ============================== */
export function renderSemanaRun(cont) {
  const hoy = hoyISO();
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }

  if (!state.ajustes?.inicio_plan) {
    cont.innerHTML = `
      <div class="vacio">
        <h3>¿Cuándo empiezas?</h3>
        <p>Elige la fecha de inicio de tu preparación de 15K. Si cargas el plan en Gimnasio, se pone sola.</p>
        <div style="max-width:240px;margin:16px auto 0"><input type="date" id="r-inicio" value="${proximoLunes(hoy)}"></div>
        <button class="btn primario" id="r-fijar">Empezar el plan</button>
      </div>`;
    cont.onclick = async ev => {
      if (ev.target.id !== 'r-fijar' || !requiereConexion()) return;
      try {
        await ejecutar(supabase.from('ajustes').upsert({ user_id: uid, inicio_plan: cont.querySelector('#r-inicio').value }));
        await cargarTodo();
        renderSemanaRun(cont);
      } catch (e) { aviso(mensajeError(e), 'error'); }
    };
    return;
  }

  const n = semanaPlan(hoy);
  const actual = Math.min(Math.max(n, 1), SEMANAS_RUN);
  const fase = faseDeSemana(actual);
  const [ini, fin] = semanaFechas(actual);
  const hechas = carrerasEntre(ini, fin);

  const hero = n < 1 ? `
      <section class="hero">
        <p class="hero-sup">Preparación 15K</p>
        <h2>Empiezas el ${fmtCorta(state.ajustes.inicio_plan).toLowerCase()}</h2>
        <p>Primera fase: base. Kilómetros cómodos y readaptar.</p>
      </section>`
    : n > SEMANAS_RUN ? `
      <section class="hero">
        <p class="hero-sup">Preparación 15K</p>
        <h2>Plan completado</h2>
        <p>27 semanas hechas. Revisa tu progreso y elige el siguiente objetivo.</p>
      </section>` : `
      <section class="hero">
        <p class="hero-sup">Preparación 15K, objetivo 3:50 /km</p>
        <h2>Fase ${fase.numero}: ${fase.nombre}</h2>
        <div class="hero-semana"><b>Semana ${n}</b><span>de ${SEMANAS_RUN}</span></div>
        <div class="segmentos finos">${Array.from({ length: SEMANAS_RUN }, (_, i) =>
          `<i class="${i + 1 < n ? 'hecho' : i + 1 === n ? 'actual' : ''}"></i>`).join('')}</div>
        <div class="instruccion"><b>Objetivo de la fase.</b> ${fase.objetivo}</div>
        <p>${fase.foco}</p>
      </section>`;

  cont.innerHTML = `
    ${hero}
    <div class="titulo-seccion"><h3>${n >= 1 && n <= SEMANAS_RUN ? 'Esta semana' : `Semana ${actual}`}</h3><span class="tenue">${fmtCorta(ini)} – ${fmtCorta(fin).toLowerCase()}</span></div>
    <div class="sesiones-semana">
      ${SLOTS.map(s => {
        const hecha = hechas.find(c => s.tipos.includes(c.tipo));
        return `
          <div class="sesion-plan ${hecha ? 'hecha' : ''}">
            <span class="icono-estado">${icono(hecha ? 'check' : 'running')}</span>
            <div>
              <h4>${s.titulo}</h4>
              <p>${hecha ? `<span class="hecho-txt">${esc(resumen(hecha))}</span>` : esc(s.plan(fase))}</p>
            </div>
            ${hecha ? `<button class="btn-icono" data-editar="${hecha.id}" aria-label="Editar">${icono('der')}</button>`
              : `<button class="btn chico suave" data-registrar="${s.clave === 'easy' ? (fase.numero === 2 ? 'tempo' : 'easy') : s.clave}">Registrar</button>`}
          </div>`;
      }).join('')}
    </div>

    <div class="titulo-seccion"><h3>Las 27 semanas</h3><span class="tenue">Series, larga y easy</span></div>
    <section class="panel mapa-semanas">
      ${FASES_RUN.map(f => `
        <div class="fase-fila">
          <h4>Fase ${f.numero}: ${f.nombre}<span>semanas ${f.desde}–${f.hasta}</span></h4>
          <div class="puntos-semanas">
            ${Array.from({ length: f.hasta - f.desde + 1 }, (_, k) => {
              const w = f.desde + k;
              const [a, b] = semanaFechas(w);
              const cs = carrerasEntre(a, b);
              return `<span class="semana-pt ${w === n ? 'actual' : ''}" title="Semana ${w}">
                ${SLOTS.map(s => `<i class="${cs.some(c => s.tipos.includes(c.tipo)) ? 'si' : ''}"></i>`).join('')}
              </span>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </section>`;

  cont.onclick = ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.registrar) { reg = { id: null, tipo: b.dataset.registrar, fecha: hoyISO() }; ir('registrar'); }
    if (b.dataset.editar) { editarCarrera(Number(b.dataset.editar)); }
  };
}

function editarCarrera(id) {
  const c = state.carreras.find(x => x.id === id);
  if (!c) return;
  reg = { id, tipo: c.tipo, fecha: c.fecha };
  ir('registrar');
}

/* ============================= REGISTRAR ============================= */
let reg = { id: null, tipo: 'series', fecha: null };

export function renderRegistrarRun(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const c = reg.id ? state.carreras.find(x => x.id === reg.id) : null;
  const fecha = reg.fecha || hoyISO();
  const esSeries = reg.tipo === 'series';
  const n = semanaPlan(fecha);
  const fase = n ? faseDeSemana(Math.min(Math.max(n, 1), SEMANAS_RUN)) : null;
  const toca = fase && (esSeries ? fase.series : reg.tipo === 'larga' ? fase.larga : fase.easy);
  const v = (campo, f = x => x) => (c && c[campo] != null ? esc(f(c[campo])) : '');

  cont.innerHTML = `
    <section class="panel campos">
      <div class="panel-cab">
        <h3>${c ? 'Editar salida' : 'Nueva salida'}</h3>
        ${c ? '<button class="btn-texto" id="c-nueva">Nueva en blanco</button>' : ''}
      </div>
      <div class="chips">${Object.entries(TIPOS).map(([k, t]) =>
        `<button class="chip ${k === reg.tipo ? 'activo' : ''}" data-tipo="${k}">${t}</button>`).join('')}</div>
      ${toca ? `<div class="banner">${icono('running')}<div><b>Esta semana toca:</b> ${esc(toca)}</div></div>` : ''}
      <label class="campo">Fecha <input type="date" id="c-fecha" value="${fecha}"></label>

      ${esSeries ? `
        <div class="campos-2">
          <label class="campo">Repeticiones <input id="c-reps" inputmode="numeric" placeholder="6" value="${v('reps')}"></label>
          <label class="campo">Metros por repetición <input id="c-metros" inputmode="numeric" placeholder="400" value="${v('metros_rep')}"></label>
        </div>
        <div class="chips">${[400, 1000, 1500, 2000].map(m => `<button class="chip" data-metros="${m}">${m} m</button>`).join('')}</div>
        <div class="campos-2">
          <label class="campo">Tiempo medio por rep. <input id="c-seg-rep" inputmode="decimal" placeholder="1:44" value="${v('seg_rep', fmtTiempo)}"></label>
          <label class="campo">Recuperación <input id="c-rec" inputmode="decimal" placeholder="1:30" value="${v('rec_seg', fmtTiempo)}"></label>
        </div>
        <label class="campo">Km totales de la sesión (opcional, con calentamiento)
          <input id="c-km" inputmode="decimal" placeholder="8" value="${v('distancia_km')}"></label>` : `
        <div class="campos-2">
          <label class="campo">Distancia (km) <input id="c-km" inputmode="decimal" placeholder="12" value="${v('distancia_km')}"></label>
          <label class="campo">Tiempo total <input id="c-tiempo" inputmode="decimal" placeholder="1:02:30" value="${v('duracion_seg', fmtTiempo)}"></label>
        </div>`}

      <div class="campos-2">
        <label class="campo">Pulso medio (ppm) <input id="c-fcm" inputmode="numeric" placeholder="145" value="${v('fc_media')}"></label>
        <label class="campo">Pulso máximo (ppm) <input id="c-fcx" inputmode="numeric" placeholder="172" value="${v('fc_max')}"></label>
      </div>

      <div class="ritmo-vivo" id="c-ritmo"></div>

      <label class="campo">Notas <textarea id="c-notas" rows="2" placeholder="Sensaciones, terreno, molestias…">${v('notas')}</textarea></label>
      <div class="acciones-sesion">
        <button class="btn primario" id="c-guardar">${c ? 'Guardar cambios' : 'Guardar salida'}</button>
        ${c ? `<button class="btn peligro" id="c-borrar" aria-label="Borrar salida">${icono('papelera')}</button>` : ''}
      </div>
    </section>
    <p class="tenue" style="text-align:center">Cuando tengas reloj, conectaremos Strava para que las salidas se registren solas.</p>`;

  const $ = id => cont.querySelector('#' + id);
  const leer = () => {
    const d = {
      fecha: $('c-fecha').value || hoyISO(), tipo: reg.tipo,
      fc_media: num($('c-fcm').value) || null, fc_max: num($('c-fcx').value) || null,
      notas: $('c-notas').value.trim() || null,
      distancia_km: num($('c-km').value) || null,
    };
    if (esSeries) Object.assign(d, {
      reps: num($('c-reps').value) || null, metros_rep: num($('c-metros').value) || null,
      seg_rep: parseTiempo($('c-seg-rep').value) || null, rec_seg: parseTiempo($('c-rec').value) || null,
      duracion_seg: null,
    });
    else Object.assign(d, { duracion_seg: parseTiempo($('c-tiempo').value, 'min') || null, reps: null, metros_rep: null, seg_rep: null, rec_seg: null });
    return d;
  };
  const pintarRitmo = () => {
    const d = leer();
    const r = ritmoDe(d);
    const ef = eficiencia(d);
    $('c-ritmo').innerHTML = `
      <div><small>Ritmo${esSeries ? ' medio de las repeticiones' : ''}</small><div class="ritmo-grande">${fmtRitmo(r)}<small> /km</small></div></div>
      <div style="text-align:right"><small>${r ? `${fmtKg((3600 / r).toFixed(1))} km/h` : ''}</small>
        ${ef ? `<br><small>${fmtKg(ef.toFixed(2))} m por latido</small>` : ''}</div>`;
  };
  pintarRitmo();

  cont.oninput = pintarRitmo;
  cont.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.tipo) { reg = { ...reg, tipo: b.dataset.tipo, fecha: $('c-fecha').value }; return renderRegistrarRun(cont); }
    if (b.dataset.metros) { $('c-metros').value = b.dataset.metros; return pintarRitmo(); }
    if (b.id === 'c-nueva') { reg = { id: null, tipo: reg.tipo, fecha: hoyISO() }; return renderRegistrarRun(cont); }

    if (b.id === 'c-guardar') {
      const d = leer();
      if (esSeries && !(d.reps && d.metros_rep && d.seg_rep)) return aviso('Pon repeticiones, metros y tiempo por repetición', 'error');
      if (!esSeries && !(d.distancia_km && d.duracion_seg)) return aviso('Pon la distancia y el tiempo total', 'error');
      if (!requiereConexion()) return;
      b.disabled = true;
      try {
        if (reg.id) await ejecutar(supabase.from('carreras').update(d).eq('id', reg.id));
        else await ejecutar(supabase.from('carreras').insert(d));
        await cargarTodo();
        aviso(reg.id ? 'Salida guardada' : `Salida guardada: ${resumen(d)}`);
        reg = { id: null, tipo: reg.tipo, fecha: null };
        ir('semana');
      } catch (e) { aviso(mensajeError(e), 'error'); b.disabled = false; }
    }
    if (b.id === 'c-borrar') {
      if (!confirm('¿Borrar esta salida?') || !requiereConexion()) return;
      try {
        await ejecutar(supabase.from('carreras').delete().eq('id', reg.id));
        await cargarTodo();
        aviso('Salida borrada');
        reg = { id: null, tipo: reg.tipo, fecha: null };
        ir('progreso');
      } catch (e) { aviso(mensajeError(e), 'error'); }
    }
  };
}

/* ============================== PROGRESO ============================== */
let vistaRodajes = 'ritmo';

export function renderProgresoRun(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const carreras = state.carreras;
  if (!carreras.length) {
    cont.innerHTML = `<div class="vacio"><h3>Aún no hay salidas</h3><p>Registra tu primera carrera y aquí verás ritmos, pulso y kilómetros.</p>
      <button class="btn primario" id="ir-reg">Registrar salida</button></div>`;
    cont.onclick = ev => ev.target.closest('#ir-reg') && ir('registrar');
    return;
  }
  const hoy = hoyISO();
  const kmSemana = carrerasEntre(lunesDe(hoy), sumarDias(lunesDe(hoy), 6)).reduce((t, c) => t + kmDe(c), 0);
  const kmMes = carrerasEntre(hoy.slice(0, 8) + '01', hoy).reduce((t, c) => t + kmDe(c), 0);
  const rodajes = carreras.filter(c => c.tipo !== 'series' && ritmoDe(c));
  const ultimoRodaje = rodajes.at(-1);
  const series = carreras.filter(c => c.tipo === 'series' && ritmoDe(c));

  cont.innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>Esta semana</span><b>${fmtKg(kmSemana.toFixed(1))}</b><small>km</small></div>
      <div class="kpi"><span>Este mes</span><b>${fmtKg(kmMes.toFixed(1))}</b><small>km</small></div>
      <div class="kpi"><span>Último rodaje</span><b>${ultimoRodaje ? fmtRitmo(ritmoDe(ultimoRodaje)) : '–'}</b><small>${ultimoRodaje?.fc_media ? `/km a ${ultimoRodaje.fc_media} ppm` : '/km'}</small></div>
    </div>

    <section class="panel">
      <h3>Kilómetros por semana</h3>
      <div class="grafico"><canvas id="g-km"></canvas></div>
    </section>

    ${series.length ? `
    <section class="panel">
      <h3>Ritmo de las series</h3>
      <p class="sub" style="margin-top:4px">Ritmo medio de las repeticiones, separado por distancia. Más arriba es más rápido.</p>
      <div class="grafico"><canvas id="g-series"></canvas></div>
      <div class="leyenda-grafico" id="ley-series"></div>
    </section>` : ''}

    ${rodajes.length ? `
    <section class="panel">
      <h3>Rodajes: easy, larga y tempo</h3>
      <div class="segmento" style="margin-top:12px">
        <button data-vr="ritmo" class="${vistaRodajes === 'ritmo' ? 'activo' : ''}">Ritmo y pulso</button>
        <button data-vr="eficiencia" class="${vistaRodajes === 'eficiencia' ? 'activo' : ''}">Eficiencia</button>
      </div>
      <div class="grafico"><canvas id="g-rodajes"></canvas></div>
      ${vistaRodajes === 'ritmo' ? `
        <div class="leyenda-grafico"><span><i style="background:${C.electrico}"></i>Ritmo /km</span><span><i style="background:${C.pervinca}"></i>Pulso medio</span></div>
        <p class="nota-grafico">Lo que buscas en los rodajes suaves: el mismo ritmo con menos pulsaciones, o más rápido con las mismas.</p>`
      : '<p class="nota-grafico">Metros que avanzas por cada latido. Si la línea sube, tu base aeróbica mejora. Necesita el pulso medio de cada salida.</p>'}
    </section>` : ''}

    <section class="panel">
      <h3>Últimas salidas</h3>
      <div class="lista-carreras" style="margin-top:6px">
        ${[...carreras].reverse().slice(0, 20).map(c => `
          <button class="carrera-item" data-editar="${c.id}">
            <span><b>${TIPOS[c.tipo]}</b><br><span class="tenue">${fmtCorta(c.fecha)}</span></span>
            <span class="derecha">${esc(resumen(c))}</span>
          </button>`).join('')}
      </div>
    </section>`;

  cont.onclick = ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.vr) { vistaRodajes = b.dataset.vr; return renderProgresoRun(cont); }
    if (b.dataset.editar) editarCarrera(Number(b.dataset.editar));
  };
  if (hayChart()) dibujarRun(cont, carreras, series, rodajes);
}

function dibujarRun(cont, carreras, series, rodajes) {
  // Km por semana
  const porSemana = new Map();
  carreras.forEach(c => porSemana.set(lunesDe(c.fecha), (porSemana.get(lunesDe(c.fecha)) || 0) + kmDe(c)));
  const semanas = [...porSemana.keys()].sort();
  grafica(cont.querySelector('#g-km'), {
    type: 'bar',
    data: { labels: semanas.map(fmtCorta), datasets: [{ data: semanas.map(w => +porSemana.get(w).toFixed(1)), backgroundColor: C.electrico, borderRadius: 6, maxBarThickness: 26 }] },
    options: {
      plugins: { tooltip: { callbacks: { title: i => `Semana del ${i[0].label.toLowerCase()}`, label: c => `${fmtKg(c.parsed.y)} km` } } },
      scales: { x: ejeX(), y: ejeY({ beginAtZero: true, title: { display: true, text: 'km' } }) },
    },
  });

  const ejeRitmo = extra => ejeY({ reverse: true, ticks: { callback: v => fmtTiempo(v) }, title: { display: true, text: 'min/km' }, ...extra });

  // Series, una línea por distancia
  if (series.length) {
    const fechas = [...new Set(series.map(c => c.fecha))].sort();
    const distancias = [...new Set(series.map(c => c.metros_rep))].sort((a, b) => a - b);
    const tonos = [C.electrico, '#6F68E0', C.pervinca, C.tinta2];
    grafica(cont.querySelector('#g-series'), {
      type: 'line',
      data: {
        labels: fechas.map(fmtCorta),
        datasets: distancias.map((m, k) => ({
          label: `${m} m`,
          data: fechas.map(f => { const c = series.find(x => x.fecha === f && x.metros_rep === m); return c ? Math.round(ritmoDe(c)) : null; }),
          borderColor: tonos[k % tonos.length], backgroundColor: tonos[k % tonos.length],
          borderWidth: 2.5, pointRadius: 4, tension: .25, spanGaps: true,
        })),
      },
      options: {
        plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtTiempo(c.parsed.y)} /km` } } },
        scales: { x: ejeX(), y: ejeRitmo() },
      },
    });
    cont.querySelector('#ley-series').innerHTML = distancias.map((m, k) => `<span><i style="background:${tonos[k % tonos.length]}"></i>${m} m</span>`).join('');
  }

  // Rodajes
  if (rodajes.length) {
    const etiquetas = rodajes.map(c => fmtCorta(c.fecha));
    if (vistaRodajes === 'ritmo') {
      grafica(cont.querySelector('#g-rodajes'), {
        type: 'line',
        data: { labels: etiquetas, datasets: [
          { label: 'Ritmo', data: rodajes.map(c => Math.round(ritmoDe(c))), yAxisID: 'y', borderColor: C.electrico, backgroundColor: C.electrico, borderWidth: 2.5, pointRadius: 4, tension: .25 },
          { label: 'Pulso', data: rodajes.map(c => c.fc_media || null), yAxisID: 'y1', borderColor: C.pervinca, backgroundColor: C.pervinca, borderWidth: 2.5, pointRadius: 4, tension: .25, spanGaps: true },
        ] },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { callbacks: {
            label: c => c.dataset.yAxisID === 'y' ? `Ritmo: ${fmtTiempo(c.parsed.y)} /km` : `Pulso: ${c.parsed.y} ppm`,
            footer: items => TIPOS[rodajes[items[0].dataIndex].tipo],
          } } },
          scales: { x: ejeX(), y: ejeRitmo(), y1: ejeY({ position: 'right', grid: { display: false }, title: { display: true, text: 'ppm' } }) },
        },
      });
    } else {
      const conFc = rodajes.filter(eficiencia);
      grafica(cont.querySelector('#g-rodajes'), {
        type: 'line',
        data: { labels: conFc.map(c => fmtCorta(c.fecha)), datasets: [{
          data: conFc.map(c => +eficiencia(c).toFixed(2)), borderColor: C.electrico, backgroundColor: C.electricoSuave,
          fill: true, borderWidth: 2.5, pointRadius: 4, tension: .25,
        }] },
        options: {
          plugins: { tooltip: { callbacks: { label: c => `${fmtKg(c.parsed.y)} m por latido`, footer: items => resumen(conFc[items[0].dataIndex]) } } },
          scales: { x: ejeX(), y: ejeY({ title: { display: true, text: 'm por latido' } }) },
        },
      });
    }
  }
}
