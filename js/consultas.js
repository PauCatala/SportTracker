// Preguntas que la app hace a tus datos (ya descargados en "state").
import { state } from './db.js';
import { agruparSeries } from './utils.js';

const compararTexto = (a, b) => (a || '').localeCompare(b || '', 'es', { numeric: true });

// Orden natural: por día de rutina, luego por el orden que tú elijas, luego por nombre
export const ordenEjercicios = (a, b) =>
  compararTexto(a.dia, b.dia) || a.orden - b.orden || compararTexto(a.nombre, b.nombre);

export const ejercicioPorId = id => state.ejercicios.find(e => e.id === Number(id));

export function diasRutina() {
  return [...new Set(state.ejercicios.filter(e => e.activo).map(e => e.dia || 'Sin día'))].sort(compararTexto);
}

export function ejerciciosDelDia(dia) {
  return state.ejercicios.filter(e => e.activo && (e.dia || 'Sin día') === dia).sort(ordenEjercicios);
}

// Mesociclo al que pertenece una fecha (el más reciente que la contenga)
export function mesocicloDe(fecha) {
  return state.mesociclos
    .filter(m => m.fecha_inicio <= fecha && (!m.fecha_fin || fecha <= m.fecha_fin))
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0] || null;
}

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
