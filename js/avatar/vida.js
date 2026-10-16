// Capa de "vida" sobre las animaciones del avatar: lo que hace que no parezca un robot.
// Se aplica cada fotograma después del AnimationMixer, con giros sobre ejes del propio avatar
// (+X su izquierda, +Y arriba, +Z delante), así no depende de cómo estén orientados los huesos.
//  - Corriendo: el tronco se inclina un poco hacia delante, los hombros giran al contrario que la cadera
//    (al ritmo de los brazos), la cabeza se mantiene mirando al frente y las manos van medio cerradas.
//  - De pie: respira, pasa el peso de una pierna a otra, mira un poco a su alrededor, codos y dedos relajados.
//  - Andando: manos relajadas y un leve vaivén de hombros.
import * as THREE from 'three';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const DEDOS = ['Index', 'Middle', 'Ring', 'Pinky'];
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qo = new THREE.Quaternion();
const a = new THREE.Vector3(), b = new THREE.Vector3(), eje = new THREE.Vector3();

// Ruido suave (suma de senos con frecuencias que no se repiten a la vista)
const ruido = (t, s = 0) => (Math.sin(t * 1.0 + s) * 0.5 + Math.sin(t * 2.31 + s * 1.7) * 0.3 + Math.sin(t * 4.17 + s * 2.9) * 0.2);

export function crearVida(objeto, buscar) {
  const H = n => buscar(new RegExp(`^(mixamorig:?)?${n}$`));
  const h = {};
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm',
    'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']) h[n] = H(n);
  if (!h.Hips || !h.Spine2 || !h.Head) return null;
  const dedos = { Left: [], Right: [] };
  for (const lado of ['Left', 'Right']) {
    for (const d of DEDOS) for (let k = 1; k <= 3; k++) { const x = H(`${lado}Hand${d}${k}`); if (x) dedos[lado].push([x, k]); }
    dedos[lado].pulgar = [H(`${lado}HandThumb1`), H(`${lado}HandThumb2`)].filter(Boolean);
    dedos[lado].i1 = H(`${lado}HandIndex1`); dedos[lado].p1 = H(`${lado}HandPinky1`);
  }
  // Todos los huesos que tocamos: se devuelven a su reposo antes del mezclador (los que no anima
  // ninguna animación, como la cabeza al correr, si no acumularían giros fotograma a fotograma)
  const tocados = [...Object.values(h), ...dedos.Left.map(d => d[0]), ...dedos.Right.map(d => d[0]), ...dedos.Left.pulgar, ...dedos.Right.pulgar].filter(Boolean);
  const reposo = new Map(tocados.map(x => [x, x.quaternion.clone()]));

  // Peso de cada estado, que cambia suave (como el fundido entre animaciones)
  const peso = { run: 0, idle: 1, walk: 0, pose: 0 };
  let estado = 'idle', t = Math.random() * 100;
  // "Enganchado": en la rueda corre detrás de las publicaciones, mirándolas y estirando la mano para alcanzarlas
  let perseguir = 0, perseguirObj = 0;
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), ident = new THREE.Quaternion();
  const hijoDe = { LeftArm: 'LeftForeArm', RightArm: 'RightForeArm', LeftForeArm: 'LeftHand', RightForeArm: 'RightHand' };
  // Orienta un hueso hacia una dirección del espacio del avatar, mezclando con la animación (w = 0 … 1)
  function apuntar(nombre, dirAvatar, w) {
    const b = h[nombre], hijo = h[hijoDe[nombre]];
    if (!b || !hijo || w < 0.01) return;
    const actual = hijo.getWorldPosition(pA).sub(b.getWorldPosition(pB)).normalize();
    const obj = dirAvatar.clone().applyQuaternion(qo).normalize();
    qA.setFromUnitVectors(actual, obj);
    qB.copy(ident).slerp(qA, w);
    q1.copy(qB).multiply(b.getWorldQuaternion(q2));
    b.quaternion.copy(b.parent.getWorldQuaternion(q2).invert().multiply(q1));
    b.updateMatrixWorld(true);
  }


  // Gira un hueso un ángulo alrededor de un eje del espacio del avatar
  function girar(hueso, ejeAvatar, ang) {
    if (!hueso || !ang) return;
    eje.copy(ejeAvatar).applyQuaternion(qo);
    girarMundo(hueso, eje, ang);
  }
  function girarMundo(hueso, ejeMundo, ang) {
    q1.setFromAxisAngle(ejeMundo, ang).multiply(hueso.getWorldQuaternion(q2));
    hueso.quaternion.copy(hueso.parent.getWorldQuaternion(q2).invert().multiply(q1));
    hueso.updateMatrixWorld(true);
  }
  // Cierra los dedos (0 abierta … 1 puño) alrededor de la línea de los nudillos
  function cerrar(lado, cuanto) {
    const L = dedos[lado];
    if (!L.i1 || !L.p1 || cuanto < 0.01) return;
    eje.copy(L.p1.getWorldPosition(a)).sub(L.i1.getWorldPosition(b)).normalize();
    if (lado === 'Right') eje.negate();
    const ejeN = eje.clone();
    for (const [x, k] of L) girarMundo(x, ejeN, cuanto * (k === 1 ? 0.9 : k === 2 ? 1.15 : 0.8));
    const mano = h[`${lado}Hand`];
    for (const x of L.pulgar) {
      const e2 = mano.getWorldPosition(a).sub(x.getWorldPosition(b)).normalize();
      girarMundo(x, e2, (lado === 'Left' ? 1 : -1) * cuanto * 0.45);
    }
  }
  // Cuánto va adelantada la mano derecha respecto a la izquierda (−1 … 1), para el giro de hombros
  const pos = new THREE.Vector3(), inv = new THREE.Quaternion();
  function balanceoBrazos() {
    if (!h.RightHand || !h.LeftHand) return 0;
    inv.copy(qo).invert();
    const zr = h.RightHand.getWorldPosition(pos).applyQuaternion(inv).z;
    const zl = h.LeftHand.getWorldPosition(pos).applyQuaternion(inv).z;
    const escala = new THREE.Vector3(); objeto.getWorldScale(escala);
    return THREE.MathUtils.clamp((zr - zl) / (0.55 * escala.y), -1, 1);
  }

  return {
    estado(n) { estado = n; },
    perseguir(si) { perseguirObj = si ? 1 : 0; },
    // Antes del mezclador: los huesos vuelven a su reposo
    antes() { for (const [x, q] of reposo) x.quaternion.copy(q); },
    // Después del mezclador: los toques de vida
    despues(dt) {
      t += dt;
      const k = 1 - Math.exp(-dt / 0.28);
      const clave = estado === 'run' ? 'run' : estado === 'walk' ? 'walk' : estado === 'idle' ? 'idle' : 'pose';
      for (const n of Object.keys(peso)) peso[n] += ((n === clave ? 1 : 0) - peso[n]) * (dt > 0 ? k : 1);
      objeto.updateMatrixWorld(true);
      objeto.getWorldQuaternion(qo);
      const { run, idle, walk, pose } = peso;

      perseguir += (perseguirObj - perseguir) * (dt > 0 ? 1 - Math.exp(-dt / 0.6) : 1);
      const enganche = perseguir * run;
      let alcanceL = 0, alcanceR = 0;
      // --- Enganchado: inclinado, mirando arriba a las publicaciones y estirando una mano cada poco ---
      if (enganche > 0.01) {
        girar(h.Spine, X, 0.1 * enganche);
        girar(h.Spine1, X, 0.05 * enganche);
        girar(h.Neck, X, -0.2 * enganche);
        girar(h.Head, X, -0.16 * enganche + 0.03 * Math.sin(t * 1.3) * enganche);
        girar(h.Head, Y, 0.08 * ruido(t * 0.5, 9) * enganche);
        // Cada ~2,8 s intenta alcanzar una publicación: alterna la mano y dura algo más de un segundo
        const ciclo = 2.8, fase = (t % ciclo) / ciclo, cual = Math.floor(t / ciclo) % 2;
        const ventana = fase < 0.45 ? Math.sin((fase / 0.45) * Math.PI) ** 1.5 : 0;
        if (cual) alcanceR = ventana * enganche; else alcanceL = ventana * enganche;
      }

      // --- Corriendo ---
      if (run > 0.01) {
        const s = balanceoBrazos();
        girar(h.Spine, X, 0.09 * run);                       // algo inclinado hacia delante
        girar(h.Hips, Y, -0.07 * s * run);                    // la cadera gira con las piernas…
        girar(h.Spine1, Y, 0.06 * s * run);
        girar(h.Spine2, Y, 0.11 * s * run);                   // …y los hombros al contrario, con los brazos
        girar(h.Neck, Y, -0.08 * s * run);                    // la cabeza sigue mirando al frente
        girar(h.Neck, X, -0.06 * run);
        girar(h.Head, X, -0.03 * run + 0.015 * Math.sin(t * 9.4) * run);
      }
      if (alcanceL > 0.01 || alcanceR > 0.01) {
        for (const [lado, w, sx] of [['Left', alcanceL, 1], ['Right', alcanceR, -1]]) {
          if (w < 0.01) continue;
          const dir = new THREE.Vector3(sx * 0.12, 0.66, 0.74);   // hacia delante y arriba: donde están las publicaciones
          apuntar(`${lado}Arm`, dir, w * 0.95);
          apuntar(`${lado}ForeArm`, dir, w * 0.9);
          girar(h[`${lado}Shoulder`], Z, sx * -0.18 * w);          // el hombro sube al estirarse
          girar(h.Spine2, Y, sx * 0.12 * w);                        // y el tronco gira un poco hacia esa mano
        }
      }
      // --- De pie (y respiración en las poses de Salud) ---
      const quieto = idle + pose * 0.6;
      if (quieto > 0.01) {
        const resp = Math.sin((t / 4.2) * Math.PI * 2);        // una respiración cada ~4 s
        girar(h.Spine1, X, -0.012 * resp * quieto);
        girar(h.Spine2, X, -0.018 * resp * quieto);
        girar(h.LeftShoulder, Z, 0.012 * resp * quieto);
        girar(h.RightShoulder, Z, -0.012 * resp * quieto);
        // Mira un poco a su alrededor, sin prisa
        girar(h.Neck, Y, 0.07 * ruido(t * 0.23, 1) * quieto);
        girar(h.Head, Y, 0.06 * ruido(t * 0.19, 4) * quieto);
        girar(h.Head, X, 0.035 * ruido(t * 0.17, 7) * quieto);
      }
      if (idle > 0.01) {
        // Pasa el peso de una pierna a otra; el tronco compensa para que la cabeza no se mueva
        const lado = Math.sin((t / 7.5) * Math.PI * 2) * 0.6 + ruido(t * 0.1, 2) * 0.4;
        girar(h.Hips, Z, 0.022 * lado * idle);
        girar(h.Spine, Z, -0.03 * lado * idle);
        girar(h.Spine2, Y, 0.025 * ruido(t * 0.13, 5) * idle);
        // Codos un poco doblados y brazos sueltos, no rígidos
        girar(h.LeftForeArm, X, -0.2 * idle);
        girar(h.RightForeArm, X, -0.2 * idle);
        girar(h.LeftArm, Z, (0.05 + 0.015 * ruido(t * 0.3, 3)) * idle);
        girar(h.RightArm, Z, -(0.05 + 0.015 * ruido(t * 0.3, 6)) * idle);
      }
      if (walk > 0.01) {
        const s = balanceoBrazos();
        girar(h.Spine2, Y, 0.06 * s * walk);
        girar(h.Neck, Y, -0.05 * s * walk);
      }
      // Manos: relajadas de pie, medio cerradas al correr (en las poses de Salud las manos van en la pose)
      const mano = 0.32 * idle + 0.4 * walk + 0.78 * run;
      // La mano que se estira va abierta, como queriendo agarrar
      if (mano > 0.01) { cerrar('Left', mano * (1 - alcanceL) + 0.12 * alcanceL); cerrar('Right', mano * (1 - alcanceR) + 0.12 * alcanceR); }
    },
  };
}
