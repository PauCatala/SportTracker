// Avatares realistas de Avaturn (https://avaturn.me).
// - SYNCO trae dos avatares listos (masculino y femenino) creados con Avaturn, con su carrera nativa.
// - También puedes usar el tuyo: créalo gratis en avaturn.me, descárgalo (.glb) y súbelo en "Tu avatar".
//   Se guarda en tu cuenta (Supabase Storage, carpeta privada) y en este dispositivo (IndexedDB).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { supabase } from '../db.js';
import { leer, guardar } from '../almacen.js';
import { animacionesPara } from './retarget.js';
import { posesSalud } from './poses.js';
import { prepararAspecto } from './aspecto.js';
import { crearVida } from './vida.js';
export { ALTURA, COLORES_ROPA, GORROS, PEINADOS } from './aspecto.js';

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

// Enlace público (temporal en el caso del tuyo) para abrir el avatar en el editor de Avaturn
export async function enlaceAvatar(eleccion) {
  if (AVATARES[eleccion]) return new URL(`../../${AVATARES[eleccion].url}`, import.meta.url).href;
  const uid = await usuario();
  if (!uid) return null;
  const { data } = await supabase.storage.from(CUBO).createSignedUrl(`${uid}/avatar.glb`, 3600).catch(() => ({ data: null }));
  return data?.signedUrl || null;
}

// Lo que hay que cargar para la elección actual (URL de un avatar de SYNCO o tu GLB)
export async function fuenteAvatar(eleccion = eleccionAvatar().eleccion) {
  if (eleccion === 'propio') { const b = await modeloPropio(); if (b) return b; eleccion = 'hombre'; }
  return AVATARES[eleccion]?.url || AVATARES.hombre.url;
}

// Guarda tu elección; con un GLB propio, también el archivo
// ---------- Ajustes de aspecto (piel y pelo), guardados en tu cuenta ----------
export const TONOS_PIEL = [['', 'Original'], ['#F6E2D6', 'Muy clara'], ['#E8C5AE', 'Clara'], ['#CF9E80', 'Media'], ['#A9765A', 'Morena'], ['#7A5240', 'Oscura'], ['#563A2E', 'Muy oscura']];
export const COLORES_PELO = [['', 'Original'], ['#24201E', 'Negro'], ['#5A3D2A', 'Castaño'], ['#8C6239', 'Castaño claro'], ['#C9A66E', 'Rubio'], ['#9C4A2B', 'Pelirrojo'], ['#A9A8A4', 'Canoso']];
export const ajustesAvatar = () => leer(CLAVE, null)?.ajustes || {};
export function guardarAjustes(ajustes) {
  guardar(CLAVE, { ...(leer(CLAVE, null) || eleccionAvatar()), v: 2, ajustes });
  window.dispatchEvent(new CustomEvent('avatar-cambiado', { detail: { ajustes } }));
}
// Aplica tu aspecto a un avatar ya cargado (se puede llamar las veces que haga falta):
// piel y pelo aquí; altura, complexión, ropa y gorro en aspecto.js
export function aplicarAjustes(av, ajustes = {}) {
  const { piel = '', pelo = '' } = ajustes;
  av.ajustesActuales = ajustes;
  try { av.aspecto?.aplicar(ajustes, Number(leer('perfil', null)?.altura) || 0); } catch (e) { console.warn('Aspecto del avatar', e); }
  av.objeto.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (/body/i.test(m.name)) {
        // La piel se tiñe multiplicando la textura (conserva poros, labios y sombras)
        m.userData.colorBase ||= m.color.clone();
        m.color.copy(piel ? new THREE.Color(piel).multiplyScalar(1.12) : m.userData.colorBase);
      }
      if (/hair/i.test(m.name)) colorearPelo(m, pelo);
    }
  });
}
// El pelo se pasa a escala de grises y se colorea, así funciona tanto para aclarar como para oscurecer
function colorearPelo(m, color) {
  if (!m.userData.tinte) {
    m.userData.tinte = { value: new THREE.Color(1, 1, 1) };
    m.userData.tinteOn = { value: 0 };
    const previo = m.onBeforeCompile;   // p. ej. el recorte del pelo bajo el gorro
    m.onBeforeCompile = (sh, r) => {
      previo?.call(m, sh, r);
      sh.uniforms.uTinte = m.userData.tinte; sh.uniforms.uTinteOn = m.userData.tinteOn;
      sh.fragmentShader = 'uniform vec3 uTinte;\nuniform float uTinteOn;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        if (uTinteOn > 0.5) { float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = uTinte * clamp(l * 3.2, 0.0, 1.6); }`);
    };
    m.customProgramCacheKey = () => 'pelo-tinte';
    m.needsUpdate = true;
  }
  m.userData.tinteOn.value = color ? 1 : 0;
  if (color) m.userData.tinte.value.set(color);
}

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
  guardar(CLAVE, { v: 2, eleccion, propioId, ajustes: previo.ajustes || {}, fecha: new Date().toISOString() });
  window.dispatchEvent(new CustomEvent('avatar-cambiado', { detail: { eleccion } }));
}

// Carrera nativa de Avaturn (ciclo de 0,67 s sin desplazamiento), adaptable a cualquier avatar de Avaturn
let carrera = null;
const clipCarrera = () => (carrera ||= fetch(new URL('../../media/avatar/avaturn/correr.json', import.meta.url)).then(r => r.json()).then(j => THREE.AnimationClip.parse(j)));
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
const BUCLES = new Set(['idle', 'walk', 'run', 'fuerza', 'comer', 'estirar']);

/**
 * Carga un GLB de Avaturn (u otro humanoide), lo orienta mirando a +Z con los pies en el suelo
 * y le prepara las animaciones. Devuelve { objeto, altura, poner, velocidad, gesto, actualizar }.
 */
export async function cargarAvatarRealista(fuente, { sombras = true, ajustes = ajustesAvatar() } = {}) {
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

  // Altura, complexión, ropa y gorro editables (se mide todo en la postura de reposo)
  let aspecto = null;
  try {
    aspecto = prepararAspecto({ modelo, objeto, giro, fuentesPelo: {
      corto: new URL('../../media/avatar/avaturn/hombre.glb', import.meta.url).href,
      coleta: new URL('../../media/avatar/avaturn/mujer.glb', import.meta.url).href,
    } });
  } catch (e) { console.warn('Aspecto editable', e); }

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
  try { Object.assign(clips, posesSalud(giro)); } catch (e) { console.warn('Poses de Salud', e); }
  if (reposoCadera) {
    try { clips.run = adaptarCarrera(await clipCarrera(), reposoCadera); } catch (e) { console.warn('Carrera de Avaturn', e); }
  }
  const mixer = new THREE.AnimationMixer(objeto);
  const acciones = {};
  for (const [n, c] of Object.entries(clips)) {
    const a = mixer.clipAction(c);
    if (!BUCLES.has(n)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
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
  // Capa de vida: inclinación y giro de hombros al correr, respiración, peso, mirada y manos relajadas
  let vida = null;
  try { vida = crearVida(objeto, buscar); } catch (e) { console.warn('Capa de vida', e); }
  mixer.addEventListener('finished', e => { if (e.action === acciones[gesto]) { gesto = null; poner(base, 0.45); } });
  poner('idle', 0);

  const resultado = {
    objeto, altura, aspecto,
    estado(n, v = 1) { base = n; vel = v; vida?.estado(n); if (!gesto) poner(n); if (actual === acciones[n]) actual.setEffectiveTimeScale(v); },
    gesto(n) { if (!acciones[n]) return; gesto = n; poner(n, 0.3); },
    hueso: n => buscar(new RegExp(`^(mixamorig:?)?${n}$`)),
    tiene: n => !!acciones[n],
    fijar(n, t) { vida?.estado(n); vida?.antes(); mixer.stopAllAction(); const a = acciones[n]; a.reset().play(); mixer.setTime(t); actual = a; modelo.position.y = baseY + balanceo.position.y; vida?.despues(0); },
    actualizar(dt) { vida?.antes(); mixer.update(dt); modelo.position.y = baseY + balanceo.position.y; vida?.despues(dt); },
    destruir() { mixer.stopAllAction(); objeto.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } }); objeto.removeFromParent(); },
  };
  // Al terminar de cargar otro peinado, se le aplican el color y el gorro
  if (aspecto) aspecto.alCambiar = () => aplicarAjustes(resultado, resultado.ajustesActuales || {});
  if (ajustes) aplicarAjustes(resultado, ajustes);
  return resultado;
}
