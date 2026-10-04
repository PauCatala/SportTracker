// Funciones pequeñas que usan todos los demás archivos: fechas, formatos y cálculos.

// ---------- Fechas (siempre como texto 'AAAA-MM-DD', igual que en la base de datos) ----------
export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const hoyISO = () => toISO(new Date());
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function sumarDias(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function lunesDe(iso) {           // lunes de la semana de esa fecha
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}
export function sumarMeses(iso, n) {     // devuelve el día 1 del mes resultante
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
export function finDeMes(iso) {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export const capitalizar = t => t.charAt(0).toUpperCase() + t.slice(1);
export const fmtCorta = iso => capitalizar(parseISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }));

// ---------- Formatos ----------
export const fmtKg = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });
export const fmtEntero = n => Math.round(n).toLocaleString('es-ES');

// "esc" evita que un texto con < o > rompa el HTML (buena práctica de seguridad)
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Convierte lo que escribes ("8,75" o "8.75") en número. Vacío → NaN (no es un número)
export function num(v) {
  if (v === '' || v == null) return NaN;
  return Number(String(v).replace(',', '.'));
}

// ---------- Cálculos de entrenamiento ----------
// 1RM estimado (fórmula de Epley): cuánto podrías levantar a 1 repetición
export const epley = (kg, reps) => kg * (1 + reps / 30);

// Agrupa filas sueltas de la tabla "series" en series con sus drops:
// [[principal, drop1], [principal], ...]
export function agruparSeries(series) {
  const mapa = new Map();
  [...series]
    .sort((a, b) => a.numero_serie - b.numero_serie || a.drop_idx - b.drop_idx)
    .forEach(s => {
      if (!mapa.has(s.numero_serie)) mapa.set(s.numero_serie, []);
      mapa.get(s.numero_serie).push(s);
    });
  return [...mapa.values()];
}

// "8×8,75 + 6×6,25"
export const textoSet = partes => partes.map(p => `${p.reps}×${fmtKg(p.kg)}`).join(' + ');

// Resumen numérico de un ejercicio en una sesión
export function metricas(sets, porLado) {
  const factor = porLado ? 2 : 1;          // si es por lado, el volumen real es el doble
  let e1rm = 0, maxKg = 0, volumen = 0, reps = 0;
  for (const partes of sets) {
    for (const p of partes) {
      const kg = Number(p.kg), r = Number(p.reps);
      e1rm = Math.max(e1rm, epley(kg, r));
      maxKg = Math.max(maxKg, kg);
      volumen += kg * r * factor;
      reps += r;
    }
  }
  return { e1rm, maxKg, volumen, reps };
}

// ---------- Tiempos y ritmos (running) ----------
// "4:20" → 260 s · "1:02:30" → 3750 s · "92" → 92 s (o minutos si sinDosPuntos = 'min')
export function parseTiempo(txt, sinDosPuntos = 'seg') {
  const t = String(txt ?? '').trim().replace(',', '.');
  if (!t) return NaN;
  if (!t.includes(':')) return Number(t) * (sinDosPuntos === 'min' ? 60 : 1);
  const partes = t.split(':').map(Number);
  if (partes.some(isNaN)) return NaN;
  return partes.reduce((total, p) => total * 60 + p, 0);
}
export function fmtTiempo(seg) {
  if (seg == null || isNaN(seg)) return '–';
  seg = Math.round(seg);
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export const fmtRitmo = segPorKm => (segPorKm > 0 && isFinite(segPorKm) ? fmtTiempo(segPorKm) : '–');
export const diasEntre = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

// ---------- Mensajes y errores ----------
export function aviso(msg, tipo = 'ok') {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  el.className = `aviso visible ${tipo}`;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (el.className = 'aviso'), 3000);
}

export function esErrorDeRed(e) {
  return /fetch|network|load failed|conexi/i.test(String(e?.message || e));
}

export function mensajeError(e) {
  if (e?.code === '23505') return 'Ya existe un ejercicio con ese nombre';
  if (esErrorDeRed(e)) return 'Sin conexión. Inténtalo cuando tengas internet';
  return e?.message || String(e);
}

export function requiereConexion() {
  if (!navigator.onLine) {
    aviso('Necesitas conexión para hacer esto', 'error');
    return false;
  }
  return true;
}
