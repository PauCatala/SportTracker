// Todo lo que habla con Supabase vive aquí.
// Estrategia sencilla: al abrir la app descargamos TODOS tus datos a memoria (state)
// y el resto de la app trabaja con ese "state". Con los datos de una persona va sobrado.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { esErrorDeRed } from './utils.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Copia en memoria de tus datos
export const state = {
  ejercicios: [], mesociclos: [], sesiones: [], series: [], rutinas: [],
  carreras: [], flex_dias: [], ajustes: null,
  faltaMigracion: false,    // true si aún no has ejecutado schema_v2.sql
};
export let uid = null;      // tu id de usuario (lo necesitan algunas escrituras)

const TABLAS = ['ejercicios', 'mesociclos', 'sesiones', 'series', 'rutinas', 'carreras', 'flex_dias', 'ajustes'];
const NUEVAS = new Set(['rutinas', 'carreras', 'flex_dias', 'ajustes']);
const CLAVE_CACHE = 'st_cache_v2';   // copia local para poder abrir la app sin internet
const CLAVE_COLA = 'st_cola_v1';     // sesiones de gimnasio guardadas sin internet

// Ejecuta una consulta y lanza el error si lo hay (así podemos usar try/catch)
export async function ejecutar(consulta) {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}

// Supabase devuelve como máximo 1000 filas por petición, así que pedimos por páginas
async function leerTabla(tabla) {
  const TAM = 1000;
  let desde = 0, filas = [];
  while (true) {
    const { data, error } = await supabase.from(tabla).select('*')
      .order(tabla === 'ajustes' ? 'user_id' : 'id').range(desde, desde + TAM - 1);
    if (error) {
      // Tabla que aún no existe → falta ejecutar la migración v2
      if (NUEVAS.has(tabla) && /does not exist|PGRST205|42P01|schema cache/i.test(`${error.code} ${error.message}`)) {
        state.faltaMigracion = true;
        return [];
      }
      throw error;
    }
    filas = filas.concat(data);
    if (data.length < TAM) return filas;
    desde += TAM;
  }
}

// ---------- Cargar datos ----------
export async function cargarTodo() {
  const { data } = await supabase.auth.getSession();
  uid = data.session?.user?.id ?? uid;

  if (navigator.onLine) {
    try {
      state.faltaMigracion = false;
      const filas = await Promise.all(TABLAS.map(leerTabla));
      TABLAS.forEach((t, i) => (state[t] = filas[i]));
      state.ajustes = filas[TABLAS.indexOf('ajustes')][0] || null;
      ordenar();
      try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(state)); } catch {}
      aplicarColaAlEstado();
      return;
    } catch (e) {
      console.warn('No se pudo cargar de Supabase, uso la copia local', e);
    }
  }
  cargarLocal();
}

function ordenar() {
  state.series.sort((a, b) => a.id - b.id);
  state.sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  state.carreras.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
}

function cargarLocal() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null');
    if (c) Object.assign(state, c);
  } catch {}
  aplicarColaAlEstado();
}

export function limpiarLocal() {
  localStorage.removeItem(CLAVE_CACHE);
}

// ---------- Cola de sesiones de gimnasio sin conexión ----------
export function pendientes() {
  try { return JSON.parse(localStorage.getItem(CLAVE_COLA) || '[]'); } catch { return []; }
}
function guardarCola(cola) {
  localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
}

// Mezcla lo pendiente con los datos descargados, para que lo veas aunque no se haya subido
function aplicarColaAlEstado() {
  for (const p of pendientes()) {
    const existente = state.sesiones.find(s => s.fecha === p.fecha && s.dia === p.dia);
    const id = existente ? existente.id : p.idTemporal;
    state.series = state.series.filter(s => s.sesion_id !== id);
    if (p.series.length === 0) {                       // era un borrado
      state.sesiones = state.sesiones.filter(s => s.id !== id);
      continue;
    }
    if (existente) Object.assign(existente, { notas: p.notas, mesociclo_id: p.mesociclo_id, pendiente: true });
    else state.sesiones.push({ id, fecha: p.fecha, dia: p.dia, notas: p.notas, mesociclo_id: p.mesociclo_id, pendiente: true });
    p.series.forEach((s, i) => state.series.push({ ...s, id: `${id}-${i}`, sesion_id: id }));
  }
}

// ---------- Guardar una sesión de gimnasio ----------
// p = { fecha, dia, notas, mesociclo_id, series: [{ejercicio_id, numero_serie, drop_idx, reps, kg, tecnica}] }
// Si series está vacío, la sesión se borra.
async function guardarEnSupabase(p) {
  const existentes = await ejecutar(
    supabase.from('sesiones').select('id').eq('fecha', p.fecha).eq('dia', p.dia)
  );
  let id = existentes[0]?.id;

  if (p.series.length === 0) {
    if (id) await ejecutar(supabase.from('sesiones').delete().eq('id', id));
    return;
  }

  if (id) {
    await ejecutar(supabase.from('sesiones').update({ notas: p.notas, mesociclo_id: p.mesociclo_id }).eq('id', id));
    await ejecutar(supabase.from('series').delete().eq('sesion_id', id));   // reescribimos sus series
  } else {
    const nueva = await ejecutar(
      supabase.from('sesiones')
        .insert({ fecha: p.fecha, dia: p.dia, notas: p.notas, mesociclo_id: p.mesociclo_id })
        .select('id').single()
    );
    id = nueva.id;
  }
  await ejecutar(supabase.from('series').insert(p.series.map(s => ({ ...s, sesion_id: id }))));
}

// Devuelve 'guardado' (subido) o 'pendiente' (guardado en el móvil para subir luego)
export async function guardarSesion(p) {
  if (navigator.onLine) {
    try {
      await guardarEnSupabase(p);
      await cargarTodo();
      return 'guardado';
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;   // un error "de verdad" se muestra; uno de red se encola
    }
  }
  const cola = pendientes().filter(x => !(x.fecha === p.fecha && x.dia === p.dia));
  cola.push({ ...p, idTemporal: -Date.now() });
  guardarCola(cola);
  cargarLocal();
  return 'pendiente';
}

// Sube lo pendiente. Devuelve cuántas sesiones se subieron.
export async function vaciarCola() {
  const cola = pendientes();
  if (!cola.length || !navigator.onLine) return 0;
  const restantes = [];
  let subidas = 0;
  for (const p of cola) {
    try { await guardarEnSupabase(p); subidas++; }
    catch (e) { console.warn(e); restantes.push(p); }
  }
  guardarCola(restantes);
  if (subidas) await cargarTodo();
  return subidas;
}
