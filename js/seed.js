// Tu rutina actual con lo que apuntaste en tus dos últimos entrenos.
// Formato de cada serie: [[reps, kg, técnica?], [reps, kg] ← drop, ...]
import { supabase, ejecutar } from './db.js';

export const D1 = 'Día 1 · Pierna y core';
export const D2 = 'Día 2 · Hombro y brazo';

const RUTINA = [
  { dia: D1, nombre: 'Sentadilla', lado: false, s: [[[7, 100]], [[7, 100]], [[7, 100]]] },
  { dia: D1, nombre: 'Prensa', lado: false, s: [[[10, 200]], [[8, 220]], [[11, 200]]] },
  { dia: D1, nombre: 'Extensión de cuádriceps', lado: false, s: [[[8, 100, 'mala']], [[10, 95, 'regular']], [[10, 95, 'bien']]] },
  { dia: D1, nombre: 'Búlgaras con mancuernas', lado: false, s: [] },
  { dia: D1, nombre: 'Gemelo de pie', lado: false, s: [] },
  { dia: D1, nombre: 'Gemelo sentado', lado: false, s: [[[14, 60]], [[12, 60]], [[11, 60]], [[14, 50]]] },
  { dia: D1, nombre: 'Máquina de abdominales', lado: false, s: [[[13, 80]], [[12, 80]], [[12, 80]]] },
  { dia: D1, nombre: 'Core lateral unilateral en polea', lado: true, s: [[[8, 13.75]], [[10, 13.75]], [[8, 13.75]]] },
  { dia: D1, nombre: 'Oblicuo unilateral', lado: true, s: [[[12, 24]], [[12, 24]]] },

  { dia: D2, nombre: 'Press militar en máquina sentado', lado: true, s: [[[8, 35]], [[8, 35]], [[8, 35]]] },
  { dia: D2, nombre: 'Elevaciones laterales en polea', lado: true, s: [[[8, 8.75]], [[8, 8.75], [6, 6.25]], [[8, 8.75], [4, 6.25]]] },
  { dia: D2, nombre: 'Curl de bíceps sentado', lado: true, s: [[[8, 17.5]], [[7, 17.5]], [[7, 17.5]]] },
  { dia: D2, nombre: 'Curl de bíceps en polea', lado: true, s: [[[7, 15], [3, 12.5]], [[10, 12.5]]] },
  { dia: D2, nombre: 'Tríceps en polea baja', lado: false, s: [[[8, 25]], [[7, 25]], [[5, 25], [6, 17.5]]] },
  { dia: D2, nombre: 'Tríceps en polea alta', lado: false, s: [[[8, 25], [5, 17.5]], [[6, 25], [3, 21.5]], [[7, 25], [2, 21.5]]] },
  { dia: D2, nombre: 'Antebrazo en polea alta', lado: true, s: [[[10, 25], [8, 17.5]], [[10, 28.5], [8, 21.5]]] },
  { dia: D2, nombre: 'Antebrazo en polea baja con barra', lado: false, s: [[[8, 25], [9, 17.5]], [[8, 25], [9, 17.5]]] },
  { dia: D2, nombre: 'Hombro posterior', lado: false, s: [[[6, 72.5], [7, 5.5]], [[5, 72.5], [6, 5.5]], [[4, 72.5], [6, 5.5]]] },
];

export async function cargarRutinaInicial({ nombreMeso, fechaD1, fechaD2 }) {
  const inicio = fechaD1 < fechaD2 ? fechaD1 : fechaD2;

  const meso = await ejecutar(supabase.from('mesociclos').insert({ nombre: nombreMeso, fecha_inicio: inicio }).select().single());

  const ejercicios = await ejecutar(supabase.from('ejercicios')
    .insert(RUTINA.map((r, i) => ({ nombre: r.nombre, dia: r.dia, por_lado: r.lado, orden: i })))
    .select());
  const idEj = Object.fromEntries(ejercicios.map(e => [e.nombre, e.id]));

  const sesiones = await ejecutar(supabase.from('sesiones').insert([
    { fecha: fechaD1, dia: D1, mesociclo_id: meso.id },
    { fecha: fechaD2, dia: D2, mesociclo_id: meso.id },
  ]).select());
  const idSes = Object.fromEntries(sesiones.map(s => [s.dia, s.id]));

  const filas = [];
  for (const r of RUTINA) {
    r.s.forEach((partes, i) => partes.forEach(([reps, kg, tecnica], j) => filas.push({
      sesion_id: idSes[r.dia], ejercicio_id: idEj[r.nombre],
      numero_serie: i + 1, drop_idx: j, reps, kg, tecnica: tecnica || null,
    })));
  }
  await ejecutar(supabase.from('series').insert(filas));
}
