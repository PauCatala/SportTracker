// Poses de Salud para avatares de Avaturn (esqueleto tipo Mixamo, en T, mirando a +Z; su derecha queda en -X).
// Cada pose se describe con la DIRECCIÓN a la que apunta cada hueso (hacia su hijo), en el espacio del avatar,
// y se convierte en giros locales del esqueleto. Así no dependemos de cómo estén orientados los ejes de cada hueso.
// Las poses son bucles suaves (respiración, una repetición de curl, un sorbo, un estiramiento a cada lado).
import * as THREE from 'three';

const HIJO = {
  Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head',
  Shoulder: 'Arm', Arm: 'ForeArm', ForeArm: 'Hand', Hand: 'HandMiddle1', UpLeg: 'Leg', Leg: 'Foot', Foot: 'ToeBase',
};
const hijoDe = n => {
  if (HIJO[n]) return HIJO[n];
  const m = n.match(/^(Left|Right)(.*)$/); if (!m) return null;
  if (HIJO[m[2]]) return m[1] + HIJO[m[2]];
  const f = m[2].match(/^Hand(\w+?)(\d)$/); return f && +f[2] < 3 ? `${m[1]}Hand${f[1]}${+f[2] + 1}` : null;
};
const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const DEDOS = ['Index', 'Middle', 'Ring', 'Pinky'];

// ---------- Poses clave (direcciones en el espacio del avatar: +X su izquierda, +Y arriba, +Z delante) ----------
// Brazos relajados (base de casi todas)
const brazoRelajado = (lado, abre = 0.1, adelante = 0.04) => {
  const s = lado === 'Left' ? 1 : -1;
  return {
    [`${lado}Arm`]: v(s * abre, -1, adelante),
    [`${lado}ForeArm`]: v(s * abre * 0.6, -1, adelante + 0.1),
    [`${lado}Hand`]: v(s * 0.02, -1, 0.12),
  };
};
const tronco = (incl = 0, lat = 0) => ({
  Spine: v(lat * 0.4, 1, incl * 0.4), Spine1: v(lat * 0.7, 1, incl * 0.7), Spine2: v(lat, 1, incl),
});
const cabeza = (arriba = 0, lado = 0) => ({ Neck: v(lado * 0.5, 1, 0.2 - arriba * 0.5), Head: v(lado, 1, 0.16 - arriba) });
const piernas = (abre = 0.06) => ({ LeftUpLeg: v(abre, -1, 0), RightUpLeg: v(-abre, -1, 0), LeftLeg: v(abre * 0.4, -1, -0.01), RightLeg: v(-abre * 0.4, -1, -0.01) });

const POSES = {
  // Gimnasio: curl de bíceps con la derecha; el izquierdo, relajado y algo separado; postura firme
  fuerza: {
    duracion: 3.2,
    claves: [
      { t: 0, d: { ...tronco(-0.02), ...cabeza(0.02), ...piernas(0.1), ...brazoRelajado('Left', 0.16, 0.02),
        RightArm: v(-0.12, -1, 0.06), RightForeArm: v(-0.08, -1, 0.3), RightHand: v(-0.02, -1, 0.3) }, giro: { RightForeArm: 1.5 }, puño: { Right: 1 } },
      { t: 1.2, d: { ...tronco(-0.04), ...cabeza(0.04), ...piernas(0.1), ...brazoRelajado('Left', 0.16, 0.02),
        RightArm: v(-0.1, -1, 0.14), RightForeArm: v(-0.12, 0.85, 0.55), RightHand: v(-0.1, 0.6, 0.6) }, giro: { RightForeArm: 1.5 }, puño: { Right: 1 } },
      { t: 1.7, d: { ...tronco(-0.04), ...cabeza(0.04), ...piernas(0.1), ...brazoRelajado('Left', 0.16, 0.02),
        RightArm: v(-0.1, -1, 0.15), RightForeArm: v(-0.12, 0.9, 0.5), RightHand: v(-0.1, 0.7, 0.5) }, giro: { RightForeArm: 1.5 }, puño: { Right: 1 } },
    ],
    vuelta: true,
  },
  // Nutrición: sostiene un batido a la altura del pecho y da un sorbo
  // Nutrición: sostiene un batido con la mano de lado (pulgar arriba, el vaso derecho en la palma) y da un sorbo
  comer: {
    duracion: 6,
    claves: (() => {
      const sostiene = { RightArm: v(-0.08, -1, 0.14), RightForeArm: v(0.3, 0.22, 1), RightHand: v(0.28, 0.16, 1) };
      const bebe = { RightArm: v(-0.1, -0.36, 0.93), RightForeArm: v(0.5, 0.86, -0.3), RightHand: v(0.95, 0.3, -0.25) };
      const base = { ...tronco(0), ...piernas(0.05), ...brazoRelajado('Left', 0.1, 0.03) };
      return [
        { t: 0, d: { ...base, ...cabeza(0.06), ...sostiene }, mano: { Right: v(0, 1, 0) }, puño: { Right: 0.55 } },
        { t: 2.4, d: { ...base, ...cabeza(0.06), ...sostiene }, mano: { Right: v(0, 1, 0) }, puño: { Right: 0.55 } },
        { t: 3.3, d: { ...base, ...cabeza(-0.12), ...bebe }, mano: { Right: v(0.1, 0.82, -0.56) }, puño: { Right: 0.55 } },
        { t: 4.1, d: { ...base, ...cabeza(-0.12), ...bebe }, mano: { Right: v(0.1, 0.82, -0.56) }, puño: { Right: 0.55 } },
      ];
    })(),
    vuelta: true,
  },
  // Flexibilidad: flexión lateral de pie; un brazo hace un arco por encima de la cabeza y la otra mano va a la cadera
  estirar: {
    duracion: 9,
    claves: [0, -1, -1, 0, 1, 1].map((lado, i) => {
      const t = [0, 1.4, 3.4, 4.5, 5.9, 7.9][i];
      const d = { ...tronco(0, lado * 0.55), ...cabeza(0.02, lado * 0.45), ...piernas(0.15) };
      if (!lado) return { t, d: { ...d, ...brazoRelajado('Left', 0.12), ...brazoRelajado('Right', 0.12) } };
      const arriba = lado < 0 ? 'Left' : 'Right', cadera = lado < 0 ? 'Right' : 'Left';
      const s = lado;   // hacia dónde se inclina (+X = su izquierda)
      Object.assign(d, {
        [`${arriba}Arm`]: v(s * 0.45, 1, -0.02), [`${arriba}ForeArm`]: v(s * 0.95, 0.45, 0), [`${arriba}Hand`]: v(s, 0.2, 0),
        [`${cadera}Arm`]: v(s * 0.55, -1, 0.12), [`${cadera}ForeArm`]: v(-s * 0.7, -0.35, 0.2), [`${cadera}Hand`]: v(-s * 0.6, -0.6, 0.1),
      });
      return { t, d, giro: { [`${arriba}Arm`]: s * 1.3 } };
    }),
    vuelta: true,
  },
};

/**
 * Crea los clips de las poses de Salud para un avatar ya cargado.
 * @param raiz  el grupo orientado del avatar (mira a +Z)
 * @returns { fuerza, comer, estirar } AnimationClip
 */
export function posesSalud(raiz) {
  raiz.updateMatrixWorld(true);
  const huesos = new Map();
  raiz.traverse(o => { if (o.isBone && !huesos.has(o.name)) huesos.set(o.name.replace(/^mixamorig:?/, ''), o); });
  const H = n => huesos.get(n);
  if (!H('Hips') || !H('RightForeArm')) return {};
  const orden = []; raiz.traverse(o => { if (o.isBone) orden.push(o); });
  const reposo = new Map(orden.map(b => [b, b.quaternion.clone()]));
  // Las direcciones se dan en el espacio del contenedor del avatar (donde mira a +Z), no en el del modelo
  const qRaiz = raiz.parent ? raiz.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const profundidad = b => { let n = 0, o = b; while (o.parent?.isBone) { n++; o = o.parent; } return n; };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  function apuntar(b, dirAvatar, giro = 0) {
    const h = H(hijoDe(b.name.replace(/^mixamorig:?/, '')));
    if (!h) return;
    b.updateWorldMatrix(true, true);
    const actual = h.getWorldPosition(tmpA).sub(b.getWorldPosition(tmpB)).normalize();
    const objetivo = dirAvatar.clone().applyQuaternion(qRaiz).normalize();
    let q = new THREE.Quaternion().setFromUnitVectors(actual, objetivo);
    if (giro) q = new THREE.Quaternion().setFromAxisAngle(objetivo, giro).multiply(q);
    const mundo = q.multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const padre = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(padre.invert().multiply(mundo));
  }
  // Gira el antebrazo sobre su eje hasta que la línea de los nudillos (meñique → índice) apunte a 'deseado'
  function orientarMano(lado, deseado, dirMano) {
    const fa = H(`${lado}ForeArm`), mano = H(`${lado}Hand`), i1 = H(`${lado}HandIndex1`), p1 = H(`${lado}HandPinky1`), m1 = H(`${lado}HandMiddle1`);
    if (!fa || !mano || !i1 || !p1 || !m1) return;
    const obj = deseado.clone().applyQuaternion(qRaiz).normalize();
    for (let k = 0; k < 4; k++) {
      fa.updateWorldMatrix(true, true);
      const eje = m1.getWorldPosition(new THREE.Vector3()).sub(mano.getWorldPosition(new THREE.Vector3())).normalize();
      const actual = i1.getWorldPosition(new THREE.Vector3()).sub(p1.getWorldPosition(new THREE.Vector3()));
      const a = actual.addScaledVector(eje, -actual.dot(eje)).normalize();
      const b = obj.clone().addScaledVector(eje, -obj.dot(eje)).normalize();
      if (a.lengthSq() < 1e-6 || b.lengthSq() < 1e-6) return;
      const ang = Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(eje), a.dot(b));
      if (Math.abs(ang) < 0.01) return;
      const ejeFa = mano.getWorldPosition(new THREE.Vector3()).sub(fa.getWorldPosition(new THREE.Vector3())).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(ejeFa, ang).multiply(fa.getWorldQuaternion(new THREE.Quaternion()));
      fa.quaternion.copy(fa.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
      if (dirMano) apuntar(mano, dirMano);
    }
  }
  // Cierra la mano (0..1) girando cada falange alrededor del eje de los nudillos
  function cerrarMano(lado, cuanto) {
    const i1 = H(`${lado}HandIndex1`), p1 = H(`${lado}HandPinky1`);
    if (!i1 || !p1) return;
    for (const dedo of DEDOS) for (let k = 1; k <= 3; k++) {
      const b = H(`${lado}Hand${dedo}${k}`); if (!b) continue;
      b.updateWorldMatrix(true, false); i1.updateWorldMatrix(true, false); p1.updateWorldMatrix(true, false);
      const eje = p1.getWorldPosition(tmpA).sub(i1.getWorldPosition(tmpB)).normalize();
      if (lado === 'Right') eje.negate();
      const q = new THREE.Quaternion().setFromAxisAngle(eje, cuanto * (k === 1 ? 1.15 : 1.25));
      const mundo = q.multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(mundo));
    }
    const t1 = H(`${lado}HandThumb1`), t2 = H(`${lado}HandThumb2`);
    for (const b of [t1, t2]) if (b) {
      b.updateWorldMatrix(true, false);
      const eje = H(`${lado}Hand`).getWorldPosition(tmpA).sub(b.getWorldPosition(tmpB)).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(eje, (lado === 'Left' ? 1 : -1) * cuanto * 0.6);
      const mundo = q.multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(mundo));
    }
  }

  const clips = {};
  for (const [nombre, def] of Object.entries(POSES)) {
    const claves = def.vuelta ? [...def.claves, { ...def.claves[0], t: def.duracion }] : def.claves;
    const tiempos = claves.map(c => c.t);
    const pistas = new Map();   // hueso -> Float32Array de cuaterniones
    claves.forEach((c, f) => {
      for (const b of orden) b.quaternion.copy(reposo.get(b));
      const nombres = Object.keys(c.d).sort((a, b) => profundidad(H(a)) - profundidad(H(b)));
      for (const n of nombres) { const b = H(n); if (b) apuntar(b, c.d[n], c.giro?.[n] || 0); }
      for (const [lado, dir] of Object.entries(c.mano || {})) orientarMano(lado, dir, c.d[`${lado}Hand`]);
      for (const [lado, cuanto] of Object.entries(c.puño || {})) cerrarMano(lado, cuanto);
      for (const b of orden) {
        if (!pistas.has(b)) pistas.set(b, new Float32Array(claves.length * 4));
        b.quaternion.toArray(pistas.get(b), f * 4);
      }
    });
    for (const b of orden) b.quaternion.copy(reposo.get(b));
    // Entre pose y pose el movimiento acelera y frena (como una persona), en vez de ir a velocidad constante
    const PASOS = 10;
    const suave = u => u * u * (3 - 2 * u);
    const tDens = [];
    for (let i = 0; i < tiempos.length - 1; i++) for (let k = 0; k < PASOS; k++) tDens.push(tiempos[i] + ((tiempos[i + 1] - tiempos[i]) * k) / PASOS);
    tDens.push(tiempos[tiempos.length - 1]);
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const densas = new Map([...pistas].map(([b, vals]) => {
      const out = new Float32Array(tDens.length * 4);
      let o = 0;
      for (let i = 0; i < tiempos.length - 1; i++) {
        qa.fromArray(vals, i * 4); qb.fromArray(vals, (i + 1) * 4);
        for (let k = 0; k < PASOS; k++) { qa.clone().slerp(qb, suave(k / PASOS)).toArray(out, o * 4); o++; }
      }
      qb.fromArray(vals, (tiempos.length - 1) * 4).toArray(out, o * 4);
      return [b, out];
    }));
    const tracks = [...densas].map(([b, vals]) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, tDens, vals));
    tracks.push(new THREE.VectorKeyframeTrack('avatar_balanceo.position', [0, def.duracion], [0, 0, 0, 0, 0, 0]));
    // Respiración suave: el tronco sube y baja un poco sobre la pose
    clips[nombre] = new THREE.AnimationClip(nombre, def.duracion, tracks);
  }
  return clips;
}

// ---------- Objetos que sostiene el avatar ----------
export function crearMancuerna() {
  const g = new THREE.Group(); g.name = 'mancuerna';
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.55, roughness: 0.32 });
  const goma = new THREE.MeshStandardMaterial({ color: 0x1b1e24, metalness: 0.1, roughness: 0.7 });
  const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.15, 24), metal);
  g.add(mango);
  for (const s of [-1, 1]) {
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 6), goma);
    disco.position.y = s * 0.1; g.add(disco);
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 20), metal);
    tapa.position.y = s * 0.131; g.add(tapa);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function crearBatido() {
  const g = new THREE.Group(); g.name = 'batido';
  const vidrio = new THREE.MeshPhysicalMaterial({ color: 0xf4f8fb, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.033, 0.135, 32, 1, true), vidrio);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.006, 32), vidrio);
  base.position.y = -0.064;
  const zumo = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.031, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0xc9718c, roughness: 0.5 }));
  zumo.position.y = -0.012;
  const pajita = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.15, 10), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }));
  pajita.position.set(0.014, 0.045, 0); pajita.rotation.z = -0.22;
  g.add(zumo, vaso, base, pajita);
  vaso.renderOrder = 3;
  g.traverse(o => { if (o.isMesh) o.castShadow = o !== vaso; });
  return g;
}

// Coloca un objeto en la palma: su eje Y queda a lo largo de los nudillos (como se agarra un mango o un vaso)
export function sostener(objeto, av, { lado = 'Right', separacion = 0.03, avance = 0.7 } = {}) {
  const mano = av.hueso(`${lado}Hand`), i1 = av.hueso(`${lado}HandIndex1`), p1 = av.hueso(`${lado}HandPinky1`), m1 = av.hueso(`${lado}HandMiddle1`);
  if (!mano || !i1 || !p1 || !m1) return false;
  // Todo en el espacio local de la mano, con la mano en su reposo
  const a = new THREE.Vector3().copy(i1.position), b = new THREE.Vector3().copy(p1.position), m = new THREE.Vector3().copy(m1.position);
  const nudillos = a.clone().sub(b).normalize();
  const dedos = m.clone().normalize();
  // Normal de la palma: hacia dentro de la mano (el lado al que se cierran los dedos)
  const palma = new THREE.Vector3().crossVectors(dedos, nudillos).normalize();
  if (lado === 'Right') palma.negate();
  objeto.position.copy(m.clone().multiplyScalar(avance)).addScaledVector(palma, separacion);
  objeto.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nudillos);
  // Escala: el objeto está en metros; la mano puede estar escalada dentro del modelo
  const e = new THREE.Vector3(); mano.getWorldScale(e); const eo = new THREE.Vector3(); av.objeto.getWorldScale(eo);
  objeto.scale.setScalar(eo.x / e.x);
  mano.add(objeto);
  return true;
}
