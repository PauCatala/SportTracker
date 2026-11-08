// SALUD · RELOJ
// Tu cuerpo día a día con lo que miden tu reloj y tu iPhone, sin apuntar nada a mano:
//   - Apple Salud (sueño, pulso, pasos, VFC…) → llega cada día con un Atajo del iPhone (api/salud.js).
//     Casi todos los relojes (Garmin, Apple Watch, Coros, Polar…) vuelcan sus datos en Apple Salud.
//   - Strava (tus entrenos: distancia, ritmo, desnivel, tiempo, pulso) → se traen solos al abrir SYNCO
//     (api/strava.js). Las carreras pasan también a tu bloque de Running.
// Pestañas: Hoy · Entrenos · Tendencias · Conectar.
import { supabase, cargarTodo } from '../db.js';
import { leer, guardar, escapar } from '../almacen.js';
import { cargador } from '../marca-anim.js';
import { hoyISO, sumarDias, lunesDe, fmtCorta, fmtTiempo, fmtRitmo, aviso } from '../utils.js';
import { grafica, ejeX, ejeY, C } from '../graficos.js';

/* =====================================================================
   DATOS
   ===================================================================== */
export const reloj = {
  dias: [],            // salud_dias, de más antiguo a más reciente
  actividades: [],     // actividades, de más reciente a más antigua
  salud: null,         // { token, ultimo_envio } (Atajo del iPhone)
  strava: null,        // { nombre, ultimo_sync, actualizado }
  cargado: false,
  error: null,
};
let cargando = null;

export function cargarReloj(forzar = false) {
  if (cargando && !forzar) return cargando;
  cargando = (async () => {
    const desde = sumarDias(hoyISO(), -180);
    const [d, a, s, st] = await Promise.all([
      supabase.from('salud_dias').select('*').gte('fecha', desde).order('fecha'),
      supabase.from('actividades').select('*').gte('fecha', sumarDias(hoyISO(), -365)).order('inicio', { ascending: false }).limit(600),
      supabase.from('salud_conexion').select('token, ultimo_envio').maybeSingle(),
      supabase.from('strava_conexion').select('nombre, ultimo_sync, actualizado').maybeSingle(),
    ]);
    const fallo = [d, a, s, st].find(r => r.error)?.error;
    reloj.error = fallo ? (/does not exist|PGRST205|42P01|schema cache/i.test(`${fallo.code} ${fallo.message}`) ? 'migracion' : fallo.message) : null;
    reloj.dias = d.data || [];
    reloj.actividades = a.data || [];
    reloj.salud = s.data || null;
    reloj.strava = st.data || null;
    reloj.cargado = true;
    return reloj;
  })().catch(e => { reloj.error = e.message; reloj.cargado = true; return reloj; });
  return cargando;
}
// Repinta solo si estás viendo Reloj (así no se borra un formulario a medias en otra pantalla)
const avisarCambio = () => { if (document.querySelector('.cs[data-bloque="reloj"]')) dispatchEvent(new CustomEvent('synco:datos')); };

/* ---------- Llamadas a las funciones de Vercel ---------- */
async function api(ruta, opciones = {}) {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  const r = await fetch(`/api/${ruta}`, { ...opciones, headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...(opciones.headers || {}) } });
  const cuerpo = await r.json().catch(() => ({ ok: false, mensaje: r.status === 404 ? 'Esta función solo existe en la web publicada (Vercel).' : `Error ${r.status}` }));
  return { status: r.status, ...cuerpo };
}

/* ---------- Strava ---------- */
const CLAVE_ULTIMO = 'synco-strava-ultimo';
const aleatorio = (n = 32) => { const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; const v = crypto.getRandomValues(new Uint8Array(n)); return [...v].map(x => abc[x % abc.length]).join(''); };

// Al volver de Strava la dirección trae ?strava=vuelta&code=…&state=… (se lee nada más cargar, antes de que la app la cambie)
let vuelta = (() => {
  const p = new URLSearchParams(location.search);
  if (p.get('strava') !== 'vuelta') return null;
  history.replaceState(null, '', location.pathname + location.hash);
  return { code: p.get('code'), state: p.get('state'), error: p.get('error') };
})();

// El servidor firma un "estado" con tu id: al volver, solo se acepta si es tuyo (nadie puede colarte su cuenta)
export async function conectarStrava() {
  const r = await api('strava?accion=iniciar', { method: 'POST' });
  if (!r.ok || !r.state) return aviso(r.mensaje || 'No se pudo empezar la conexión con Strava', 'error');
  location.href = `/api/strava?accion=autorizar&state=${encodeURIComponent(r.state)}`;
}

// Se llama al entrar en la cuenta: termina la conexión si venimos de Strava
export async function terminarConexionStrava() {
  if (!vuelta) return false;
  const { code, state, error } = vuelta;
  vuelta = null;     // se usa una sola vez
  if (error || !code) { aviso('No se ha conectado Strava: no diste permiso.', 'error'); return false; }
  const r = await api('strava?accion=canjear', { method: 'POST', body: JSON.stringify({ code, state }) });
  if (!r.ok) { aviso(r.mensaje || 'No se pudo conectar Strava', 'error'); return false; }
  aviso(r.aviso || `Strava conectado${r.nombre ? `: ${r.nombre}` : ''}. Trayendo tus entrenos…`, r.aviso ? 'error' : 'ok');
  await cargarReloj(true);
  await sincronizarStrava({ forzar: true });
  dispatchEvent(new CustomEvent('ir-a', { detail: 'salud|reloj|entrenos' }));
  return true;
}

// Trae los entrenos nuevos. Sola, como mucho cada 20 minutos; con el botón, siempre.
let sincronizando = null;
export function sincronizarStrava({ forzar = false } = {}) {
  if (sincronizando) return sincronizando;
  if (!reloj.strava) return Promise.resolve(null);
  let ultimo = 0;
  try { ultimo = Number(localStorage.getItem(CLAVE_ULTIMO)) || 0; } catch { /* nada */ }
  if (!forzar && Date.now() - ultimo < 20 * 60000) return Promise.resolve(null);
  sincronizando = (async () => {
    const r = await api('strava?accion=sincronizar', { method: 'POST' }).catch(() => ({ ok: false, mensaje: 'Sin conexión: Strava se sincronizará más tarde' }));
    try { localStorage.setItem(CLAVE_ULTIMO, String(Date.now())); } catch { /* nada */ }
    if (r.ok) {
      const antes = new Set(reloj.actividades.map(a => a.externo_id));
      await cargarReloj(true);
      const nuevas = reloj.actividades.filter(a => !antes.has(a.externo_id));
      if (nuevas.length) {
        if (nuevas.some(a => a.deporte === 'correr')) await cargarTodo();     // tu plan de running se pone al día
        aviso(nuevas.length === 1 ? `Nuevo entreno de Strava: ${nuevas[0].nombre || NOMBRE_DEP[nuevas[0].deporte]}` : `${nuevas.length} entrenos nuevos de Strava`);
        avisarCambio();
      } else if (forzar) aviso('Strava al día: no hay entrenos nuevos');
    } else if (forzar) aviso(r.mensaje || 'No se pudo sincronizar Strava', 'error');
    return r;
  })().finally(() => { sincronizando = null; });
  return sincronizando;
}

// Al entrar: carga, termina la conexión con Strava si venimos de allí, y trae lo nuevo
export async function iniciarReloj() {
  await cargarReloj(true);
  if (!(await terminarConexionStrava())) sincronizarStrava().catch(e => console.warn('Strava', e));
  avisarCambio();
}

/* ---------- Código del Atajo ---------- */
async function codigoAtajo(renovar = false) {
  if (reloj.salud?.token && !renovar) return reloj.salud.token;
  const token = aleatorio(40);
  const { error } = await supabase.from('salud_conexion').upsert({ token }, { onConflict: 'user_id' });
  if (error) throw error;
  reloj.salud = { ...(reloj.salud || {}), token, ultimo_envio: renovar ? null : reloj.salud?.ultimo_envio || null };
  return token;
}
const urlAtajo = token => `${location.origin}/api/salud?t=${token}`;

/* =====================================================================
   CÁLCULOS
   ===================================================================== */
const valores = (campo, desde, hasta = hoyISO()) => reloj.dias.filter(d => d.fecha >= desde && d.fecha <= hasta && d[campo] != null).map(d => Number(d[campo]));
const media = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mediana = xs => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const diaDe = f => reloj.dias.find(d => d.fecha === f) || null;
const limitar = (x, a, b) => Math.max(a, Math.min(b, x));

// El día que se muestra: hoy si ya hay algo; si no, el último con datos
function diaActual() {
  const hoy = hoyISO();
  const d = diaDe(hoy);
  if (d && Object.keys(CAMPOS).some(k => d[k] != null)) return d;
  return [...reloj.dias].reverse().find(x => Object.keys(CAMPOS).some(k => x[k] != null)) || null;
}
const CAMPOS = { pasos: 1, sueno_min: 1, fc_media: 1, fc_reposo: 1, vfc: 1, kcal_activas: 1 };

// PREPARACIÓN (0-100): cómo llegas hoy, comparándote contigo mismo. Orientativo, no es un dato médico.
//  - Sueño: horas dormidas frente a 8 h.
//  - Pulso en reposo: frente a tu mediana de las 4 semanas anteriores (más alto = más cansancio).
//  - VFC: frente a tu mediana de las 4 semanas anteriores (más baja = más estrés).
export function preparacion(fecha = hoyISO()) {
  const d = diaDe(fecha);
  if (!d) return null;
  const base = campo => mediana(valores(campo, sumarDias(fecha, -28), sumarDias(fecha, -1)));
  const partes = [];
  if (d.sueno_min != null) partes.push({ id: 'sueno', peso: 0.4, nota: limitar((d.sueno_min / 480) * 100, 0, 100), texto: `${fmtHoras(d.sueno_min)} de sueño` });
  const bR = base('fc_reposo');
  if (d.fc_reposo != null && bR) {
    const dif = d.fc_reposo - bR;
    partes.push({ id: 'reposo', peso: 0.3, nota: limitar(dif >= 0 ? 80 - dif * 8 : 80 - dif * 4, 0, 100), texto: dif > 1 ? `pulso en reposo ${Math.round(dif)} lpm por encima de lo normal` : dif < -1 ? `pulso en reposo ${Math.round(-dif)} lpm por debajo de lo normal` : 'pulso en reposo normal' });
  }
  const bV = base('vfc');
  if (d.vfc != null && bV) {
    const r = d.vfc / bV;
    partes.push({ id: 'vfc', peso: 0.3, nota: limitar(80 + (r - 1) * 100, 0, 100), texto: r < 0.92 ? 'VFC más baja de lo habitual' : r > 1.08 ? 'VFC más alta de lo habitual' : 'VFC en tu rango' });
  }
  if (!partes.length) return null;
  const pesoTotal = partes.reduce((t, p) => t + p.peso, 0);
  const nota = Math.round(partes.reduce((t, p) => t + p.nota * p.peso, 0) / pesoTotal);
  const nivel = nota >= 75 ? { id: 'alto', titulo: 'Listo para apretar', consejo: 'Buen día para series, tiradas o subir cargas.' }
    : nota >= 55 ? { id: 'medio', titulo: 'Entreno normal', consejo: 'Sigue tu plan sin forzar de más.' }
    : { id: 'bajo', titulo: 'Mejor suave', consejo: 'Rodaje suave, movilidad o descanso: hoy recuperas.' };
  return { nota, ...nivel, partes, soloSueno: partes.length === 1 && partes[0].id === 'sueno' };
}

/* =====================================================================
   FORMATOS Y PIEZAS
   ===================================================================== */
const n0 = n => (n == null ? '–' : Math.round(n).toLocaleString('es-ES'));
const n1 = n => (n == null ? '–' : (Math.round(n * 10) / 10).toLocaleString('es-ES'));
export const fmtHoras = min => (min == null ? '–' : min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`);
function haceCuanto(fechaHora) {
  if (!fechaHora) return 'nunca';
  const s = (Date.now() - new Date(fechaHora).getTime()) / 1000;
  if (s < 90) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// Deportes
const ICONO_DEP = {
  correr: '<circle cx="15" cy="4.5" r="1.7"/><path d="M13.2 8.2l-2.3 4.8 3.1 2.6-1.2 5.4M10.9 13l-2.6 3.3-3.3-.8M7.6 10.4l5.6-2.2 2.7 3.1 2.6.6"/>',
  bici: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l3.7-7.5h5.6l3.7 7.5M9.2 9l3.3 7.5 2.3-7.5M13.5 5.5h2.7"/>',
  nadar: '<circle cx="16" cy="6" r="1.7"/><path d="M3 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M5 13l4.5-4 3 3 3.5-2"/>',
  caminar: '<circle cx="13" cy="4.5" r="1.7"/><path d="M11 21l2-6-2.5-2.5.8-4.5M13.5 13l2 3 1 5M11.3 8l-3 2.2-.8 3.3M11.3 8l3.2 2.4 2.5.4"/>',
  gimnasio: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  futbol: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4zM12 3.5v4M15.4 10l4-1.3M14.1 14l2.4 3.4M9.9 14l-2.4 3.4M8.6 10l-4-1.3"/>',
  baloncesto: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c2.5 2 2.5 10 0 12M18 6c-2.5 2-2.5 10 0 12"/>',
  raqueta: '<ellipse cx="14" cy="9" rx="5.5" ry="6" transform="rotate(35 14 9)"/><path d="M10.2 13.6l-5.7 5.9M9 4.5l9 9"/>',
  flexibilidad: '<circle cx="12" cy="4.8" r="1.7"/><path d="M12 8.3v5.2M4.5 19.2c2.2-3.3 4.7-4.6 7.5-4.6s5.3 1.3 7.5 4.6M7.2 11.4l4.8-1.3 4.8 1.3"/>',
  remo: '<path d="M3 16.5c3 2 15 2 18 0M5 9l14 6M7.5 6.5L5 9l2.8 1.2"/>',
  otro: '<path d="M13 3.5L6 13.5h5.5l-1 7 7-10H12l1-7z"/>',
};
export const NOMBRE_DEP = { correr: 'Carrera', bici: 'Bici', nadar: 'Natación', caminar: 'Caminata', gimnasio: 'Gimnasio', futbol: 'Fútbol', baloncesto: 'Baloncesto', raqueta: 'Raqueta', flexibilidad: 'Yoga y pilates', remo: 'Remo', otro: 'Otro' };
const iconoDep = dep => svg(ICONO_DEP[dep] || ICONO_DEP.otro);

// Ritmo o velocidad según el deporte
function marcha(a) {
  if (!a.distancia_km || !a.duracion_seg) return null;
  if (a.deporte === 'correr' || a.deporte === 'caminar') return { valor: fmtRitmo(a.duracion_seg / a.distancia_km), unidad: '/km', nombre: 'Ritmo' };
  if (a.deporte === 'nadar') return { valor: fmtRitmo(a.duracion_seg / (a.distancia_km * 10)), unidad: '/100 m', nombre: 'Ritmo' };
  return { valor: n1(a.distancia_km / (a.duracion_seg / 3600)), unidad: 'km/h', nombre: 'Velocidad' };
}

// Recorrido de Strava (polilínea codificada de Google) → dibujo SVG
function decodificar(cadena) {
  const puntos = []; let i = 0, lat = 0, lng = 0;
  while (i < cadena.length) {
    for (const eje of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = cadena.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < cadena.length);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (eje === 0) lat += d; else lng += d;
    }
    puntos.push([lat / 1e5, lng / 1e5]);
  }
  return puntos;
}
function recorrido(mapa, cls = '') {
  if (!mapa) return '';
  let pts;
  try { pts = decodificar(mapa); } catch { return ''; }
  if (pts.length < 2) return '';
  const k = Math.cos((pts[0][0] * Math.PI) / 180);     // corrige la longitud según la latitud
  const xs = pts.map(p => p[1] * k), ys = pts.map(p => -p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const ancho = Math.max(x1 - x0, y1 - y0) || 1, m = 6, L = 100 - 2 * m;
  const ox = m + (L - ((x1 - x0) / ancho) * L) / 2, oy = m + (L - ((y1 - y0) / ancho) * L) / 2;
  // Como mucho ~180 puntos: de sobra para un dibujo pequeño
  const paso = Math.max(1, Math.floor(pts.length / 180));
  const indices = xs.map((_, j) => j).filter(j => j % paso === 0 || j === xs.length - 1);
  const px = j => (ox + ((xs[j] - x0) / ancho) * L).toFixed(1), py = j => (oy + ((ys[j] - y0) / ancho) * L).toFixed(1);
  const d = indices.map((j, n) => `${n ? 'L' : 'M'}${px(j)} ${py(j)}`).join('');
  const ini = [px(0), py(0)], fin = [px(xs.length - 1), py(xs.length - 1)];
  return `<svg class="rj-ruta ${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="${d}"/><circle class="ini" cx="${ini[0]}" cy="${ini[1]}" r="2.6"/><circle class="fin" cx="${fin[0]}" cy="${fin[1]}" r="2.6"/></svg>`;
}

// Mini línea de los últimos días (sin librería). El punto final va aparte para que no se deforme al estirar.
function chispa(xs) {
  const v = xs.filter(x => x != null);
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
  const pts = xs.map((x, i) => (x == null ? null : [(i / (xs.length - 1)) * 100, 28 - ((x - min) / r) * 24])).filter(Boolean);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const u = pts.at(-1);
  return `<div class="rj-chispa"><svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg><i style="left:${u[0]}%;top:${(u[1] / 32) * 100}%"></i></div>`;
}
const ultimosDias = (campo, n = 14) => Array.from({ length: n }, (_, i) => diaDe(sumarDias(hoyISO(), i - n + 1))?.[campo] ?? null);

function aro(frac, centro, sub) {
  const f = limitar(frac || 0, 0, 1), R = 42, L = 2 * Math.PI * R;
  return `<div class="rj-aro"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="fondo"/><circle cx="50" cy="50" r="${R}" class="valor" style="stroke-dasharray:${(L * f).toFixed(1)} ${L.toFixed(1)}"/></svg><div><b>${centro}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}

const objetivoPasos = () => Number(leer('reloj-objetivo-pasos', 10000)) || 10000;

/* =====================================================================
   VISTAS
   ===================================================================== */
async function preparar(cont) {
  if (!reloj.cargado) { cont.innerHTML = cargador('Cargando tus datos del reloj…'); await cargarReloj(); }
  if (reloj.error === 'migracion') {
    cont.innerHTML = `<section class="panel"><h3>Falta un paso en la base de datos</h3><p>Ejecuta <code>sql/salud_reloj.sql</code> en el editor SQL de Supabase y vuelve a abrir SYNCO.</p></section>`;
    return false;
  }
  if (reloj.error) {
    cont.innerHTML = `<section class="panel"><h3>No se han podido cargar tus datos del reloj</h3><p class="tenue">${navigator.onLine ? 'Inténtalo de nuevo en un momento.' : 'Parece que no tienes conexión.'}</p><button class="btn chico" data-reintentar>Reintentar</button></section>`;
    cont.onclick = async ev => { if (ev.target.closest('[data-reintentar]')) { cont.innerHTML = cargador('Cargando…'); await cargarReloj(true); dispatchEvent(new CustomEvent('synco:datos')); } };
    return false;
  }
  return true;
}
const sinConexion = () => !reloj.salud?.ultimo_envio && !reloj.strava && !reloj.dias.length && !reloj.actividades.length;

// ------------------------------ HOY ------------------------------
export async function renderRelojHoy(cont) {
  if (!(await preparar(cont))) return;
  if (sinConexion()) {
    cont.innerHTML = `
      <section class="panel rj-bienvenida">
        <span class="rj-insignia">${svg('<rect x="7" y="6.5" width="10" height="11" rx="3"/><path d="M9 6.5l.6-3h4.8l.6 3M9 17.5l.6 3h4.8l.6-3M12 9.8V12l1.6 1"/>')}</span>
        <h3>Tu reloj, dentro de SYNCO</h3>
        <p>Conecta una vez y cada día verás aquí tu sueño, tu pulso, tus pasos y tus entrenos, sin apuntar nada.</p>
        <div class="rj-dos">
          <div><b>Apple Salud</b><span>Sueño, pulso en reposo, VFC, pasos y energía. Vale para Garmin, Apple Watch y casi cualquier reloj.</span></div>
          <div><b>Strava</b><span>Tus entrenos con distancia, ritmo, desnivel, tiempo y pulso. Las carreras van solas a tu plan de running.</span></div>
        </div>
        <button class="btn primario" data-ir-vista="conectar">Conectar</button>
      </section>`;
    cont.onclick = ev => { if (ev.target.closest('[data-ir-vista]')) dispatchEvent(new CustomEvent('ir-a', { detail: 'salud|reloj|conectar' })); };
    return;
  }

  const d = diaActual();
  const hoy = hoyISO();
  const esHoy = d?.fecha === hoy;
  const prep = d ? preparacion(d.fecha) : null;
  const sem = sumarDias(hoy, -6);
  const sueno7 = media(valores('sueno_min', sem));
  const pasos7 = media(valores('pasos', sem));
  const reposo28 = mediana(valores('fc_reposo', sumarDias(hoy, -28), sumarDias(hoy, -1)));
  const objP = objetivoPasos();
  const fases = d ? [['profundo', 'Profundo', d.sueno_profundo_min], ['rem', 'REM', d.sueno_rem_min], ['ligero', 'Ligero', d.sueno_ligero_min], ['despierto', 'Despierto', d.despierto_min]].filter(f => f[2] != null) : [];
  const totalFases = fases.reduce((t, f) => t + f[2], 0);
  const recientes = reloj.actividades.slice(0, 4);

  cont.innerHTML = `
    ${d && !esHoy ? `<p class="rj-nota">Aún no han llegado los datos de hoy. Te enseño los del <b>${fmtCorta(d.fecha).toLowerCase()}</b>.</p>` : ''}
    ${!d ? '<p class="rj-nota">Aún no ha llegado ningún día de Apple Salud. Mira la pestaña Conectar.</p>' : ''}

    ${prep ? `
    <section class="panel rj-prep rj-${prep.id}">
      ${aro(prep.nota / 100, prep.nota, 'de 100')}
      <div>
        <span class="rj-eti">Preparación ${esHoy ? 'de hoy' : ''}</span>
        <h3>${prep.titulo}</h3>
        <p>${prep.consejo}</p>
        <ul class="rj-motivos">${prep.partes.map(p => `<li class="${p.nota >= 75 ? 'bien' : p.nota >= 55 ? 'regular' : 'mal'}"><i></i>${escapar(p.texto)}</li>`).join('')}</ul>
        ${prep.soloSueno ? '<p class="rj-pie">Con el pulso en reposo y la VFC de tu reloj, esta nota será más fina.</p>' : ''}
      </div>
    </section>` : ''}

    <div class="rj-rejilla">
      <section class="panel rj-tarjeta rj-sueno">
        <header><h3>Sueño</h3>${sueno7 ? `<span>Media 7 días: ${fmtHoras(sueno7)}</span>` : ''}</header>
        <p class="rj-grande">${d?.sueno_min != null ? `${Math.floor(d.sueno_min / 60)}<small>h</small> ${String(d.sueno_min % 60).padStart(2, '0')}<small>min</small>` : '–'}</p>
        ${totalFases ? `<div class="rj-fases">${fases.map(f => `<i class="${f[0]}" style="flex:${f[2]}" title="${f[1]}: ${fmtHoras(f[2])}"></i>`).join('')}</div>
          <ul class="rj-leyenda">${fases.map(f => `<li class="${f[0]}"><i></i>${f[1]} <b>${fmtHoras(f[2])}</b></li>`).join('')}</ul>`
          : d?.sueno_min != null ? `<p class="rj-sub">${d.sueno_min >= 420 ? 'Has descansado bien.' : d.sueno_min >= 360 ? 'Algo justo: intenta acostarte antes hoy.' : 'Poco descanso: tenlo en cuenta al entrenar.'}</p>` : '<p class="rj-sub">Sin datos de sueño.</p>'}
        ${chispa(ultimosDias('sueno_min'))}
      </section>

      <section class="panel rj-tarjeta rj-pulso">
        <header><h3>Pulso</h3>${reposo28 ? `<span>Reposo habitual: ${n0(reposo28)} lpm</span>` : ''}</header>
        <p class="rj-grande">${d?.fc_reposo != null ? `${n0(d.fc_reposo)}<small>lpm en reposo</small>` : d?.fc_media != null ? `${n0(d.fc_media)}<small>lpm de media</small>` : '–'}</p>
        <div class="rj-trio">
          <div><span>Media</span><b>${n0(d?.fc_media)}</b></div>
          <div><span>Mínima</span><b>${n0(d?.fc_min)}</b></div>
          <div><span>Máxima</span><b>${n0(d?.fc_max)}</b></div>
        </div>
        ${chispa(ultimosDias('fc_reposo'))}
      </section>

      <section class="panel rj-tarjeta rj-pasos">
        <header><h3>Pasos</h3>${pasos7 ? `<span>Media 7 días: ${n0(pasos7)}</span>` : ''}</header>
        <div class="rj-pasos-fila">
          ${aro((d?.pasos || 0) / objP, n0(d?.pasos), `de ${n0(objP)}`)}
          <div class="rj-mini">
            ${d?.distancia_km != null ? `<div><span>Distancia</span><b>${n1(d.distancia_km)} km</b></div>` : ''}
            ${d?.kcal_activas != null ? `<div><span>Energía activa</span><b>${n0(d.kcal_activas)} kcal</b></div>` : ''}
            ${d?.minutos_ejercicio != null ? `<div><span>Ejercicio</span><b>${n0(d.minutos_ejercicio)} min</b></div>` : ''}
            ${d?.pisos != null ? `<div><span>Pisos</span><b>${n0(d.pisos)}</b></div>` : ''}
          </div>
        </div>
        <label class="rj-objetivo">Objetivo diario <input type="number" inputmode="numeric" min="1000" max="50000" step="500" value="${objP}" data-objetivo-pasos></label>
      </section>

      <section class="panel rj-tarjeta rj-extra">
        <header><h3>Recuperación</h3></header>
        <div class="rj-mini">
          <div><span>VFC</span><b>${d?.vfc != null ? `${n0(d.vfc)} ms` : '–'}</b></div>
          <div><span>Oxígeno en sangre</span><b>${d?.spo2 != null ? `${n1(d.spo2)} %` : '–'}</b></div>
          ${d?.peso != null ? `<div><span>Peso</span><b>${n1(d.peso)} kg</b></div>` : ''}
        </div>
        ${chispa(ultimosDias('vfc'))}
        <p class="rj-pie">VFC: cuanto más alta respecto a tu normal, mejor recuperado estás.</p>
      </section>
    </div>

    <section class="panel">
      <div class="panel-cab"><h3>Últimos entrenos</h3>${reloj.actividades.length ? '<button class="btn chico" data-ir-vista="entrenos">Ver todos</button>' : ''}</div>
      ${recientes.length ? `<ul class="rj-lista">${recientes.map(filaActividad).join('')}</ul>`
        : `<p class="tenue">${reloj.strava ? 'Cuando tu reloj suba un entreno a Strava, aparecerá aquí.' : 'Conecta Strava y tus entrenos llegarán solos.'}</p>`}
    </section>

    ${pieSync()}`;

  cont.onclick = async ev => {
    if (ev.target.closest('[data-ir-vista]')) return dispatchEvent(new CustomEvent('ir-a', { detail: `salud|reloj|${ev.target.closest('[data-ir-vista]').dataset.irVista}` }));
    if (ev.target.closest('[data-sincronizar]')) return botonSincronizar(ev.target.closest('[data-sincronizar]'));
  };
  cont.onchange = ev => {
    if (!ev.target.matches('[data-objetivo-pasos]')) return;
    const v = Math.round(Number(ev.target.value));
    if (v >= 1000 && v <= 50000) { guardar('reloj-objetivo-pasos', v); renderRelojHoy(cont); }
  };
}

function pieSync() {
  return `<p class="rj-sync">
    <span>Apple Salud: ${reloj.salud?.ultimo_envio ? haceCuanto(reloj.salud.ultimo_envio) : 'sin conectar'}</span>
    <span>Strava: ${reloj.strava ? haceCuanto(reloj.strava.actualizado) : 'sin conectar'}</span>
    ${reloj.strava ? '<button class="rj-enlace" data-sincronizar>Sincronizar ahora</button>' : ''}
  </p>`;
}
async function botonSincronizar(b) {
  b.disabled = true; b.textContent = 'Sincronizando…';
  try { await Promise.all([sincronizarStrava({ forzar: true }), cargarReloj(true)]); }
  catch (e) { aviso('Sin conexión: inténtalo más tarde', 'error'); }
  finally { avisarCambio(); b.disabled = false; b.textContent = 'Sincronizar ahora'; }
}

function filaActividad(a) {
  const m = marcha(a);
  return `<li class="rj-act">
    <span class="rj-act-icono dep-${a.deporte}">${iconoDep(a.deporte)}</span>
    <div class="rj-act-txt">
      <b>${escapar(a.nombre || NOMBRE_DEP[a.deporte])}</b>
      <small>${fmtCorta(a.fecha)}${a.inicio ? ` · ${new Date(a.inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''} · ${NOMBRE_DEP[a.deporte]}</small>
      <div class="rj-act-datos">
        ${a.distancia_km ? `<span><b>${n1(a.distancia_km)}</b> km</span>` : ''}
        ${a.duracion_seg ? `<span><b>${fmtTiempo(a.duracion_seg)}</b></span>` : ''}
        ${m ? `<span><b>${m.valor}</b> ${m.unidad}</span>` : ''}
        ${a.desnivel_m ? `<span><b>${n0(a.desnivel_m)}</b> m ↑</span>` : ''}
        ${a.fc_media ? `<span><b>${n0(a.fc_media)}</b> lpm</span>` : ''}
      </div>
    </div>
    ${recorrido(a.mapa)}
  </li>`;
}

// ------------------------------ ENTRENOS ------------------------------
let filtroDep = 'todos';
export async function renderRelojEntrenos(cont) {
  if (!(await preparar(cont))) return;
  const todas = reloj.actividades;
  const deportes = [...new Set(todas.map(a => a.deporte))];
  if (filtroDep !== 'todos' && !deportes.includes(filtroDep)) filtroDep = 'todos';
  const lista = filtroDep === 'todos' ? todas : todas.filter(a => a.deporte === filtroDep);

  // Esta semana y las 8 anteriores (horas de entreno)
  const lunes = lunesDe(hoyISO());
  const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(lunes, -7 * (7 - i)));
  const horas = semanas.map(l => lista.filter(a => a.fecha >= l && a.fecha <= sumarDias(l, 6)).reduce((t, a) => t + (a.duracion_seg || 0), 0) / 3600);
  const deSemana = lista.filter(a => a.fecha >= lunes);
  const kmSemana = deSemana.reduce((t, a) => t + (Number(a.distancia_km) || 0), 0);
  const desnivelSemana = deSemana.reduce((t, a) => t + (Number(a.desnivel_m) || 0), 0);

  // Agrupadas por semana
  const grupos = new Map();
  for (const a of lista) { const l = lunesDe(a.fecha); if (!grupos.has(l)) grupos.set(l, []); grupos.get(l).push(a); }

  cont.innerHTML = `
    ${deportes.length > 1 ? `<div class="chips rj-chips">${['todos', ...deportes].map(dep => `<button class="chip ${dep === filtroDep ? 'activo' : ''}" data-dep="${dep}">${dep === 'todos' ? 'Todos' : NOMBRE_DEP[dep]}</button>`).join('')}</div>` : ''}
    <section class="panel">
      <div class="panel-cab"><h3>Esta semana</h3><span class="tenue">Horas de entreno · 8 semanas</span></div>
      <div class="rj-kpis">
        <div><span>Tiempo</span><b>${fmtHoras(horas.at(-1) * 60)}</b></div>
        ${filtroDep === 'todos' ? `<div><span>Entrenos</span><b>${deSemana.length}</b></div>` : `<div><span>Distancia</span><b>${n1(kmSemana)} km</b></div>`}
        <div><span>Desnivel</span><b>${n0(desnivelSemana)} m</b></div>
      </div>
      <div class="grafico rj-grafico-bajo"><canvas id="rj-g-semanas"></canvas></div>
    </section>
    <section class="panel">
      ${lista.length ? [...grupos].map(([l, as]) => `
        <h4 class="rj-semana">Semana del ${fmtCorta(l).toLowerCase()}</h4>
        <ul class="rj-lista">${as.map(filaActividad).join('')}</ul>`).join('')
        : `<p class="tenue">${reloj.strava ? 'Aún no ha llegado ningún entreno.' : 'Conecta Strava en la pestaña Conectar y tus entrenos llegarán solos.'}</p>`}
    </section>
    ${pieSync()}`;

  grafica(cont.querySelector('#rj-g-semanas'), {
    type: 'bar',
    data: { labels: semanas.map(l => fmtCorta(l).split(' ').slice(1).join(' ')), datasets: [{ data: horas.map(h => Math.round(h * 10) / 10), backgroundColor: semanas.map((_, i) => (i === 7 ? C.electrico : C.pervinca)), borderRadius: 6, maxBarThickness: 28 }] },
    options: { scales: { x: ejeX(), y: ejeY({ beginAtZero: true, ticks: { callback: v => `${v} h` } }) }, plugins: { tooltip: { callbacks: { label: c => fmtHoras(c.raw * 60) } } } },
  });

  cont.onclick = ev => {
    const c = ev.target.closest('[data-dep]');
    if (c) { filtroDep = c.dataset.dep; return renderRelojEntrenos(cont); }
    if (ev.target.closest('[data-sincronizar]')) return botonSincronizar(ev.target.closest('[data-sincronizar]'));
  };
}

// ------------------------------ TENDENCIAS ------------------------------
let rango = 30;
export async function renderRelojTendencias(cont) {
  if (!(await preparar(cont))) return;
  const hoy = hoyISO();
  const fechas = Array.from({ length: rango }, (_, i) => sumarDias(hoy, i - rango + 1));
  const serie = campo => fechas.map(f => diaDe(f)?.[campo] ?? null);
  const etiquetas = fechas.map(f => fmtCorta(f).split(' ').slice(1).join(' '));
  const resumen = (campo, fmt) => { const v = valores(campo, fechas[0]); return v.length ? fmt(media(v)) : '–'; };
  const tarjetas = [
    ['sueno', 'Sueño', `Media: ${resumen('sueno_min', fmtHoras)}`],
    ['reposo', 'Pulso en reposo', `Media: ${resumen('fc_reposo', n0)} lpm · cuanto más bajo, mejor forma`],
    ['vfc', 'Variabilidad (VFC)', `Media: ${resumen('vfc', n0)} ms · más alta = mejor recuperado`],
    ['pasos', 'Pasos', `Media: ${resumen('pasos', n0)} al día`],
  ];
  cont.innerHTML = `
    <div class="segmento-suave rj-rango">${[[7, '7 días'], [30, '30 días'], [90, '90 días']].map(([n, t]) => `<button data-rango="${n}" class="${n === rango ? 'activo' : ''}">${t}</button>`).join('')}</div>
    ${reloj.dias.length ? tarjetas.map(([id, t, sub]) => `
      <section class="panel"><div class="panel-cab"><h3>${t}</h3></div><p class="tenue rj-tend-sub">${sub}</p><div class="grafico rj-grafico-bajo"><canvas id="rj-t-${id}"></canvas></div></section>`).join('')
      : '<section class="panel"><p class="tenue">Las tendencias aparecen cuando lleguen unos días de Apple Salud.</p></section>'}`;
  if (reloj.dias.length) {
    const barras = (id, datos, color, fmt) => grafica(cont.querySelector(`#rj-t-${id}`), {
      type: 'bar', data: { labels: etiquetas, datasets: [{ data: datos, backgroundColor: color, borderRadius: 4, maxBarThickness: 18 }] },
      options: { scales: { x: ejeX(), y: ejeY({ beginAtZero: true, ticks: { callback: fmt } }) }, plugins: { tooltip: { callbacks: { label: c => fmt(c.raw) } } } },
    });
    const linea = (id, datos, fmt) => grafica(cont.querySelector(`#rj-t-${id}`), {
      type: 'line', data: { labels: etiquetas, datasets: [{ data: datos, borderColor: C.electrico, backgroundColor: C.electricoSuave, fill: true, tension: 0.35, spanGaps: true, pointRadius: rango > 30 ? 0 : 2.5, pointBackgroundColor: C.electrico, borderWidth: 2 }] },
      options: { scales: { x: ejeX(), y: ejeY({ ticks: { callback: fmt } }) }, plugins: { tooltip: { callbacks: { label: c => fmt(c.raw) } } } },
    });
    barras('sueno', serie('sueno_min').map(m => (m == null ? null : Math.round(m / 6) / 10)), C.medio, v => `${String(v).replace('.', ',')} h`);
    linea('reposo', serie('fc_reposo'), v => `${v} lpm`);
    linea('vfc', serie('vfc'), v => `${v} ms`);
    barras('pasos', serie('pasos'), C.pervinca, v => n0(v));
  }
  cont.onclick = ev => { const b = ev.target.closest('[data-rango]'); if (b) { rango = Number(b.dataset.rango); renderRelojTendencias(cont); } };
}

// ------------------------------ CONECTAR ------------------------------
const PASOS_ATAJO = [
  ['Crea el Atajo', 'Abre la app <b>Atajos</b> → pestaña <b>Atajos</b> → <b>+</b>. Llámalo <b>SYNCO Salud</b>.'],
  ['Pasos de hoy', 'Añade <b>Buscar muestras de salud</b>: tipo <b>Pasos</b>, <b>Fecha de inicio · es hoy</b>. Debajo, <b>Calcular estadísticas</b> → <b>Suma</b>.'],
  ['Pulso de hoy', 'Otra <b>Buscar muestras de salud</b>: tipo <b>Frecuencia cardiaca</b>, fecha de inicio hoy. Debajo, tres <b>Calcular estadísticas</b>: <b>Media</b>, <b>Mínimo</b> y <b>Máximo</b>.'],
  ['Reposo y VFC', '<b>Buscar muestras de salud</b> con tipo <b>Frecuencia cardiaca en reposo</b> (hoy, límite 1). Y otra con <b>Variabilidad de la frecuencia cardiaca</b> (hoy) → <b>Calcular estadísticas · Media</b>.'],
  ['Sueño de anoche', '<b>Buscar muestras de salud</b>: tipo <b>Análisis del sueño</b>, <b>Fecha de fin · es hoy</b> y, si te deja, <b>Valor · no es · En la cama</b> y <b>no es · Despierto</b>. Luego <b>Obtener detalles de muestras de salud → Duración</b> y <b>Calcular estadísticas → Suma</b>.'],
  ['Envíalo a SYNCO', 'Añade <b>Obtener contenido de URL</b>. Pega tu dirección (botón de arriba), <b>Método: POST</b>, <b>Cuerpo de la solicitud: JSON</b>, y añade estos campos (tipo <b>Número</b>) con el resultado de cada paso:'],
  ['Pruébalo', 'Pulsa ▶︎. Debe responder <b>«Guardados N datos»</b>. Abajo verás aquí lo que ha llegado.'],
  ['Que vaya solo', 'Pestaña <b>Automatización</b> → <b>+</b> → <b>Hora del día</b>: <b>22:30, cada día</b> → <b>Ejecutar inmediatamente</b> → atajo <b>SYNCO Salud</b>. Si quieres el sueño ya por la mañana, crea otra a las <b>10:00</b>.'],
];
const CAMPOS_ATAJO = [
  ['pasos', 'Suma de pasos'], ['fc_media', 'Media del pulso'], ['fc_min', 'Mínimo del pulso'], ['fc_max', 'Máximo del pulso'],
  ['fc_reposo', 'Frecuencia en reposo'], ['vfc', 'Media de la VFC'], ['sueno', 'Suma de la duración del sueño'],
  ['kcal_activas', 'Opcional: suma de energía activa'], ['sueno_profundo', 'Opcional: sueño profundo'], ['sueno_rem', 'Opcional: sueño REM'],
];
const ETIQUETAS_DATO = { pasos: 'Pasos', distancia_km: 'Distancia', kcal_activas: 'Energía activa', minutos_ejercicio: 'Ejercicio', pisos: 'Pisos', sueno_min: 'Sueño', sueno_profundo_min: 'Profundo', sueno_rem_min: 'REM', sueno_ligero_min: 'Ligero', despierto_min: 'Despierto', fc_media: 'Pulso medio', fc_min: 'Pulso mínimo', fc_max: 'Pulso máximo', fc_reposo: 'Reposo', vfc: 'VFC', spo2: 'Oxígeno', peso: 'Peso' };
const fmtDato = (k, v) => (k.endsWith('_min') ? fmtHoras(v) : k === 'distancia_km' ? `${n1(v)} km` : k.startsWith('fc_') ? `${n0(v)} lpm` : k === 'vfc' ? `${n0(v)} ms` : k === 'spo2' ? `${n1(v)} %` : k === 'peso' ? `${n1(v)} kg` : k === 'kcal_activas' ? `${n0(v)} kcal` : k === 'minutos_ejercicio' ? `${n0(v)} min` : n0(v));

let stravaConfigurado = null;
export async function renderRelojConectar(cont) {
  if (!(await preparar(cont))) return;
  if (stravaConfigurado === null) {
    api('strava?accion=estado', { method: 'GET' }).then(r => { stravaConfigurado = !!r.configurado; if (cont.isConnected && cont.querySelector('.rj-strava')) renderRelojConectar(cont); }).catch(() => { stravaConfigurado = false; });
  }
  const ultimoDia = [...reloj.dias].reverse().find(d => d.fuente !== 'Manual');
  const recibido = ultimoDia ? Object.entries(ETIQUETAS_DATO).filter(([k]) => ultimoDia[k] != null) : [];
  const conectadoSalud = !!reloj.salud?.ultimo_envio;

  cont.innerHTML = `
    <section class="panel rj-conexion">
      <div class="rj-con-cab">
        <span class="rj-logo salud">${svg('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>')}</span>
        <div><h3>Apple Salud</h3><p class="tenue">Sueño, pulso, VFC, pasos y energía. Desde tu reloj, sea cual sea.</p></div>
        <span class="rj-estado ${conectadoSalud ? 'ok' : ''}">${conectadoSalud ? `Conectado · ${haceCuanto(reloj.salud.ultimo_envio)}` : 'Sin conectar'}</span>
      </div>
      <p>El iPhone no deja que una web lea Apple Salud, pero sí que un <b>Atajo</b> te mande los datos cada día. Se configura una vez (unos 10 minutos) y después va solo.</p>
      <div class="rj-codigo">
        <span>Tu dirección personal</span>
        <code data-url>${reloj.salud?.token ? escapar(urlAtajo(reloj.salud.token)).replace(/t=(.{6}).+$/, 't=$1••••••••') : 'Pulsa «Copiar dirección» para crearla'}</code>
        <div class="rj-botones">
          <button class="btn primario chico" data-copiar>Copiar dirección</button>
          <button class="btn chico" data-probar ${reloj.salud?.token ? '' : 'disabled'}>Probar</button>
          <button class="btn chico" data-renovar ${reloj.salud?.token ? '' : 'disabled'} title="Crea una dirección nueva y anula la anterior">Cambiar</button>
        </div>
        <p class="rj-pie">Es secreta: quien la tenga puede escribir datos de salud en tu cuenta (no leerlos). Si la compartes por error, pulsa «Cambiar».</p>
      </div>
      <details class="rj-guia" ${conectadoSalud ? '' : 'open'}>
        <summary>Cómo crear el Atajo, paso a paso</summary>
        <ol>${PASOS_ATAJO.map(([t, txt], i) => `<li><b>${t}</b><p>${txt}</p>${i === 5 ? `<table class="rj-campos"><tr><th>Clave</th><th>Valor</th></tr>${CAMPOS_ATAJO.map(([k, v]) => `<tr><td><code>${k}</code></td><td>${v}</td></tr>`).join('')}</table>` : ''}</li>`).join('')}</ol>
        <p class="rj-pie">Los nombres de las acciones pueden variar un poco según tu versión de iOS. SYNCO entiende números con coma o punto y el sueño en segundos, minutos u horas.</p>
      </details>
      ${ultimoDia ? `
      <div class="rj-recibido">
        <span>Lo último que ha llegado · ${fmtCorta(ultimoDia.fecha)}</span>
        <ul>${recibido.map(([k, t]) => `<li><span>${t}</span><b>${fmtDato(k, ultimoDia[k])}</b></li>`).join('')}</ul>
        ${recibido.length < 5 ? '<p class="rj-pie">¿Falta algo? Revisa que ese campo esté en el paso «Obtener contenido de URL» del Atajo.</p>' : ''}
      </div>` : ''}
    </section>

    <section class="panel rj-conexion rj-strava">
      <div class="rj-con-cab">
        <span class="rj-logo strava">${svg('<path d="M10 3.5l-5.5 11h3.3L10 10.1l2.2 4.4h3.3zM15.5 14.5l-1.7 3.3-1.6-3.3h-2.3l3.9 7.7 3.9-7.7z" fill="currentColor" stroke="none"/>')}</span>
        <div><h3>Strava</h3><p class="tenue">Tus entrenos: distancia, ritmo, desnivel, tiempo y pulso.</p></div>
        <span class="rj-estado ${reloj.strava ? 'ok' : ''}">${reloj.strava ? `Conectado · ${haceCuanto(reloj.strava.actualizado)}` : 'Sin conectar'}</span>
      </div>
      ${reloj.strava ? `
        <p>Conectado como <b>${escapar(reloj.strava.nombre || 'tu cuenta')}</b>. Cada vez que abres SYNCO se traen los entrenos nuevos; las carreras pasan también a tu plan de Running.</p>
        <div class="rj-botones"><button class="btn primario chico" data-sincronizar>Sincronizar ahora</button><button class="btn chico" data-desconectar>Desconectar</button></div>`
      : stravaConfigurado === false ? `
        <p>Strava aún no está activado en el servidor de SYNCO. Es gratis y se hace una sola vez:</p>
        <ol class="rj-pasos-admin">
          <li>Entra en <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a> y crea una aplicación. En <b>Authorization Callback Domain</b> pon <code>${escapar(location.host)}</code>.</li>
          <li>En Vercel → tu proyecto → <b>Settings → Environment Variables</b>, añade <code>STRAVA_CLIENT_ID</code> y <code>STRAVA_CLIENT_SECRET</code> con los valores de esa página.</li>
          <li>Vuelve a desplegar (Deployments → Redeploy) y recarga esta pantalla.</li>
        </ol>`
      : stravaConfigurado === null ? cargador('Comprobando…')
      : `
        <p>Tu reloj (Garmin, Apple Watch, Coros, Polar, Suunto…) sube cada entreno a Strava. Conéctalo una vez y llegarán solos a SYNCO.</p>
        <button class="btn rj-btn-strava" data-conectar-strava>Conectar con Strava</button>
        <p class="rj-pie">Si estás en la app instalada del iPhone y no vuelve sola a SYNCO, conéctalo una vez desde Safari o desde el ordenador: queda guardado en tu cuenta.</p>`}
    </section>

    <section class="panel">
      <details class="rj-guia">
        <summary>Apuntar un día a mano</summary>
        <form class="rj-manual" data-manual>
          <div class="campos-2">
            <label>Día<input type="date" name="fecha" value="${hoyISO()}" max="${hoyISO()}" required></label>
            <label>Sueño (h:mm)<input name="sueno" placeholder="7:30" inputmode="numeric"></label>
            <label>Pasos<input name="pasos" type="number" inputmode="numeric" min="0" max="150000"></label>
            <label>Pulso en reposo<input name="fc_reposo" type="number" inputmode="numeric" min="25" max="150"></label>
          </div>
          <button class="btn primario chico">Guardar</button>
        </form>
      </details>
    </section>`;

  cont.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    try {
      if (b.matches('[data-copiar]')) {
        const t = await codigoAtajo();
        await navigator.clipboard.writeText(urlAtajo(t)).then(() => aviso('Dirección copiada: pégala en el Atajo'), () => prompt('Copia esta dirección:', urlAtajo(t)));
        return renderRelojConectar(cont);
      }
      if (b.matches('[data-probar]')) {
        b.disabled = true;
        const r = await fetch(urlAtajo(reloj.salud.token)).then(x => x.json()).catch(() => ({ ok: false, mensaje: 'Esta prueba solo funciona en la web publicada.' }));
        aviso(r.ok ? 'La dirección funciona. Ahora ejecuta el Atajo.' : r.mensaje, r.ok ? 'ok' : 'error');
        b.disabled = false;
        return;
      }
      if (b.matches('[data-renovar]')) {
        if (!confirm('Se creará una dirección nueva y la anterior dejará de funcionar. Tendrás que pegarla otra vez en el Atajo. ¿Seguir?')) return;
        const t = await codigoAtajo(true);
        const copiada = await navigator.clipboard.writeText(urlAtajo(t)).then(() => true, () => false);
        aviso(copiada ? 'Dirección nueva copiada' : 'Dirección nueva creada: pulsa «Copiar dirección»');
        return renderRelojConectar(cont);
      }
      if (b.matches('[data-conectar-strava]')) return conectarStrava();
      if (b.matches('[data-sincronizar]')) { b.disabled = true; b.textContent = 'Sincronizando…'; await sincronizarStrava({ forzar: true }); return renderRelojConectar(cont); }
      if (b.matches('[data-desconectar]')) {
        if (!confirm('¿Desconectar Strava? Los entrenos que ya han llegado se quedan.')) return;
        const r = await api('strava?accion=desconectar', { method: 'POST' });
        if (!r.ok) return aviso(r.mensaje || 'No se pudo desconectar', 'error');
        reloj.strava = null;
        aviso('Strava desconectado');
        return renderRelojConectar(cont);
      }
    } catch (e) { console.warn(e); aviso(e.message || 'Algo ha fallado', 'error'); }
  };
  cont.onsubmit = async ev => {
    if (!ev.target.matches('[data-manual]')) return;
    ev.preventDefault();
    const f = new FormData(ev.target);
    const fila = { fecha: f.get('fecha'), fuente: 'Manual' };
    const s = String(f.get('sueno') || '').trim();
    // «7:30» o «7h30» → 7 h 30 min · «7,5» o «7.5» → 7 h y media
    if (s) {
      const hm = s.match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})?/i), dec = s.match(/^(\d{1,2})(?:[.,](\d+))?$/);
      if (hm) fila.sueno_min = Number(hm[1]) * 60 + Number(hm[2] || 0);
      else if (dec) fila.sueno_min = Math.round(Number(`${dec[1]}.${dec[2] || 0}`) * 60);
      if (!(fila.sueno_min >= 0 && fila.sueno_min <= 1440)) return aviso('El sueño no tiene buen formato: usa 7:30', 'error');
    }
    for (const k of ['pasos', 'fc_reposo']) if (f.get(k)) fila[k] = Number(f.get(k));
    if (Object.keys(fila).length <= 2) return aviso('Escribe al menos un dato', 'error');
    const { error } = await supabase.from('salud_dias').upsert(fila, { onConflict: 'user_id,fecha' });
    if (error) return aviso(error.message, 'error');
    aviso('Día guardado');
    await cargarReloj(true);
    avisarCambio();
  };
}

/* =====================================================================
   ÓRBITA (las tarjetas alrededor del avatar en Salud)
   ===================================================================== */
export function orbitaReloj({ tarjeta, dato, anillo, accion, ir }) {
  if (!reloj.cargado) return { izq: [tarjeta({ titulo: 'Reloj', cuerpo: cargador('Cargando…') })], der: [], despues: () => cargarReloj().then(avisarCambio) };
  if (reloj.error) return { izq: [tarjeta({ titulo: 'Reloj', cuerpo: '<p class="cs-texto">No se han podido cargar tus datos ahora mismo.</p>' })], der: [] };
  if (sinConexion()) {
    return {
      izq: [tarjeta({ titulo: 'Tu reloj', ancla: 'manoIzq', clase: 'cs-destacada', cuerpo: `<p class="cs-texto">Conecta Apple Salud y Strava: sueño, pulso, pasos y entrenos llegarán solos.</p>${accion('Conectar', ir('reloj', 'conectar'))}` })],
      der: [],
    };
  }
  const d = diaActual();
  const prep = d ? preparacion(d.fecha) : null;
  const ultima = reloj.actividades[0];
  const m = ultima ? marcha(ultima) : null;
  const objP = objetivoPasos();
  const reposo = ultimosDias('fc_reposo', 7).filter(x => x != null);
  return {
    izq: [
      tarjeta({ titulo: 'Preparación', ancla: 'cabeza', clase: 'cs-destacada', etiqueta: prep ? '' : 'sin datos', cuerpo: prep
        ? `${dato(prep.nota, '/ 100', escapar(prep.titulo))}<p class="cs-sub">${escapar(prep.consejo)}</p>`
        : '<p class="cs-texto">Cuando lleguen tu sueño y tu pulso, verás cómo llegas a cada día.</p>' }),
      tarjeta({ mitad: true, titulo: 'Sueño', ancla: 'coronilla', cuerpo: dato(d?.sueno_min != null ? fmtHoras(d.sueno_min) : '–', '', d?.sueno_profundo_min != null ? `${fmtHoras(d.sueno_profundo_min)} profundo` : '') }),
      tarjeta({ mitad: true, titulo: 'Reposo', ancla: 'pecho', cuerpo: dato(n0(d?.fc_reposo), 'lpm', reposo.length > 1 ? `Media 7 días: ${n0(media(reposo))}` : '') }),
    ],
    der: [
      tarjeta({ titulo: 'Pasos', ancla: 'pies', cuerpo: `${anillo((d?.pasos || 0) / objP, n0(d?.pasos), `de ${n0(objP)}`)}` }),
      tarjeta({ titulo: 'Último entreno', ancla: 'piesDer', etiqueta: ultima ? fmtCorta(ultima.fecha) : '', cuerpo: ultima
        ? `${dato(ultima.distancia_km ? n1(ultima.distancia_km) : fmtTiempo(ultima.duracion_seg), ultima.distancia_km ? 'km' : '', `${escapar(NOMBRE_DEP[ultima.deporte])}${m ? ` · ${m.valor} ${m.unidad}` : ''}${ultima.fc_media ? ` · ${n0(ultima.fc_media)} lpm` : ''}`)}${accion('Ver entrenos', ir('reloj', 'entrenos'))}`
        : `<p class="cs-texto">${reloj.strava ? 'Aún no ha llegado ningún entreno.' : 'Conecta Strava para que lleguen solos.'}</p>${accion(reloj.strava ? 'Ver entrenos' : 'Conectar', ir('reloj', reloj.strava ? 'entrenos' : 'conectar'))}` }),
    ],
    base: d ? `<div class="cs-kpis">
      <div><span>Pulso medio</span><b>${n0(d.fc_media)}</b><small>lpm</small></div>
      <div><span>VFC</span><b>${n0(d.vfc)}</b><small>ms</small></div>
      <div><span>Energía activa</span><b>${n0(d.kcal_activas)}</b><small>kcal</small></div>
    </div>` : '',
  };
}

// Para pruebas
export const _interno = { decodificar, recorrido };
