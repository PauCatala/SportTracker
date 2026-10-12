// SALUD · Estación corporal: tu avatar en el centro de una plataforma, con la pose del apartado activo.
// - Vive mientras estés en Salud: al cambiar de pestaña o de apartado se reutiliza (no se recarga el modelo).
// - Expone las "anclas" del cuerpo (cabeza, pecho, cintura, manos, rodillas, pies) en coordenadas de pantalla
//   para que los paneles de alrededor dibujen sus hilos hacia el cuerpo.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { fuenteAvatar, cargarAvatarRealista } from '../avatar/avaturn.js';
import { crearMancuerna, crearBatido, sostener } from '../avatar/poses.js';

// Cada apartado: pose, objeto en la mano, ángulo de cámara y velocidad de la animación
export const ESCENAS = {
  perfil:    { pose: 'idle',    objeto: null,    giro: 0,     vel: 1 },
  gym:       { pose: 'fuerza',  objeto: 'pesa',  giro: -0.38, vel: 1 },
  running:   { pose: 'run',     objeto: null,    giro: -1.05, vel: 0.72 },
  nutricion: { pose: 'comer',   objeto: 'vaso',  giro: -0.28, vel: 1 },
  flex:      { pose: 'estirar', objeto: null,    giro: 0,     vel: 1 },
};

// Huesos de cada ancla (con un desplazamiento vertical en metros, en el espacio del avatar)
const ANCLAS = {
  coronilla: ['Head', 0.17], cabeza: ['Head', 0.08], pecho: ['Spine2', 0.04], estomago: ['Spine', 0.02], cintura: ['Hips', 0],
  hombro: ['RightArm', 0], hombroIzq: ['LeftArm', 0], mano: ['RightHand', 0.02], manoIzq: ['LeftHand', 0.02],
  muslo: ['LeftUpLeg', -0.2], rodilla: ['LeftLeg', 0], pies: ['LeftFoot', -0.06], piesDer: ['RightFoot', -0.06],
};

let unica = null;
export function estacion() { return unica || (unica = crear()); }
export const hayWebGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

function crear() {
  const raiz = document.createElement('div');
  raiz.className = 'cs-lienzo';
  const lienzo = document.createElement('canvas');
  lienzo.setAttribute('aria-label', 'Tu avatar. Arrastra para girarlo.');
  lienzo.setAttribute('role', 'img');
  raiz.append(lienzo);
  const movil = matchMedia('(max-width: 899px)').matches;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio, movil ? 1.75 : 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.02;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;

  const esc = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(r);
  esc.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  esc.environmentIntensity = 0.75;
  esc.add(new THREE.HemisphereLight(0xffffff, 0xdfe3e8, 0.55));
  const clave = new THREE.DirectionalLight(0xfff5ec, 1.75);
  clave.position.set(1.6, 3.4, 2.4); clave.castShadow = true;
  clave.shadow.mapSize.set(movil ? 1024 : 2048, movil ? 1024 : 2048); clave.shadow.radius = 7; clave.shadow.bias = -0.0004;
  Object.assign(clave.shadow.camera, { left: -1.4, right: 1.4, top: 2.3, bottom: -0.4, near: 0.5, far: 9 });
  esc.add(clave);
  const contra = new THREE.DirectionalLight(0xe2ebff, 1.15); contra.position.set(-2.2, 2.4, -2.2); esc.add(contra);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.35); relleno.position.set(-2, 1.2, 2.5); esc.add(relleno);

  // ---------- Plataforma ----------
  const plataforma = new THREE.Group(); esc.add(plataforma);
  const satin = new THREE.MeshPhysicalMaterial({ color: 0xf6f7f7, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.3 });
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.95, 0.045, 96), satin);
  disco.position.y = -0.0225; disco.receiveShadow = true; plataforma.add(disco);
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.92, 96), new THREE.ShadowMaterial({ opacity: 0.16 }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.0015; sombra.receiveShadow = true; plataforma.add(sombra);
  // Anillos finos: el "dial" de la estación (uno gira muy despacio)
  const linea = (r1, r2, op, segmentos = 160, theta = Math.PI * 2, inicio = 0) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, segmentos, 1, inicio, theta), new THREE.MeshBasicMaterial({ color: 0x8796ad, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.002; plataforma.add(m); return m;
  };
  linea(0.86, 0.864, 0.35);
  linea(0.62, 0.623, 0.22);
  const dial = new THREE.Group(); plataforma.add(dial);
  for (let i = 0; i < 3; i++) { const a = linea(0.74, 0.748, 0.5, 64, Math.PI * 0.42, i * (Math.PI * 2 / 3)); plataforma.remove(a); dial.add(a); }
  // Sombra suave bajo la plataforma
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), new THREE.ShadowMaterial({ opacity: 0 }));
  halo.visible = false; esc.add(halo);
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshBasicMaterial({ map: degradado(), transparent: true, depthWrite: false }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.046; esc.add(suelo);

  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  const soporte = new THREE.Group(); esc.add(soporte);

  // ---------- Estado ----------
  let av = null, cargando = null, vivo = false, escena = 'perfil', giroUsuario = 0, giroObj = 0, inercia = 0, arrastre = false;
  let camAng = 0, camAngObj = 0, alDibujar = null;
  const objetos = { pesa: crearMancuerna(), vaso: crearBatido() };
  for (const o of Object.values(objetos)) { o.visible = false; o.userData.escala = 0; }

  async function cargar() {
    if (cargando) return cargando;
    cargando = (async () => {
      const nuevo = await cargarAvatarRealista(await fuenteAvatar());
      nuevo.objeto.scale.setScalar(1.8 / nuevo.altura);
      if (av) { for (const o of Object.values(objetos)) o.removeFromParent(); soporte.remove(av.objeto); av.destruir(); }
      av = nuevo; soporte.add(av.objeto);
      for (const o of Object.values(objetos)) { sostener(o, av, { separacion: o === objetos.vaso ? 0.045 : 0.03 }); o.userData.base = o.scale.x; o.scale.setScalar(0.0001); }
      aplicarPose(true);
      raiz.classList.add('listo');
      return av;
    })().catch(e => { console.warn('Estación corporal', e); raiz.classList.add('sin-avatar'); cargando = null; });
    return cargando;
  }
  function aplicarPose(inmediato = false) {
    if (!av) return;
    const e = ESCENAS[escena] || ESCENAS.perfil;
    const pose = av.tiene(e.pose) ? e.pose : 'idle';
    if (reducido) { av.fijar(pose, pose === 'fuerza' ? 1.5 : pose === 'comer' ? 1 : pose === 'estirar' ? 2.4 : 0.2); }
    else av.estado(pose, e.vel);
    for (const [k, o] of Object.entries(objetos)) o.userData.objetivo = k === e.objeto ? 1 : 0;
    if (inmediato) for (const o of Object.values(objetos)) { o.userData.escala = o.userData.objetivo; }
  }
  window.addEventListener('avatar-cambiado', () => { cargando = null; cargar(); });

  // ---------- Encuadre ----------
  function medir() {
    const { width: w, height: h } = raiz.getBoundingClientRect();
    if (!w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h;
    // Alto visible ≈ 2,35 m; en pantallas estrechas se aleja para que quepa el ancho de la plataforma
    const mitad = 1.18;
    const d = mitad / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(1, 0.8 / cam.aspect);
    cam.userData.d = d;
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(raiz);

  // ---------- Interacción: arrastrar para girar ----------
  let x0 = 0, t0 = 0;
  lienzo.addEventListener('pointerdown', e => { arrastre = true; x0 = e.clientX; t0 = performance.now(); inercia = 0; lienzo.setPointerCapture(e.pointerId); raiz.classList.add('arrastrando'); });
  lienzo.addEventListener('pointermove', e => {
    if (!arrastre) return;
    const dx = e.clientX - x0, ahora = performance.now();
    giroUsuario += dx * 0.011; inercia = (dx * 0.011) / Math.max(0.016, (ahora - t0) / 1000);
    x0 = e.clientX; t0 = ahora;
  });
  const soltar = () => { arrastre = false; inercia = THREE.MathUtils.clamp(inercia, -5, 5); raiz.classList.remove('arrastrando'); };
  lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('dblclick', () => { giroUsuario = 0; inercia = 0; });

  // ---------- Bucle ----------
  const reloj = new THREE.Clock();
  const tmp = new THREE.Vector3();
  function bucle() {
    if (!vivo) return;
    if (!raiz.isConnected) { vivo = false; return; }
    requestAnimationFrame(bucle);
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (!arrastre) { giroUsuario += inercia * dt; inercia *= Math.pow(0.03, dt); if (Math.abs(inercia) < 0.01) giroUsuario += (0 - giroUsuario) * Math.min(1, dt * 0.25); }
    camAng += (camAngObj - camAng) * Math.min(1, dt * (reducido ? 20 : 2.4));
    soporte.rotation.y = giroUsuario + camAng;
    if (!reducido) dial.rotation.y += dt * 0.08;
    // Objetos: aparecen y desaparecen con suavidad
    for (const o of Object.values(objetos)) {
      o.userData.escala += ((o.userData.objetivo || 0) - o.userData.escala) * Math.min(1, dt * 6);
      const s = Math.max(0.0001, o.userData.escala);
      o.scale.setScalar((o.userData.base || 1) * s);
      o.visible = s > 0.02;
    }
    if (av) {
      av.actualizar(reducido ? 0 : dt);
    }
    const d = cam.userData.d || 6;
    cam.position.set(0, 1.02, d); cam.lookAt(0, 0.98, 0);
    r.render(esc, cam);
    if (alDibujar && av) alDibujar(ancla);
  }
  // El vaso se mantiene casi derecho, como cuando se sostiene de verdad
  const arriba = new THREE.Vector3(0, 1, 0), qMundo = new THREE.Quaternion(), qPadre = new THREE.Quaternion();
  function nivelar(o) {
    o.parent.getWorldQuaternion(qPadre);
    const ejeActual = new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion).applyQuaternion(qPadre);
    const objetivo = ejeActual.clone().lerp(arriba, 0.8).normalize();
    const corr = new THREE.Quaternion().setFromUnitVectors(ejeActual, objetivo);
    o.getWorldQuaternion(qMundo);
    qMundo.premultiply(corr);
    o.quaternion.copy(qPadre.clone().invert().multiply(qMundo));
  }

  // Posición en pantalla (px, relativa al lienzo) de un punto del cuerpo
  function ancla(nombre) {
    const a = ANCLAS[nombre]; if (!a || !av) return null;
    const b = av.hueso(a[0]); if (!b) return null;
    b.getWorldPosition(tmp); tmp.y += a[1];
    tmp.project(cam);
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, visible: tmp.z < 1 };
  }

  return {
    elemento: raiz,
    montar(destino, apartado) {
      destino.append(raiz);
      this.escena(apartado);
      medir();
      if (!vivo) { vivo = true; reloj.getDelta(); requestAnimationFrame(bucle); }
      cargar();
    },
    escena(apartado) {
      if (!ESCENAS[apartado]) apartado = 'perfil';
      const cambia = apartado !== escena;
      escena = apartado;
      camAngObj = ESCENAS[apartado].giro;
      if (cambia) { giroUsuario *= 0.3; }
      aplicarPose();
    },
    alDibujar(fn) { alDibujar = fn; },
    ancla,
    _depurar: () => ({ objetos, av }),
  };
}

// Degradado radial para el suelo (sombra suave alrededor de la plataforma)
function degradado() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  grad.addColorStop(0, 'rgba(40,52,74,0.16)'); grad.addColorStop(0.55, 'rgba(40,52,74,0.06)'); grad.addColorStop(1, 'rgba(40,52,74,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
