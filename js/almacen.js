// Guardado de las secciones nuevas de SYNCO (perfil, nutrición, tareas, hábitos, notas...).
// - Sin cuenta: todo se guarda en este navegador.
// - Con cuenta: además se sube a Supabase (tabla lumen_datos) y se baja al entrar,
//   así lo ves igual en el móvil y en el ordenador.

import { supabase } from './db.js';

const PREFIJO = 'lumen:';
let usuario = null;               // id del usuario cuando hay sesión
const porSubir = new Map();       // cambios esperando a subirse
let temporizador = null;

const copia = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

// Lee un dato; si no existe devuelve "porDefecto"
export function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v === null ? copia(porDefecto) : JSON.parse(v);
  } catch {
    return copia(porDefecto);
  }
}

// Quien quiera enterarse de los cambios (p. ej. los avisos, que se recalculan al cambiar la agenda)
const oyentes = new Set();
export const escuchar = f => oyentes.add(f);

// ---------- Tareas hechas: se borran solas a los 7 días ----------
// Al guardar, cada tarea apunta cuándo se marcó como hecha (hechaEn). Si se desmarca, se quita la marca.
// Así funciona igual se marque desde el tablero, el calendario, la lista o una nota rápida.
export const DIAS_HECHAS = 7;
const HECHA = { tareas: t => t.estado === 'hecho', lista: x => !!x.hecho };
function sellarHechas(clave, valor) {
  const hecha = HECHA[clave];
  if (!hecha || !Array.isArray(valor)) return valor;
  const ahora = Date.now();
  return valor.map(x => {
    if (!x || typeof x !== 'object') return x;
    if (hecha(x)) return x.hechaEn ? x : { ...x, hechaEn: ahora };
    if (!x.hechaEn) return x;
    const { hechaEn, ...resto } = x;
    return resto;
  });
}
// Días que le quedan a una tarea hecha antes de borrarse (null si no está hecha)
export function diasParaBorrar(x) {
  if (!x?.hechaEn) return null;
  return Math.max(0, Math.ceil((x.hechaEn + DIAS_HECHAS * 86400000 - Date.now()) / 86400000));
}
// «Se borra mañana», «Se borra en 5 días»
export const textoBorra = n => (n <= 0 ? 'Se borra hoy' : n === 1 ? 'Se borra mañana' : `Se borra en ${n} días`);
// Borra las que llevan más de 7 días hechas (se llama al entrar y al abrir Tareas)
export function borrarHechasAntiguas() {
  let borradas = 0;
  for (const clave of Object.keys(HECHA)) {
    const lista = leer(clave, null);
    if (!Array.isArray(lista)) continue;
    const limite = Date.now() - DIAS_HECHAS * 86400000;
    const quedan = sellarHechas(clave, lista).filter(x => !(HECHA[clave](x) && x.hechaEn <= limite));
    borradas += lista.length - quedan.length;
    // Solo se guarda si algo cambia (tareas hechas sin fecha de hecho, o tareas que ya tocaba borrar)
    if (quedan.length !== lista.length || quedan.some((x, i) => x !== lista[i])) guardar(clave, quedan);
  }
  return borradas;
}

// Guarda un dato (al momento en el navegador; a la nube medio segundo después)
export function guardar(clave, valor) {
  valor = sellarHechas(clave, valor);
  try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); } catch (e) { console.warn(e); }
  if (usuario) programarSubida(clave, valor);
  oyentes.forEach(f => { try { f(clave); } catch (e) { console.warn(e); } });
}

function programarSubida(clave, valor) {
  porSubir.set(clave, valor);
  clearTimeout(temporizador);
  temporizador = setTimeout(async () => {
    const filas = [...porSubir].map(([c, v]) => ({ user_id: usuario, clave: c, valor: v, actualizado: new Date().toISOString() }));
    porSubir.clear();
    const { error } = await supabase.from('lumen_datos').upsert(filas);
    if (error) console.warn('No se pudo guardar en la nube:', error.message);
  }, 500);
}

// Al entrar: baja lo que tienes en la nube y sube lo que creaste sin cuenta
export async function sincronizar(uid) {
  usuario = uid;
  const { data, error } = await supabase.from('lumen_datos').select('clave, valor');
  if (error) { console.warn('No se pudieron bajar tus datos:', error.message); return; }
  const enNube = new Set();
  for (const fila of data) {
    localStorage.setItem(PREFIJO + fila.clave, JSON.stringify(fila.valor));
    enNube.add(fila.clave);
  }
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIJO) && !enNube.has(k.slice(PREFIJO.length)))
    .forEach(k => programarSubida(k.slice(PREFIJO.length), JSON.parse(localStorage.getItem(k))));
}

// Al cerrar sesión: borra la copia de este navegador
export function olvidar() {
  usuario = null;
  Object.keys(localStorage).filter(k => k.startsWith(PREFIJO)).forEach(k => localStorage.removeItem(k));
}

// Utilidades comunes
export const hoyISO = () => new Date().toLocaleDateString('sv-SE');   // AAAA-MM-DD en hora local
export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const escapar = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
