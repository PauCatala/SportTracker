// Preguntas que la app hace a tus datos (ya descargados en "state").
import { state } from './db.js';
import { agruparSeries, diasEntre } from './utils.js';

const compararTexto = (a, b) => (a || '').localeCompare(b || '', 'es', { numeric: true });

// Orden natural: por día de rutina, luego por el orden que tú elijas, luego por nombre
export const ordenEjercicios = (a, b) =>
  compararTexto(a.dia, b.dia) || a.orden - b.orden || compararTexto(a.nombre, b.nombre);

export const ejercicioPorId = id => state.ejercicios.find(e => e.id === Number(id));

/* ---------- Mesociclos y rutinas ---------- */

// Mesociclo al que pertenece una fecha (el más reciente que la contenga)
export function mesocicloDe(fecha) {
  return state.mesociclos
    .filter(m => m.fecha_inicio <= fecha && (!m.fecha_fin || fecha <= m.fecha_fin))
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0] || null;
}

// Semana dentro del mesociclo (1, 2, 3, 4...)
export const semanaDeMeso = (meso, fecha) => Math.floor(diasEntre(meso.fecha_inicio, fecha) / 7) + 1;
export const semanasDeMeso = meso => meso.fecha_fin ? Math.ceil((diasEntre(meso.fecha_inicio, meso.fecha_fin) + 1) / 7) : null;

export const rutinaDe = (mesoId, dia) =>
  state.rutinas.filter(r => r.mesociclo_id === mesoId && r.dia === dia).sort((a, b) => a.orden - b.orden);

// Mesociclo cuya rutina se usa en una fecha: el de esa fecha si tiene rutina;
// si no (p. ej. un mesociclo antiguo sin rutina), el más cercano en el tiempo que sí la tenga
export function mesoConRutina(fecha) {
  const conRutina = new Set(state.rutinas.map(r => r.mesociclo_id));
  const meso = mesocicloDe(fecha);
  if (meso && conRutina.has(meso.id)) return meso;
  const distancia = m => fecha < m.fecha_inicio ? diasEntre(fecha, m.fecha_inicio) : m.fecha_fin && fecha > m.fecha_fin ? diasEntre(m.fecha_fin, fecha) : 0;
  return state.mesociclos.filter(m => conRutina.has(m.id)).sort((a, b) => distancia(a) - distancia(b))[0] || null;
}

// Días disponibles para entrenar en una fecha: los de la rutina del mesociclo,
// o si no hay ninguna rutina, los días que tengas puestos en los ejercicios
export function diasPara(fecha) {
  const meso = mesoConRutina(fecha);
  const deRutina = meso ? [...new Set(state.rutinas.filter(r => r.mesociclo_id === meso.id).map(r => r.dia))] : [];
  const dias = deRutina.length ? deRutina
    : [...new Set(state.ejercicios.filter(e => e.activo).map(e => e.dia || 'Sin día'))];
  return dias.sort(compararTexto);
}

export const ejerciciosDelDia = dia =>
  state.ejercicios.filter(e => e.activo && (e.dia || 'Sin día') === dia).sort(ordenEjercicios);

/* ---------- Sesiones y series ---------- */

export const sesionDe = (fecha, dia) => state.sesiones.find(s => s.fecha === fecha && s.dia === dia) || null;

export const seriesDe = (sesionId, ejId) =>
  state.series.filter(s => s.sesion_id === sesionId && (ejId == null || s.ejercicio_id === Number(ejId)));

// Todas las veces que hiciste un ejercicio, de la más antigua a la más reciente
export function historialEjercicio(ejId) {
  const porSesion = new Map();
  for (const s of state.series) {
    if (s.ejercicio_id !== Number(ejId)) continue;
    if (!porSesion.has(s.sesion_id)) porSesion.set(s.sesion_id, []);
    porSesion.get(s.sesion_id).push(s);
  }
  return [...porSesion.entries()]
    .map(([sesionId, filas]) => ({ sesion: state.sesiones.find(x => x.id === sesionId), sets: agruparSeries(filas) }))
    .filter(h => h.sesion)
    .sort((a, b) => a.sesion.fecha.localeCompare(b.sesion.fecha));
}

// La última vez que hiciste el ejercicio ANTES de esa fecha → tu mínimo a superar
export function ultimaVez(ejId, fecha) {
  return historialEjercicio(ejId).filter(h => h.sesion.fecha < fecha).at(-1) || null;
}

/* ---------- Plan general (running, flexibilidad) ---------- */

// Semana del plan para una fecha (1 = la primera). null si no hay fecha de inicio
export function semanaPlan(fecha) {
  const inicio = state.ajustes?.inicio_plan;
  return inicio ? Math.floor(diasEntre(inicio, fecha) / 7) + 1 : null;
}
