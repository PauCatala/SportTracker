// Avatar realista con Avaturn (https://avaturn.me).
// - El editor de Avaturn se abre a pantalla completa dentro de Lumen (iframe oficial con su SDK).
// - Al pulsar "Siguiente" en Avaturn recibimos el modelo 3D (GLB) y lo guardamos:
//   en tu cuenta (Supabase Storage, carpeta privada) y en este dispositivo (IndexedDB).
// - Después se carga en la rueda del Inicio con animaciones adaptadas a su esqueleto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AvaturnSDK } from '../../vendor/avaturn/sdk-1.1.4.js';
import { supabase } from '../db.js';
import { leer, guardar } from '../almacen.js';
import { AVATURN_SUBDOMINIO } from '../config.js';
import { animacionesPara } from './retarget.js';

const CLAVE = 'avatar-avaturn';        // datos del avatar en tu cuenta (lumen_datos)
const CUBO = 'avatares';               // carpeta privada de Supabase Storage

export const tieneAvaturn = () => !!leer(CLAVE, null)?.avatarId;
export const datosAvaturn = () => leer(CLAVE, null);

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

// El modelo del avatar guardado (blob GLB), de este dispositivo o de tu cuenta
export async function modeloGuardado() {
  const meta = datosAvaturn();
  if (!meta?.avatarId) return null;
  const local = await leerLocal().catch(() => null);
  if (local?.id === meta.avatarId) return local.blob;
  const uid = await usuario();
  if (!uid) return local?.blob || null;
  const { data, error } = await supabase.storage.from(CUBO).download(`${uid}/avatar.glb`);
  if (error || !data) return local?.blob || null;
  await guardarLocal(meta.avatarId, data).catch(() => {});
  return data;
}

async function guardarModelo(blob, info) {
  await guardarLocal(info.avatarId, blob);
  const uid = await usuario();
  if (uid) {
    const { error } = await supabase.storage.from(CUBO).upload(`${uid}/avatar.glb`, blob, { contentType: 'model/gltf-binary', upsert: true });
    if (error) console.warn('No se pudo subir el avatar a tu cuenta:', error.message);
  }
  guardar(CLAVE, { v: 1, avatarId: info.avatarId, bodyId: info.bodyId, gender: info.gender, caras: !!info.avatarSupportsFaceAnimations, fecha: new Date().toISOString() });
}

// ---------- Editor de Avaturn a pantalla completa ----------
let abierto = null;
export function abrirAvaturn({ alGuardar, alExportar } = {}) {
  if (abierto) return abierto;
  const raiz = document.createElement('div');
  raiz.className = 'avt entrando';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', 'Tu avatar');
  raiz.innerHTML = `
    <header class="avt-cab">
      <button class="cr-icono" data-cerrar aria-label="Cerrar"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="avt-titulo"><h2>Tu avatar</h2><p>Hazte una foto o elige un rostro, ajusta tu estilo y pulsa <b>Siguiente</b> para traerlo a Lumen.</p></div>
    </header>
    <div class="avt-marco">
      <div class="avt-sdk"></div>
      <p class="avt-estado"><span></span>Abriendo el editor…</p>
    </div>`;
  document.body.append(raiz);
  document.body.classList.add('con-creador');
  requestAnimationFrame(() => raiz.classList.remove('entrando'));
  const estado = raiz.querySelector('.avt-estado');
  const mostrar = (texto, cargando = true) => { estado.hidden = false; estado.innerHTML = `${cargando ? '<span></span>' : ''}${texto}`; estado.classList.remove('fuera'); };

  const sdk = new AvaturnSDK();
  sdk.init(raiz.querySelector('.avt-sdk'), { url: `https://${AVATURN_SUBDOMINIO}.avaturn.dev`, iframeClassName: 'avt-iframe' })
    .then(() => estado.classList.add('fuera'))
    .catch(e => { console.warn('Avaturn', e); mostrar('No se ha podido abrir el editor de Avaturn. Revisa la conexión e inténtalo de nuevo.', false); });
  // Por si el aviso de "listo" no llega, el iframe ya se ve debajo
  setTimeout(() => estado.classList.add('fuera'), 6000);

  sdk.on('export', async data => {
    mostrar('Guardando tu avatar…');
    try {
      const res = await fetch(data.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (alExportar) await alExportar(blob, data);
      else {
        await guardarModelo(blob, data);
        window.dispatchEvent(new CustomEvent('avatar-cambiado', { detail: { tipo: 'avaturn' } }));
        alGuardar?.(data);
      }
      mostrar('¡Listo! Tu avatar ya está en tu Inicio.', false);
      setTimeout(cerrar, 900);
    } catch (e) {
      console.warn('Avaturn export', e);
      mostrar('No se ha podido guardar el avatar. Vuelve a pulsar Siguiente.', false);
    }
  });
  sdk.on('error', e => console.warn('Avaturn', e));

  function cerrar() {
    raiz.classList.add('saliendo');
    removeEventListener('keydown', teclas);
    setTimeout(() => { try { sdk.destroy(); } catch { /* ya cerrado */ } raiz.remove(); document.body.classList.remove('con-creador'); }, 300);
    abierto = null;
  }
  const teclas = ev => { if (ev.key === 'Escape') cerrar(); };
  addEventListener('keydown', teclas);
  raiz.querySelector('[data-cerrar]').onclick = cerrar;
  abierto = { cerrar };
  return abierto;
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
  modelo.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = sombras; o.receiveShadow = sombras; o.frustumCulled = false;
    for (const m of [].concat(o.material)) {
      if ('envMapIntensity' in m) m.envMapIntensity = 0.85;
      if (m.map) m.map.anisotropy = 4;
      if (m.transparent && m.alphaTest === 0) { m.alphaTest = 0.4; m.transparent = false; m.alphaToCoverage = true; }
    }
  });

  const { clips, balanceo } = await animacionesPara(giro);
  objeto.add(balanceo);
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
