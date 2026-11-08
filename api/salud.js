// Función de Vercel "salud" (se publica sola en /api/salud).
// Recibe lo que manda el Atajo del iPhone (datos de la app Salud: sueño, pulso, pasos…) y lo guarda
// en tu cuenta. El Atajo no puede iniciar sesión: se identifica con tu código secreto (?t=…),
// que solo ves tú en SYNCO → Salud → Reloj → Conectar.
//
// El Atajo puede mandar los números como texto y con formato español ("8.432", "62,5", "7 h 32 min"),
// así que aquí se limpia todo antes de guardarlo. Cualquier dato que falte se deja como estaba.
const SUPABASE_URL = 'https://lqbqlgkuubyukqbhckck.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4KJkWRlKFHDTvA6-w5UisA_qFN_r68T';
const ZONA = 'Europe/Madrid';

// ---------- Números ----------
// "8.432" → 8432 · "62,5" → 62.5 · "1.234,5" → 1234.5 · "62.5" → 62.5 · 70 → 70
function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (Array.isArray(v)) return v.length ? numero(v[0]) : null;
  let s = String(v).trim().replace(/\s| | /g, '');
  const m = s.match(/-?[\d.,]+/);
  if (!m) return null;
  s = m[0];
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');      // 8.432 / 1.234,5
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');                    // 8,432 / 1,234.5 (formato inglés)
  else s = s.replace(',', '.');                                                              // 62,5
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- Duraciones (en minutos) ----------
// Con unidad escrita se respeta: "7 h 32 min" · "7:32" · "27120 s" · "7,5 h".
// Un número suelto: más de 1440 → segundos; si no → minutos.
// Solo para el TOTAL de sueño, un número de 16 o menos se entiende como horas (nadie duerme 16 minutos en total).
function minutos(v, { horasSiPequeno = false } = {}) {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) {        // lista de duraciones (p. ej. tramos de sueño): se suman
    const ns = v.map(x => minutos(x)).filter(x => x !== null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) : null;
  }
  if (typeof v === 'number') return porTamano(v, horasSiPequeno);
  const s = String(v).trim().toLowerCase();
  let m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
  const h = s.match(/([\d.,]+)\s*(h|hr|hrs|hora|horas)\b/);
  const mi = s.match(/([\d.,]+)\s*(m|min|mins|minuto|minutos)\b/);
  const se = s.match(/([\d.,]+)\s*(s|seg|sec|segundo|segundos)\b/);
  if (h || mi || se) return (h ? numero(h[1]) * 60 : 0) + (mi ? numero(mi[1]) : 0) + (se ? numero(se[1]) / 60 : 0);
  m = s.match(/^(\d+)\s*h\s*(\d+)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = numero(s);
  return n === null ? null : porTamano(n, horasSiPequeno);
}
function porTamano(n, horasSiPequeno) {
  if (n <= 0) return null;
  if (horasSiPequeno && n <= 16) return n * 60;
  return n > 1440 ? n / 60 : n;
}

// ---------- Fechas ----------
const hoyEn = (zona = ZONA, mas = 0) => {
  const d = new Date(Date.now() + mas * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: zona });
};
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12 };
function fecha(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'hoy' || s === 'today') return hoyEn();
  if (s === 'ayer' || s === 'yesterday') return hoyEn(ZONA, -1);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return iso(m[3], m[2], m[1]);
  m = s.match(/(\d{1,2})\s+(?:de\s+)?([a-zé]{3})[a-zé]*\.?\s+(?:de\s+)?(\d{4})/);
  if (m && MESES[m[2]]) return iso(m[3], MESES[m[2]], m[1]);
  return null;
}
function iso(a, m, d) {
  a = Number(a); if (a < 100) a += 2000;
  const f = new Date(Date.UTC(a, Number(m) - 1, Number(d)));
  if (f.getUTCMonth() !== Number(m) - 1) return null;
  return f.toISOString().slice(0, 10);
}

// ---------- Nombres de los campos ----------
// El Atajo puede usar nombres en español o inglés; todos llevan al mismo campo.
const ALIAS = {
  pasos: ['pasos', 'steps', 'step_count'],
  distancia_km: ['distancia_km', 'distancia', 'distance', 'km'],
  kcal_activas: ['kcal_activas', 'kcal', 'calorias', 'energia_activa', 'active_energy', 'active_calories'],
  minutos_ejercicio: ['minutos_ejercicio', 'ejercicio', 'exercise_minutes'],
  pisos: ['pisos', 'plantas', 'flights', 'flights_climbed'],
  sueno: ['sueno', 'sueño', 'sueno_min', 'sleep', 'horas_sueno', 'dormido'],
  sueno_profundo: ['sueno_profundo', 'profundo', 'deep', 'sueno_profundo_min'],
  sueno_rem: ['sueno_rem', 'rem', 'sueno_rem_min'],
  sueno_ligero: ['sueno_ligero', 'ligero', 'nucleo', 'núcleo', 'core', 'sueno_ligero_min'],
  despierto: ['despierto', 'awake', 'despierto_min'],
  fc_media: ['fc_media', 'pulso_medio', 'heart_rate_avg', 'fc'],
  fc_min: ['fc_min', 'pulso_min', 'heart_rate_min'],
  fc_max: ['fc_max', 'pulso_max', 'heart_rate_max'],
  fc_reposo: ['fc_reposo', 'reposo', 'resting_heart_rate', 'pulso_reposo'],
  vfc: ['vfc', 'hrv', 'variabilidad'],
  spo2: ['spo2', 'oxigeno', 'oxígeno', 'saturacion', 'blood_oxygen'],
  peso: ['peso', 'weight'],
  fecha: ['fecha', 'date', 'dia', 'día'],
};
const normalizar = cuerpo => Object.fromEntries(Object.entries(cuerpo).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, '_'), v]));
function campoExacto(cuerpo, nombres) {
  const normal = normalizar(cuerpo);
  for (const a of nombres) if (normal[a] !== undefined && normal[a] !== '') return normal[a];
  return undefined;
}
const campo = (cuerpo, clave) => campoExacto(cuerpo, ALIAS[clave]);

// Dentro de lo razonable; si no, se descarta (mejor vacío que un dato absurdo)
const entre = (n, min, max, redondeo = 0) => {
  if (n === null || n === undefined || !Number.isFinite(n) || n < min || n > max) return null;
  const k = 10 ** redondeo;
  return Math.round(n * k) / k;
};

// Convierte lo que manda el Atajo en una fila limpia de salud_dias
function limpiar(cuerpo, ahora = { hoy: hoyEn() }) {
  const n = k => numero(campo(cuerpo, k));
  // Duración con la unidad en el nombre (sueno_seg, sueno_h, sueno_min) o deducida (sueno)
  const mins = (k, opciones) => {
    for (const [suf, f] of [['_min', 1], ['_seg', 1 / 60], ['_s', 1 / 60], ['_h', 60], ['_horas', 60]]) {
      const v = numero(campoExacto(cuerpo, ALIAS[k].map(a => a.replace(/_min$/, '') + suf)));
      if (v !== null) return v * f;
    }
    return minutos(campo(cuerpo, k), opciones);
  };
  let spo2 = n('spo2');
  if (spo2 !== null && spo2 <= 1) spo2 *= 100;                 // 0,97 → 97 %
  let dist = n('distancia_km');
  if (dist !== null && dist > 200) dist /= 1000;               // llegó en metros
  const dia = {
    fecha: fecha(campo(cuerpo, 'fecha')) || ahora.hoy,
    pasos: entre(n('pasos'), 0, 150000),
    distancia_km: entre(dist, 0, 200, 2),
    kcal_activas: entre(n('kcal_activas'), 0, 10000),
    minutos_ejercicio: entre(n('minutos_ejercicio'), 0, 1440),
    pisos: entre(n('pisos'), 0, 1000),
    sueno_min: entre(mins('sueno', { horasSiPequeno: true }), 0, 1440),
    sueno_profundo_min: entre(mins('sueno_profundo'), 0, 1440),
    sueno_rem_min: entre(mins('sueno_rem'), 0, 1440),
    sueno_ligero_min: entre(mins('sueno_ligero'), 0, 1440),
    despierto_min: entre(mins('despierto'), 0, 1440),
    fc_media: entre(n('fc_media'), 25, 230),
    fc_min: entre(n('fc_min'), 25, 230),
    fc_max: entre(n('fc_max'), 25, 240),
    fc_reposo: entre(n('fc_reposo'), 25, 150),
    vfc: entre(n('vfc'), 1, 400),
    spo2: entre(spo2, 50, 100, 1),
    peso: entre(n('peso'), 20, 400, 2),
  };
  // Si solo llegan las fases del sueño, el total es su suma
  if (dia.sueno_min === null) {
    const fases = [dia.sueno_profundo_min, dia.sueno_rem_min, dia.sueno_ligero_min].filter(x => x !== null);
    if (fases.length) dia.sueno_min = Math.round(fases.reduce((a, b) => a + b, 0));
  }
  for (const k of Object.keys(dia)) if (typeof dia[k] === 'number' && k.endsWith('_min')) dia[k] = Math.round(dia[k]);
  return dia;
}

// ---------- Lectura del cuerpo de la petición ----------
async function leerCuerpo(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let texto = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!texto) texto = await new Promise(ok => { let t = ''; req.on('data', c => { t += c; if (t.length > 100000) req.destroy(); }); req.on('end', () => ok(t)); req.on('error', () => ok('')); });
  texto = texto.trim();
  if (!texto) return {};
  try { return JSON.parse(texto); } catch { /* sigue */ }
  try { return Object.fromEntries(new URLSearchParams(texto)); } catch { return {}; }
}

const responder = (res, status, cuerpo) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
};

async function guardar(token, dia, crudo) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/salud_ingesta`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_dia: { ...dia, crudo } }),
  });
  return r.ok ? r.json() : `error ${r.status}`;
}

async function manejador(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); return responder(res, 204, {}); }
  const params = new URL(req.url, 'http://x').searchParams;
  const token = (params.get('t') || req.headers['x-synco-codigo'] || '').trim();
  if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return responder(res, 401, { ok: false, mensaje: 'Falta tu código de SYNCO o no es válido.' });

  if (req.method === 'GET') return responder(res, 200, { ok: true, mensaje: 'SYNCO está listo para recibir tus datos. El Atajo debe enviarlos con el método POST.' });
  if (req.method !== 'POST') return responder(res, 405, { ok: false, mensaje: 'Usa POST.' });

  const cuerpo = await leerCuerpo(req);
  // Se puede mandar un día ({…}) o varios ({ dias: [{…}, {…}] })
  const lista = Array.isArray(cuerpo?.dias) ? cuerpo.dias.slice(0, 31) : [cuerpo];
  const resultados = [];
  for (const crudo of lista) {
    if (!crudo || typeof crudo !== 'object') continue;
    const dia = limpiar(crudo);
    const datos = Object.entries(dia).filter(([k, v]) => k !== 'fecha' && v !== null).length;
    if (!datos) { resultados.push({ fecha: dia.fecha, ok: false, mensaje: 'No ha llegado ningún dato que se entienda.' }); continue; }
    let r;
    try { r = await guardar(token, dia, crudo); } catch { r = 'red'; }
    resultados.push({ fecha: dia.fecha, ok: r === 'ok', datos, mensaje: r === 'ok' ? `Guardados ${datos} datos` : r === 'codigo' ? 'Este código ya no es válido: cópialo de nuevo en SYNCO.' : r === 'fecha' ? 'La fecha no es válida.' : 'No se pudo guardar. Inténtalo más tarde.' });
  }
  if (!resultados.length) return responder(res, 400, { ok: false, mensaje: 'No ha llegado nada. Revisa el paso «Obtener contenido de URL» del Atajo.' });
  const ok = resultados.every(x => x.ok);
  const codigoMalo = resultados.some(x => /código/.test(x.mensaje));
  return responder(res, ok ? 200 : codigoMalo ? 401 : 400, { ok, mensaje: resultados.map(x => `${x.fecha}: ${x.mensaje}`).join(' · '), resultados });
}

module.exports = manejador;
module.exports.limpiar = limpiar;
module.exports.minutos = minutos;
module.exports.numero = numero;
module.exports.fecha = fecha;
