// Función de Vercel "strava" (se publica sola en /api/strava).
// Conecta tu cuenta de Strava y trae tus entrenos (los que sube tu reloj Garmin, Apple Watch, Coros…).
//
// Por qué hace falta: Strava exige un "secreto de cliente" que no puede estar en la web (lo vería cualquiera).
// Vive aquí, en las variables de entorno de Vercel: STRAVA_CLIENT_ID y STRAVA_CLIENT_SECRET.
// Todo lo que se guarda en Supabase se hace CON TU SESIÓN (tu token de usuario), así que las reglas de
// seguridad (RLS) siguen funcionando: esta función no puede tocar datos de otra persona.
//
// Acciones:
//   GET  ?accion=estado                  → ¿está configurado Strava en Vercel?
//   POST ?accion=iniciar                 → estado firmado con tu id (protege la vuelta de Strava)
//   GET  ?accion=autorizar&state=…       → te manda a Strava para dar permiso
//   POST ?accion=canjear  {code, state}  → guarda la conexión (tras volver de Strava)
//   POST ?accion=sincronizar             → trae los entrenos nuevos
//   POST ?accion=desconectar             → quita el permiso y borra la conexión
const SUPABASE_URL = 'https://lqbqlgkuubyukqbhckck.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4KJkWRlKFHDTvA6-w5UisA_qFN_r68T';
const STRAVA = 'https://www.strava.com';
const ID = () => process.env.STRAVA_CLIENT_ID;
const SECRETO = () => process.env.STRAVA_CLIENT_SECRET;

// ---------- Deportes de Strava → deportes de SYNCO ----------
const DEPORTES = {
  correr: ['Run', 'TrailRun', 'VirtualRun'],
  bici: ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'EMountainBikeRide', 'Velomobile', 'Handcycle'],
  nadar: ['Swim'],
  caminar: ['Walk', 'Hike'],
  gimnasio: ['WeightTraining', 'Crossfit', 'Workout', 'HighIntensityIntervalTraining', 'StairStepper', 'Elliptical', 'RockClimbing'],
  futbol: ['Soccer'],
  baloncesto: ['Basketball'],
  raqueta: ['Tennis', 'Padel', 'Squash', 'Badminton', 'TableTennis', 'Pickleball', 'Racquetball'],
  flexibilidad: ['Yoga', 'Pilates'],
  remo: ['Rowing', 'VirtualRow', 'Kayaking', 'Canoeing', 'StandUpPaddling'],
};
const deporteDe = tipo => Object.keys(DEPORTES).find(k => DEPORTES[k].includes(tipo)) || 'otro';

// Una actividad de Strava → fila de la tabla actividades
function aActividad(a) {
  const tipo = a.sport_type || a.type;
  const km = a.distance ? Math.round(a.distance / 10) / 100 : null;
  return {
    fecha: String(a.start_date_local || a.start_date).slice(0, 10),
    inicio: a.start_date || null,
    deporte: deporteDe(tipo),
    tipo_origen: tipo || null,
    nombre: a.name ? String(a.name).slice(0, 200) : null,
    distancia_km: km || null,
    duracion_seg: a.moving_time || null,
    tiempo_total_seg: a.elapsed_time || null,
    desnivel_m: a.total_elevation_gain != null ? Math.round(a.total_elevation_gain * 10) / 10 : null,
    fc_media: a.has_heartrate && a.average_heartrate ? Math.round(a.average_heartrate) : null,
    fc_max: a.has_heartrate && a.max_heartrate ? Math.round(a.max_heartrate) : null,
    // En la lista, Strava solo da kilojulios (bici con potencia). Pedaleando, 1 kJ de trabajo ≈ 1 kcal gastada.
    kcal: a.calories ? Math.round(a.calories) : a.kilojoules ? Math.round(a.kilojoules) : null,
    vel_media_kmh: a.average_speed ? Math.round(a.average_speed * 3.6 * 100) / 100 : null,
    potencia_media: a.average_watts ? Math.round(a.average_watts) : null,
    cadencia: a.average_cadence ? Math.round(a.average_cadence * 10) / 10 : null,
    mapa: a.map?.summary_polyline || null,
    fuente: 'strava',
    externo_id: String(a.id),
  };
}

// Una carrera de Strava → fila de la tabla carreras (la que usa tu plan de running)
// workout_type de Strava para correr: 1 = competición, 2 = tirada larga, 3 = entrenamiento (series)
function aCarrera(a) {
  const km = a.distance ? Math.round(a.distance / 100) / 10 : null;
  // Una competición se guarda como tempo (es un esfuerzo fuerte y continuo; Running no tiene tipo «carrera»)
  const tipo = a.workout_type === 3 ? 'series' : a.workout_type === 2 ? 'larga' : a.workout_type === 1 ? 'tempo' : km >= 14 ? 'larga' : 'easy';
  return {
    fecha: String(a.start_date_local || a.start_date).slice(0, 10),
    tipo,
    distancia_km: km,
    duracion_seg: a.moving_time || null,
    fc_media: a.has_heartrate && a.average_heartrate ? Math.round(a.average_heartrate) : null,
    fc_max: a.has_heartrate && a.max_heartrate ? Math.round(a.max_heartrate) : null,
    notas: a.name ? String(a.name).slice(0, 200) : null,
    fuente: 'strava',
    strava_id: a.id,
  };
}

// ¿Hay una carrera apuntada a mano el mismo día y con distancia parecida (±15 %, mínimo 0,5 km)?
function emparejarManual(existentes, r) {
  return existentes.find(e => !e.strava_id && e.fuente !== 'test' && e.fecha === r.fecha
    && (!e.distancia_km || !r.distancia_km || Math.abs(Number(e.distancia_km) - r.distancia_km) <= Math.max(0.5, r.distancia_km * 0.15))) || null;
}

// ---------- Utilidades ----------
const responder = (res, status, cuerpo) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
};
async function leerCuerpo(req) {
  let cuerpo;
  try { cuerpo = req.body; } catch { return {}; }     // JSON mal formado
  if (cuerpo && typeof cuerpo === 'object' && !Buffer.isBuffer(cuerpo)) return cuerpo;
  const t = typeof cuerpo === 'string' ? cuerpo : await new Promise(ok => { let s = ''; req.on('data', c => { s += c; }); req.on('end', () => ok(s)); req.on('error', () => ok('')); });
  try { return JSON.parse(t || '{}'); } catch { return {}; }
}
// Supabase con tu sesión
function db(jwt) {
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
  return async (ruta, { method = 'GET', body, prefer } = {}) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { method, headers: prefer ? { ...h, Prefer: prefer } : h, body: body ? JSON.stringify(body) : undefined });
    const texto = await r.text();
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${texto.slice(0, 200)}`);
    return texto ? JSON.parse(texto) : null;
  };
}
async function usuario(req) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, jwt } : null;
}
async function token(cuerpo) {
  const r = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: ID(), client_secret: SECRETO(), ...cuerpo }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || `Strava ${r.status}`), { status: r.status });
  return d;
}

// ---------- Firma del permiso ----------
// Antes de ir a Strava, la app pide aquí un "estado" firmado con tu id. Al volver, solo se acepta el
// código de Strava si ese estado es tuyo y tiene menos de 30 minutos: nadie puede colarte su cuenta.
const crypto = require('crypto');
const firmar = texto => crypto.createHmac('sha256', SECRETO()).update(texto).digest('base64url').slice(0, 32);
function crearEstado(uid) {
  const base = `${uid}.${Math.floor(Date.now() / 1000) + 1800}`;
  return `${base}.${firmar(base)}`;
}
function estadoValido(estado, uid) {
  const m = String(estado || '').match(/^([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]{32})$/);
  if (!m || m[1] !== uid || Number(m[2]) < Date.now() / 1000) return false;
  const esperado = firmar(`${m[1]}.${m[2]}`);
  return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(m[3]));
}

// ---------- Acciones ----------
async function canjear(u, { code, state }) {
  if (!code || !/^[A-Za-z0-9]{10,80}$/.test(code)) return [400, { ok: false, mensaje: 'Falta el permiso de Strava.' }];
  if (!estadoValido(state, u.id)) return [403, { ok: false, mensaje: 'Este enlace de Strava no es tuyo o ha caducado. Vuelve a pulsar «Conectar con Strava».' }];
  const t = await token({ code, grant_type: 'authorization_code' });
  const alcance = String(t.scope || '');
  const fila = {
    user_id: u.id,
    athlete_id: t.athlete?.id || null,
    nombre: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || null,
    access_token: t.access_token, refresh_token: t.refresh_token, expira: t.expires_at,
    ultimo_sync: 0, actualizado: new Date().toISOString(),
  };
  await db(u.jwt)('strava_conexion?on_conflict=user_id', { method: 'POST', body: fila, prefer: 'resolution=merge-duplicates' });
  return [200, { ok: true, nombre: fila.nombre, aviso: alcance && !/activity:read/.test(alcance) ? 'No diste permiso para ver tus actividades: vuelve a conectar y marca esa casilla.' : null }];
}

async function sincronizar(u) {
  const q = db(u.jwt);
  const [c] = await q('strava_conexion?select=*');
  if (!c) return [404, { ok: false, mensaje: 'Strava no está conectado.' }];
  let acceso = c.access_token;
  // El permiso de Strava caduca cada 6 horas: se renueva solo
  if (!c.expira || c.expira < Date.now() / 1000 + 120) {
    const t = await token({ grant_type: 'refresh_token', refresh_token: c.refresh_token });
    acceso = t.access_token;
    await q(`strava_conexion?user_id=eq.${u.id}`, { method: 'PATCH', body: { access_token: t.access_token, refresh_token: t.refresh_token, expira: t.expires_at, actualizado: new Date().toISOString() } });
  }
  // Desde la última vez (con 7 días de margen por si subes algo con retraso). La primera vez, 90 días.
  const desde = c.ultimo_sync ? c.ultimo_sync - 7 * 86400 : Math.floor(Date.now() / 1000) - 90 * 86400;
  const todas = [];
  let cortado = false;     // Strava nos frenó (límite de peticiones): no se da por terminada
  for (let pagina = 1; pagina <= 4; pagina++) {
    const r = await fetch(`${STRAVA}/api/v3/athlete/activities?after=${desde}&per_page=100&page=${pagina}`, { headers: { Authorization: `Bearer ${acceso}` } });
    if (r.status === 401) return [401, { ok: false, mensaje: 'Strava ha retirado el permiso. Vuelve a conectar.' }];
    if (r.status === 429) { cortado = true; break; }     // límite de Strava: lo que falte llegará la próxima vez
    if (!r.ok) throw new Error(`Strava ${r.status}`);
    const lote = await r.json();
    todas.push(...lote);
    if (lote.length < 100) break;
  }
  if (todas.length) {
    await q('actividades?on_conflict=user_id,externo_id', { method: 'POST', body: todas.map(aActividad).map(a => ({ ...a, user_id: u.id })), prefer: 'resolution=merge-duplicates,return=minimal' });
    // Las carreras también van a tu bloque de Running (si ya estaba, no se toca: puede que la hayas corregido)
    const runs = todas.filter(a => deporteDe(a.sport_type || a.type) === 'correr' && a.distance > 0).map(aCarrera);
    if (runs.length) {
      // Si ya la habías apuntado a mano ese día (distancia parecida), se enlaza con Strava en vez de duplicarla
      const fechas = [...new Set(runs.map(r => r.fecha))];
      const existentes = await q(`carreras?select=id,fecha,distancia_km,strava_id,fc_media,fuente&fecha=in.(${fechas.join(',')})`);
      const nuevas = [];
      for (const r of runs) {
        if (existentes.some(e => String(e.strava_id) === String(r.strava_id))) continue;
        const manual = emparejarManual(existentes, r);
        if (manual) {
          manual.strava_id = r.strava_id;
          await q(`carreras?id=eq.${manual.id}`, { method: 'PATCH', body: { strava_id: r.strava_id, ...(manual.fc_media ? {} : { fc_media: r.fc_media, fc_max: r.fc_max }) } });
        } else nuevas.push({ ...r, user_id: u.id });
      }
      if (nuevas.length) await q('carreras?on_conflict=strava_id', { method: 'POST', body: nuevas, prefer: 'resolution=ignore-duplicates,return=minimal' });
    }
  }
  const ultimo = todas.reduce((m, a) => Math.max(m, Math.floor(new Date(a.start_date).getTime() / 1000) || 0), c.ultimo_sync || 0);
  const cambios = { actualizado: new Date().toISOString() };
  if (!cortado) cambios.ultimo_sync = ultimo || Math.floor(Date.now() / 1000) - 7 * 86400;
  await q(`strava_conexion?user_id=eq.${u.id}`, { method: 'PATCH', body: cambios });
  return [200, { ok: true, nuevas: todas.length, carreras: todas.filter(a => deporteDe(a.sport_type || a.type) === 'correr').length }];
}

async function desconectar(u) {
  const q = db(u.jwt);
  const [c] = await q('strava_conexion?select=access_token,refresh_token,expira');
  if (c?.expira && c.expira < Date.now() / 1000 + 60 && c.refresh_token) {
    try { const t = await token({ grant_type: 'refresh_token', refresh_token: c.refresh_token }); c.access_token = t.access_token; } catch { /* sigue: se borra igual */ }
  }
  if (c?.access_token) await fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: c.access_token }) }).catch(() => {});
  await q(`strava_conexion?user_id=eq.${u.id}`, { method: 'DELETE' });
  return [200, { ok: true }];
}

// ---------- Entrada ----------
async function manejador(req, res) {
  const params = new URL(req.url, 'http://x').searchParams;
  const accion = params.get('accion');
  const configurado = !!(ID() && SECRETO());

  if (accion === 'estado') return responder(res, 200, { configurado });
  if (!configurado) return responder(res, 503, { ok: false, mensaje: 'Falta configurar Strava en Vercel (STRAVA_CLIENT_ID y STRAVA_CLIENT_SECRET).' });

  if (accion === 'autorizar') {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const estado = (params.get('state') || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120);
    const vuelta = `https://${host}/?strava=vuelta`;
    const url = `${STRAVA}/oauth/authorize?client_id=${encodeURIComponent(ID())}&response_type=code&approval_prompt=auto`
      + `&scope=read,activity:read_all&redirect_uri=${encodeURIComponent(vuelta)}&state=${estado}`;
    res.statusCode = 302;
    res.setHeader('Location', url);
    return res.end();
  }

  if (req.method !== 'POST') return responder(res, 405, { ok: false, mensaje: 'Usa POST.' });
  const u = await usuario(req);
  if (!u) return responder(res, 401, { ok: false, mensaje: 'Inicia sesión en SYNCO.' });
  try {
    const [status, cuerpo] = accion === 'iniciar' ? [200, { ok: true, state: crearEstado(u.id) }]
      : accion === 'canjear' ? await canjear(u, await leerCuerpo(req))
      : accion === 'sincronizar' ? await sincronizar(u)
      : accion === 'desconectar' ? await desconectar(u)
      : [400, { ok: false, mensaje: 'Acción desconocida.' }];
    return responder(res, status, cuerpo);
  } catch (e) {
    console.error('strava', accion, e.message);
    return responder(res, e.status === 400 || e.status === 401 ? 401 : 502, { ok: false, mensaje: e.status === 400 || e.status === 401 ? 'Strava no ha aceptado el permiso. Vuelve a conectar.' : 'Strava no responde ahora mismo. Se volverá a intentar.' });
  }
}

module.exports = manejador;
module.exports.aActividad = aActividad;
module.exports.aCarrera = aCarrera;
module.exports.deporteDe = deporteDe;
