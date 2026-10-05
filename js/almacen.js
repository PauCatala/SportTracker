// Guardado de las secciones nuevas de Lumen (perfil, nutrición, tareas, hábitos, notas...).
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

// Guarda un dato (al momento en el navegador; a la nube medio segundo después)
export function guardar(clave, valor) {
  try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); } catch (e) { console.warn(e); }
  if (usuario) programarSubida(clave, valor);
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
