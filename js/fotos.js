// FOTOS: se guardan comprimidas en este dispositivo (IndexedDB, mucho más espacio que el navegador normal).
// Carpetas: 'progreso' (foto semanal), 'comidas' y 'dia'.
import { hoyISO } from './almacen.js';
import { lunesDe, sumarDias } from './utils.js';

const BD = 'lumen-fotos', ALMACEN = 'fotos';
let conexion = null;

function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: 'id' }).createIndex('carpeta', 'carpeta');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return conexion;
}
async function operacion(modo, fn) {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const t = bd.transaction(ALMACEN, modo);
    const r = fn(t.objectStore(ALMACEN));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => mal(t.error);
  });
}

export const guardarFoto = foto => operacion('readwrite', s => s.put(foto));
export const borrarFoto = id => operacion('readwrite', s => s.delete(id));
export async function fotosDe(carpeta) {
  const lista = await operacion('readonly', s => s.index('carpeta').getAll(carpeta));
  return (lista || []).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creada - a.creada);
}

// Reduce la foto a 1280 px y la guarda en JPEG: ocupa ~10 veces menos
export async function comprimir(archivo, max = 1280, calidad = 0.82) {
  const img = await createImageBitmap(archivo);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * k);
  lienzo.height = Math.round(img.height * k);
  lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return new Promise(ok => lienzo.toBlob(ok, 'image/jpeg', calidad));
}

// La foto de progreso es semanal: cuenta para la semana de lunes a domingo
export const domingoDe = fecha => sumarDias(lunesDe(fecha), 6);

export const semanaDeFoto = f => f.semana || domingoDe(f.fecha);

// ¿Hay que avisar de la foto de progreso?
//  - domingo sin foto esta semana  → "hoy toca"
//  - lunes o martes sin foto de la semana pasada → "te faltó"
export async function avisoProgreso() {
  try {
    const hoy = hoyISO();
    const dia = new Date().getDay();   // 0 = domingo
    const fotos = await fotosDe('progreso');
    const semanas = new Set(fotos.map(semanaDeFoto));
    if (dia === 0 && !semanas.has(domingoDe(hoy))) return 'hoy';
    if ((dia === 1 || dia === 2) && !semanas.has(domingoDe(sumarDias(hoy, -7)))) return 'falto';
    return null;
  } catch {
    return null;
  }
}
