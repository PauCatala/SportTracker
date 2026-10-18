// Entiende lo que escribes o dictas en una nota rápida y lo convierte en cosas de SYNCO:
//   «mañana a las 17 reunión con Laura»        → evento del calendario
//   «entregar la práctica el viernes, urgente» → tarea (prioridad alta)
//   «press banca 3x15 80 kg»                    → series en tu sesión de gimnasio de ese día
//   «he corrido 8 km en 42 min»                 → salida de running
//   «comprar leche»                             → tu lista de Personal
// Todo se hace aquí, en el móvil, sin enviar el texto a ningún sitio (y sin coste).
// Sin dependencias: se puede probar con Node.

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, veinte: 20, treinta: 30 };

// Minúsculas y sin tildes, para comparar (la ñ se queda)
export const normalizar = s => s.toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const desdeISO = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d, 12); };
const mas = (s, n) => { const d = desdeISO(s); d.setDate(d.getDate() + n); return iso(d); };
const hh = (h, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const numero = s => Number(String(s).replace(',', '.'));

// Pasa «tres series de diez» a «3 series de 10»
function cifras(t) {
  return t.replace(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|veinte|treinta)\b(?=\s+(series|sets?|reps?|repeticiones|veces|kilos?|kg|km|kilometros?|minutos?|min|horas?|h\b|dias?|semanas?|x))/g, (_, n) => NUMEROS[n]);
}

/* ---------------- Fechas ---------------- */
// Busca una fecha en el texto. pasado = true si hablas de algo ya hecho («el lunes hice…»).
// Devuelve { fecha, resto } (resto: el texto sin la expresión de fecha) o { fecha: null }.
function buscarFecha(t, hoy, pasado) {
  const quitar = (m, fecha) => ({ fecha, resto: (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() });
  let m;
  if ((m = /\bpasado\s+mañana\b/.exec(t))) return quitar(m, mas(hoy, 2));
  if ((m = /\banteayer\b/.exec(t))) return quitar(m, mas(hoy, -2));
  // «mañana» es un día salvo en «por/de/esta la mañana»
  if ((m = /(?<!\b(?:la|esta|por|de)\s)\bmañana\b/.exec(t))) return quitar(m, mas(hoy, 1));
  if ((m = /\bayer\b/.exec(t))) return quitar(m, mas(hoy, -1));
  if ((m = /\b(?:para\s+)?hoy\b/.exec(t))) return quitar(m, hoy);
  if ((m = /\b(?:dentro\s+de|en)\s+(\d+)\s+dias?\b/.exec(t))) return quitar(m, mas(hoy, Number(m[1])));
  if ((m = /\b(?:la\s+)?semana\s+que\s+viene\b|\bla\s+proxima\s+semana\b/.exec(t))) return quitar(m, mas(hoy, 7));
  // 25/10, 25-10-2026
  if ((m = /\b(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(t))) {
    const a = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : desdeISO(hoy).getFullYear();
    const d = new Date(a, Number(m[2]) - 1, Number(m[1]), 12);
    if (!m[3] && !pasado && iso(d) < hoy) d.setFullYear(a + 1);
    if (d.getMonth() === Number(m[2]) - 1) return quitar(m, iso(d));
  }
  // el 25 de octubre / 25 de octubre
  if ((m = new RegExp(`\\b(?:el\\s+)?(?:(?:${DIAS.join('|')})\\s+)?(\\d{1,2})\\s+de\\s+(${MESES.join('|')})(?:\\s+de\\s+(\\d{4}))?\\b`).exec(t))) {
    const a = m[3] ? Number(m[3]) : desdeISO(hoy).getFullYear();
    const d = new Date(a, MESES.indexOf(m[2]), Number(m[1]), 12);
    if (!m[3] && !pasado && iso(d) < hoy) d.setFullYear(a + 1);
    return quitar(m, iso(d));
  }
  // el lunes, este jueves, el próximo viernes, el viernes que viene
  if ((m = new RegExp(`\\b(?:el\\s+|este\\s+|esta\\s+)?(?:(proximo|siguiente)\\s+)?(${DIAS.join('|')})(\\s+que\\s+viene|\\s+pasado)?\\b`).exec(t))) {
    const objetivo = DIAS.indexOf(m[2]), hoyDia = desdeISO(hoy).getDay();
    let n;
    if (pasado || /pasado/.test(m[3] || '')) n = -((hoyDia - objetivo + 7) % 7);
    else { n = (objetivo - hoyDia + 7) % 7; if (m[1] || m[3]) n = n || 7; }
    return quitar(m, mas(hoy, n));
  }
  // el día 25 / el 25
  if ((m = /\bel\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?:[:h.]|kg|km|reps?|series|x|min))/.exec(t))) {
    const base = desdeISO(hoy), d = new Date(base.getFullYear(), base.getMonth(), Number(m[1]), 12);
    if (!pasado && iso(d) < hoy) d.setMonth(d.getMonth() + 1);
    if (pasado && iso(d) > hoy) d.setMonth(d.getMonth() - 1);
    return quitar(m, iso(d));
  }
  return { fecha: null, resto: t };
}

/* ---------------- Horas ---------------- */
// Devuelve { inicio, fin, resto } (horas «HH:MM») o { inicio: null }
function buscarHora(t) {
  const quitar = (m, inicio, fin = null) => ({ inicio, fin, resto: (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() });
  const franja = s => (/tarde/.test(s || '') ? 'tarde' : /noche/.test(s || '') ? 'noche' : /mañana|madrugada/.test(s || '') ? 'mañana' : '');
  const a24 = (h, f) => { h = Number(h); if ((f === 'tarde' || f === 'noche') && h < 12) h += 12; if (f === 'noche' && h === 24) h = 0; return h; };
  const minutos = (min, extra) => (min ? Number(min) : /y\s+media/.test(extra || '') ? 30 : /y\s+cuarto/.test(extra || '') ? 15 : /menos\s+cuarto/.test(extra || '') ? -15 : 0);
  const hora = (h, min, extra, f) => { let H = a24(h, f), M = minutos(min, extra); if (M < 0) { H -= 1; M += 60; } return H >= 0 && H < 24 && M < 60 ? hh(H, M) : null; };
  const H = '(\\d{1,2})(?:[:.h](\\d{2}))?(?:\\s*(?:h\\b|horas?\\b))?(\\s+y\\s+media|\\s+y\\s+cuarto|\\s+menos\\s+cuarto)?';
  const F = '(?:\\s+de\\s+la\\s+(mañana|tarde|noche|madrugada))?';
  let m;
  // de 17 a 19 / desde las 9 hasta las 10:30 / entre las 5 y las 7 de la tarde
  if ((m = new RegExp(`\\b(?:de|desde|entre)\\s+(?:las\\s+|la\\s+)?${H}${F}\\s+(?:a|hasta|y)\\s+(?:las\\s+|la\\s+)?${H}${F}`).exec(t))) {
    const f2 = franja(m[8]), f1 = franja(m[4]) || f2;
    const ini = hora(m[1], m[2], m[3], f1), fin = hora(m[5], m[6], m[7], f2 || f1);
    if (ini && fin) return quitar(m, ini, fin);
  }
  // a las 17:30, a la 1, sobre las 5 de la tarde
  if ((m = new RegExp(`\\b(?:a|sobre|hacia|para)\\s+(?:las|la)\\s+${H}${F}`).exec(t))) {
    const ini = hora(m[1], m[2], m[3], franja(m[4]));
    if (ini) return quitar(m, ini);
  }
  // 17:30 / 17h / 9.30 suelto
  if ((m = /\b(\d{1,2})(?::(\d{2})|h(\d{2})?\b)(?!\s*(?:km|kg|min))/.exec(t))) {
    const ini = hora(m[1], m[2] || m[3], '', '');
    if (ini) return quitar(m, ini);
  }
  if ((m = /\ba\s+mediodia\b/.exec(t))) return quitar(m, '14:00');
  if ((m = /\b(?:por\s+la|esta)\s+(mañana|tarde|noche)\b/.exec(t))) return { inicio: null, franja: m[1], resto: t };
  return { inicio: null, resto: t };
}
// «durante 2 horas», «1 h y media», «45 minutos» → minutos
function buscarDuracion(t) {
  let m;
  if ((m = /\b(?:durante\s+)?(\d+(?:[.,]\d+)?)\s*(?:horas?|h)\b(\s+y\s+media)?/.exec(t)) && !/\ba\s+las?\s+\d/.test(t.slice(Math.max(0, m.index - 8), m.index + 2))) {
    return { min: Math.round(numero(m[1]) * 60 + (m[2] ? 30 : 0)), m };
  }
  if ((m = /\bmedia\s+hora\b/.exec(t))) return { min: 30, m };
  if ((m = /\b(?:durante\s+)?(\d+)\s*(?:minutos|min)\b/.exec(t))) return { min: Number(m[1]), m };
  return null;
}
const sumarMin = (h, min) => { const [a, b] = h.split(':').map(Number), x = Math.min(23 * 60 + 59, a * 60 + b + min); return hh(Math.floor(x / 60), x % 60); };

/* ---------------- Gimnasio ---------------- */
const RE_KG = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilos?)\b/;
const RE_REPS = /(\d+)\s*(?:reps?|repeticiones|rep\.?)\b/;
const RE_SERIES = /(\d+)\s*(?:series|sets?)\b/;
const RE_NXM = /(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/;
const pareceGym = t => (RE_KG.test(t) && (RE_REPS.test(t) || RE_NXM.test(t) || RE_SERIES.test(t) || /(?:kg|kilos?)\s*[x×*]\s*\d/.test(t)))
  || (RE_REPS.test(t) && RE_SERIES.test(t)) || (RE_NXM.test(t) && /\b(press|sentadilla|peso muerto|remo|curl|dominadas|fondos|jalon|hip thrust|zancadas|prensa|extension|elevacion|aperturas|banca|militar)\b/.test(t));

// Lee las series de un trozo: «15 reps x 80kg x 3 series», «3x10 a 60», «4 series de 8 con 100 kg»,
// «80kg x 10, 85 x 8» (cada pareja, una serie). Devuelve { series: [{reps, kg}], resto }
function leerSeries(t) {
  let s = ` ${t} `;
  const sacar = re => { const m = re.exec(s); if (m) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return m; };
  // Varias parejas «peso x reps» seguidas: cada una es una serie
  const parejas = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)\s*[x×*]\s*(\d+)(?!\s*(?:series|sets?))/g)];
  if (parejas.length > 1 || (parejas.length === 1 && !RE_REPS.test(t) && !RE_SERIES.test(t))) {
    for (const p of parejas) s = s.replace(p[0], ' ');
    return { series: parejas.map(p => ({ reps: Number(p[2]), kg: numero(p[1]) })), resto: s };
  }
  let kg = null, reps = null, n = null, m;
  if ((m = sacar(RE_KG))) kg = numero(m[1]);
  if ((m = sacar(RE_REPS))) reps = Number(m[1]);
  if ((m = sacar(RE_SERIES))) n = Number(m[1]);
  // «series de 8» (reps tras «series de»)
  if (n && !reps && (m = sacar(/\bde\s+(\d+)\b(?!\s*(?:kg|kilos?))/))) reps = Number(m[1]);
  // NxM: si ya hay series → M son reps; si ya hay reps → N son series; si no, «series x reps»
  if ((m = sacar(RE_NXM))) {
    const a = Number(m[1]), b = numero(m[2]);
    if (n && !reps) reps = b;
    else if (reps && !n) n = a === reps ? b : a;
    else if (!n && !reps) { n = a; reps = b; }
  }
  // Peso sin unidad: «con 100», «a 60», «@ 80»
  if (kg === null && (m = sacar(/(?:\bcon|\ba|@)\s+(\d+(?:[.,]\d+)?)\b/))) kg = numero(m[1]);
  s = s.replace(/\bx\b|[x×*]/g, ' ');
  if (!reps) return { series: [], resto: s };
  return { series: Array.from({ length: Math.min(n || 1, 12) }, () => ({ reps, kg: kg ?? 0 })), resto: s };
}

// El ejercicio de tu catálogo que mejor encaja con lo escrito
const SINONIMOS = [[/\bbench\b|\bbanca\b/, 'press banca'], [/\bsquat\b/, 'sentadilla'], [/\bdeadlift\b|\bmuerto\b/, 'peso muerto'], [/\bpull ?ups?\b/, 'dominadas'], [/\bdips\b/, 'fondos']];
export function buscarEjercicio(texto, ejercicios = []) {
  let t = ` ${normalizar(texto)} `;
  for (const [re, s] of SINONIMOS) if (re.test(t) && !t.includes(s)) t += ` ${s} `;
  const palabras = new Set(t.split(/[^a-zñ0-9]+/).filter(p => p.length > 1 && !VACIAS.has(p)));
  if (!palabras.size) return null;
  let mejor = null, nota = 0;
  for (const e of ejercicios) {
    const n = normalizar(e.nombre), suyas = n.split(/[^a-zñ0-9]+/).filter(p => p.length > 1 && !VACIAS.has(p));
    if (!suyas.length) continue;
    let comunes = 0;
    for (const p of suyas) if (palabras.has(p) || [...palabras].some(q => q.length > 3 && (p.startsWith(q) || q.startsWith(p)))) comunes++;
    let v = comunes / suyas.length + (t.includes(` ${n} `) ? 1 : 0) + (e.activo ? 0.05 : 0);
    if (comunes === 0) v = 0;
    if (v > nota) { nota = v; mejor = e; }
  }
  return nota >= 0.5 ? mejor : null;
}
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'y', 'a', 'al', 'un', 'una', 'he', 'hice', 'hecho', 'hoy', 'ayer', 'series', 'serie', 'reps', 'rep', 'kg', 'kilos', 'por', 'lado', 'para', 'mi', 'me', 'hacer']);

/* ---------------- Running ---------------- */
const pareceRun = t => /\b(corr(er|ido|i|iendo)|rodaje|running|tirada|trote|trotar|fartlek|tempo|umbral|5k|10k|media maraton|maraton)\b/.test(t)
  || (/\b\d+(?:[.,]\d+)?\s*(?:km|kilometros?)\b/.test(t) && !RE_KG.test(t))
  || /\b\d+\s*[x×]\s*\d{3,4}\s*m?\b/.test(t);
// «42:30», «1:05:00», «42 min», «1h 5 min», «1 hora y 10» → segundos
function leerTiempo(t) {
  let m;
  if ((m = /\b(\d{1,2}):(\d{2}):(\d{2})\b/.exec(t))) return { seg: m[1] * 3600 + m[2] * 60 + Number(m[3]), m };
  if ((m = /\b(?:en\s+)?(\d+)\s*(?:h|horas?)\s*(?:y\s+)?(\d+)?\s*(?:min|minutos)?\b/.exec(t))) return { seg: m[1] * 3600 + (Number(m[2]) || 0) * 60, m };
  if ((m = /\b(?:en\s+)?(\d{1,3}):(\d{2})\b/.exec(t))) return { seg: m[1] * 60 + Number(m[2]), m };
  if ((m = /\b(?:en\s+)?(\d+(?:[.,]\d+)?)\s*(?:min|minutos|')\b/.exec(t))) return { seg: Math.round(numero(m[1]) * 60), m };
  return null;
}
function leerRun(t) {
  const d = { tipoRun: 'easy', distancia_km: null, duracion_seg: null, reps: null, metros_rep: null, seg_rep: null, rec_seg: null };
  let m;
  if ((m = /\b(\d+)\s*[x×]\s*(\d{3,4})\s*m?\b/.exec(t))) {
    d.tipoRun = 'series'; d.reps = Number(m[1]); d.metros_rep = Number(m[2]);
    const tras = t.slice(m.index + m[0].length);
    const r = /\b(?:a|en)\s+(\d{1,2}):(\d{2})\b|\b(?:a|en)\s+(\d{2,3})\s*(?:s|seg|segundos)?\b/.exec(tras);
    if (r) d.seg_rep = r[1] ? r[1] * 60 + Number(r[2]) : Number(r[3]);
    const rec = /\b(?:rec(?:uperando|uperacion)?|descanso|pausa)\s+(?:de\s+)?(\d{1,2}):(\d{2})|\b(?:rec(?:uperando|uperacion)?|descanso|pausa)\s+(?:de\s+)?(\d+)\s*(s|seg|segundos|min|minutos)?\b/.exec(tras);
    if (rec) d.rec_seg = rec[1] ? rec[1] * 60 + Number(rec[2]) : /min/.test(rec[4] || '') ? rec[3] * 60 : Number(rec[3]);
    d.distancia_km = Math.round(((d.reps * d.metros_rep) / 1000 + 4) * 10) / 10;
    return d;
  }
  if (/\btirada\s+larga|\blarga\b/.test(t)) d.tipoRun = 'larga';
  else if (/\btempo|umbral|ritmo\s+de\s+carrera/.test(t)) d.tipoRun = 'tempo';
  if ((m = /\b(\d+(?:[.,]\d+)?)\s*(?:km|kilometros?|k)\b/.exec(t))) d.distancia_km = numero(m[1]);
  else if (/\bmedia\s+maraton\b/.test(t)) d.distancia_km = 21.1;
  else if (/\bmaraton\b/.test(t)) d.distancia_km = 42.2;
  const sinDist = m ? t.replace(m[0], ' ') : t;
  const tiempo = leerTiempo(sinDist);
  if (tiempo) d.duracion_seg = tiempo.seg;
  // Ritmo «a 5:10» (min/km) sin tiempo total → tiempo = ritmo × distancia
  if (!d.duracion_seg && d.distancia_km && (m = /\ba\s+(\d):(\d{2})\b/.exec(sinDist))) d.duracion_seg = Math.round((m[1] * 60 + Number(m[2])) * d.distancia_km);
  return d;
}

/* ---------------- Tareas y eventos ---------------- */
const RE_EVENTO = /\b(reunion|cita|cena|comida|almuerzo|desayuno|quedada|quedar|quedo|clase|examen|parcial|medico|dentista|fisio|peluqueria|cumple(años)?|boda|partido|entrevista|vuelo|tren|viaje|concierto|cine|teatro|tutoria|seminario|charla|conferencia|evento|fiesta|entreno|entrenamiento|padel|futbol|baloncesto|tenis|yoga|pilates|spinning|natacion)\b/;
const RE_TAREA = /^(?:tengo\s+que|hay\s+que|debo|deberia|necesito|recuerdame(?:\s+que)?|recordar(?:me)?|acordarme\s+de|no\s+olvidar|no\s+olvides|apunta(?:me)?(?:\s+que)?|quiero|me\s+toca)\b|\b(entregar|terminar|acabar|hacer|estudiar|repasar|preparar|llamar|enviar|mandar|escribir|leer|revisar|pagar|reservar|pedir|comprar|renovar|devolver|imprimir|subir|corregir|organizar|limpiar|ordenar|lavar|planchar|recoger|contestar|responder|buscar)\b/;
const RE_ESTUDIO = /\b(estudiar|repasar|examen|parcial|practica|practicas|tema|apuntes|asignatura|tfg|tfm|clase|ejercicios|problemas|lectura|trabajo\s+de|entrega|memoria|laboratorio|lab|universidad|uni|upv|profe|profesor)\b/;
const RE_TRABAJO = /\b(trabajo|curro|cliente|proyecto|informe|presentacion|reunion|correo|email|mail|jefe|oficina|factura|propuesta)\b/;
const RE_HOGAR = /\b(comprar|compra|super|mercadona|limpiar|lavar|planchar|tender|basura|ordenar|cocinar|recoger|aspirar|fregar|regar|casa|piso)\b/;
const CATEGORIA = [
  [/\b(clase|seminario|laboratorio|tutoria|charla|conferencia)\b/, 'clase'],
  [/\b(examen|parcial|estudiar|repasar)\b/, 'estudio'],
  [/\b(reunion|entrevista|cliente|oficina|trabajo|curro)\b/, 'trabajo'],
  [/\b(gimnasio|gym|entreno|entrenamiento|partido|padel|futbol|baloncesto|tenis|yoga|pilates|spinning|natacion|correr|carrera)\b/, 'deporte'],
  [/\b(peluqueria|barberia|ropa)\b/, 'imagen'],
  [/\b(limpiar|compra|super|casa|piso)\b/, 'hogar'],
];
const PRIORIDAD_ALTA = /\b(urgente|importante|cuanto\s+antes|asap|prioridad\s+alta|ya\s+mismo|sin\s+falta)\b/;
const PRIORIDAD_BAJA = /\b(cuando\s+pueda|sin\s+prisa|algun\s+dia|prioridad\s+baja|si\s+me\s+da\s+tiempo)\b/;

// Limpia el título: sin muletillas del principio ni restos de fecha, hora o prioridad
function limpiarTitulo(original, normal) {
  // Trabajamos sobre el texto original (con tildes y mayúsculas), quitando lo que se quitó en el normalizado
  let t = normal
    .replace(/^(?:y\s+|pues\s+|oye\s+|vale\s+)+/, '')
    .replace(/^(?:tengo\s+que|hay\s+que|debo|deberia|necesito|recuerdame(?:\s+que)?|recordar(?:me)?(?:\s+que)?|acordarme\s+de|no\s+olvidar|no\s+olvides|apunta(?:me)?(?:\s+que)?|anota(?:me)?|me\s+toca|tengo|quiero)\s+/, '')
    .replace(PRIORIDAD_ALTA, '').replace(PRIORIDAD_BAJA, '').replace(/\bprioridad\s+(?:media|normal)\b/, '')
    .replace(/\b(?:por\s+la|esta)\s+(?:mañana|tarde|noche)\b/, '')
    .replace(/\s*[,.;:]+\s*$/, '').replace(/^\s*[,.;:-]+\s*/, '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
  return capital(recuperarTildes(t, original));
}
// Devuelve las palabras con sus tildes y mayúsculas originales (Laura, Bioestadística…)
function recuperarTildes(t, original) {
  const mapa = new Map();
  for (const p of original.split(/\s+/)) { const k = normalizar(p).replace(/[^a-zñ0-9]/g, ''); if (k && !mapa.has(k)) mapa.set(k, p.replace(/[,.;:!?¿¡]+$/, '').replace(/^[¿¡]+/, '')); }
  return t.split(' ').map(p => {
    const limpio = p.replace(/[,.;:!?]+$/, ''), cola = p.slice(limpio.length);
    const o = mapa.get(limpio);
    if (!o) return p;
    // Mantiene mayúsculas solo si no son de inicio de frase
    const conTildes = o.toLowerCase() === o || o === o.toUpperCase() || original.indexOf(o) > 0 ? o : o.toLowerCase();
    return conTildes + cola;
  }).join(' ');
}

/* ---------------- Trocear ---------------- */
// Una nota puede traer varias cosas: por líneas, «;», o frases. Las series de gimnasio
// seguidas («press 3x10 80kg, sentadilla 4x8 100kg») también se separan por comas.
function trocear(texto) {
  const trozos = [];
  for (const linea of texto.split(/\n|;|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/)) {
    const l = linea.trim().replace(/^[-•*·]\s*/, '');
    if (!l) continue;
    const n = cifras(normalizar(l));
    if (pareceGym(n) && /,|\sy\s/.test(l)) {
      // Separamos por comas/«y» solo si cada parte tiene números (si no, es parte del nombre)
      const partes = l.split(/,\s*|\s+y\s+(?=\S*\d|[a-zA-ZáéíóúñÑ]+\s+\d)/).map(x => x.trim()).filter(Boolean);
      if (partes.length > 1 && partes.every(p => /\d/.test(p))) { trozos.push(...partes); continue; }
    }
    trozos.push(l);
  }
  return trozos;
}

/* ---------------- Analizar ---------------- */
// hoy: «AAAA-MM-DD». ejercicios: tu catálogo de gimnasio ({id, nombre, dia, activo}).
// Devuelve una lista de acciones (cada una con su tipo y sus datos, editables antes de guardar).
export function analizar(texto, { hoy, ejercicios = [] } = {}) {
  hoy ||= iso(new Date());
  const acciones = [];
  let ultimaFecha = null;   // «ayer: press 3x10, sentadilla 4x8» → la fecha vale para lo que sigue
  for (const trozo of trocear(texto)) {
    const n0 = cifras(normalizar(trozo));
    const esGym = pareceGym(n0), esRun = !esGym && pareceRun(n0);
    const pasado = esGym || esRun || /\b(he|hice|hizo|fui|estuve|corri|entrene|termine|acabe)\b/.test(n0);
    const f = buscarFecha(n0, hoy, pasado);
    const fecha = f.fecha || (esGym || esRun ? ultimaFecha : null);
    if (f.fecha) ultimaFecha = f.fecha;
    let n = f.resto;

    if (esGym) {
      const { series, resto } = leerSeries(n);
      const ej = buscarEjercicio(resto, ejercicios);
      const nombre = limpiarTitulo(trozo, resto.replace(/\b(he\s+hecho|hice|hecho|en\s+el\s+gym|en\s+el\s+gimnasio|gimnasio|gym|hoy)\b/g, ' ').replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(?:(?:de|con|a|en|y|el|la)\s+)+|(?:\s+(?:de|con|a|en|y|el|la))+$/g, ''));
      // Sin nombre: son más series del ejercicio anterior («80kg x 10, 85 x 8»)
      const previa = acciones[acciones.length - 1];
      if (!ej && !nombre && previa?.tipo === 'gym') { previa.series.push(...series); continue; }
      acciones.push({ tipo: 'gym', fecha: fecha || hoy, ejercicio: ej ? { id: ej.id, nombre: ej.nombre } : null, nombreLeido: nombre, series, texto: trozo });
      continue;
    }
    if (esRun) {
      acciones.push({ tipo: 'run', fecha: fecha || hoy, ...leerRun(n), texto: trozo });
      continue;
    }

    const h = buscarHora(n);
    n = h.resto;
    let fin = h.fin || null;
    const dur = buscarDuracion(n);
    if (dur) { n = n.replace(dur.m[0], ' ').replace(/\s+/g, ' ').trim(); if (h.inicio && !fin) fin = sumarMin(h.inicio, dur.min); }
    const prioridad = PRIORIDAD_ALTA.test(n0) ? 'alta' : PRIORIDAD_BAJA.test(n0) ? 'baja' : 'media';
    const verbo = RE_TAREA.test(n0);
    const titulo = limpiarTitulo(trozo, n.replace(/^(?:a|el|la|para)\s+/, '').replace(/\s+(?:a|el|para|de)$/, ''));
    if (!titulo) continue;

    if (h.inicio || (RE_EVENTO.test(n0) && fecha && !verbo)) {
      const cat = CATEGORIA.find(([re]) => re.test(n0))?.[1] || 'personal';
      acciones.push({ tipo: 'evento', titulo, fecha: fecha || (h.inicio && h.inicio < hh(new Date().getHours(), new Date().getMinutes()) ? mas(hoy, 1) : hoy),
        todoElDia: !h.inicio, inicio: h.inicio, fin: h.inicio ? (fin || sumarMin(h.inicio, 60)) : null, cat, texto: trozo });
    } else if (verbo || fecha || PRIORIDAD_ALTA.test(n0)) {
      // Estudios o trabajo → tablero de tareas; casa y recados → tu lista de Personal
      const academico = RE_ESTUDIO.test(n0), laboral = RE_TRABAJO.test(n0);
      if (!academico && !laboral && (RE_HOGAR.test(n0) || !fecha)) acciones.push({ tipo: 'lista', texto: titulo, fecha: fecha || '', texto0: trozo });
      else acciones.push({ tipo: 'tarea', titulo, fecha: fecha || '', prioridad, tipoTarea: academico || !laboral ? 'estudio' : 'trabajo', texto: trozo });
    } else {
      acciones.push({ tipo: 'nota', texto: trozo.trim() });
    }
  }
  return acciones;
}
