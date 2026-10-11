// Avatares realistas de Avaturn (https://avaturn.me).
// - Lumen trae dos avatares listos (masculino y femenino) creados con Avaturn, con su carrera nativa.
// - También puedes usar el tuyo: créalo gratis en avaturn.me, descárgalo (.glb) y súbelo en "Tu avatar".
//   Se guarda en tu cuenta (Supabase Storage, carpeta privada) y en este dispositivo (IndexedDB).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { supabase } from '../db.js';
import { leer, guardar } from '../almacen.js';
import { animacionesPara } from './retarget.js';

const CLAVE = 'avatar-avaturn';        // tu elección (lumen_datos)
const CUBO = 'avatares';               // carpeta privada de Supabase Storage
export const AVATARES = {
  hombre: { nombre: 'Él', url: 'media/avatar/avaturn/hombre.glb' },
  mujer: { nombre: 'Ella', url: 'media/avatar/avaturn/mujer.glb' },
};

// Elección actual: 'hombre', 'mujer' o 'propio'. Por defecto, según el sexo de tu perfil.
export function eleccionAvatar() {
  const d = leer(CLAVE, null);
  if (d?.eleccion) return d;
  if (d?.avatarId) return { eleccion: 'propio', propioId: d.avatarId };   // formato anterior
  return { eleccion: leer('perfil', null)?.sexo === 'm' ? 'mujer' : 'hombre' };
}
export const tieneAvaturn = () => !!leer(CLAVE, null);

// ---------- Copia local (IndexedDB) ----------
function bd() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('lumen-avatar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('glb');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function guardarLocal(id, blob) {
  const db = await bd();
  await new Promise((ok, mal) => { const t = db.transaction('glb', 'readwrite'); t.objectStore('glb').put({ id, blob }, 'actual'); t.oncomplete = ok; t.onerror = () => mal(t.error); });
}
async function leerLocal() {
  const db = await bd();
  return new Promise(ok => { const r = db.transaction('glb').objectStore('glb').get('actual'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
}
async function usuario() {
  try { return (await supabase.auth.getSession()).data.session?.user?.id || null; } catch { return null; }
}

// Tu avatar propio (blob GLB), de este dispositivo o de tu cuenta
export async function modeloPropio() {
  const id = eleccionAvatar().propioId || leer(CLAVE, null)?.propioId;
  const local = await leerLocal().catch(() => null);
  if (local && (!id || local.id === id)) return local.blob;
  const uid = await usuario();
  if (!uid) return local?.blob || null;
  const { data, error } = await supabase.storage.from(CUBO).download(`${uid}/avatar.glb`);
  if (error || !data) return local?.blob || null;
  await guardarLocal(id || 'cuenta', data).catch(() => {});
  return data;
}

// Lo que hay que cargar para la elección actual (URL de un avatar de Lumen o tu GLB)
export async function fuenteAvatar(eleccion = eleccionAvatar().eleccion) {
  if (eleccion === 'propio') { const b = await modeloPropio(); if (b) return b; eleccion = 'hombre'; }
  return AVATARES[eleccion]?.url || AVATARES.hombre.url;
}

// Guarda tu elección; con un GLB propio, también el archivo
export async function elegirAvatar(eleccion, blob = null) {
  const previo = leer(CLAVE, null) || {};
  let propioId = previo.propioId || previo.avatarId || null;
  if (blob) {
    propioId = crypto.randomUUID();
    await guardarLocal(propioId, blob);
    const uid = await usuario();
    if (uid) {
      const { error } = await supabase.storage.from(CUBO).upload(`${uid}/avatar.glb`, blob, { contentType: 'model/gltf-binary', upsert: true });
      if (error) console.warn('No se pudo subir el avatar a tu cuenta:', error.message);
    }
  }
  guardar(CLAVE, { v: 2, eleccion, propioId, fecha: new Date().toISOString() });
  window.dispatchEvent(new CustomEvent('avatar-cambiado', { detail: { eleccion } }));
}

// Carrera nativa de Avaturn (ciclo de 0,67 s sin desplazamiento), adaptable a cualquier avatar de Avaturn
let carrera = null;
const clipCarrera = () => (carrera ||= fetch('media/avatar/avaturn/correr.json').then(r => r.json()).then(j => THREE.AnimationClip.parse(j)));
function adaptarCarrera(base, cadera) {
  const clip = base.clone();
  const p = clip.tracks.find(t => t.name === 'Hips.position');
  if (p) {
    const v = p.values = p.values.slice();
    for (let i = 0; i < v.length; i += 3) { v[i] = cadera.position.x; v[i + 1] *= cadera.position.y; v[i + 2] = cadera.position.z; }
  }
  // El balanceo vertical ya va en la cadera: la capa de balanceo queda quieta durante la carrera
  clip.tracks.push(new THREE.VectorKeyframeTrack('avatar_balanceo.position', [0, clip.duration], [0, 0, 0, 0, 0, 0]));
  return clip;
}

// ---------- Modelo en la escena ----------
const cargador = new GLTFLoader();

/**
 * Carga un GLB de Avaturn (u otro humanoide), lo orienta mirando a +Z con los pies en el suelo
 * y le prepara las animaciones. Devuelve { objeto, altura, poner, velocidad, gesto, actualizar }.
 */
export async function cargarAvatarRealista(fuente, { sombras = true } = {}) {
  const url = fuente instanceof Blob ? URL.createObjectURL(fuente) : fuente;
  let gltf;
  try { gltf = await cargador.loadAsync(url); } finally { if (fuente instanceof Blob) URL.revokeObjectURL(url); }
  const modelo = gltf.scene;
  const objeto = new THREE.Group(); objeto.name = 'avatar-realista';
  const giro = new THREE.Group(); objeto.add(giro); giro.add(modelo);
  modelo.updateMatrixWorld(true);

  // ¿Mira a +Z? La pierna izquierda del avatar debe quedar en +X
  const buscar = re => { let r = null; modelo.traverse(o => { if (!r && o.isBone && re.test(o.name)) r = o; }); return r; };
  const izq = buscar(/left.?up.?leg/i), der = buscar(/right.?up.?leg/i);
  if (izq && der && izq.getWorldPosition(new THREE.Vector3()).x < der.getWorldPosition(new THREE.Vector3()).x) giro.rotation.y = Math.PI;
  objeto.updateMatrixWorld(true);

  // Pies en el suelo y altura
  const caja = new THREE.Box3().setFromObject(objeto);
  modelo.position.y -= caja.min.y;
  const baseY = modelo.position.y;
  const altura = caja.max.y - caja.min.y;
  objeto.updateMatrixWorld(true);

  // Materiales: que reciban bien la luz del estudio, sin brillos de plástico
  const mallas = []; modelo.traverse(o => { if (o.isMesh) mallas.push(o); });
  for (const o of mallas) {
    o.castShadow = sombras; o.receiveShadow = sombras; o.frustumCulled = false;
    const m = o.material;
    if ('envMapIntensity' in m) m.envMapIntensity = 0.85;
    if (m.map) m.map.anisotropy = 8;
    // Pelo semitransparente en dos pasadas, como en Avaturn: núcleo sólido (ordena bien y da sombra)
    // y bordes suaves por encima, sin escribir profundidad
    if (m.transparent && o.isSkinnedMesh) {
      const borde = m.clone();
      borde.alphaTest = 0; borde.depthWrite = false; borde.transparent = true;
      m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true;
      const suave = new THREE.SkinnedMesh(o.geometry, borde);
      suave.bind(o.skeleton, o.bindMatrix);
      suave.frustumCulled = false; suave.renderOrder = 2; suave.castShadow = false;
      o.parent.add(suave);
    }
  }

  // Avatares de Avaturn (huesos Hips, LeftUpLeg...): su carrera nativa, mucho más natural que la adaptada
  const cadera = buscar(/^Hips$/);
  const reposoCadera = cadera && buscar(/^LeftUpLeg$/) ? cadera.clone(false) : null;
  const { clips, balanceo } = await animacionesPara(giro);
  objeto.add(balanceo);
  if (reposoCadera) {
    try { clips.run = adaptarCarrera(await clipCarrera(), reposoCadera); } catch (e) { console.warn('Carrera de Avaturn', e); }
  }
  const mixer = new THREE.AnimationMixer(objeto);
  const acciones = {};
  for (const [n, c] of Object.entries(clips)) {
    const a = mixer.clipAction(c);
    if (!['idle', 'walk', 'run'].includes(n)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    acciones[n] = a;
  }
  let actual = null, base = 'idle', gesto = null, vel = 1;
  function poner(n, fundido = 0.35) {
    const a = acciones[n];
    if (!a || a === actual) return;
    a.reset().setEffectiveTimeScale(n === base ? vel : 1).setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(a, fundido, false);
    actual = a;
  }
  mixer.addEventListener('finished', e => { if (e.action === acciones[gesto]) { gesto = null; poner(base, 0.45); } });
  poner('idle', 0);

  return {
    objeto, altura,
    estado(n, v = 1) { base = n; vel = v; if (!gesto) poner(n); if (actual === acciones[n]) actual.setEffectiveTimeScale(v); },
    gesto(n) { if (!acciones[n]) return; gesto = n; poner(n, 0.3); },
    fijar(n, t) { mixer.stopAllAction(); const a = acciones[n]; a.reset().play(); mixer.setTime(t); actual = a; this.actualizar(0); },
    actualizar(dt) { mixer.update(dt); modelo.position.y = baseY + balanceo.position.y; },
    destruir() { mixer.stopAllAction(); objeto.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } }); objeto.removeFromParent(); },
  };
}
