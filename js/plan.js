// Tu plan de 6 meses (el PDF "Project Pau") convertido en datos.
// Si algún día cambias de plan, solo hay que tocar este archivo.
import { supabase, ejecutar, state } from './db.js';
import { sumarDias } from './utils.js';

/* ============================== GIMNASIO ============================== */

// Los 5 días y sus ejercicios, en el orden en que se hacen
export const DIAS_PLAN = [
  { nombre: 'Día 1 · Pecho y espalda', ejercicios: [
    'Press inclinado con barra', 'Dips lastrados', 'Pec deck / aperturas', 'Dominadas lastradas',
    'Remo con barra (Pendlay)', 'Pull-over en polea, brazos rectos'] },
  { nombre: 'Día 2 · Pierna (cuádriceps), gemelo y abdomen', ejercicios: [
    'Sentadilla barra alta', 'Prensa 45°', 'Extensión de cuádriceps', 'Búlgara con mancuernas',
    'Gemelo de pie', 'Gemelo sentado', 'Crunch en polea (lastrado)', 'Elevación de piernas colgado (lastrada)'] },
  { nombre: 'Día 3 · Hombro, brazos y antebrazo', ejercicios: [
    'Press militar con barra', 'Elevaciones laterales', 'Pájaros (deltoides posterior)', 'Curl de bíceps con barra',
    'Press francés / extensión en polea', 'Curl de muñeca en polea (barra)', 'Pulso en polea unilateral'] },
  { nombre: 'Día 4 · Pecho y espalda', ejercicios: [
    'Press banca plano con mancuernas', 'Cruce de poleas / aperturas', 'Jalón al pecho agarre neutro',
    'Remo bajo en polea a la cintura', 'Remo con mancuerna a un brazo', 'Face pull'] },
  { nombre: 'Día 5 · Pierna (femoral y glúteo), gemelo y abdomen', ejercicios: [
    'Peso muerto rumano con barra', 'Hip thrust', 'Curl femoral tumbado', 'Peso muerto sumo con mancuerna',
    'Gemelo de pie', 'Gemelo sentado', 'Rueda abdominal (lastrada)', 'Plancha lastrada / Pallof'] },
];

// Ejercicios donde la carga se apunta por lado (mancuerna o brazo)
const POR_LADO = new Set(['Búlgara con mancuernas', 'Remo con mancuerna a un brazo', 'Pulso en polea unilateral']);

// Si ya tenías ejercicios con otro nombre, se renombran para conservar su historial
const ALIAS = {
  'Sentadilla': 'Sentadilla barra alta',
  'Prensa': 'Prensa 45°',
  'Búlgaras con mancuernas': 'Búlgara con mancuernas',
  'Elevaciones laterales en polea': 'Elevaciones laterales',
  'Hombro posterior': 'Pájaros (deltoides posterior)',
  'Antebrazo en polea baja con barra': 'Curl de muñeca en polea (barra)',
};

// Series × reps de cada mesociclo, día a día, en el mismo orden que DIAS_PLAN
export const MESOS_PLAN = [
  { numero: 1, nombre: 'Volumen base', descripcion: 'Reconstruir base con volumen alto y técnica perfecta. RIR 2–3.', dias: [
    '3x6-8 3x6-8 3x10-12 3x6-8 3x8-10 3x10-12',
    '3x6-8 3x8-10 3x10-12 3x8-10 4x10-12 4x10-12 3x12-15 3x12-15',
    '3x6-8 3x10-12 3x10-12 3x8-10 3x8-10 3x12-15 3x12-15',
    '3x6-8 3x10-12 3x8-10 3x8-10 3x8-10 3x10-12',
    '3x6-8 3x8-10 3x10-12 3x8-10 4x10-12 4x10-12 3x12-15 3x12-15'] },
  { numero: 2, nombre: 'Intensificación', descripcion: 'Subimos carga en los pesados (5–7 reps). RIR 2. Empuja los kilos.', dias: [
    '3x5-7 3x5-7 3x8-12 3x5-7 3x6-8 3x8-12',
    '3x5-7 3x6-8 3x8-12 3x6-8 4x8-10 4x8-10 3x10-12 3x10-12',
    '3x5-7 3x8-12 3x8-12 3x6-8 3x6-8 3x12-15 3x12-15',
    '3x5-7 3x8-12 3x6-8 3x6-8 3x6-8 3x8-12',
    '3x5-7 3x6-8 3x8-12 3x6-8 4x8-10 4x8-10 3x10-12 3x10-12'] },
  { numero: 3, nombre: 'Volumen', descripcion: 'Una serie más en compuestos y más reps en aislados. Bombeo y densidad.', dias: [
    '4x6-8 4x6-8 3x12-15 4x6-8 3x8-10 3x12-15',
    '4x6-8 3x8-10 3x12-15 3x8-10 4x12-15 4x12-15 3x12-15 3x12-15',
    '4x6-8 3x12-15 3x12-15 3x8-10 3x8-10 3x15-20 3x15-20',
    '4x6-8 3x12-15 3x8-10 3x8-10 3x8-10 3x12-15',
    '4x6-8 3x8-10 3x12-15 3x8-10 4x12-15 4x12-15 3x12-15 3x12-15'] },
  { numero: 4, nombre: 'Fuerza-hipertrofia', descripcion: 'Fase pesada (4–6 reps). RIR 1–2. Tus mejores cargas del bloque.', dias: [
    '4x4-6 4x4-6 3x8-10 4x4-6 3x6-8 3x8-10',
    '4x4-6 3x6-8 3x8-10 3x6-8 4x8-10 4x8-10 3x10-12 3x10-12',
    '4x4-6 3x8-10 3x8-10 3x6-8 3x6-8 3x12-15 3x12-15',
    '4x4-6 3x8-10 3x6-8 3x6-8 3x6-8 3x8-10',
    '4x4-6 3x6-8 3x8-10 3x6-8 4x8-10 4x8-10 3x10-12 3x10-12'] },
  { numero: 5, nombre: 'Especialización y bombeo', descripcion: 'Foco en pierna, abdomen y gemelo. Reps altas y técnicas de intensidad en aislados.', dias: [
    '3x6-8 3x6-8 3x12-20 3x6-8 3x10-12 3x12-20',
    '3x6-8 3x10-12 3x12-20 3x10-12 5x12-20 5x12-20 4x12-20 4x12-20',
    '3x6-8 3x12-20 3x12-20 3x10-12 3x10-12 3x15-20 3x15-20',
    '3x6-8 3x12-20 3x10-12 3x10-12 3x10-12 3x12-20',
    '3x6-8 3x10-12 3x12-20 3x10-12 5x12-20 5x12-20 4x12-20 4x12-20'] },
  { numero: 6, nombre: 'Pico', descripcion: 'Consolidar lo ganado con las cargas más altas. 5–7 reps, autorregulado.', dias: [
    '3x5-7 3x5-7 3x10-12 3x5-7 3x6-8 3x10-12',
    '3x5-7 3x6-8 3x10-12 3x6-8 4x10-12 4x10-12 3x12-15 3x12-15',
    '3x5-7 3x10-12 3x10-12 3x6-8 3x6-8 3x12-15 3x12-15',
    '3x5-7 3x10-12 3x6-8 3x6-8 3x6-8 3x10-12',
    '3x5-7 3x6-8 3x10-12 3x6-8 4x10-12 4x10-12 3x12-15 3x12-15'] },
];

// Qué toca cada semana del mesociclo (método de progresión del plan)
export const SEMANAS_MESO = [
  { titulo: 'Carga base', texto: 'Elige el peso con el que llegas justo al tope bajo del rango.' },
  { titulo: 'Más repeticiones', texto: 'Mismo peso, +1–2 reps por serie.' },
  { titulo: 'Más carga', texto: 'Sube 2,5–5 kg y vuelve al nº bajo de reps.' },
  { titulo: 'Descarga', texto: 'Una serie menos y −10–15 % de carga. No te la saltes.' },
];

// Día de gimnasio sugerido según el día de la semana (lunes = Día 1 ... viernes = Día 5)
export const diaSugerido = (fechaISO, dias) => {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const i = (new Date(y, m - 1, d).getDay() + 6) % 7;   // 0 = lunes
  return dias[Math.min(i, dias.length - 1)] ?? dias[0];
};

/* ============================== RUNNING ============================== */

export const SEMANAS_RUN = 27;
export const FASES_RUN = [
  { numero: 1, nombre: 'Base', desde: 1, hasta: 5, objetivo: '5:00 → 4:50 /km en cómodo',
    foco: 'Construir kilómetros cómodos y bajar el pulso a ritmo suave.',
    series: '6–8 × 400 m a 4:20 · rec. 90 s + 3 km trote',
    larga: '10 → 14 km a 5:00–5:15',
    easy: 'Easy 6–8 km a 5:15, o bici Z2 60–90 min' },
  { numero: 2, nombre: 'Umbral', desde: 6, hasta: 11, objetivo: 'Umbral 4:15 → 4:05 /km',
    foco: 'Mover el umbral con tiradas controladas-duras.',
    series: '5 × 1000 m a 4:15 · rec. 90 s (progresa a 4:05)',
    larga: '14 → 16 km a 4:55–5:05',
    easy: 'Tempo 5 km a 4:30, o bici Z2 90 min' },
  { numero: 3, nombre: 'VO₂ y velocidad', desde: 12, hasta: 17, objetivo: '1000 a 4:00 · 400 a 3:50',
    foco: 'Techo aeróbico y economía. Aquí duele.',
    series: '5–6 × 1000 m a 4:00, o 10 × 400 m a 3:50 · rec. 90 s',
    larga: '16 → 18 km con los últimos 4 km a 4:30',
    easy: 'Easy 8 km a 5:00, o bici Z2 fuerte 90–120 min' },
  { numero: 4, nombre: 'Específico 15K', desde: 18, hasta: 23, objetivo: 'Ritmo 15K 4:10 → 3:55 /km',
    foco: 'Acostumbrar cuerpo y cabeza al ritmo de carrera.',
    series: '4 × 2000 m a ritmo objetivo (4:10 → 4:00) · rec. 2 min',
    larga: '14–16 km con 6–8 km a ritmo 15K',
    easy: 'Easy 6–8 km regenerativo, o bici suave' },
  { numero: 5, nombre: 'Afinamiento y carrera', desde: 24, hasta: 27, objetivo: 'Estrella 3:50 · realista 4:05–4:20',
    foco: 'Bajar volumen, mantener la chispa y llegar fresco.',
    series: '3 × 1500 m a ritmo objetivo, recortando',
    larga: 'Baja a 10–12 km suave',
    easy: 'Trote suave 4–5 km y descanso extra' },
];
export const faseDeSemana = n => FASES_RUN.find(f => n >= f.desde && n <= f.hasta) || null;

/* =========================== FLEXIBILIDAD =========================== */

export const FLEX = [
  { id: 'gato',      nombre: 'Gato-camello',                     dosis: '1 × 10',       como: 'Calienta la columna. Redondea y arquea despacio.' },
  { id: 'isquios',   nombre: 'Isquios de pie, manos al suelo',   dosis: '3 × 45 s',     como: 'Piernas rectas, baja sin rebotes. Gana rango cada semana.' },
  { id: 'pliegue',   nombre: 'Pliegue sentado, cabeza a rodillas', dosis: '3 × 45–60 s', como: 'El ejercicio del objetivo. Pecho a los muslos, tira de los pies.' },
  { id: 'pancake',   nombre: 'Pancake / aductores',              dosis: '3 × 45 s',     como: 'Sentado, piernas abiertas, baja el pecho al suelo.' },
  { id: 'jefferson', nombre: 'Jefferson curl lastrado',          dosis: '3 × 6–8',      como: 'Peso ligero. Enrolla vértebra a vértebra y sube igual.' },
  { id: 'cadera',    nombre: 'Movilidad de cadera 90/90',        dosis: '2 × 8 por lado', como: 'Gira las dos piernas de lado a lado. Abre caderas.' },
  { id: 'hipo',      nombre: 'Hipopresivo (vacuum)',             dosis: '3 × 3 apneas', como: 'Exhala todo, mete costillas y barriga, aguanta 10–15 s. Mejor en ayunas.' },
  { id: 'cuello-f',  nombre: 'Cuello lastrado: flexión',         dosis: '3 × 12–15',    como: 'Tumbado, disco en la frente, barbilla al pecho. Sube y baja lento.' },
  { id: 'cuello-e',  nombre: 'Cuello lastrado: extensión',       dosis: '3 × 12–15',    como: 'Boca abajo, disco en la nuca, sube la mirada. Rango completo.' },
];
const BASE_FLEX = ['gato', 'isquios', 'pliegue', 'pancake', 'jefferson', 'cadera'];

// Semana tipo del plan: L/X/V con cuello, M/J/S con hipopresivos, domingo solo flexibilidad
export function flexDelDia(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay();      // 0 = domingo
  const extra = [1, 3, 5].includes(dia) ? ['cuello-f', 'cuello-e'] : [2, 4, 6].includes(dia) ? ['hipo'] : [];
  return FLEX.filter(f => [...BASE_FLEX, ...extra].includes(f.id));
}

// Medida semanal del pliegue: de peor a mejor
export const MEDIDAS_FLEX = ['Dedos a media espinilla', 'Dedos al tobillo', 'Dedos a los dedos del pie', 'Cabeza a las rodillas'];

/* ======================= CARGAR EL PLAN EN SUPABASE ======================= */

// Primer lunes a partir de una fecha
export function proximoLunes(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  return sumarDias(fechaISO, (8 - dia) % 7);
}

export async function cargarPlan(inicio, uid) {
  // 1) Ejercicios: renombrar los antiguos equivalentes y crear los que falten
  const existentes = await ejecutar(supabase.from('ejercicios').select('*'));
  const porNombre = new Map(existentes.map(e => [e.nombre, e]));
  for (const [viejo, nuevo] of Object.entries(ALIAS)) {
    if (porNombre.has(viejo) && !porNombre.has(nuevo)) {
      const e = porNombre.get(viejo);
      await ejecutar(supabase.from('ejercicios').update({ nombre: nuevo, activo: true }).eq('id', e.id));
      porNombre.delete(viejo);
      porNombre.set(nuevo, { ...e, nombre: nuevo });
    }
  }
  const nuevos = [];
  DIAS_PLAN.forEach(dia => dia.ejercicios.forEach((nombre, i) => {
    if (!porNombre.has(nombre) && !nuevos.some(n => n.nombre === nombre)) {
      nuevos.push({ nombre, dia: dia.nombre, orden: i, por_lado: POR_LADO.has(nombre) });
    }
  }));
  if (nuevos.length) {
    const creados = await ejecutar(supabase.from('ejercicios').insert(nuevos).select());
    creados.forEach(e => porNombre.set(e.nombre, e));
  }

  // 2) Mesociclos: quitar los de una carga anterior del plan y cerrar los que sigan abiertos
  const mesos = await ejecutar(supabase.from('mesociclos').select('*'));
  const delPlan = mesos.filter(m => m.numero != null).map(m => m.id);
  if (delPlan.length) await ejecutar(supabase.from('mesociclos').delete().in('id', delPlan));
  for (const m of mesos.filter(m => m.numero == null && !m.fecha_fin && m.fecha_inicio < inicio)) {
    await ejecutar(supabase.from('mesociclos').update({ fecha_fin: sumarDias(inicio, -1) }).eq('id', m.id));
  }

  // 3) Crear los 6 mesociclos (4 semanas cada uno) con su rutina
  for (const plan of MESOS_PLAN) {
    const ini = sumarDias(inicio, 28 * (plan.numero - 1));
    const fin = sumarDias(ini, 27);
    const meso = await ejecutar(supabase.from('mesociclos').insert({
      nombre: plan.nombre, numero: plan.numero, descripcion: plan.descripcion, fecha_inicio: ini, fecha_fin: fin,
    }).select().single());

    const filas = [];
    DIAS_PLAN.forEach((dia, d) => {
      plan.dias[d].split(' ').forEach((txt, i) => {
        const [series, rango] = txt.split('x');
        const [min, max] = rango.split('-').map(Number);
        filas.push({
          mesociclo_id: meso.id, dia: dia.nombre, ejercicio_id: porNombre.get(dia.ejercicios[i]).id,
          orden: i, series: Number(series), reps_min: min, reps_max: max,
        });
      });
    });
    await ejecutar(supabase.from('rutinas').insert(filas));
    // Las sesiones que ya caigan en esas fechas pasan a este mesociclo
    await ejecutar(supabase.from('sesiones').update({ mesociclo_id: meso.id }).gte('fecha', ini).lte('fecha', fin));
  }

  // 4) Guardar la fecha de inicio (también la usa el plan de running)
  await ejecutar(supabase.from('ajustes').upsert({ user_id: uid, inicio_plan: inicio }));
}

export const planCargado = () => state.mesociclos.some(m => m.numero != null);
