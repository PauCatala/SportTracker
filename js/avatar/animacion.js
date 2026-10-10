// Animaciones del avatar: reposo, caminar, correr, saludar, "me gusta", asentir y negar.
// Las curvas vienen ya adaptadas al esqueleto de MakeHuman (media/avatar/animaciones.json).
import * as THREE from 'three';

const RUTA = new URL('../../media/avatar/animaciones.json', import.meta.url).href;
let datosP = null;
function datos() {
  if (!datosP) { datosP = fetch(RUTA).then(r => r.json()); datosP.catch(() => { datosP = null; }); }
  return datosP;
}

const BUCLES = new Set(['idle', 'walk', 'run']);
export const NOMBRES = { reposo: 'idle', caminar: 'walk', correr: 'run', saludar: 'saludar', megusta: 'megusta', asentir: 'agree', negar: 'headShake' };

function clip(nombre, c) {
  const t = Float32Array.from({ length: c.n }, (_, i) => (i / (c.n - 1)) * c.d);
  const pistas = Object.entries(c.q).map(([h, q]) => new THREE.QuaternionKeyframeTrack(`${h}.quaternion`, t, q));
  const y = new Float32Array(c.n * 3);
  c.y.forEach((v, i) => { y[i * 3 + 1] = v; });
  pistas.push(new THREE.VectorKeyframeTrack('avatar_balanceo.position', t, y));
  return new THREE.AnimationClip(nombre, c.d, pistas);
}

export async function crearAnimador(avatar) {
  const D = await datos();
  const raiz = avatar.objeto;
  const balanceo = new THREE.Object3D(); balanceo.name = 'avatar_balanceo';
  raiz.add(balanceo);
  const mixer = new THREE.AnimationMixer(raiz);
  const acciones = {};
  for (const [n, c] of Object.entries(D)) {
    const a = mixer.clipAction(clip(n, c));
    if (!BUCLES.has(n)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    acciones[n] = a;
  }
  const huesoRaiz = avatar.hueso('root');
  let actual = null, base = 'idle', velocidad = 1, gestoActivo = null;

  function poner(nombre, fundido = 0.35) {
    const a = acciones[nombre];
    if (!a || a === actual) return;
    a.reset().setEffectiveTimeScale(nombre === base ? velocidad : 1).setEffectiveWeight(1).play();
    if (actual) {
      // Sincroniza pasos al cambiar entre caminar y correr
      if (BUCLES.has(nombre) && BUCLES.has(actual.getClip().name) && nombre !== 'idle' && actual.getClip().name !== 'idle') {
        a.time = (actual.time / actual.getClip().duration) * a.getClip().duration;
      }
      actual.crossFadeTo(a, fundido, false);
    }
    actual = a;
  }

  mixer.addEventListener('finished', e => {
    if (e.action === acciones[gestoActivo]) { gestoActivo = null; poner(base, 0.45); }
  });

  poner('idle', 0);

  return {
    // Estado continuo: 'idle' | 'walk' | 'run'
    estado(nombre, vel = 1) {
      const n = NOMBRES[nombre] || nombre;
      base = n; velocidad = vel;
      if (!gestoActivo) poner(n);
      if (actual === acciones[n]) actual.setEffectiveTimeScale(vel);
    },
    // Gesto de una vez: vuelve solo al estado de antes
    gesto(nombre) {
      const n = NOMBRES[nombre] || nombre;
      if (!acciones[n]) return;
      gestoActivo = n;
      poner(n, 0.3);
    },
    // Fija la animación en un instante (miniaturas, pruebas)
    fijar(nombre, t) {
      mixer.stopAllAction();
      const a = acciones[NOMBRES[nombre] || nombre];
      a.reset().play(); mixer.setTime(t); actual = a;
      this.actualizar(0);
    },
    actualizar(dt) {
      mixer.update(dt);
      const rep = raiz.userData.posReposo?.[0];
      if (rep) huesoRaiz.position.set(rep.x, rep.y + balanceo.position.y, rep.z);
    },
    destruir() { mixer.stopAllAction(); balanceo.removeFromParent(); },
  };
}
