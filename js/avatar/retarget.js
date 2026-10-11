// Animaciones para cualquier avatar humanoide (Avaturn, Mixamo, Ready Player Me…).
// Las curvas (media/avatar/movimientos.json) son giros en el espacio del mundo respecto al
// reposo; aquí se pasan al esqueleto del avatar teniendo en cuenta su postura de reposo
// (en T o en A) y se crean clips de three.js listos para el AnimationMixer.
import * as THREE from 'three';

const RUTA = new URL('../../media/avatar/movimientos.json', import.meta.url).href;
let datosP = null;
const datos = () => {
  if (!datosP) { datosP = fetch(RUTA).then(r => r.json()); datosP.catch(() => { datosP = null; }); }
  return datosP;
};

// Nombre canónico: sin prefijos de Mixamo ni separadores ("mixamorig:LeftArm" → "leftarm")
const canon = n => n.replace(/^mixamorig[:_]?/i, '').replace(/^.*[:|]/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
// Tronco: los dos esqueletos están erguidos; no se alinean (evita torcer la cadera)
const TRONCO = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']);

/**
 * Prepara las animaciones para un avatar.
 * @param raiz  objeto que contiene el esqueleto (ya orientado mirando a +Z y en su pose de reposo)
 * @returns { clips: {nombre: AnimationClip}, balanceo: Object3D, alturaCadera }
 */
export async function animacionesPara(raiz) {
  const D = await datos();
  raiz.updateMatrixWorld(true);
  // Huesos del avatar por nombre canónico
  const porNombre = new Map();
  raiz.traverse(o => { if (o.isBone && !porNombre.has(canon(o.name))) porNombre.set(canon(o.name), o); });
  const hueso = n => porNombre.get(canon(n));
  const cadera = hueso('Hips');
  if (!cadera) throw new Error('El avatar no tiene un esqueleto humanoide reconocible');

  // Reposo del avatar: giro y posición en el mundo
  const qRep = new Map(), pRep = new Map();
  raiz.traverse(o => { if (o.isBone) { qRep.set(o, o.getWorldQuaternion(new THREE.Quaternion())); pRep.set(o, o.getWorldPosition(new THREE.Vector3())); } });
  const HIJO = {};
  for (const [n, d] of Object.entries(D.dir)) HIJO[n] = d;
  // Dirección de reposo de cada hueso en el avatar (hacia su hijo de referencia)
  const hijoDe = n => {
    const mapa = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
    if (mapa[n]) return mapa[n];
    const m = n.match(/^(Left|Right)(.*)$/); if (!m) return null;
    const [, l, r] = m;
    const sig = { Shoulder: 'Arm', Arm: 'ForeArm', ForeArm: 'Hand', Hand: 'HandMiddle1', UpLeg: 'Leg', Leg: 'Foot', Foot: 'ToeBase' }[r];
    if (sig) return l + sig;
    const f = r.match(/^Hand(\w+?)(\d)$/); if (f) return `${l}Hand${f[1]}${+f[2] + 1}`;
    return null;
  };
  const alin = new Map();
  const usados = [];
  for (const n of D.huesos) {
    const b = hueso(n);
    if (!b) continue;
    usados.push([n, b]);
    let q = new THREE.Quaternion();
    const h = hijoDe(n) && hueso(hijoDe(n));
    if (!TRONCO.has(n) && h && D.dir[n]) {
      const dT = pRep.get(h).clone().sub(pRep.get(b));
      if (dT.lengthSq() > 1e-10) q = new THREE.Quaternion().setFromUnitVectors(dT.normalize(), new THREE.Vector3().fromArray(D.dir[n]));
    }
    alin.set(b, q);
  }

  // Orden de los huesos de padres a hijos para pasar de global a local
  const orden = [];
  raiz.traverse(o => { if (o.isBone) orden.push(o); });
  const mapeado = new Map(usados.map(([n, b]) => [b, n]));
  const padreMundo = o => o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const qPadreFijo = new Map();
  for (const b of orden) if (!b.parent?.isBone) qPadreFijo.set(b, padreMundo(b));
  const locRep = new Map(orden.map(b => [b, b.quaternion.clone()]));
  const alturaCadera = pRep.get(cadera).y - raiz.getWorldPosition(new THREE.Vector3()).y;

  const balanceo = new THREE.Object3D(); balanceo.name = 'avatar_balanceo';
  const clips = {};
  const tmp = new THREE.Quaternion();
  for (const [nombre, c] of Object.entries(D.clips)) {
    const t = Float32Array.from({ length: c.n }, (_, i) => (i / (c.n - 1)) * c.d);
    const vals = new Map(usados.map(([, b]) => [b, new Float32Array(c.n * 4)]));
    for (let f = 0; f < c.n; f++) {
      const mundo = new Map();
      for (const b of orden) {
        const padre = b.parent?.isBone ? mundo.get(b.parent) : qPadreFijo.get(b);
        const n = mapeado.get(b);
        let w;
        if (n) {
          const d = tmp.fromArray(c.q[n], f * 4);
          w = d.clone().multiply(alin.get(b)).multiply(qRep.get(b));
          const local = padre.clone().invert().multiply(w);
          local.toArray(vals.get(b), f * 4);
        } else {
          w = padre.clone().multiply(locRep.get(b));
        }
        mundo.set(b, w);
      }
    }
    const pistas = [...vals].map(([b, v]) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, t, v));
    const y = new Float32Array(c.n * 3);
    c.y.forEach((v, i) => { y[i * 3 + 1] = v * alturaCadera; });
    pistas.push(new THREE.VectorKeyframeTrack('avatar_balanceo.position', t, y));
    clips[nombre] = new THREE.AnimationClip(nombre, c.d, pistas);
  }

  // Saludo con la mano derecha (el lado derecho del avatar queda en -X)
  clips.saludar = gestoSaludo(clips.idle, usados, hueso, hijoDe, pRep, qRep, orden, qPadreFijo, locRep);
  return { clips, balanceo, alturaCadera };
}

function gestoSaludo(idle, usados, hueso, hijoDe, pRep, qRep, orden, qPadreFijo, locRep) {
  const dur = 2.6, FPS = 30, n = Math.round(dur * FPS) + 1;
  const pistaIdle = new Map(idle.tracks.filter(p => p.name.endsWith('.quaternion')).map(p => [p.name.slice(0, -11), p]));
  const brazo = ['RightArm', 'RightForeArm', 'RightHand'].map(x => hueso(x));
  if (brazo.some(b => !b)) return idle;
  const dirRep = nombre => {
    const b = hueso(nombre), h = hueso(hijoDe(nombre));
    return h ? pRep.get(h).clone().sub(pRep.get(b)).normalize() : new THREE.Vector3(0, 1, 0);
  };
  const reposoDir = { RightArm: dirRep('RightArm'), RightForeArm: dirRep('RightForeArm'), RightHand: dirRep('RightHand') };
  const t = Float32Array.from({ length: n }, (_, i) => (i / (n - 1)) * dur);
  const vals = new Map(orden.map(b => [b, new Float32Array(n * 4)]));
  const muestra = new Float32Array(4);
  const suave = x => x * x * (3 - 2 * x);
  for (let f = 0; f < n; f++) {
    const tt = t[f];
    const k = suave(Math.max(0, Math.min(1, tt / 0.4, (dur - tt) / 0.45)));
    const objetivos = {
      RightArm: new THREE.Vector3(-0.72, 0.6, 0.22),
      RightForeArm: new THREE.Vector3(-0.12, 1, 0.14),
      RightHand: new THREE.Vector3(-0.05 + 0.3 * Math.sin(tt * Math.PI * 2 * 1.6), 1, 0.12),
    };
    const mundo = new Map();
    for (const b of orden) {
      const padre = b.parent?.isBone ? mundo.get(b.parent) : qPadreFijo.get(b);
      // pose de reposo animada (idle) en este instante
      const p = pistaIdle.get(b.name);
      let local = locRep.get(b).clone();
      if (p) { p.createInterpolant(muestra).evaluate(Math.min(tt, idle.duration - 1e-3) % idle.duration); local.fromArray(muestra); }
      let w = padre.clone().multiply(local);
      const nombre = Object.keys(objetivos).find(x => hueso(x) === b);
      if (nombre && k > 0) {
        const apunta = new THREE.Quaternion().setFromUnitVectors(reposoDir[nombre], objetivos[nombre].normalize()).multiply(qRep.get(b));
        w = w.slerp(apunta, k);
        local = padre.clone().invert().multiply(w);
      }
      local.toArray(vals.get(b), f * 4);
      mundo.set(b, w);
    }
  }
  const pistas = [...vals].filter(([b]) => pistaIdle.has(b.name) || brazo.includes(b))
    .map(([b, v]) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, t, v));
  const y = idle.tracks.find(p => p.name === 'avatar_balanceo.position');
  if (y) pistas.push(new THREE.VectorKeyframeTrack('avatar_balanceo.position', t, Float32Array.from({ length: n * 3 }, (_, i) => (i % 3 === 1 ? y.values[1] : 0))));
  return new THREE.AnimationClip('saludar', dur, pistas);
}
