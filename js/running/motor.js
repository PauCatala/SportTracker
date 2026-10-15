// MOTOR DE RUNNING: tu nivel, tus ritmos y tu plan semana a semana.
//  - Nivel (VDOT, método de Jack Daniels): sale de un test (5 km a tope, test de 12 minutos o una marca reciente).
//  - Ritmos: suave, maratón, umbral, series e intervalos cortos, calculados con tu VDOT.
//  - Plan: fases (base → desarrollo → específico → afinar) hasta tu carrera; el volumen sube poco a poco,
//    con una semana de descarga cada cuatro. Cada semana se ajusta según lo que hiciste la anterior.
// Todo son funciones puras sobre tu perfil (run-perfil), tus salidas (state.carreras) y el registro de ajustes.
import { leer, guardar } from '../almacen.js';

// ---------- Fechas ----------
const iso = d => d.toLocaleDateString('sv-SE');
const fecha = s => new Date(`${s}T12:00`);
export const sumar = (s, n) => { const d = fecha(s); d.setDate(d.getDate() + n); return iso(d); };
export const lunes = s => { const d = fecha(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return iso(d); };
const semanasEntre = (a, b) => Math.round((fecha(lunes(b)) - fecha(lunes(a))) / (7 * 864e5));

// ---------- VDOT ----------
const vo2 = v => -4.6 + 0.182258 * v + 0.000104 * v * v;                 // v en m/min
const pctMax = t => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);  // t en min
export const vdotDe = (metros, segundos) => { const t = segundos / 60; return vo2(metros / t) / pctMax(t); };
const velPara = objetivo => (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (4.6 + objetivo))) / (2 * 0.000104);
const ritmoA = (vdot, frac) => 60000 / velPara(vdot * frac);              // seg/km
// Tiempo previsto para una distancia con tu VDOT (búsqueda binaria)
export function prevision(vdot, metros) {
  let a = metros / 400 * 60, b = metros / 50 * 60;                         // entre 24 km/h y 3 km/h
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (vdotDe(metros, m) > vdot) a = m; else b = m; }
  return (a + b) / 2;
}
// Tus ritmos de entrenamiento (seg/km)
export function ritmos(vdot) {
  const r = {
    suave: ritmoA(vdot, 0.70), suaveMin: ritmoA(vdot, 0.74), suaveMax: ritmoA(vdot, 0.65),
    maraton: prevision(vdot, 42195) / 42.195,
    umbral: ritmoA(vdot, 0.88),
    series: ritmoA(vdot, 0.975),
  };
  r.rapido = r.series - 15;                                                // repeticiones cortas (≈ 6 s/400 m más rápido)
  return r;
}

// ---------- Objetivos ----------
export const OBJETIVOS = {
  '5k': { nombre: '5 km', metros: 5000, semanas: 10, pico: 30, larga: 12, afinar: 1 },
  '10k': { nombre: '10 km', metros: 10000, semanas: 12, pico: 40, larga: 16, afinar: 1 },
  '15k': { nombre: '15 km', metros: 15000, semanas: 14, pico: 45, larga: 18, afinar: 1 },
  media: { nombre: 'Media maratón', metros: 21097, semanas: 16, pico: 50, larga: 21, afinar: 2 },
  maraton: { nombre: 'Maratón', metros: 42195, semanas: 18, pico: 65, larga: 32, afinar: 2 },
  forma: { nombre: 'Ponerme en forma', metros: 5000, semanas: 12, pico: 25, larga: 10, afinar: 0 },
};
export const VOLUMENES = [[8, 'Menos de 10 km'], [15, '10–20 km'], [27, '20–35 km'], [42, '35–50 km'], [55, 'Más de 50 km']];

// ---------- Perfil ----------
// { objetivo, carrera (fecha, opcional), tiempoObjetivo (seg, opcional), dias: [1,3,6] (0 = domingo),
//   volumen (km/semana al empezar), inicio (lunes), tests: [{fecha, tipo, metros, segundos, vdot}], principiante }
export const perfilRun = () => leer('run-perfil', null);
export const guardarPerfil = p => guardar('run-perfil', p);
export const vdotActual = (p, hoy) => vdotEnSemana(p, Math.max(1, semanaDe(p, hoy)));

// ---------- Fases ----------
export function datosPlan(p) {
  const obj = OBJETIVOS[p.objetivo] || OBJETIVOS['10k'];
  const fin = p.carrera ? lunes(p.carrera) : sumar(p.inicio, 7 * (obj.semanas - 1));
  const total = Math.max(4, semanasEntre(p.inicio, fin) + 1);
  const afinar = Math.min(obj.afinar, Math.max(0, total - 4));
  const resto = total - afinar;
  const base = Math.max(1, Math.round(resto * 0.3)), desarrollo = Math.max(1, Math.round(resto * 0.4));
  const especifico = resto - base - desarrollo;
  return { obj, total, base, desarrollo, especifico, afinar };
}
export const FASES = {
  base: { nombre: 'Base', foco: 'Kilómetros cómodos para construir tu motor aeróbico. Casi todo suave.' },
  desarrollo: { nombre: 'Desarrollo', foco: 'Entran las series y el umbral: subes la velocidad sin perder la base.' },
  especifico: { nombre: 'Específico', foco: 'Entrenas a ritmo de carrera para que el día D te salga solo.' },
  afinar: { nombre: 'Afinar', foco: 'Menos volumen y piernas frescas: llegas descansado a la carrera.' },
};
export function faseDe(p, n) {
  const d = datosPlan(p);
  if (n <= d.base) return 'base';
  if (n <= d.base + d.desarrollo) return 'desarrollo';
  if (n <= d.base + d.desarrollo + d.especifico) return 'especifico';
  return 'afinar';
}
export const semanaDe = (p, dia) => semanasEntre(p.inicio, dia) + 1;

// ---------- Volumen de cada semana ----------
function volumen(p, n) {
  const d = datosPlan(p);
  const v0 = Math.max(p.principiante ? 6 : 10, p.volumen || 15);
  const pico = Math.max(v0, Math.min(d.obj.pico, v0 * 1.8));
  const subida = d.total - d.afinar;
  let v = v0 + (pico - v0) * Math.min(1, (n - 1) / Math.max(1, subida - 1));
  if (n % 4 === 0 && n <= subida) v *= 0.8;                         // semana de descarga
  if (n > subida) v = pico * (n === d.total ? 0.5 : 0.7);           // afinar
  return v * (ajustesDe(p).find(a => a.n === n)?.factor || 1);
}

// ---------- Sesiones ----------
// Cada sesión: { slot, tipo (series|tempo|easy|larga — los de la tabla carreras), titulo, clave (lo esencial en grande),
//   detalle, pasos: [{ que, cuanto, ritmo }], km, min, color }
const fmt = s => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const ritmoTxt = s => `${fmt(s)} /km`;
const tramo = (metros, ritmo) => fmt((metros / 1000) * ritmo);          // lo que tarda en un tramo

// Series de cada fase (se van rotando semana a semana)
const SERIES = {
  base: [{ reps: 6, m: 200, rec: 60, ritmo: 'rapido', nota: 'Rápidos pero sueltos, sin apretar.' }, { reps: 8, m: 200, rec: 60, ritmo: 'rapido' }],
  desarrollo: [{ reps: 6, m: 800, rec: 120, ritmo: 'series' }, { reps: 5, m: 1000, rec: 150, ritmo: 'series' }, { reps: 10, m: 400, rec: 90, ritmo: 'rapido' }, { reps: 4, m: 1200, rec: 150, ritmo: 'series' }],
  especifico: [{ reps: 5, m: 1000, rec: 120, ritmo: 'carrera' }, { reps: 3, m: 2000, rec: 150, ritmo: 'carrera' }, { reps: 6, m: 800, rec: 90, ritmo: 'series' }],
  afinar: [{ reps: 4, m: 600, rec: 120, ritmo: 'carrera' }],
};
const TEMPO = {
  base: [{ bloques: 6, min: 2, rec: 1, nombre: 'Fartlek' }, { bloques: 5, min: 3, rec: 1.5, nombre: 'Fartlek' }],
  desarrollo: [{ bloques: 3, min: 8, rec: 2, nombre: 'Umbral' }, { bloques: 2, min: 12, rec: 3, nombre: 'Umbral' }, { bloques: 1, min: 20, rec: 0, nombre: 'Umbral' }],
  especifico: [{ bloques: 1, min: 25, rec: 0, nombre: 'Umbral' }, { bloques: 2, min: 15, rec: 2, nombre: 'Umbral' }],
  afinar: [{ bloques: 2, min: 8, rec: 2, nombre: 'Umbral' }],
};

function sesionSeries(r, fase, n, carreraRitmo) {
  const lista = SERIES[fase]; const s = lista[(n - 1) % lista.length];
  const ritmo = s.ritmo === 'carrera' ? carreraRitmo : r[s.ritmo];
  const kmBloque = (s.reps * s.m) / 1000 + (s.reps - 1) * (s.rec / 60) / (r.suave / 60) * 0.6;
  const km = 2.5 + kmBloque + 1.5;
  return {
    slot: 'series', tipo: 'series', titulo: fase === 'base' ? 'Rectas rápidas' : 'Series',
    clave: `${s.reps} × ${s.m} m`, objetivo: { reps: s.reps, metros: s.m, seg: Math.round((s.m / 1000) * ritmo), rec: s.rec },
    detalle: `cada ${s.m} m en ${tramo(s.m, ritmo)} · ${ritmoTxt(ritmo)}`,
    pasos: [
      { que: 'Calienta', cuanto: '15 min suave', ritmo: ritmoTxt(r.suave) },
      { que: `${s.reps} × ${s.m} m`, cuanto: `cada una en ${tramo(s.m, ritmo)}`, ritmo: ritmoTxt(ritmo), fuerte: true },
      { que: 'Recupera', cuanto: `${fmt(s.rec)} trotando entre cada una`, ritmo: '' },
      { que: 'Enfría', cuanto: '10 min muy suave', ritmo: '' },
    ],
    nota: s.nota || (s.ritmo === 'carrera' ? 'A tu ritmo objetivo de carrera.' : 'Todas a la misma velocidad: la última igual que la primera.'),
    km, min: Math.round(25 + (s.reps * s.m / 1000) * ritmo / 60 + (s.reps - 1) * s.rec / 60),
  };
}
function sesionTempo(r, fase, n) {
  const lista = TEMPO[fase]; const t = lista[(n - 1) % lista.length];
  const ritmo = fase === 'base' ? r.umbral + 10 : r.umbral;
  const minTrabajo = t.bloques * t.min;
  const km = 2.5 + (minTrabajo * 60) / ritmo + 1.5 + (t.bloques - 1) * t.rec * 60 / r.suave;
  return {
    slot: 'tempo', tipo: 'tempo', titulo: t.nombre,
    clave: t.bloques > 1 ? `${t.bloques} × ${t.min} min` : `${t.min} min seguidos`,
    detalle: `a ${ritmoTxt(ritmo)}${t.rec ? ` · ${fmt(t.rec * 60)} suave entre bloques` : ''}`,
    pasos: [
      { que: 'Calienta', cuanto: '15 min suave', ritmo: ritmoTxt(r.suave) },
      { que: t.bloques > 1 ? `${t.bloques} × ${t.min} min` : `${t.min} min`, cuanto: 'a ritmo de umbral: cómodo-duro, podrías decir frases cortas', ritmo: ritmoTxt(ritmo), fuerte: true },
      ...(t.rec ? [{ que: 'Recupera', cuanto: `${fmt(t.rec * 60)} trotando entre bloques`, ritmo: '' }] : []),
      { que: 'Enfría', cuanto: '10 min muy suave', ritmo: '' },
    ],
    nota: 'Controlado: deberías acabar con la sensación de que podrías hacer un bloque más.',
    km, min: Math.round(25 + minTrabajo + (t.bloques - 1) * t.rec),
  };
}
function sesionSuave(r, km, slot = 'easy', conRectas = false) {
  return {
    slot, tipo: 'easy', titulo: 'Rodaje suave',
    clave: `${fmtKm(km)} km`, detalle: `a ${ritmoTxt(r.suave)} · puedes hablar sin problema`,
    pasos: [
      { que: `${fmtKm(km)} km`, cuanto: 'suave y relajado', ritmo: `${fmt(r.suaveMin)}–${fmt(r.suaveMax)} /km`, fuerte: true },
      ...(conRectas ? [{ que: '4 rectas', cuanto: 'de 20 s al final, rápidas y sueltas', ritmo: '' }] : []),
    ],
    nota: 'Si dudas, más lento. Aquí se construye la base.',
    km, min: Math.round((km * r.suave) / 60),
  };
}
function sesionLarga(r, km, fase, carreraRitmo) {
  const final = fase === 'especifico' ? Math.min(5, Math.round(km * 0.25)) : 0;
  return {
    slot: 'larga', tipo: 'larga', titulo: 'Tirada larga',
    clave: `${fmtKm(km)} km`, detalle: final ? `suave y los últimos ${final} km a ritmo de carrera` : `a ${ritmoTxt(r.suave + 10)} · sin prisa`,
    pasos: [
      { que: `${fmtKm(km - final)} km`, cuanto: 'suave, constante', ritmo: ritmoTxt(r.suave + 10), fuerte: !final },
      ...(final ? [{ que: `${final} km`, cuanto: 'a ritmo de carrera', ritmo: ritmoTxt(carreraRitmo), fuerte: true }] : []),
    ],
    nota: 'Lleva agua si pasa de una hora. Lo importante es el tiempo de pie, no el ritmo.',
    km, min: Math.round((km * (r.suave + 10)) / 60),
  };
}
export const fmtKm = k => (Math.round(k * 2) / 2).toLocaleString('es-ES');

// El test de nivel: 5 km a tope (o 12 minutos si estás empezando)
export function sesionTest(r, principiante) {
  return principiante ? {
    slot: 'series', tipo: 'tempo', test: true, titulo: 'Test de 12 minutos',
    clave: '12 min', detalle: 'la mayor distancia posible en 12 minutos, corriendo o andando rápido',
    pasos: [
      { que: 'Calienta', cuanto: '10 min andando rápido y trotando', ritmo: '' },
      { que: '12 min', cuanto: 'lo más lejos que puedas, a un ritmo que aguantes', ritmo: '', fuerte: true },
      { que: 'Anota', cuanto: 'los metros que has recorrido', ritmo: '' },
    ],
    nota: 'Mejor en pista o con el reloj midiendo la distancia.', km: 3, min: 30,
  } : {
    slot: 'series', tipo: 'tempo', test: true, titulo: 'Test de 5 km',
    clave: '5 km a tope', detalle: 'el mejor tiempo que puedas hoy, repartiendo bien el esfuerzo',
    pasos: [
      { que: 'Calienta', cuanto: '15 min suave + 3 rectas', ritmo: ritmoTxt(r.suave) },
      { que: '5 km', cuanto: 'a tope y regular: el primer km no más rápido que el resto', ritmo: '', fuerte: true },
      { que: 'Enfría', cuanto: '10 min muy suave', ritmo: '' },
    ],
    nota: 'Con este tiempo calculamos tus ritmos. Lo repetirás cada 6 semanas.', km: 9, min: 55,
  };
}

// Reparte las sesiones en tus días: la larga el último (normalmente el fin de semana),
// las de calidad separadas por días suaves
function repartir(dias, sesiones) {
  const orden = [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));   // lunes primero
  const asignado = new Map();
  const larga = sesiones.find(s => s.slot === 'larga');
  const resto = sesiones.filter(s => s !== larga);
  if (larga) asignado.set(orden.at(-1), larga);
  const libres = orden.filter(d => !asignado.has(d));
  const calidad = resto.filter(s => s.slot === 'series' || s.slot === 'tempo');
  const suaves = resto.filter(s => !calidad.includes(s));
  // Calidad en los días más separados entre sí; suaves en el resto
  const posiciones = calidad.length === 1 ? [0] : calidad.length === 2 ? [0, Math.max(1, libres.length - 1)] : [];
  calidad.forEach((s, i) => { const d = libres[posiciones[i] ?? i]; if (d !== undefined) asignado.set(d, s); });
  for (const s of suaves) { const d = libres.find(x => !asignado.has(x)); if (d !== undefined) asignado.set(d, s); }
  return asignado;   // dia (0 = domingo) → sesión
}

/**
 * Plan de una semana (por su lunes). Devuelve { n, fase, vol, sesiones: [{...sesion, dow, fechaPlan, id}] } o null.
 */
export function semanaPlanRun(p, lun) {
  if (!p?.inicio) return null;
  const n = semanaDe(p, lun);
  const d = datosPlan(p);
  if (n < 1 || n > d.total) return null;
  const fase = faseDe(p, n);
  const vdot = vdotEnSemana(p, n);
  const r = ritmos(vdot);
  const carreraRitmo = prevision(vdot, d.obj.metros) / (d.obj.metros / 1000);
  const vol = volumen(p, n);
  const dias = (p.dias?.length ? p.dias : [2, 4, 0]).slice(0, 6);
  const nd = dias.length;
  // Qué sesiones entran según los días que entrenas
  const tocaTest = !p.tests?.length ? n === 1 : (n % 6 === 0 && fase !== 'afinar');
  const calidad = [];
  if (tocaTest) calidad.push(sesionTest(r, p.principiante));
  else if (!p.principiante || fase !== 'base') calidad.push(sesionSeries(r, fase, n, carreraRitmo));
  if (nd >= 4 && !p.principiante) calidad.push(sesionTempo(r, fase, n));
  const kmCalidad = calidad.reduce((t, s) => t + s.km, 0);
  // La larga nunca baja de lo que ya corrías (tu tirada más larga reciente), salvo al afinar
  const tope = d.obj.larga * (fase === 'afinar' ? 0.6 : 1);
  const desdeHistoria = p.largaBase ? Math.min(tope, p.largaBase * (fase === 'afinar' ? 0.6 : 1) + 0.5 * (n - 1)) : 0;
  const kmLarga = Math.max(p.principiante ? 3 : 6, desdeHistoria, Math.min(tope, vol * 0.32));
  const nSuaves = Math.max(0, nd - calidad.length - 1);
  const kmSuave = nSuaves ? Math.max(p.principiante ? 2.5 : 5, (vol - kmCalidad - kmLarga) / nSuaves) : 0;
  const sesiones = [...calidad, ...Array.from({ length: nSuaves }, (_, i) => sesionSuave(r, kmSuave, i ? `easy${i + 1}` : 'easy', i === 0 && fase !== 'base')),
    sesionLarga(r, kmLarga, fase, carreraRitmo)];
  const reparto = repartir(dias, sesiones);
  const lista = [];
  for (const [dow, s] of reparto) {
    const fechaPlan = sumar(lun, (dow + 6) % 7);
    lista.push({ ...s, dow, fechaPlan, id: `run:${s.slot}:${fechaPlan}` });
  }
  lista.sort((a, b) => a.fechaPlan.localeCompare(b.fechaPlan));
  return { n, total: d.total, fase, vol: lista.reduce((t, s) => t + s.km, 0), vdot, ritmos: r, carreraRitmo, sesiones: lista };
}

// ---------- Adaptación semana a semana ----------
// "run-ajustes": [{ n, vdot (± sobre el último test), factor (volumen), motivo }]
export const ajustesDe = p => leer('run-ajustes', []).filter(a => !p?.inicio || a.inicio === p.inicio);
function vdotEnSemana(p, n) {
  const fin = sumar(p.inicio, 7 * n - 1);
  const tests = (p.tests || []).filter(t => t.fecha <= fin);
  const base = tests.at(-1)?.vdot || p.tests?.[0]?.vdot || (p.principiante ? 28 : 35);
  // Solo cuentan los ajustes hechos después del último test
  const desdeTest = tests.at(-1) ? semanaDe(p, tests.at(-1).fecha) : 0;
  return base + ajustesDe(p).filter(a => a.n <= n && a.n > desdeTest).reduce((t, a) => t + (a.vdot || 0), 0);
}
/**
 * Al empezar una semana se revisa la anterior: si hiciste (casi) todo y las series te salieron
 * más rápidas de lo previsto y sin ir al límite, sube tu nivel; si fallaste sesiones o fueron muy duras,
 * baja un poco el volumen. Devuelve el ajuste de la semana actual (creándolo si hace falta).
 */
export function adaptar(p, hoy, carreras, extra = {}) {
  if (!p?.inicio) return null;
  const n = semanaDe(p, hoy);
  if (n < 2) return null;
  const lista = leer('run-ajustes', []);
  const ya = lista.find(a => a.inicio === p.inicio && a.n === n);
  if (ya) return ya;
  const previa = semanaPlanRun(p, sumar(lunes(hoy), -7));
  if (!previa) return null;
  const hechas = emparejar(previa.sesiones, carreras, extra);
  const plan = previa.sesiones.filter(s => !s.test).length;
  const cumplidas = previa.sesiones.filter(s => hechas.get(s.id)).length;
  const adherencia = plan ? cumplidas / previa.sesiones.length : 1;
  let vdot = 0, factor = 1, motivo = 'Semana nueva con la carga prevista.';
  const calidad = previa.sesiones.filter(s => s.slot === 'series' && !s.test && s.objetivo && hechas.get(s.id));
  const esfuerzos = [...hechas.values()].filter(Boolean).map(c => extra[c.id]?.rpe).filter(Boolean);
  const esfuerzo = esfuerzos.length ? esfuerzos.reduce((a, b) => a + b, 0) / esfuerzos.length : null;
  if (adherencia < 0.5) { factor = 0.85; motivo = 'La semana pasada hiciste menos de la mitad: esta semana bajamos un poco el volumen para retomar.'; }
  else if (esfuerzo && esfuerzo >= 8.5) { factor = 0.9; motivo = 'La semana pasada te costó mucho: esta semana un poco más suave.'; }
  else if (calidad.length) {
    const c = hechas.get(calidad[0].id);
    const real = c.seg_rep, obj = calidad[0].objetivo.seg;
    if (real && obj && real < obj * 0.98 && (!esfuerzo || esfuerzo <= 7)) { vdot = 0.5; motivo = 'Tus series fueron más rápidas de lo previsto y sin ir al límite: subimos tus ritmos.'; }
    else if (real && obj && real > obj * 1.04) { vdot = -0.5; motivo = 'Tus series salieron más lentas de lo previsto: ajustamos los ritmos a tu momento.'; }
    else motivo = 'Cumpliste la semana: seguimos con la progresión.';
  } else if (adherencia >= 0.8) motivo = 'Cumpliste la semana: seguimos con la progresión.';
  const nuevo = { inicio: p.inicio, n, vdot, factor, motivo, fecha: hoy };
  guardar('run-ajustes', [...lista, nuevo]);
  return nuevo;
}

// Qué salida corresponde a cada sesión del plan: la que registraste desde ella, la del mismo día o la del mismo tipo
export function emparejar(sesiones, carreras, extra = {}) {
  const usadas = new Set(), res = new Map();
  if (!sesiones.length) return res;
  const desde = lunes(sesiones[0].fechaPlan), hasta = sumar(desde, 6);
  const semana = carreras.filter(c => c.fecha >= desde && c.fecha <= hasta);
  const toma = (s, c) => { if (c) { usadas.add(c.id); res.set(s.id, c); } };
  for (const s of sesiones) toma(s, semana.find(c => !usadas.has(c.id) && extra[c.id]?.plan === s.id));
  for (const s of sesiones) if (!res.has(s.id)) toma(s, semana.find(c => !usadas.has(c.id) && c.fecha === (s.fecha || s.fechaPlan) && (c.tipo === s.tipo || s.test)));
  for (const s of sesiones) if (!res.has(s.id)) toma(s, semana.find(c => !usadas.has(c.id) && c.tipo === s.tipo && !extra[c.id]?.plan));
  return res;
}

// La semana tal y como la verás: con los cambios que hayas hecho en el calendario
// (día y hora fijos para todas las semanas, o un día suelto movido o quitado)
export const HORA_DEF = dow => (dow === 0 || dow === 6 ? '09:30' : '19:30');
export function semanaConCambios(p, lun) {
  const s = semanaPlanRun(p, lun);
  if (!s) return null;
  const cfg = leer('cal-ajustes', {}).run || {};
  const cam = leer('plan-cambios', {});
  s.sesiones = s.sesiones.map(x => {
    const fijo = cfg[x.slot]?.fijo ? cfg[x.slot] : null;
    const c = cam[x.id] || {};
    let fechaS = fijo && fijo.dia !== undefined ? sumar(lun, (fijo.dia + 6) % 7) : x.fechaPlan;
    if (c.fecha) fechaS = c.fecha;
    const inicio = c.inicio || fijo?.hora || HORA_DEF(new Date(`${fechaS}T12:00`).getDay());
    return { ...x, fecha: fechaS, inicio, borrado: !!c.borrado, tituloPropio: c.titulo || null };
  }).filter(x => !x.borrado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return s;
}

// Lo que ya corres (últimas 4 semanas): km por semana y tu tirada más larga
export function historia(carreras, hoy) {
  const desde = sumar(hoy, -28);
  const rec = carreras.filter(c => c.fecha >= desde && c.fecha <= hoy);
  const km = c => Number(c.distancia_km) || (c.reps && c.metros_rep ? (c.reps * c.metros_rep) / 1000 : 0);
  return { volumen: rec.reduce((t, c) => t + km(c), 0) / 4, larga: Math.max(0, ...rec.filter(c => c.tipo !== 'series').map(km)) };
}
