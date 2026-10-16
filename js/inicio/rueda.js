// Escena 3D del Inicio: una rueda de publicaciones (una por área de SYNCO, dos vueltas)
// y tu avatar corriendo dentro. Se gira arrastrando, con el dedo o con las flechas;
// tocar una publicación te lleva a esa área y tocar el avatar abre su editor.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cargarAvatar } from './avatar.js';

const R = 2.6;            // radio de la rueda
const W = 1.36;           // ancho de la cinta
const ALTURA_AVATAR = 3.15;   // ~+20 % respecto a la versión anterior
const INCLINACION = 0.92;  // giro de la rueda respecto a la cámara (la vemos de tres cuartos)
const VEL_BASE = 0.8;      // rad/s cuando nadie la toca: la cinta avanza hacia la izquierda y el avatar corre hacia nosotros, de tres cuartos
// Velocidad del pie apoyado en la carrera de Avaturn (4,4 m/s a 1,8 m de estatura) en unidades de la escena:
// la animación se acompasa a la superficie de la rueda para que los pies no patinen
const VEL_PIE = 4.4 * (ALTURA_AVATAR / 1.75);
const VEL_PIE_ANDAR = 1.4 * (ALTURA_AVATAR / 1.75); // al ir despacio (p. ej. con el puntero encima), camina
const GIRO_TEXTURA = Math.PI / 2;   // con la rueda girando hacia la izquierda, así las publicaciones se leen derechas

export function soporta3D() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

export async function crearRueda(cont, { lienzos, areas, alDestacar, alElegir, alPulsarAvatar, alSobre, quieto = false }) {
  // ---------- Renderizador ----------
  const movil = matchMedia('(pointer: coarse)').matches;
  let dpr = Math.min(devicePixelRatio || 1, movil ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const lienzo = renderer.domElement;
  lienzo.tabIndex = 0;
  lienzo.setAttribute('role', 'application');
  lienzo.setAttribute('aria-label', 'Rueda de SYNCO. Arrastra o usa las flechas para girarla y pulsa Intro para entrar en la publicación destacada.');
  cont.appendChild(lienzo);

  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.55;

  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const VISTA = { pos: new THREE.Vector3(0, 0.9, 12.2), mira: new THREE.Vector3(0, -0.15, 0) };
  const cam = { pos: VISTA.pos.clone(), mira: VISTA.mira.clone() };
  const camObj = { pos: VISTA.pos.clone(), mira: VISTA.mira.clone() };
  camara.position.copy(cam.pos);

  // ---------- Luz: una ventana grande arriba a la izquierda y un relleno frío ----------
  escena.add(new THREE.HemisphereLight(0xffffff, 0xe6ebf2, 0.65));
  const sol = new THREE.DirectionalLight(0xfffaf2, 2.1);
  sol.position.set(-2.2, 10, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(movil ? 1024 : 2048, movil ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
  sol.shadow.radius = 6;
  sol.shadow.bias = -0.0004;
  escena.add(sol);
  const relleno = new THREE.DirectionalLight(0xdbe8ff, 0.6);
  relleno.position.set(5, 2, 4);
  escena.add(relleno);

  // Suelo invisible que solo recoge la sombra
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.11 }));
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -R - 0.02;
  suelo.receiveShadow = true;
  escena.add(suelo);

  // ---------- La rueda ----------
  const soporte = new THREE.Group();
  soporte.rotation.y = INCLINACION;
  escena.add(soporte);
  const rueda = new THREE.Group();
  soporte.add(rueda);

  // ---------- La cinta ----------
  // Una tira continua de papel fotográfico satinado que se curva sobre sí misma:
  // las publicaciones son la propia superficie (por fuera y por dentro) y el canto es finísimo.
  const ESPESOR = 0.012, ONDA = 0.035;
  const onda = th => ONDA * Math.sin(th * 2 + 0.6);           // leve ondulación de tira flexible
  function ondular(geo) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + onda(Math.atan2(p.getX(i), p.getZ(i))));
    geo.computeVertexNormals();
    return geo;
  }
  const papel = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.12, clearcoatRoughness: 0.45 });
  // Cantos: dos tiras finísimas que cierran el grosor del papel
  for (const lado of [-1, 1]) {
    const pts = [], idx = [];
    const SEG = 360;
    for (let k = 0; k <= SEG; k++) {
      const th = (k / SEG) * Math.PI * 2, y = lado * W / 2 + onda(th);
      for (const r of [R - ESPESOR / 2, R + ESPESOR / 2]) pts.push(r * Math.sin(th), y, r * Math.cos(th));
      if (k < SEG) { const o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
    const canto = new THREE.Mesh(g, papel.clone()); canto.material.side = THREE.DoubleSide;
    canto.rotation.x = Math.PI / 2; canto.castShadow = true;
    rueda.add(canto);
  }

  // Publicaciones: dos vueltas de las cinco áreas; cada lienzo trae su propio margen en blanco
  const N = areas.length * 2;
  const paso = (Math.PI * 2) / N;
  const hueco = 0;
  const texturas = lienzos.map(c => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.center.set(0.5, 0.5);
    t.rotation = GIRO_TEXTURA;   // la publicación queda "de pie" a lo largo de la cinta
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  });
  const matPost = map => new THREE.MeshPhysicalMaterial({ map, roughness: 0.52, sheen: 0.25, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.12, clearcoatRoughness: 0.45, envMapIntensity: 0.4, emissive: 0x000000 });
  const tarjetas = [];
  for (let i = 0; i < N; i++) {
    const a = i % areas.length;
    const t0 = i * paso + hueco / 2, largo = paso - hueco;
    const grupo = new THREE.Group();
    const texFuera = texturas[a];
    const fuera = new THREE.Mesh(ondular(new THREE.CylinderGeometry(R + ESPESOR / 2, R + ESPESOR / 2, W, 40, 6, true, t0, largo)), matPost(texFuera));
    // Cara de dentro (la textura se refleja para que se lea bien)
    const texDentro = texFuera.clone();
    texDentro.wrapS = THREE.RepeatWrapping;
    texDentro.repeat.x = -1;
    texDentro.rotation = GIRO_TEXTURA + Math.PI;
    texDentro.needsUpdate = true;
    const mDentro = matPost(texDentro); mDentro.side = THREE.BackSide;
    const dentro = new THREE.Mesh(ondular(new THREE.CylinderGeometry(R - ESPESOR / 2, R - ESPESOR / 2, W, 40, 6, true, t0, largo)), mDentro);
    for (const m of [fuera, dentro]) { m.receiveShadow = true; m.castShadow = true; m.userData.tarjeta = i; }
    grupo.add(fuera, dentro);
    grupo.rotation.x = Math.PI / 2;
    rueda.add(grupo);
    tarjetas.push({ i, area: a, centro: t0 + largo / 2, fuera, dentro, texDentro, brillo: 0, brilloObj: 0 });
  }

  // ---------- El avatar ----------
  let avatar = null;
  const ancla = new THREE.Group();
  ancla.position.set(0, -R + ESPESOR / 2 + 0.004, 0);
  soporte.add(ancla);
  try {
    avatar = await cargarAvatar();
    avatar.objeto.scale.setScalar(ALTURA_AVATAR);
    avatar.objeto.rotation.y = VEL_BASE < 0 ? Math.PI / 2 : -Math.PI / 2; // corre a favor de la cinta, que gira bajo sus pies
    ancla.add(avatar.objeto);
    avatar.poner(quieto ? 'quieto' : 'correr', 0);
    avatar.mallas.forEach(m => { m.userData.avatar = true; });
  } catch (e) {
    console.warn('No se pudo cargar el avatar', e);
  }

  // ---------- Estado e interacción ----------
  let angulo = 0, vel = quieto ? 0 : VEL_BASE, velObj = vel;
  let pausado = quieto;
  let arrastre = null;
  let ultimoToque = 0;
  let destacada = -1;
  let editor = false;
  let giroAvatar = 0;
  let objetivoAngulo = null;
  let sobre = null;
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const objetos = tarjetas.flatMap(t => [t.fuera, t.dentro]);

  function aNDC(ev) {
    const r = lienzo.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }
  function tocado() {
    rayo.setFromCamera(puntero, camara);
    const lista = avatar ? [...objetos, ...avatar.mallas] : objetos;
    const h = rayo.intersectObjects(lista, false)[0];
    if (!h) return null;
    if (h.object.userData.avatar) return { avatar: true };
    return { tarjeta: tarjetas[h.object.userData.tarjeta] };
  }

  lienzo.addEventListener('pointerdown', ev => {
    lienzo.setPointerCapture(ev.pointerId);
    arrastre = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, t: performance.now(), movido: false };
    objetivoAngulo = null;
    vel = 0;   // al tocar, la cinta se detiene: lo que pulsas no se escapa
  });
  lienzo.addEventListener('pointermove', ev => {
    aNDC(ev);
    if (!arrastre) {
      const h = tocado();
      const nuevo = h?.tarjeta ? h.tarjeta.i : h?.avatar ? 'avatar' : null;
      if (nuevo !== sobre) {
        sobre = nuevo;
        lienzo.style.cursor = nuevo !== null ? 'pointer' : 'grab';
        alSobre?.(h ? { area: h.tarjeta ? areas[h.tarjeta.area] : null, avatar: !!h.avatar, x: ev.clientX, y: ev.clientY } : null);
      } else if (nuevo !== null) {
        alSobre?.({ area: h.tarjeta ? areas[h.tarjeta.area] : null, avatar: !!h.avatar, x: ev.clientX, y: ev.clientY });
      }
      return;
    }
    const dx = ev.clientX - arrastre.x;
    if (Math.abs(ev.clientX - arrastre.x0) > 6) { arrastre.movido = true; cont.classList.add('arrastrando'); }
    const ahora = performance.now();
    const dt = Math.max(1, ahora - arrastre.t) / 1000;
    if (editor) {
      giroAvatar += dx * 0.012;
    } else {
      const d = dx * 0.006;
      angulo += d;
      vel = THREE.MathUtils.lerp(vel, d / dt, 0.5);
    }
    arrastre.x = ev.clientX; arrastre.t = ahora;
    ultimoToque = ahora;
  });
  const soltar = ev => {
    if (!arrastre) return;
    cont.classList.remove('arrastrando');
    const fueClic = !arrastre.movido;
    arrastre = null;
    if (!fueClic) return;
    aNDC(ev);
    const h = tocado();
    if (h?.avatar) return alPulsarAvatar?.();
    if (h?.tarjeta && !editor) elegir(h.tarjeta);
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', () => { arrastre = null; cont.classList.remove('arrastrando'); });
  lienzo.addEventListener('pointerleave', () => { if (sobre !== null) { sobre = null; alSobre?.(null); } });
  lienzo.addEventListener('wheel', ev => {
    if (!editor) return;
    ev.preventDefault();
    zoomEditor = THREE.MathUtils.clamp(zoomEditor + ev.deltaY * 0.003, 3.2, 7);
  }, { passive: false });
  lienzo.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); siguiente(ev.key === 'ArrowRight' ? 1 : -1); }
    if ((ev.key === 'Enter' || ev.key === ' ') && destacada >= 0) { ev.preventDefault(); elegir(tarjetas[destacada]); }
  });

  function siguiente(dir) {
    objetivoAngulo = (objetivoAngulo ?? angulo) + dir * paso;
    ultimoToque = performance.now();
  }

  // Al elegir: la cámara se acerca a la publicación y avisamos a la página
  let eligiendo = false;
  function elegir(t) {
    if (eligiendo) return;
    eligiendo = true;
    avatar?.gesto('like');
    const p = centroMundo(t);
    camObj.mira.copy(p);
    camObj.pos.copy(p).add(VISTA.pos.clone().sub(p).normalize().multiplyScalar(3.4));
    alElegir?.(areas[t.area], () => { eligiendo = false; volverVista(); });
  }
  function volverVista() { camObj.pos.copy(VISTA.pos); camObj.mira.copy(VISTA.mira); }

  // ---------- Editor del avatar ----------
  let zoomEditor = 4.6;
  function modoEditor(si) {
    editor = si;
    giroAvatar = 0;
    if (avatar) avatar.poner(si || pausado ? 'quieto' : 'correr');
    if (!si) volverVista();
  }

  // ---------- Cálculos por fotograma ----------
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), haciaCam = new THREE.Vector3();
  function centroMundo(t) {
    const a = t.centro - Math.PI / 2;
    tmp.set(Math.cos(a) * (R + 0.03), Math.sin(a) * (R + 0.03), 0);
    return rueda.localToWorld(tmp.clone());
  }
  function calcularDestacada() {
    let mejor = -1, val = -Infinity;
    for (const t of tarjetas) {
      const a = t.centro - Math.PI / 2;
      tmp.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      nrm.set(Math.cos(a), Math.sin(a), 0);
      rueda.localToWorld(tmp);
      nrm.transformDirection(rueda.matrixWorld);
      haciaCam.copy(camara.position).sub(tmp).normalize();
      // Cara de fuera mirando a cámara, o cara de dentro (por el hueco de la rueda)
      const v = Math.max(nrm.dot(haciaCam), -nrm.dot(haciaCam) * 0.92) + tmp.y * 0.04;
      if (v > val) { val = v; mejor = t.i; }
    }
    if (mejor !== destacada) {
      destacada = mejor;
      tarjetas.forEach(t => { t.brilloObj = t.i === mejor ? 1 : 0; });
      alDestacar?.(areas[tarjetas[mejor].area]);
      if (Math.random() < 0.35) avatar?.gesto('like');
    }
  }

  // ---------- Tamaño y calidad ----------
  function medir() {
    const w = cont.clientWidth, h = cont.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    // En pantallas estrechas nos alejamos un poco para que quepa la rueda entera
    camara.fov = w / h < 0.9 ? 36 : 30;
    camara.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(medir);
  ro.observe(cont);
  medir();

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(cont);

  // ---------- Bucle ----------
  const reloj = new THREE.Clock();
  let raf = 0, tiempos = [];
  function bucle() {
    raf = requestAnimationFrame(bucle);
    if (!visible || document.hidden) { reloj.getDelta(); return; }
    const dt = Math.min(reloj.getDelta(), 0.05);
    const ahora = performance.now();

    // Velocidad de la rueda: tras soltarla vuelve poco a poco al trote base
    if (!arrastre) {
      if (objetivoAngulo !== null) {
        const d = objetivoAngulo - angulo;
        vel = d * 4;
        if (Math.abs(d) < 0.002) objetivoAngulo = null;
      } else {
        velObj = pausado || editor || eligiendo ? 0 : sobre !== null ? VEL_BASE * 0.2 : VEL_BASE;
        const k = ahora - ultimoToque < 1200 ? 0.6 : 1.6;
        vel += (velObj - vel) * Math.min(1, dt * k);
      }
      angulo += vel * dt;
    }
    rueda.rotation.z = angulo;

    // El avatar corre al ritmo de la rueda (y se da la vuelta si la giras al revés)
    if (avatar) {
      const rapidez = Math.abs(vel);
      if (!editor) {
        const superficie = rapidez * R;
        const marcha = rapidez < 0.06 ? 'quieto' : superficie < 1.3 ? 'andar' : 'correr';
        avatar.poner(marcha, 0.35);
        avatar.perseguir?.(marcha === 'correr');
        avatar.velocidad(marcha === 'correr' ? THREE.MathUtils.clamp(superficie / VEL_PIE, 0.5, 1.4)
          : marcha === 'andar' ? THREE.MathUtils.clamp(superficie / VEL_PIE_ANDAR, 0.5, 1.3) : 1);
        const mira = vel < -0.12 ? Math.PI / 2 : -Math.PI / 2;
        avatar.objeto.rotation.y += (mira - avatar.objeto.rotation.y) * Math.min(1, dt * 5);
      } else {
        avatar.perseguir?.(false);
        avatar.velocidad(1);
        avatar.objeto.rotation.y += ((-INCLINACION * 0.85 + giroAvatar) - avatar.objeto.rotation.y) * Math.min(1, dt * 6);
      }
      avatar.actualizar(dt);
    }

    // Cámara: suave hacia su objetivo (vista general, publicación elegida o editor)
    if (editor && avatar) {
      const p = ancla.getWorldPosition(tmp).clone().add(new THREE.Vector3(0, ALTURA_AVATAR * 0.55, 0));
      // Con el panel a la derecha (ordenador), el avatar se coloca en el hueco de la izquierda
      const desplazar = cont.clientWidth > 700 ? 0.85 : 0;
      p.x += desplazar;
      camObj.mira.copy(p);
      camObj.pos.copy(p).add(new THREE.Vector3(0, 0.35, zoomEditor));
      if (cont.clientWidth <= 700) { camObj.mira.y -= 0.55; camObj.pos.y -= 0.2; }
    }
    const k = Math.min(1, dt * (eligiendo ? 5 : 3.2));
    cam.pos.lerp(camObj.pos, k);
    cam.mira.lerp(camObj.mira, k);
    camara.position.copy(cam.pos);
    camara.lookAt(cam.mira);

    // Brillo de la destacada
    soporte.updateMatrixWorld();
    if (!editor) calcularDestacada();
    for (const t of tarjetas) {
      t.brillo += (t.brilloObj - t.brillo) * Math.min(1, dt * 6);
      const e = 0.03 * t.brillo + (sobre === t.i ? 0.06 : 0);
      t.fuera.material.emissive.setScalar(e);
      t.dentro.material.emissive.setScalar(e);
    }

    renderer.render(escena, camara);

    // Si el dispositivo va justo, bajamos la resolución
    tiempos.push(dt);
    if (tiempos.length === 90) {
      const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
      tiempos = [];
      if (media > 0.028 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); medir(); }
    }
  }
  bucle();

  return {
    siguiente,
    abrirDestacada: () => destacada >= 0 && elegir(tarjetas[destacada]),
    irA: id => {
      // Gira hasta que esa área quede destacada y entra
      const t = tarjetas.find(x => areas[x.area].id === id);
      if (t) elegir(t);
    },
    pausar(si) { pausado = si; if (avatar && !editor) avatar.poner(si ? 'quieto' : 'correr'); },
    modoEditor,
    aplicarAspecto: a => avatar?.aplicar(a),
    saludar: () => avatar?.gesto('saludar'),
    refrescar(i) { texturas[i].needsUpdate = true; tarjetas.filter(t => t.area === i).forEach(t => { t.texDentro.needsUpdate = true; }); },
    destruir() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      escena.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); });
      });
      texturas.forEach(t => t.dispose());
      pmrem.dispose();
      renderer.dispose();
      lienzo.remove();
    },
  };
}
