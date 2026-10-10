// Avatar 3D del Inicio: carga el modelo (GLB con esqueleto), sus animaciones
// y aplica tu aspecto guardado. Preparado para cambiar de modelo sin tocar la escena.
//
// AHORA: maniquí provisional (X Bot de los ejemplos de three.js, animaciones de Mixamo).
// PRÓXIMO: personaje de Quaternius (CC0) con pelo, ropa y gestos (saludo, pulgar arriba).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { leer, guardar } from '../almacen.js';

// Cada modelo dice qué clip es cada acción y qué se puede personalizar
export const MODELOS = {
  maniqui: {
    url: 'media/maniqui.glb',
    acciones: { correr: 'run', quieto: 'idle', andar: 'walk' },
    gestos: { like: 'agree', no: 'headShake' },          // se suman encima del movimiento
    materiales: { cuerpo: 'asdf1:Beta_HighLimbsGeoSG2', detalles: 'Beta_Joints_MAT' },
    opciones: [
      { id: 'estilo', nombre: 'Estilo', tipo: 'estilos' },
      { id: 'cuerpo', nombre: 'Color del cuerpo', tipo: 'color', valores: ['#F4F3EF', '#D9DEE6', '#DDE9DF', '#E7DFF7', '#F3E1E5', '#F6E8DA', '#3A4254'] },
      { id: 'detalles', nombre: 'Color de las articulaciones', tipo: 'color', valores: ['#A9CBE8', '#C9B8E0', '#9CC3A6', '#E6A9B6', '#E4C29E', '#222B3D', '#FFFFFF'] },
      { id: 'acabado', nombre: 'Acabado', tipo: 'texto', valores: [['mate', 'Mate'], ['satinado', 'Satinado'], ['cristal', 'Cerámica']] },
    ],
    estilos: [
      { nombre: 'Porcelana', cuerpo: '#F4F3EF', detalles: '#A9CBE8', acabado: 'satinado' },
      { nombre: 'Salvia', cuerpo: '#DDE9DF', detalles: '#3F6B51', acabado: 'mate' },
      { nombre: 'Lavanda', cuerpo: '#E7DFF7', detalles: '#5B4B8A', acabado: 'satinado' },
      { nombre: 'Rosa', cuerpo: '#F3E1E5', detalles: '#8A4B5C', acabado: 'mate' },
      { nombre: 'Grafito', cuerpo: '#3A4254', detalles: '#DCEAF7', acabado: 'cristal' },
    ],
  },
};

export const MODELO_ACTUAL = 'maniqui';
export const ASPECTO_BASE = { modelo: MODELO_ACTUAL, cuerpo: '#F4F3EF', detalles: '#A9CBE8', acabado: 'satinado' };

// Tu aspecto se guarda en tu cuenta (almacen → Supabase si has entrado; si no, en este navegador)
export const leerAspecto = () => ({ ...ASPECTO_BASE, ...(leer('avatar', null) || {}), modelo: MODELO_ACTUAL });
export const guardarAspecto = a => guardar('avatar', a);

const ACABADOS = {
  mate: { roughness: .85, metalness: 0, clearcoat: 0 },
  satinado: { roughness: .45, metalness: 0, clearcoat: .4 },
  cristal: { roughness: .2, metalness: 0, clearcoat: 1 },
};

export async function cargarAvatar(aspecto = leerAspecto()) {
  const spec = MODELOS[aspecto.modelo] || MODELOS[MODELO_ACTUAL];
  const gltf = await new GLTFLoader().loadAsync(spec.url);
  const raiz = gltf.scene;

  // Materiales propios (físicos, con barniz) para que encajen con la luz de la escena
  const mats = {};
  raiz.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    const clave = Object.keys(spec.materiales).find(k => spec.materiales[k] === o.material.name) || 'cuerpo';
    mats[clave] ??= new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .5, sheen: .3, sheenColor: '#ffffff' });
    o.material = mats[clave];
  });

  // Altura normalizada a 1: la escena decide el tamaño
  const caja = new THREE.Box3().setFromObject(raiz);
  const alto = caja.max.y - caja.min.y;
  raiz.scale.setScalar(1 / alto);
  raiz.position.y = -caja.min.y / alto;
  const cuerpo = new THREE.Group();
  cuerpo.add(raiz);

  // Animaciones
  const mezclador = new THREE.AnimationMixer(raiz);
  const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
  const acciones = {};
  for (const [id, nombre] of Object.entries(spec.acciones)) if (clips[nombre]) acciones[id] = mezclador.clipAction(clips[nombre]);
  const gestos = {};
  for (const [id, nombre] of Object.entries(spec.gestos || {})) {
    if (!clips[nombre]) continue;
    const clip = clips[nombre].clone();
    THREE.AnimationUtils.makeClipAdditive(clip);
    const a = mezclador.clipAction(clip);
    a.blendMode = THREE.AdditiveAnimationBlendMode;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    gestos[id] = a;
  }

  let actual = null;
  function poner(id, fundido = .45) {
    const sig = acciones[id];
    if (!sig || sig === actual) return;
    sig.reset().setEffectiveWeight(1).play();
    if (actual) actual.crossFadeTo(sig, fundido, false);
    actual = sig;
  }
  let ultimoGesto = 0;
  function gesto(id) {
    const g = gestos[id];
    const ahora = performance.now();
    if (!g || ahora - ultimoGesto < 2500) return;
    ultimoGesto = ahora;
    g.reset().setEffectiveWeight(1).fadeIn(.2).play();
  }
  const velocidad = v => { if (actual) actual.timeScale = v; };

  function aplicar(a) {
    if (mats.cuerpo) mats.cuerpo.color.set(a.cuerpo);
    if (mats.detalles) mats.detalles.color.set(a.detalles);
    const ac = ACABADOS[a.acabado] || ACABADOS.satinado;
    for (const m of Object.values(mats)) Object.assign(m, ac);
  }
  aplicar(aspecto);

  const mallas = [];
  raiz.traverse(o => { if (o.isMesh) mallas.push(o); });

  return { objeto: cuerpo, spec, mallas, poner, gesto, velocidad, aplicar, actualizar: dt => mezclador.update(dt) };
}
