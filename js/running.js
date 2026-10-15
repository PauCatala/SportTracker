// RUNNING: una plataforma de entreno completa y sencilla.
//  - Hoy: qué toca cada día y cómo hacerlo (series con su tiempo exacto, ritmos, calentamiento…).
//  - Test de nivel al empezar (y cada 6 semanas): de él salen tus ritmos.
//  - El plan se adapta cada semana a lo que haces (motor en running/motor.js).
//  - Historial: todas tus salidas, editables (tipo, día, distancia, tiempo, series, pulso, esfuerzo).
import { state, supabase, ejecutar, cargarTodo } from './db.js';
import { leer, guardar } from './almacen.js';
import {
  hoyISO, sumarDias, lunesDe, fmtCorta, fmtKg, esc, num, parseTiempo, fmtTiempo, fmtRitmo,
  aviso, mensajeError, requiereConexion, capitalizar,
} from './utils.js';
import { bannerMigracion } from './gym.js';
import { grafica, hayChart, ejeX, ejeY, C } from './graficos.js';
import { icono } from './iconos.js';
import { abrirModal } from './interaccion.js';
import {
  OBJETIVOS, VOLUMENES, FASES, perfilRun, guardarPerfil, semanaConCambios, adaptar, emparejar, vdotDe, prevision,
  ritmos, vdotActual, lunes, sumar, datosPlan, semanaDe, fmtKm, historia,
} from './running/motor.js';

const TIPOS = { easy: 'Rodaje suave', larga: 'Tirada larga', series: 'Series', tempo: 'Umbral / tempo' };
const ir = vista => window.dispatchEvent(new CustomEvent('navegar', { detail: { bloque: 'running', vista } }));
const extras = () => leer('run-extra', {});
const guardarExtra = (id, datos) => { const e = extras(); e[id] = { ...(e[id] || {}), ...datos }; guardar('run-extra', e); };
const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaDe = f => new Date(`${f}T12:00`).getDay();

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
  if (c.duracion_seg) partes.push(fmtTiempo(c.duracion_seg));
  if (ritmoDe(c)) partes.push(`${fmtRitmo(ritmoDe(c))} /km`);
  if (c.fc_media) partes.push(`${c.fc_media} ppm`);
  return partes.join(' · ');
}
const carrerasEntre = (a, b) => state.carreras.filter(c => c.fecha >= a && c.fecha <= b);

/* ============================== HOY ============================== */
let diaSel = null;   // día elegido en la tira de la semana

export function renderSemanaRun(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const p = perfilRun();
  if (!p?.inicio) return renderAlta(cont);
  const hoy = hoyISO();
  // Planes creados antes de tener en cuenta tu historial: se completa una vez
  if (p.largaBase === undefined) { const h = historia(state.carreras, hoy); p.largaBase = h.larga; p.volumen = Math.max(p.volumen || 0, Math.round(h.volumen)); guardarPerfil(p); }
  const ajuste = adaptar(p, hoy, state.carreras, extras());
  const lun = lunes(hoy);
  const sem = semanaConCambios(p, lun);
  const d = datosPlan(p);
  if (!sem) return renderFueraDePlan(cont, p, d);
  if (!diaSel || diaSel < lun || diaSel > sumar(lun, 6)) diaSel = hoy;
  const hechas = emparejar(sem.sesiones, state.carreras, extras());
  const delDia = sem.sesiones.filter(s => s.fecha === diaSel);
  const r = sem.ritmos;
  const prev = prevision(sem.vdot, d.obj.metros);
  const fase = FASES[sem.fase];

  cont.innerHTML = `
    <div class="rn">
      <header class="rn-cab">
        <div><small>Objetivo</small><b>${esc(d.obj.nombre)}</b>${p.objetivo !== 'forma' ? `<span>Previsión ${fmtTiempo(prev)}</span>` : ''}</div>
        <div><small>Semana</small><b>${sem.n}<i> / ${sem.total}</i></b><span>${fase.nombre}</span></div>
        <div><small>Esta semana</small><b>${fmtKm(sem.vol)}<i> km</i></b><span>${sem.sesiones.length} salidas</span></div>
        <button class="rn-icono" data-a="ajustes" aria-label="Cambiar objetivo, días o nivel">${icono('ajustes')}</button>
      </header>

      <nav class="rn-dias" aria-label="Días de esta semana">
        ${DIAS.map(([dow, l]) => {
          const f = sumar(lun, (dow + 6) % 7);
          const s = sem.sesiones.find(x => x.fecha === f);
          const hecha = s && hechas.get(s.id);
          return `<button class="rn-dia ${f === diaSel ? 'sel' : ''} ${f === hoy ? 'hoy' : ''} ${s ? `con ${s.slot.replace(/\d/, '')}` : ''} ${hecha ? 'hecha' : ''} ${s && !hecha && f < hoy ? 'falta' : ''}" data-dia="${f}">
            <small>${l}</small><b>${Number(f.slice(8))}</b><i>${hecha ? icono('check') : ''}</i></button>`;
        }).join('')}
      </nav>

      ${delDia.length ? delDia.map(s => tarjetaSesion(s, hechas.get(s.id), diaSel === hoy)).join('') : tarjetaDescanso(sem, diaSel, hoy, hechas)}

      ${ajuste && sem.n > 1 ? `<p class="rn-adapta">${icono('rayo')}<span><b>Tu plan se ha ajustado.</b> ${esc(ajuste.motivo)}</span></p>` : ''}

      <section class="rn-ritmos">
        <div class="rn-tit"><h3>Tus ritmos</h3><button class="btn-texto" data-a="test">Hacer un test</button></div>
        <div class="rn-chips">
          ${chipRitmo('Suave', `${fmtTiempo(r.suaveMin)}–${fmtTiempo(r.suaveMax)}`, 'easy')}
          ${chipRitmo('Umbral', fmtTiempo(r.umbral), 'tempo')}
          ${chipRitmo('Series', fmtTiempo(r.series), 'series')}
          ${p.objetivo !== 'forma' ? chipRitmo(`Ritmo ${d.obj.nombre}`, fmtTiempo(prev / (d.obj.metros / 1000)), 'carrera') : ''}
        </div>
        <p class="rn-nivel">Nivel (VDOT) <b>${sem.vdot.toFixed(1)}</b> · ${p.tests?.length ? `último test el ${fmtCorta(p.tests.at(-1).fecha).toLowerCase()}` : 'aún sin test: los ritmos son orientativos'}</p>
      </section>

      <section class="rn-semana">
        <div class="rn-tit"><h3>La semana</h3><button class="btn-texto" data-a="ajustes">Ajustar plan</button></div>
        <p class="rn-foco">${fase.nombre}: ${fase.foco}</p>
        <ul>${sem.sesiones.map(s => {
          const c = hechas.get(s.id);
          return `<li class="${c ? 'hecha' : s.fecha < hoy ? 'falta' : ''}"><button data-dia="${s.fecha}">
            <span class="rn-pt ${s.slot.replace(/\d/, '')}"></span>
            <span class="rn-li-dia">${capitalizar(NOMBRE_DIA[diaDe(s.fecha)]).slice(0, 3)}</span>
            <b>${esc(s.tituloPropio || s.titulo)}</b><span class="rn-li-clave">${esc(s.clave)}</span>
            <em>${c ? icono('check') : `${fmtKm(s.km)} km`}</em></button></li>`;
        }).join('')}</ul>
      </section>
    </div>`;

  cont.onclick = ev => {
    const b = ev.target.closest('[data-dia],[data-a],[data-registrar],[data-hecho],[data-editar]');
    if (!b) return;
    if (b.dataset.dia) { diaSel = b.dataset.dia; return renderSemanaRun(cont); }
    const s = sem.sesiones.find(x => x.id === (b.dataset.registrar || b.dataset.hecho));
    if (b.dataset.registrar && s) return s.test ? abrirTest(cont, s) : abrirSalida({ sesion: s, fecha: s.fecha }, () => renderSemanaRun(cont));
    if (b.dataset.hecho && s) return hechoTalCual(s, () => renderSemanaRun(cont));
    if (b.dataset.editar) return abrirSalida({ id: Number(b.dataset.editar) }, () => renderSemanaRun(cont));
    if (b.dataset.a === 'ajustes') return renderAlta(cont, p);
    if (b.dataset.a === 'test') return abrirTest(cont);
  };
}

const chipRitmo = (nombre, valor, tipo) => `<div class="rn-chip ${tipo}"><small>${nombre}</small><b>${valor}<i> /km</i></b></div>`;

// La sesión del día, con lo esencial en grande
function tarjetaSesion(s, hecha, esHoy) {
  const cuando = esHoy ? 'Hoy' : capitalizar(NOMBRE_DIA[diaDe(s.fecha)]);
  return `
    <article class="rn-hoy ${s.slot.replace(/\d/, '')} ${hecha ? 'hecha' : ''}">
      <p class="rn-cuando">${cuando} · ${s.inicio}</p>
      <h2>${esc(s.tituloPropio || s.titulo)}</h2>
      <div class="rn-clave">${esc(s.clave)}</div>
      <p class="rn-detalle">${esc(s.detalle)}</p>
      <ol class="rn-pasos">${s.pasos.map(x => `
        <li class="${x.fuerte ? 'fuerte' : ''}"><b>${esc(x.que)}</b><span>${esc(x.cuanto)}</span>${x.ritmo ? `<em>${esc(x.ritmo)}</em>` : ''}</li>`).join('')}
      </ol>
      <p class="rn-nota">${esc(s.nota)}</p>
      <p class="rn-total">≈ ${fmtKm(s.km)} km · ${s.min} min</p>
      ${hecha ? `
        <div class="rn-hecho"><span>${icono('check')}<b>Hecho</b> ${esc(resumen(hecha))}</span>
          <button class="btn suave chico" data-editar="${hecha.id}">Editar</button></div>`
      : `<div class="rn-acciones">
          <button class="btn primario" data-registrar="${s.id}">${s.test ? 'Anotar resultado' : 'Registrar'}</button>
          ${s.test ? '' : `<button class="btn suave" data-hecho="${s.id}">Hecho tal cual</button>`}
        </div>`}
    </article>`;
}
function tarjetaDescanso(sem, dia, hoy, hechas) {
  const sig = sem.sesiones.find(s => s.fecha > dia && !hechas.get(s.id));
  return `
    <article class="rn-hoy descanso">
      <p class="rn-cuando">${dia === hoy ? 'Hoy' : capitalizar(NOMBRE_DIA[diaDe(dia)])}</p>
      <h2>Descanso</h2>
      <p class="rn-detalle">Recuperar también es entrenar: es cuando el cuerpo asimila el trabajo. Si te apetece moverte, paseo o movilidad suave.</p>
      ${sig ? `<p class="rn-sig">Siguiente: <b>${capitalizar(NOMBRE_DIA[diaDe(sig.fecha)])}</b>, ${esc(sig.titulo.toLowerCase())} · ${esc(sig.clave)}</p>` : ''}
    </article>`;
}

// Registrar la sesión tal y como estaba prevista (un toque)
async function hechoTalCual(s, despues) {
  if (!requiereConexion()) return;
  const d = { fecha: s.fecha, tipo: s.tipo, distancia_km: Math.round(s.km * 10) / 10, duracion_seg: s.min * 60, fc_media: null, fc_max: null, notas: null };
  if (s.tipo === 'series' && s.objetivo) Object.assign(d, { reps: s.objetivo.reps, metros_rep: s.objetivo.metros, seg_rep: s.objetivo.seg, rec_seg: s.objetivo.rec, duracion_seg: null });
  try {
    const nueva = await ejecutar(supabase.from('carreras').insert(d).select('id').single());
    guardarExtra(nueva.id, { plan: s.id });
    await cargarTodo();
    aviso(`¡Hecho! ${s.titulo}: ${s.clave}`);
    despues?.();
  } catch (e) { aviso(mensajeError(e), 'error'); }
}

/* ============================== ALTA DEL PLAN ============================== */
// Tres pasos en una sola pantalla: objetivo, tu nivel y tu semana
function renderAlta(cont, previo = null) {
  const hoy = hoyISO();
  const v = previo || { objetivo: '10k', dias: [2, 4, 0], volumen: 15, nivel: 'test' };
  let nivel = previo ? (previo.principiante ? 'empiezo' : previo.tests?.length ? 'marca' : 'test') : 'test';
  const t0 = previo?.tests?.at(-1);
  cont.innerHTML = `
    <div class="rn rn-alta">
      <header class="rn-alta-cab">
        <h2>${previo ? 'Tu plan de running' : 'Vamos a crear tu plan'}</h2>
        <p>${previo ? 'Cambia lo que quieras: el plan se recalcula al momento.' : 'Tres preguntas y tendrás un plan que se adapta a ti semana a semana.'}</p>
      </header>
      <form class="rn-form" novalidate>
        <fieldset><legend><span>1</span>¿Cuál es tu objetivo?</legend>
          <div class="rn-opc">${Object.entries(OBJETIVOS).map(([k, o]) => `<label><input type="radio" name="objetivo" value="${k}" ${v.objetivo === k ? 'checked' : ''}><span>${o.nombre}</span></label>`).join('')}</div>
          <label class="campo rn-carrera">Fecha de la carrera <small>(opcional)</small><input type="date" name="carrera" min="${sumarDias(hoy, 28)}" value="${v.carrera || ''}"></label>
        </fieldset>
        <fieldset><legend><span>2</span>¿Cuál es tu nivel?</legend>
          <div class="rn-opc grande">
            <label><input type="radio" name="nivel" value="marca" ${nivel === 'marca' ? 'checked' : ''}><span><b>Tengo una marca reciente</b><small>De los últimos 2 meses</small></span></label>
            <label><input type="radio" name="nivel" value="test" ${nivel === 'test' ? 'checked' : ''}><span><b>Haré el test</b><small>5 km a tope la primera semana</small></span></label>
            <label><input type="radio" name="nivel" value="empiezo" ${nivel === 'empiezo' ? 'checked' : ''}><span><b>Estoy empezando</b><small>Test sencillo de 12 minutos</small></span></label>
          </div>
          <div class="rn-marca">
            <label class="campo">Distancia <select name="mDist">${[[5000, '5 km'], [10000, '10 km'], [15000, '15 km'], [21097, 'Media maratón'], [42195, 'Maratón']].map(([m, n]) => `<option value="${m}" ${t0?.metros === m ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="campo">Tiempo <input name="mTiempo" inputmode="numeric" placeholder="24:30" value="${t0?.segundos ? fmtTiempo(t0.segundos) : ''}"></label>
          </div>
        </fieldset>
        <fieldset><legend><span>3</span>Tu semana</legend>
          <p class="rn-ayuda">¿Qué días puedes correr? Elige entre 3 y 5.</p>
          <div class="rn-diasel">${DIAS.map(([n, l]) => `<label><input type="checkbox" name="dias" value="${n}" ${v.dias.includes(n) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
          <p class="rn-ayuda">¿Cuánto corres ahora por semana?</p>
          <div class="rn-opc">${VOLUMENES.map(([k, n]) => `<label><input type="radio" name="volumen" value="${k}" ${Math.abs((v.volumen || 15) - k) < 4 ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
        </fieldset>
        <p class="error" id="rn-error"></p>
        <div class="rn-alta-acciones">
          ${previo ? '<button type="button" class="btn suave" data-a="cancelar">Cancelar</button>' : ''}
          <button class="btn primario" type="submit">${previo ? 'Guardar cambios' : 'Crear mi plan'}</button>
        </div>
      </form>
    </div>`;
  const form = cont.querySelector('form');
  const sync = () => form.classList.toggle('con-marca', form.elements.nivel.value === 'marca');
  form.addEventListener('change', sync); sync();
  cont.onclick = ev => { if (ev.target.closest('[data-a=cancelar]')) renderSemanaRun(cont); };
  form.onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(form);
    const dias = f.getAll('dias').map(Number);
    const err = cont.querySelector('#rn-error');
    if (dias.length < 3 || dias.length > 5) { err.textContent = 'Elige entre 3 y 5 días.'; return; }
    const nv = f.get('nivel');
    const h = historia(state.carreras, hoy);
    const p = {
      ...(previo || {}), objetivo: f.get('objetivo'), carrera: f.get('carrera') || null, dias,
      volumen: Math.max(Number(f.get('volumen')), Math.round(h.volumen)), largaBase: h.larga || previo?.largaBase || 0,
      principiante: nv === 'empiezo', inicio: previo?.inicio || lunes(hoy), tests: previo?.tests || [],
    };
    if (nv === 'marca') {
      const seg = parseTiempo(f.get('mTiempo'), 'min'), metros = Number(f.get('mDist'));
      if (!(seg > 0)) { err.textContent = 'Escribe tu tiempo, por ejemplo 24:30 o 1:52:00.'; return; }
      const ultimo = p.tests.at(-1);
      if (!ultimo || ultimo.segundos !== seg || ultimo.metros !== metros) p.tests = [...p.tests, { fecha: hoy, tipo: 'marca', metros, segundos: seg, vdot: vdotDe(metros, seg) }];
    }
    // Si cambian los días, los cambios fijos del calendario dejan de valer
    if (previo && JSON.stringify(previo.dias) !== JSON.stringify(dias)) {
      const cal = leer('cal-ajustes', {}); if (cal.run) { delete cal.run; guardar('cal-ajustes', cal); }
    }
    guardarPerfil(p);
    aviso(previo ? 'Plan actualizado' : 'Tu plan está listo');
    diaSel = null;
    renderSemanaRun(cont);
  };
}

function renderFueraDePlan(cont, p, d) {
  const hoy = hoyISO();
  const terminado = semanaDe(p, hoy) > d.total;
  cont.innerHTML = `
    <div class="rn"><article class="rn-hoy descanso">
      <p class="rn-cuando">${terminado ? 'Plan completado' : 'Aún no ha empezado'}</p>
      <h2>${terminado ? '¡Enhorabuena!' : `Empiezas el ${fmtCorta(p.inicio).toLowerCase()}`}</h2>
      <p class="rn-detalle">${terminado ? `Has terminado tu plan de ${esc(d.obj.nombre.toLowerCase())}. Haz un test y elige tu siguiente objetivo.` : 'Te avisaremos con tu primera sesión.'}</p>
      <div class="rn-acciones"><button class="btn primario" data-a="nuevo">${terminado ? 'Nuevo objetivo' : 'Cambiar el plan'}</button></div>
    </article></div>`;
  cont.onclick = ev => {
    if (!ev.target.closest('[data-a=nuevo]')) return;
    renderAlta(cont, terminado ? { ...p, inicio: lunes(hoy), carrera: null } : p);
  };
}

/* ============================== TEST ============================== */
function abrirTest(cont, sesion = null) {
  const p = perfilRun();
  const hoy = hoyISO();
  abrirModal({
    titulo: 'Test de nivel',
    subtitulo: 'Running',
    contenido: `
      <form class="ev-form rn-test" novalidate>
        <p class="rn-ayuda">Con tu resultado calculamos tus ritmos de entrenamiento. Repítelo cada 6 semanas para ver cuánto mejoras.</p>
        <div class="rn-opc grande">
          <label><input type="radio" name="tipo" value="5k" ${!p?.principiante ? 'checked' : ''}><span><b>5 km a tope</b><small>Anota tu tiempo</small></span></label>
          <label><input type="radio" name="tipo" value="12min" ${p?.principiante ? 'checked' : ''}><span><b>12 minutos</b><small>Anota los metros</small></span></label>
          <label><input type="radio" name="tipo" value="marca"><span><b>Una carrera reciente</b><small>Distancia y tiempo</small></span></label>
        </div>
        <div class="ev-fila">
          <label class="campo rn-t-dist">Distancia <select name="dist">${[[5000, '5 km'], [10000, '10 km'], [21097, 'Media maratón'], [42195, 'Maratón']].map(([m, n]) => `<option value="${m}">${n}</option>`).join('')}</select></label>
          <label class="campo rn-t-tiempo">Tiempo <input name="tiempo" inputmode="numeric" placeholder="24:30"></label>
          <label class="campo rn-t-metros">Metros en 12 min <input name="metros" inputmode="numeric" placeholder="2400"></label>
          <label class="campo">Día <input type="date" name="fecha" value="${sesion?.fecha && sesion.fecha <= hoy ? sesion.fecha : hoy}"></label>
        </div>
        <p class="rn-prev"></p>
        <p class="error"></p>
        <div class="ev-acciones fin"><button type="button" class="btn suave" data-cerrar-modal>Cancelar</button><button class="btn primario" type="submit">Guardar resultado</button></div>
      </form>`,
    alAbrir: (cuerpo, cerrar) => {
      const form = cuerpo.querySelector('form');
      const calc = () => {
        const tipo = form.elements.tipo.value;
        form.dataset.tipo = tipo;
        let metros, seg;
        if (tipo === '12min') { metros = num(form.elements.metros.value); seg = 720; }
        else { metros = tipo === '5k' ? 5000 : Number(form.elements.dist.value); seg = parseTiempo(form.elements.tiempo.value, 'min'); }
        const ok = metros > 400 && seg > 0;
        const vd = ok ? vdotDe(metros, seg) : null;
        const r = vd ? ritmos(vd) : null;
        cuerpo.querySelector('.rn-prev').innerHTML = r ? `Tu nivel: <b>${vd.toFixed(1)}</b> · suave ${fmtTiempo(r.suave)}, umbral ${fmtTiempo(r.umbral)}, series ${fmtTiempo(r.series)} /km` : '';
        return ok ? { metros, seg, vd } : null;
      };
      form.addEventListener('input', calc); form.addEventListener('change', calc); calc();
      form.onsubmit = async ev => {
        ev.preventDefault();
        const x = calc();
        if (!x) { cuerpo.querySelector('.error').textContent = 'Completa el resultado del test.'; return; }
        const f = form.elements.fecha.value || hoy;
        const pp = perfilRun();
        pp.tests = [...(pp.tests || []), { fecha: f, tipo: form.elements.tipo.value, metros: x.metros, segundos: x.seg, vdot: x.vd }];
        guardarPerfil(pp);
        // También queda como salida en tu historial
        if (navigator.onLine) {
          try {
            const nueva = await ejecutar(supabase.from('carreras').insert({ fecha: f, tipo: 'tempo', fuente: 'test', distancia_km: Math.round(x.metros / 10) / 100, duracion_seg: Math.round(x.seg), notas: 'Test de nivel' }).select('id').single());
            if (sesion) guardarExtra(nueva.id, { plan: sesion.id });
            await cargarTodo();
          } catch (e) { console.warn(e); }
        }
        await cerrar();
        aviso(`Nivel ${x.vd.toFixed(1)}: tus ritmos están actualizados`);
        renderSemanaRun(cont);
      };
    },
  });
}

/* ============================== REGISTRAR / EDITAR UNA SALIDA ============================== */
// { id } edita una salida; { sesion, fecha } registra la de una sesión del plan (rellena lo previsto)
export function abrirSalida({ id = null, sesion = null, fecha = null } = {}, despues) {
  const c = id ? state.carreras.find(x => x.id === id) : null;
  const ex = c ? extras()[c.id] || {} : {};
  let tipo = c?.tipo || sesion?.tipo || 'easy';
  const obj = sesion?.objetivo;
  const val = (campo, f = x => x) => (c && c[campo] != null ? esc(f(c[campo])) : '');
  const plan = (v, f = x => x) => (v != null ? esc(f(v)) : '');
  abrirModal({
    titulo: c ? 'Editar salida' : sesion ? esc(sesion.titulo) : 'Nueva salida',
    subtitulo: 'Running',
    contenido: `
      <form class="ev-form rn-salida" novalidate data-tipo="${tipo}">
        ${sesion ? `<p class="rn-ayuda">Previsto: <b>${esc(sesion.clave)}</b> · ${esc(sesion.detalle)}</p>` : ''}
        <div class="rn-opc">${Object.entries(TIPOS).map(([k, n]) => `<label><input type="radio" name="tipo" value="${k}" ${k === tipo ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
        <div class="ev-fila rn-f3">
          <label class="campo">Día <input type="date" name="fecha" value="${c?.fecha || fecha || hoyISO()}"></label>
          <label class="campo">Distancia (km) <input name="km" inputmode="decimal" placeholder="${sesion ? fmtKm(sesion.km) : '8'}" value="${val('distancia_km')}"></label>
          <label class="campo rn-s-no">Tiempo total <input name="tiempo" inputmode="numeric" placeholder="${sesion ? fmtTiempo(sesion.min * 60) : '45:00'}" value="${val('duracion_seg', fmtTiempo)}"></label>
        </div>
        <div class="ev-fila rn-s-si rn-f4">
          <label class="campo">Repeticiones <input name="reps" inputmode="numeric" value="${val('reps') || plan(obj?.reps)}"></label>
          <label class="campo">Metros <input name="metros" inputmode="numeric" value="${val('metros_rep') || plan(obj?.metros)}"></label>
          <label class="campo">Tiempo por rep. <input name="segRep" inputmode="numeric" placeholder="${obj ? fmtTiempo(obj.seg) : '1:44'}" value="${val('seg_rep', fmtTiempo)}"></label>
          <label class="campo">Recuperación <input name="rec" inputmode="numeric" value="${val('rec_seg', fmtTiempo) || plan(obj?.rec, fmtTiempo)}"></label>
        </div>
        <div class="ev-fila">
          <label class="campo">Pulso medio <input name="fcm" inputmode="numeric" placeholder="ppm" value="${val('fc_media')}"></label>
          <label class="campo">Pulso máximo <input name="fcx" inputmode="numeric" placeholder="ppm" value="${val('fc_max')}"></label>
        </div>
        <label class="campo rn-rpe">¿Cómo de duro? <b data-rpe></b>
          <input type="range" name="rpe" min="1" max="10" step="1" value="${ex.rpe || 6}"><small><i>Muy fácil</i><i>Al límite</i></small></label>
        <p class="rn-prev"></p>
        <label class="campo">Notas <textarea name="notas" rows="2" placeholder="Sensaciones, terreno, molestias…">${val('notas')}</textarea></label>
        <p class="error"></p>
        <div class="ev-acciones fin">
          ${c ? `<button type="button" class="btn-texto peligro" data-borrar>Borrar</button>` : ''}
          <button type="button" class="btn suave" data-cerrar-modal>Cancelar</button>
          <button class="btn primario" type="submit">${c ? 'Guardar cambios' : 'Guardar salida'}</button>
        </div>
      </form>`,
    alAbrir: (cuerpo, cerrar) => {
      const form = cuerpo.querySelector('form');
      const E = n => form.elements[n];
      const leerForm = () => {
        tipo = E('tipo').value; form.dataset.tipo = tipo;
        const d = {
          fecha: E('fecha').value || hoyISO(), tipo, distancia_km: num(E('km').value) || null,
          fc_media: num(E('fcm').value) || null, fc_max: num(E('fcx').value) || null, notas: E('notas').value.trim() || null,
        };
        if (tipo === 'series') Object.assign(d, {
          reps: num(E('reps').value) || null, metros_rep: num(E('metros').value) || null,
          seg_rep: parseTiempo(E('segRep').value) || null, rec_seg: parseTiempo(E('rec').value) || null, duracion_seg: parseTiempo(E('tiempo').value, 'min') || null,
        });
        else Object.assign(d, { duracion_seg: parseTiempo(E('tiempo').value, 'min') || null, reps: null, metros_rep: null, seg_rep: null, rec_seg: null });
        return d;
      };
      const pintar = () => {
        const d = leerForm();
        const r = ritmoDe(d);
        cuerpo.querySelector('[data-rpe]').textContent = ['', 'Muy fácil', 'Fácil', 'Fácil', 'Cómodo', 'Moderado', 'Moderado', 'Duro', 'Muy duro', 'Durísimo', 'Al límite'][Number(E('rpe').value)];
        cuerpo.querySelector('.rn-prev').innerHTML = r ? `Ritmo${tipo === 'series' ? ' de las series' : ''}: <b>${fmtRitmo(r)} /km</b>${obj && tipo === 'series' && d.seg_rep ? ` · objetivo ${fmtTiempo(obj.seg)} por repetición` : ''}` : '';
      };
      form.addEventListener('input', pintar); form.addEventListener('change', pintar); pintar();
      form.onsubmit = async ev => {
        ev.preventDefault();
        const d = leerForm();
        const err = cuerpo.querySelector('.error');
        if (tipo === 'series' ? !(d.reps && d.metros_rep && d.seg_rep) : !(d.distancia_km && d.duracion_seg)) {
          err.textContent = tipo === 'series' ? 'Pon repeticiones, metros y tiempo por repetición.' : 'Pon la distancia y el tiempo.'; return;
        }
        if (tipo === 'series' && !d.distancia_km) d.distancia_km = Math.round(((d.reps * d.metros_rep) / 1000 + 4) * 10) / 10;
        if (!requiereConexion()) return;
        try {
          let idFinal = c?.id;
          if (c) await ejecutar(supabase.from('carreras').update(d).eq('id', c.id));
          else idFinal = (await ejecutar(supabase.from('carreras').insert(d).select('id').single())).id;
          guardarExtra(idFinal, { rpe: Number(E('rpe').value), ...(sesion ? { plan: sesion.id } : {}) });
          await cargarTodo();
          await cerrar();
          aviso(c ? 'Salida actualizada' : `Guardada: ${resumen(d)}`);
          despues?.();
        } catch (e) { err.textContent = mensajeError(e); }
      };
      cuerpo.querySelector('[data-borrar]')?.addEventListener('click', async () => {
        if (!confirm('¿Borrar esta salida?') || !requiereConexion()) return;
        try {
          await ejecutar(supabase.from('carreras').delete().eq('id', c.id));
          await cargarTodo(); await cerrar(); aviso('Salida borrada'); despues?.();
        } catch (e) { err.textContent = mensajeError(e); }
      });
    },
  });
}

/* ============================== HISTORIAL ============================== */
export function renderRegistrarRun(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const lista = [...state.carreras].reverse();
  const porSemana = new Map();
  for (const c of lista) { const l = lunesDe(c.fecha); if (!porSemana.has(l)) porSemana.set(l, []); porSemana.get(l).push(c); }
  cont.innerHTML = `
    <div class="rn">
      <div class="rn-tit"><h3>Tus salidas</h3><button class="btn primario chico" data-nueva>${icono('mas')}Añadir salida</button></div>
      ${lista.length ? [...porSemana].map(([l, cs]) => `
        <section class="rn-hist">
          <h4>Semana del ${fmtCorta(l).toLowerCase()}<span>${fmtKg(cs.reduce((t, c) => t + kmDe(c), 0).toFixed(1))} km</span></h4>
          <ul>${cs.map(c => `<li><button data-editar="${c.id}">
            <span class="rn-pt ${c.tipo}"></span>
            <span class="rn-li-dia">${fmtCorta(c.fecha).split(',')[0]}</span>
            <b>${c.fuente === 'test' ? 'Test de nivel' : TIPOS[c.tipo]}</b>
            <span class="rn-li-clave">${esc(resumen(c))}</span>
            <em>${icono('der')}</em></button></li>`).join('')}</ul>
        </section>`).join('') : '<div class="vacio"><h3>Aún no hay salidas</h3><p>Registra tu primera salida desde «Hoy» o con «Añadir salida».</p></div>'}
    </div>`;
  cont.onclick = ev => {
    const b = ev.target.closest('[data-editar],[data-nueva]'); if (!b) return;
    abrirSalida(b.dataset.editar ? { id: Number(b.dataset.editar) } : {}, () => renderRegistrarRun(cont));
  };
}

function editarCarrera(id) { abrirSalida({ id }, () => ir('progreso')); }

/* ============================== PROGRESO ============================== */
let vistaRodajes = 'ritmo';

export function renderProgresoRun(cont) {
  if (state.faltaMigracion) { cont.innerHTML = bannerMigracion(); return; }
  const carreras = state.carreras;
  if (!carreras.length) {
    cont.innerHTML = `<div class="vacio"><h3>Aún no hay salidas</h3><p>Registra tu primera carrera y aquí verás ritmos, pulso y kilómetros.</p>
      <button class="btn primario" id="ir-reg">Registrar salida</button></div>`;
    cont.onclick = ev => ev.target.closest('#ir-reg') && ir('semana');
    return;
  }
  const hoy = hoyISO();
  const kmSemana = carrerasEntre(lunesDe(hoy), sumarDias(lunesDe(hoy), 6)).reduce((t, c) => t + kmDe(c), 0);
  const kmMes = carrerasEntre(hoy.slice(0, 8) + '01', hoy).reduce((t, c) => t + kmDe(c), 0);
  const rodajes = carreras.filter(c => c.tipo !== 'series' && ritmoDe(c));
  const ultimoRodaje = rodajes.at(-1);
  const series = carreras.filter(c => c.tipo === 'series' && ritmoDe(c));

  const p = perfilRun();
  const vd = p?.inicio ? vdotActual(p, hoy) : null;
  const tests = p?.tests || [];
  cont.innerHTML = `
    ${vd ? `<section class="panel rn-prevs">
      <h3>Tu nivel: ${vd.toFixed(1)}</h3>
      <p class="sub">Lo que podrías correr hoy, según tus tests y entrenos.</p>
      <div class="rn-chips">${[[5000, '5 km'], [10000, '10 km'], [21097, 'Media'], [42195, 'Maratón']].map(([m, n]) => `<div class="rn-chip"><small>${n}</small><b>${fmtTiempo(prevision(vd, m))}</b></div>`).join('')}</div>
      ${tests.length > 1 ? `<p class="nota-grafico">Desde tu primer test: ${(vd - tests[0].vdot >= 0 ? '+' : '')}${(vd - tests[0].vdot).toFixed(1)} puntos de nivel.</p>` : ''}
    </section>` : ''}
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
            <span><b>${c.fuente === 'test' ? 'Test de nivel' : TIPOS[c.tipo]}</b><br><span class="tenue">${fmtCorta(c.fecha)}</span></span>
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
