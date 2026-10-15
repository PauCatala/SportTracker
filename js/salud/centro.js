// SALUD · Centro corporal
// Tu avatar en el centro y, a su alrededor, lo importante de cada apartado, unido con hilos finos
// a la parte del cuerpo con la que tiene que ver. Debajo siguen todas las herramientas de siempre.
// No duplica lógica: lee los mismos datos (perfil, sesiones, carreras, comidas, flexibilidad) y,
// en Perfil, guarda exactamente igual que el formulario de siempre.
import { leer, guardar, escapar } from '../almacen.js';
import { cargador } from '../marca-anim.js';
import { hoyISO, sumarDias, lunesDe, fmtKg, fmtRitmo, fmtCorta, diasEntre } from '../utils.js';
import { state } from '../db.js';
import { PERFIL_VACIO, ACTIVIDAD, imc, textoImc, caloriasMantenimiento, caloriasObjetivo, planPeso, planHTML, fmt, perfilCompleto } from '../perfil.js';
import { objetivosDelDia, totalesDe, comidasDe } from '../nutricion.js';
import { DIAS_PLAN, diaSugerido, faseDeSemana, SEMANAS_RUN, flexDelDia, MEDIDAS_FLEX } from '../plan.js';
import { semanaPlan, mesocicloDe, semanaDeMeso, semanasDeMeso, ejercicioPorId } from '../consultas.js';
import { ritmoDe, resumen } from '../running.js';
import { perfilRun, semanaConCambios, FASES, lunes as lunesRun } from '../running/motor.js';
import { cumplimiento } from '../flex.js';
import { estacion, hayWebGL } from './estacion.js';

const NOMBRES = { perfil: 'Perfil', gym: 'Gimnasio', nutricion: 'Nutrición', running: 'Running', flex: 'Flexibilidad' };
const LEMAS = {
  perfil: 'Tu cuerpo, tus datos de partida.',
  gym: 'Fuerza que se acumula semana a semana.',
  nutricion: 'Lo que comes, a la medida de tu objetivo.',
  running: 'Kilómetros, ritmo y plan.',
  flex: 'Movilidad que se nota cada día.',
};
let ultimo = null;          // apartado de la última vez (para animar solo al cambiar)

const ir = (bloque, vista) => `data-ir="${bloque}|${vista}"`;
const n0 = n => Math.round(n).toLocaleString('es-ES');

// =====================================================================
// Montaje: devuelve el contenedor donde se pinta la pestaña de siempre
// =====================================================================
export function montarCentro(cont, bloque, { sesion, datos, abrirLogin }) {
  const cambia = ultimo !== bloque;
  ultimo = bloque;
  const conDatos = bloque === 'perfil' || bloque === 'nutricion' || (sesion && datos);
  cont.innerHTML = `
    <section class="cs${cambia ? ' entra' : ''}" data-bloque="${bloque}">
      <div class="cs-escena">
        <div class="cs-centro" aria-hidden="false"></div>
        <svg class="cs-hilos" aria-hidden="true"></svg>
        <div class="cs-orbita cs-izq"></div>
        <div class="cs-orbita cs-der"></div>
        <div class="cs-base"></div>
        <p class="cs-pista">${matchMedia('(pointer: coarse)').matches ? 'Desliza para girar' : 'Arrastra para girar'}</p>
      </div>
      <div class="cs-detalle">
        <div class="cs-detalle-cab"><h2>${NOMBRES[bloque]}</h2><p>${LEMAS[bloque]}</p><div class="cs-pestanas"></div></div>
        <div class="cs-contenido"></div>
      </div>
    </section>`;
  const raiz = cont.querySelector('.cs');
  const centro = raiz.querySelector('.cs-centro');
  if (hayWebGL) { const e = estacion(); e.montar(centro, bloque); e.alDibujar(a => dibujarHilos(raiz, a)); }
  else raiz.classList.add('sin-3d');

  const pintarOrbita = () => {
    const o = conDatos ? ORBITAS[bloque]() : sesion ? cargandoDatos(bloque) : sinCuenta(bloque);
    raiz.querySelector('.cs-izq').innerHTML = o.izq.join('');
    raiz.querySelector('.cs-der').innerHTML = o.der.join('');
    raiz.querySelector('.cs-base').innerHTML = o.base || '';
    raiz.querySelectorAll('.cs-tarjeta').forEach((t, i) => t.style.setProperty('--i', i));
    // Arco: las tarjetas del medio de cada columna se acercan un poco más al avatar
    for (const col of raiz.querySelectorAll('.cs-orbita')) {
      const ts = [...col.children], mid = (ts.length - 1) / 2;
      ts.forEach((t, i) => t.style.setProperty('--arco', ts.length > 1 ? Math.round(30 * (1 - Math.abs(i - mid) / Math.max(mid, 0.5))) : 18));
    }
    o.despues?.(raiz);
  };
  pintarOrbita();
  if (cambia) setTimeout(() => raiz.classList.remove('entra'), 900);

  // Interacción propia del centro (los eventos de la pestaña de debajo van en su contenedor)
  const escena = raiz.querySelector('.cs-escena');
  escena.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ir]');
    if (b) { const [bl, vi] = b.dataset.ir.split('|'); return dispatchEvent(new CustomEvent('navegar', { detail: { bloque: bl, vista: vi } })); }
    if (ev.target.closest('[data-entrar]')) return abrirLogin?.();
    if (ev.target.closest('[data-receta]')) return import('../recetas.js').then(m => m.abrirRecetaPorId(ev.target.closest('[data-receta]').dataset.receta, ev.target.closest('.cs-tarjeta')));
    const sx = ev.target.closest('[data-cs-sexo]');
    if (sx) { cambiarPerfil({ sexo: sx.dataset.csSexo }); pintarOrbita(); }
    const paso = ev.target.closest('[data-cs-paso]');
    if (paso) {
      const [campo, d] = paso.dataset.csPaso.split('|');
      const inp = raiz.querySelector(`[data-cs-campo="${campo}"]`);
      const nuevo = Math.round(((Number(inp.value) || Number(inp.placeholder) || 0) + Number(d)) * 10) / 10;
      inp.value = nuevo; inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  escena.addEventListener('change', ev => {
    const c = ev.target.closest('[data-cs-campo]');
    if (!c) return;
    const campo = c.dataset.csCampo, valor = c.value === '' ? '' : Number(c.value);
    if (campo === 'pesoObjetivo' || campo === 'meses') {
      // Igual que en el formulario de siempre: el plan empieza hoy con tu peso actual
      const actual = leer('perfil', PERFIL_VACIO);
      cambiarPerfil({ [campo]: valor, inicio: { fecha: hoyISO(), peso: Number(actual.peso) } });
    } else cambiarPerfil({ [campo]: valor });
    pintarOrbita();
    raiz.querySelector(`[data-cs-campo="${campo}"]`)?.focus({ preventScroll: true });
  });
  const alPerfil = () => { if (raiz.isConnected) pintarOrbita(); else removeEventListener('lumen-perfil', alPerfil); };
  addEventListener('lumen-perfil', alPerfil);
  // Cuando guardas algo abajo (una comida, una sesión, tu peso…), la pestaña se vuelve a pintar:
  // entonces se ponen al día también los paneles de alrededor del avatar
  let espera = 0;
  const detalle = raiz.querySelector('.cs-contenido');
  new MutationObserver(() => {
    clearTimeout(espera);
    espera = setTimeout(() => { if (raiz.isConnected && conDatos && !raiz.querySelector('.cs-escena').contains(document.activeElement)) pintarOrbita(); }, 180);
  }).observe(detalle, { childList: true });
  return { detalle: raiz.querySelector('.cs-contenido'), pestanas: raiz.querySelector('.cs-pestanas'), raiz };
}

function cambiarPerfil(cambios) {
  guardar('perfil', { ...leer('perfil', PERFIL_VACIO), ...cambios });
  // La pestaña de debajo (peso, gráfica, marcas) se entera y se pone al día
  document.querySelector('.cs-contenido')?._alPerfil?.();
}

// ---------- Hilos: de cada tarjeta a su punto del cuerpo ----------
function dibujarHilos(raiz, ancla) {
  const svg = raiz.querySelector('.cs-hilos');
  if (!svg || !raiz.isConnected) return;
  const caja = raiz.querySelector('.cs-escena').getBoundingClientRect();
  const lienzo = raiz.querySelector('.cs-lienzo canvas')?.getBoundingClientRect();
  if (!lienzo || getComputedStyle(svg).display === 'none') return;
  const ox = lienzo.left - caja.left, oy = lienzo.top - caja.top;
  let d = '', puntos = '';
  for (const t of raiz.querySelectorAll('[data-ancla]')) {
    const p = ancla(t.dataset.ancla); if (!p) continue;
    const r = t.getBoundingClientRect();
    if (!r.width) continue;
    const izq = t.closest('.cs-izq');
    const x1 = (izq ? r.right : r.left) - caja.left, y1 = r.top + Math.min(r.height / 2, 34) - caja.top;
    const x2 = p.x + ox, y2 = p.y + oy;
    const cx = x1 + (x2 - x1) * 0.55;
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}C${cx.toFixed(1)} ${y1.toFixed(1)} ${cx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    puntos += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3"/><circle class="aro" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="7"/><circle class="fin" cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2.2"/>`;
  }
  svg.innerHTML = `<path d="${d}"/>${puntos}`;
}

// ---------- Piezas ----------
const tarjeta = ({ titulo, ancla, cuerpo, clase = '', etiqueta = '', mitad = false }) =>
  `<article class="cs-tarjeta ${clase}${mitad ? ' cs-mitad' : ''}" ${ancla ? `data-ancla="${ancla}"` : ''}>${titulo ? `<header><h3>${titulo}</h3>${etiqueta ? `<span>${etiqueta}</span>` : ''}</header>` : ''}${cuerpo}</article>`;
const dato = (valor, unidad = '', sub = '') => `<p class="cs-dato"><b>${valor}</b>${unidad ? `<span>${unidad}</span>` : ''}</p>${sub ? `<p class="cs-sub">${sub}</p>` : ''}`;
function anillo(frac, centro, sub = '', color = 'var(--cs-acento)') {
  const f = Math.max(0, Math.min(1, frac || 0)), R = 34, L = 2 * Math.PI * R;
  return `<div class="cs-anillo"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" class="fondo"/><circle cx="40" cy="40" r="${R}" class="valor" style="stroke:${color};stroke-dasharray:${(L * f).toFixed(1)} ${L.toFixed(1)}"/></svg><div><b>${centro}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}
function barras(valores, etiquetas, formato = v => v) {
  const max = Math.max(1, ...valores);
  return `<div class="cs-barras">${valores.map((v, i) => `<div title="${escapar(etiquetas[i])}: ${formato(v)}"><i style="height:${Math.max(4, (v / max) * 100)}%"></i><small>${escapar(etiquetas[i])}</small></div>`).join('')}</div>`;
}
const puntos = (n, total, lleno = 'lleno') => `<div class="cs-puntos">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? lleno : ''}"></i>`).join('')}</div>`;
const accion = (texto, attr) => `<button class="cs-accion" ${attr}>${texto}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>`;

function cargandoDatos(bloque) {
  return { izq: [tarjeta({ titulo: NOMBRES[bloque], cuerpo: cargador('Cargando tus datos…') })], der: [] };
}
function sinCuenta(bloque) {
  const texto = { gym: 'tus rutinas, series y progreso', running: 'tus salidas, ritmos y plan', flex: 'tus rutinas de movilidad y tu racha' }[bloque] || 'tus datos';
  return {
    izq: [tarjeta({ titulo: NOMBRES[bloque], cuerpo: `<p class="cs-texto">Entra en tu cuenta para ver ${texto} alrededor de tu avatar.</p><button class="btn primario chico" data-entrar>Entrar</button>` })],
    der: [],
  };
}

// =====================================================================
// PERFIL · tus datos rodean tu cuerpo y se editan ahí mismo
// =====================================================================
function orbitaPerfil() {
  const p = leer('perfil', PERFIL_VACIO);
  const vImc = imc(p), mant = caloriasMantenimiento(p), kcal = caloriasObjetivo(p), plan = planPeso(p);
  const campo = (nombre, valor, unidad, paso, extra = '') => `
    <div class="cs-campo">
      <button type="button" class="cs-paso" data-cs-paso="${nombre}|-${paso}" aria-label="Restar">−</button>
      <label><input data-cs-campo="${nombre}" type="number" inputmode="decimal" step="${paso}" value="${valor ?? ''}" ${extra} aria-label="${unidad}"><span>${unidad}</span></label>
      <button type="button" class="cs-paso" data-cs-paso="${nombre}|${paso}" aria-label="Sumar">+</button>
    </div>`;
  const pct = vImc ? Math.max(0, Math.min(1, (vImc - 15) / 20)) : null;
  return {
    izq: [
      tarjeta({ titulo: 'Sexo', ancla: 'cabeza', cuerpo: `<div class="segmento-suave cs-seg">${[['h', 'Hombre'], ['m', 'Mujer']].map(([k, t]) => `<button type="button" data-cs-sexo="${k}" class="${p.sexo === k ? 'activo' : ''}">${t}</button>`).join('')}</div>` }),
      tarjeta({ mitad: true, titulo: 'Edad', ancla: 'cabeza', cuerpo: campo('edad', p.edad, 'años', 1, 'min="12" max="99" placeholder="—"') }),
      tarjeta({ mitad: true, titulo: 'Altura', ancla: 'coronilla', cuerpo: campo('altura', p.altura, 'cm', 1, 'min="120" max="230" placeholder="—"') }),
    ],
    der: [
      tarjeta({ titulo: 'Peso', ancla: 'cintura', etiqueta: vImc ? `IMC ${fmt(vImc)} · ${textoImc(vImc)}` : '', cuerpo: campo('peso', p.peso, 'kg', 0.1, 'placeholder="—"')
        + (pct !== null ? `<div class="cs-escala"><i style="left:${(pct * 100).toFixed(1)}%"></i></div><div class="cs-escala-txt"><span>Bajo</span><span>Saludable</span><span>Alto</span></div>` : '') }),
      tarjeta({ titulo: 'Actividad', ancla: 'pies', cuerpo: `<select class="cs-select" data-cs-campo="actividad">${ACTIVIDAD.map(([v, t]) => `<option value="${v}" ${Number(p.actividad) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>` }),
      tarjeta({ titulo: 'Objetivo', ancla: 'pecho', cuerpo: `
        <div class="cs-objetivo">
          <label><input data-cs-campo="pesoObjetivo" type="number" inputmode="decimal" step="0.1" placeholder="Mantener" value="${p.pesoObjetivo ?? ''}" aria-label="Peso objetivo"><span>kg</span></label>
          <select class="cs-select" data-cs-campo="meses" aria-label="Plazo"><option value="">Plazo</option>${Array.from({ length: 24 }, (_, i) => i + 1).map(m => `<option value="${m}" ${Number(p.meses) === m ? 'selected' : ''}>${m} ${m === 1 ? 'mes' : 'meses'}</option>`).join('')}</select>
        </div>
        <div class="cs-plan">${planHTML(p)}</div>` }),
    ],
    base: `<div class="cs-kpis">
      <div><span>IMC</span><b>${vImc ? fmt(vImc) : '–'}</b></div>
      <div><span>Mantenimiento</span><b>${mant ? n0(mant) : '–'}</b><small>kcal</small></div>
      <div><span>Tu objetivo diario</span><b>${kcal ? n0(kcal) : '–'}</b><small>${plan.estado === 'ok' ? (plan.diff < 0 ? 'kcal · déficit' : 'kcal · superávit') : 'kcal'}</small></div>
    </div>`,
  };
}

// =====================================================================
// GIMNASIO · qué toca hoy, el mesociclo y los músculos trabajados esta semana
// =====================================================================
const ZONAS = [
  ['pecho', 'Pecho', 'pecho', /press (banca|inclinado)|dips|pec deck|apertura|cruce/i],
  ['espalda', 'Espalda', 'hombroIzq', /dominada|remo|jal[oó]n|pull-over|face pull/i],
  ['hombro', 'Hombro', 'hombroIzq', /press militar|elevaciones laterales|p[aá]jaros/i],
  ['brazos', 'Brazos', 'manoIzq', /curl de b[ií]ceps|press franc[eé]s|extensi[oó]n en polea|mu[ñn]eca|pulso/i],
  ['pierna', 'Cuádriceps', 'muslo', /sentadilla|prensa|extensi[oó]n de cu[aá]driceps|b[uú]lgara/i],
  ['femoral', 'Femoral y glúteo', 'rodilla', /peso muerto|hip thrust|curl femoral/i],
  ['gemelo', 'Gemelo', 'pies', /gemelo/i],
  ['core', 'Abdomen', 'estomago', /crunch|elevaci[oó]n de piernas|rueda|plancha|pallof/i],
];
// La semana en curso aún no ha terminado: se compara con la media de las semanas completas
function textoVolumen(vol) {
  const completas = vol.slice(0, -1).filter(v => v > 0);
  if (!completas.length) return 'Semana en curso';
  const media = completas.reduce((a, b) => a + b, 0) / completas.length;
  const pct = Math.round((vol.at(-1) / media) * 100);
  return `Semana en curso · ${pct} % de tu media semanal`;
}
function orbitaGym() {
  const hoy = hoyISO(), lunes = lunesDe(hoy);
  const sesSemana = state.sesiones.filter(s => s.fecha >= lunes && s.fecha <= hoy);
  const idsSemana = new Set(sesSemana.map(s => s.id));
  const porZona = Object.fromEntries(ZONAS.map(z => [z[0], 0]));
  for (const se of state.series) {
    if (!idsSemana.has(se.sesion_id)) continue;
    const nombre = ejercicioPorId(se.ejercicio_id)?.nombre || '';
    const z = ZONAS.find(x => x[3].test(nombre));
    if (z) porZona[z[0]]++;
  }
  // Volumen (kg × reps) de las últimas 6 semanas
  const semanas = Array.from({ length: 6 }, (_, i) => sumarDias(lunes, -7 * (5 - i)));
  const sesionSemana = new Map(state.sesiones.map(s => [s.id, lunesDe(s.fecha)]));
  const vol = semanas.map(l => state.series.reduce((t, se) => t + (sesionSemana.get(se.sesion_id) === l ? (Number(se.kg) || 0) * (Number(se.reps) || 0) : 0), 0));
  const dow = new Date().getDay();
  const tocaDia = dow >= 1 && dow <= 5 ? diaSugerido(hoy, DIAS_PLAN.map(d => d.nombre)) : null;
  const hecho = tocaDia && state.sesiones.some(s => s.fecha === hoy);
  const meso = mesocicloDe(hoy);
  const ultima = state.sesiones.filter(s => s.fecha <= hoy).at(-1);
  const seriesUltima = ultima ? state.series.filter(x => x.sesion_id === ultima.id).length : 0;
  const zonas = ZONAS.filter(z => porZona[z[0]] > 0);
  const maxZ = Math.max(10, ...Object.values(porZona));
  return {
    izq: [
      tarjeta({ titulo: 'Hoy toca', ancla: 'pecho', clase: 'cs-destacada', cuerpo: tocaDia
        ? `${dato(escapar(tocaDia.split('·')[1]?.trim() || tocaDia), '', hecho ? 'Hecho hoy. Buen trabajo.' : escapar(tocaDia.split('·')[0].trim()))}${hecho ? '' : accion('Empezar entreno', ir('gym', 'entrenar'))}`
        : `${dato('Descanso')}<p class="cs-sub">Fin de semana: recupera para el lunes.</p>` }),
      tarjeta({ mitad: true, titulo: 'Mesociclo', ancla: 'cabeza', cuerpo: meso
        ? `${dato(escapar(meso.numero ? `M${meso.numero}` : meso.nombre || 'Actual'), '', `Semana ${semanaDeMeso(meso, hoy)}${semanasDeMeso(meso) ? ` de ${semanasDeMeso(meso)}` : ''}`)}${semanasDeMeso(meso) ? `<div class="progreso"><i style="width:${Math.min(100, (semanaDeMeso(meso, hoy) / semanasDeMeso(meso)) * 100)}%"></i></div>` : ''}${accion('Ver rutina', ir('gym', 'rutina'))}`
        : `<p class="cs-texto">Aún no tienes un mesociclo en curso.</p>${accion('Crear mesociclo', ir('gym', 'mesociclos'))}` }),
      tarjeta({ mitad: true, titulo: 'Esta semana', ancla: 'mano', etiqueta: `${sesSemana.length} de 5`, cuerpo: `${puntos(sesSemana.length, 5)}<p class="cs-sub">${ultima ? `Última: ${fmtCorta(ultima.fecha)} · ${seriesUltima} series` : 'Aún sin entrenos registrados'}</p>` }),
    ],
    der: [
      tarjeta({ titulo: 'Músculos esta semana', etiqueta: 'series', clase: 'cs-zonas', cuerpo: zonas.length
        ? `<ul>${zonas.map(z => `<li data-ancla="${z[2]}"><span>${z[1]}</span><div class="progreso"><i style="width:${(porZona[z[0]] / maxZ) * 100}%"></i></div><b>${porZona[z[0]]}</b></li>`).join('')}</ul>`
        : '<p class="cs-texto">Cuando registres series, verás aquí qué músculos has trabajado y cuánto.</p>' }),
      tarjeta({ titulo: 'Volumen', ancla: 'hombroIzq', etiqueta: 'kg × reps, 6 semanas', cuerpo: `${dato(vol.at(-1) ? n0(vol.at(-1)) : '–', 'kg', textoVolumen(vol))}${barras(vol, semanas.map(l => fmtCorta(l).split(' ').slice(1).join(' ')), n0)}${accion('Ver progreso', ir('gym', 'progreso'))}` }),
    ],
  };
}

// =====================================================================
// RUNNING · el plan, los kilómetros de la semana y tu última salida
// =====================================================================
const kmDe = c => Number(c.distancia_km) || (c.reps && c.metros_rep ? (c.reps * c.metros_rep) / 1000 : 0);
function orbitaRunning() {
  const hoy = hoyISO(), lunes = lunesDe(hoy);
  const carreras = [...state.carreras].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const semana = carreras.filter(c => c.fecha >= lunes && c.fecha <= hoy);
  const kmSemana = semana.reduce((t, c) => t + kmDe(c), 0);
  const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(lunes, -7 * (7 - i)));
  const km = semanas.map(l => carreras.reduce((t, c) => t + (lunesDe(c.fecha) === l ? kmDe(c) : 0), 0));
  const pr = perfilRun();
  const semR = pr?.inicio ? semanaConCambios(pr, lunesRun(hoy)) : null;
  const deHoy = semR?.sesiones.find(x => x.fecha === hoy);
  const fase = semR ? FASES[semR.fase] : null;
  const ultima = carreras.filter(c => c.fecha <= hoy).at(-1);
  const recientes = carreras.filter(c => diasEntre(c.fecha, hoy) <= 30 && ritmoDe(c));
  const mejor = recientes.length ? Math.min(...recientes.map(ritmoDe)) : null;
  return {
    izq: [
      tarjeta({ titulo: 'Hoy toca', ancla: 'cabeza', clase: 'cs-destacada', cuerpo: semR
        ? `${dato(deHoy ? escapar(deHoy.clave) : 'Descanso', '', deHoy ? `${escapar(deHoy.titulo)} · ${escapar(deHoy.detalle)}` : `Semana ${semR.n} de ${semR.total} · ${escapar(fase.nombre)}`)}<div class="progreso"><i style="width:${Math.min(100, (semR.n / semR.total) * 100)}%"></i></div>${accion('Ver el plan', ir('running', 'semana'))}`
        : `<p class="cs-texto">Haz un test de nivel y crea tu plan: se adapta a ti cada semana.</p>${accion('Crear mi plan', ir('running', 'semana'))}` }),
      tarjeta({ mitad: true, titulo: 'Esta semana', ancla: 'pies', cuerpo: `${dato(fmtKg(Math.round(kmSemana * 10) / 10), 'km', `${semana.length} ${semana.length === 1 ? 'salida' : 'salidas'}`)}${accion('Ver historial', ir('running', 'registrar'))}` }),
    ],
    der: [
      tarjeta({ titulo: 'Última salida', ancla: 'pecho', cuerpo: ultima
        ? `${dato(fmtRitmo(ritmoDe(ultima)), '/km', `${fmtCorta(ultima.fecha)} · ${escapar(resumen(ultima))}`)}`
        : '<p class="cs-texto">Aún no has registrado ninguna salida.</p>' }),
      tarjeta({ mitad: true, titulo: 'Mejor ritmo', ancla: 'piesDer', etiqueta: 'últimos 30 días', cuerpo: dato(mejor ? fmtRitmo(mejor) : '–', mejor ? '/km' : '', semR ? `Tu nivel: ${semR.vdot.toFixed(1)}` : '') }),
      tarjeta({ titulo: 'Kilómetros', ancla: 'rodilla', etiqueta: '8 semanas', cuerpo: `${barras(km.map(x => Math.round(x * 10) / 10), semanas.map(l => fmtCorta(l).split(' ').slice(1).join(' ')), v => `${fmtKg(v)} km`)}${accion('Ver progreso', ir('running', 'progreso'))}` }),
    ],
  };
}

// =====================================================================
// NUTRICIÓN · lo que llevas hoy, tus macros y una receta que encaja
// =====================================================================
function orbitaNutricion() {
  const p = leer('perfil', PERFIL_VACIO);
  const hoy = hoyISO();
  const obj = objetivosDelDia(), t = totalesDe(hoy), comidas = comidasDe(hoy);
  if (!obj || !perfilCompleto(p)) {
    return {
      izq: [tarjeta({ titulo: 'Primero, tu perfil', ancla: 'cabeza', clase: 'cs-destacada', cuerpo: `<p class="cs-texto">Con tu edad, altura, peso y objetivo calculamos tus calorías y macros.</p>${accion('Completar perfil', ir('perfil', 'datos'))}` })],
      der: [tarjeta({ titulo: 'Recetas', ancla: 'mano', cuerpo: `<p class="cs-texto">Más de 260 recetas con filtros por objetivo, tiempo y lo que tienes en casa.</p>${accion('Explorar recetas', ir('nutricion', 'recetas'))}` })],
    };
  }
  const resto = { kcal: Math.max(0, obj.kcal - t.kcal), p: Math.max(0, obj.p - t.p) };
  const macro = (nombre, hecho, meta, color) => `<div class="cs-macro">${anillo(hecho / meta, `${Math.round(hecho)}`, `/${meta} g`, color)}<span>${nombre}</span></div>`;
  return {
    izq: [
      tarjeta({ mitad: true, titulo: 'Calorías de hoy', ancla: 'estomago', clase: 'cs-destacada', cuerpo: `${anillo(t.kcal / obj.kcal, n0(t.kcal), `de ${n0(obj.kcal)} kcal`)}<p class="cs-sub">${t.kcal <= obj.kcal ? `Te quedan ${n0(obj.kcal - t.kcal)} kcal` : `${n0(t.kcal - obj.kcal)} kcal por encima`}</p>` }),
      tarjeta({ mitad: true, titulo: 'Comidas', ancla: 'mano', etiqueta: `${comidas.length}`, cuerpo: `${comidas.length ? `<ul class="cs-lista">${comidas.slice(-4).map(c => `<li><span>${escapar(c.nombre || 'Comida')}</span><b>${n0(c.kcal)}</b></li>`).join('')}</ul>` : '<p class="cs-texto">Aún no has apuntado nada hoy.</p>'}${accion('Añadir comida', ir('nutricion', 'hoy'))}` }),
    ],
    der: [
      tarjeta({ titulo: 'Macros', ancla: 'pecho', cuerpo: `<div class="cs-macros">${macro('Proteína', t.p, obj.p, 'var(--cs-proteina)')}${macro('Hidratos', t.c, obj.c, 'var(--cs-hidratos)')}${macro('Grasa', t.g, obj.g, 'var(--cs-grasa)')}</div>${accion('Ajustar objetivos', ir('nutricion', 'objetivos'))}` }),
      tarjeta({ titulo: 'Encaja con tu día', ancla: 'manoIzq', clase: 'cs-sugerencia', cuerpo: '<p class="cs-texto">Buscando una receta para lo que te queda…</p>' }),
    ],
    despues: async raiz => {
      const caja = raiz.querySelector('.cs-sugerencia');
      try {
        const { recetaSugerida } = await import('../recetas.js');
        const r = await recetaSugerida(resto);
        if (!caja.isConnected) return;
        caja.innerHTML = r ? `<header><h3>Encaja con tu día</h3><span>${r.min} min</span></header>
          <button class="cs-receta" data-receta="${r.id}"><b>${escapar(r.n)}</b><span>${n0(r.kcal)} kcal · ${Math.round(r.p)} g proteína</span></button>
          <p class="cs-sub">Elegida para las ${n0(resto.kcal)} kcal y ${Math.round(resto.p)} g de proteína que te quedan.</p>${accion('Ver más recetas', ir('nutricion', 'recetas'))}`
          : `<header><h3>Encaja con tu día</h3></header><p class="cs-texto">Has cubierto tu objetivo de hoy.</p>`;
      } catch { caja.querySelector('.cs-texto').textContent = 'No se han podido cargar las recetas.'; }
    },
  };
}

// =====================================================================
// FLEXIBILIDAD · la rutina de hoy, tu racha y tu medida
// =====================================================================
function orbitaFlex() {
  const hoy = hoyISO();
  const items = flexDelDia(hoy);
  const fila = state.flex_dias.find(f => f.fecha === hoy);
  const hechos = new Set(fila?.completados || []);
  const frac = cumplimiento(hoy);
  let dia = frac >= 1 ? hoy : sumarDias(hoy, -1), racha = 0;
  while (cumplimiento(dia) >= 1 && racha < 365) { racha++; dia = sumarDias(dia, -1); }
  const lunes = lunesDe(hoy);
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const medida = [...state.flex_dias].filter(f => f.medida != null).sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  return {
    izq: [
      tarjeta({ mitad: true, titulo: 'Hoy', ancla: 'cintura', clase: 'cs-destacada', cuerpo: `${anillo(frac, `${Math.round(frac * 100)}%`, `${[...hechos].filter(h => items.some(i => i.id === h)).length} de ${items.length}`, 'var(--cs-flex)')}${accion(frac >= 1 ? 'Ver rutina' : 'Hacer la rutina', ir('flex', 'hoy'))}` }),
      tarjeta({ mitad: true, titulo: 'Racha', ancla: 'cabeza', cuerpo: `${dato(racha, racha === 1 ? 'día' : 'días', racha ? 'Seguidos con la rutina completa' : 'Completa la rutina de hoy para empezarla')}<div class="cs-semana">${semana.map(d => `<i class="${d > hoy ? 'futuro' : cumplimiento(d) >= 1 ? 'lleno' : cumplimiento(d) > 0 ? 'medio' : ''}" title="${fmtCorta(d)}"></i>`).join('')}</div>` }),
    ],
    der: [
      tarjeta({ titulo: 'Rutina de hoy', ancla: 'muslo', clase: 'cs-rutina', cuerpo: `<ul class="cs-lista">${items.map(i => `<li class="${hechos.has(i.id) ? 'hecho' : ''}"><span>${escapar(i.nombre)}</span><small>${escapar(i.dosis)}</small></li>`).join('')}</ul>` }),
      tarjeta({ titulo: 'Tu medida', ancla: 'rodilla', etiqueta: 'pliegue', cuerpo: medida
        ? `${dato(`Nivel ${medida.medida + 1}`, `de ${MEDIDAS_FLEX.length}`, escapar(MEDIDAS_FLEX[medida.medida]))}${puntos(medida.medida + 1, MEDIDAS_FLEX.length)}`
        : `<p class="cs-texto">Mide tu pliegue una vez por semana para ver cuánto avanzas.</p>${accion('Ver progreso', ir('flex', 'progreso'))}` }),
    ],
  };
}

const ORBITAS = { perfil: orbitaPerfil, gym: orbitaGym, running: orbitaRunning, nutricion: orbitaNutricion, flex: orbitaFlex };
