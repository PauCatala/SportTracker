// «Crear mi avatar»: editor a pantalla completa del avatar humano de Lumen.
// Seis pasos (base, cuerpo, rostro y piel, pelo, ropa, guardar), vista 3D con giro,
// zoom y vistas de frente/perfil/espalda, deshacer y rehacer, y guardado en tu cuenta.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { crearAvatar, datos } from './motor.js';
import { crearAnimador } from './animacion.js';
import {
  PERFILES, normalizar, CONTROLES_CUERPO, CONTROLES_ROSTRO, FORMAS_CABEZA, RASGOS, TONOS_PIEL,
  COLORES_PELO, COLORES_OJOS, PALETA_ROPA, PELOS, CEJAS, BARBAS, PRENDAS,
} from './parametros.js';
import { leerPerfil, guardarPerfil, tieneAvatar } from '../inicio/avatar.js';

const MINI = new URL('../../media/avatar/mini/', import.meta.url).href;

const PASOS = [
  { id: 'base', nombre: 'Base', foco: 'cuerpo' },
  { id: 'cuerpo', nombre: 'Cuerpo', foco: 'cuerpo' },
  { id: 'rostro', nombre: 'Rostro y piel', foco: 'cara' },
  { id: 'pelo', nombre: 'Pelo y vello', foco: 'cabeza' },
  { id: 'ropa', nombre: 'Ropa', foco: 'cuerpo' },
  { id: 'guardar', nombre: 'Guardar', foco: 'cuerpo' },
];

const SVG = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  rehacer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  reset: '<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  base: '<circle cx="12" cy="6.5" r="3"/><path d="M6 21v-5.5a6 6 0 0112 0V21"/>',
  cuerpo: '<circle cx="12" cy="4.5" r="2.2"/><path d="M8 22l1.2-8M16 22l-1.2-8M6 9.5c2 1.2 4 1.7 6 1.7s4-.5 6-1.7M12 11.2V16"/>',
  rostro: '<path d="M12 3c-4 0-6.5 3-6.5 7.5 0 5 3.2 10.5 6.5 10.5s6.5-5.5 6.5-10.5C18.5 6 16 3 12 3z"/><path d="M9.5 10.5h.01M14.5 10.5h.01M10 15.5c1.2.8 2.8.8 4 0"/>',
  pelo: '<path d="M5 13c0-5 3-9 7-9s7 4 7 9"/><path d="M5 13c1-3 3.5-4.5 7-5 1.5 2 4 3 7 3"/><path d="M6.5 13.5V18M17.5 13.5V18"/>',
  ropa: '<path d="M8.5 3L4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 15.5 3a3.5 3.5 0 01-7 0z"/>',
  guardar: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[n]}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let abierto = null;

export async function abrirCreador({ alGuardar, primeraVez = !tieneAvatar() } = {}) {
  if (abierto) return abierto;
  const inicial = leerPerfil();
  let perfil = structuredClone(inicial);
  const historial = [JSON.stringify(perfil)];
  let posHist = 0;
  let paso = 0, subRostro = 'rostro', subRopa = 'arriba';
  let guardado = false;

  // ---------- Estructura ----------
  const raiz = document.createElement('div');
  raiz.className = 'creador entrando';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', 'Crear mi avatar');
  raiz.innerHTML = `
    <header class="cr-cab">
      <button class="cr-icono" data-cancelar aria-label="Cerrar sin guardar">${ico('x')}</button>
      <div class="cr-titulo"><h2>${primeraVez ? 'Crea tu avatar' : 'Tu avatar'}</h2><p class="cr-paso"></p></div>
      <div class="cr-acciones">
        <button class="cr-icono" data-deshacer aria-label="Deshacer" title="Deshacer">${ico('deshacer')}</button>
        <button class="cr-icono" data-rehacer aria-label="Rehacer" title="Rehacer">${ico('rehacer')}</button>
        <button class="cr-icono" data-reset aria-label="Restablecer" title="Volver a como estaba">${ico('reset')}</button>
        <button class="btn primario cr-guardar" data-guardar>Guardar</button>
      </div>
    </header>
    <nav class="cr-pasos" aria-label="Pasos">
      ${PASOS.map((p, i) => `<button data-paso="${i}" aria-label="${p.nombre}">${ico(p.id)}<span>${p.nombre}</span></button>`).join('')}
    </nav>
    <main class="cr-escena">
      <div class="cr-lienzo"></div>
      <p class="cr-cargando"><span></span>Preparando tu avatar…</p>
      <div class="cr-vistas" role="group" aria-label="Vista">
        <button data-vista="0" class="activo">Frente</button><button data-vista="1">Perfil</button><button data-vista="2">Espalda</button>
      </div>
      <div class="cr-zoom" role="group" aria-label="Zoom">
        <button class="cr-icono" data-zoom="-1" aria-label="Acercar">${ico('mas')}</button>
        <button class="cr-icono" data-zoom="1" aria-label="Alejar">${ico('menos')}</button>
      </div>
      <div class="cr-animar" role="group" aria-label="Probar animaciones">
        ${[['idle', 'Reposo'], ['walk', 'Caminar'], ['run', 'Correr'], ['saludar', 'Saludar'], ['megusta', 'Me gusta']].map(([k, n], i) => `<button data-anim="${k}" class="${i ? '' : 'activo'}">${n}</button>`).join('')}
      </div>
    </main>
    <section class="cr-panel" aria-live="polite">
      <div class="cr-panel-cuerpo"></div>
      <footer class="cr-panel-pie">
        <button class="btn" data-atras>Atrás</button>
        <span class="cr-progreso" aria-hidden="true">${PASOS.map(() => '<i></i>').join('')}</span>
        <button class="btn primario" data-siguiente>Siguiente</button>
      </footer>
    </section>
    <div class="cr-confirmar" hidden>
      <div class="cr-confirmar-caja" role="alertdialog" aria-labelledby="cr-conf-t">
        <h3 id="cr-conf-t">¿Salir sin guardar?</h3>
        <p>Perderás los cambios que has hecho en tu avatar.</p>
        <div><button class="btn" data-seguir>Seguir editando</button><button class="btn primario" data-salir>Salir</button></div>
      </div>
    </div>`;
  document.body.append(raiz);
  document.body.classList.add('con-creador');
  requestAnimationFrame(() => raiz.classList.remove('entrando'));
  const $ = s => raiz.querySelector(s);
  const panel = $('.cr-panel-cuerpo');
  const lienzoCont = $('.cr-lienzo');

  // ---------- Escena 3D ----------
  const movil = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, movil ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  lienzoCont.append(renderer.domElement);
  const lienzo = renderer.domElement;
  lienzo.setAttribute('aria-label', 'Vista 3D de tu avatar. Arrastra para girar.');
  lienzo.tabIndex = 0;

  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.5;
  escena.add(new THREE.HemisphereLight(0xffffff, 0xe9ecf1, 0.55));
  const clave = new THREE.DirectionalLight(0xfff6ee, 1.9);
  clave.position.set(-1.6, 3.4, 3.2);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  Object.assign(clave.shadow.camera, { left: -1.4, right: 1.4, top: 2.4, bottom: -0.4, near: 0.5, far: 10 });
  clave.shadow.bias = -0.0003; clave.shadow.normalBias = 0.015; clave.shadow.radius = 5;
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0xdfe9ff, 1.1);
  contra.position.set(2.2, 2.6, -2.8);
  escena.add(contra);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.35);
  relleno.position.set(2.5, 1.2, 2.5);
  escena.add(relleno);
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.13 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
  escena.add(suelo);
  // Peana suave
  const peana = new THREE.Mesh(new THREE.CircleGeometry(0.62, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  peana.rotation.x = -Math.PI / 2; peana.position.y = 0.001;
  escena.add(peana);

  const camara = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
  const orbita = { az: 0.35, azObj: 0, alt: 0.08, dist: 3.6, distObj: 3.6, mira: new THREE.Vector3(0, 0.9, 0), miraObj: new THREE.Vector3(0, 0.9, 0) };

  let avatar = null, anim = null;
  try {
    await datos();
    avatar = await crearAvatar(perfil);
    anim = await crearAnimador(avatar);
    escena.add(avatar.objeto);
    $('.cr-cargando').classList.add('fuera');
  } catch (e) {
    console.warn('Avatar', e);
    $('.cr-cargando').innerHTML = 'No se ha podido cargar tu avatar. Revisa la conexión e inténtalo de nuevo.';
  }

  // ---------- Aplicar cambios (el último gana) ----------
  let aplicando = false, pendiente = false;
  async function refrescar() {
    if (!avatar) return;
    if (aplicando) { pendiente = true; return; }
    aplicando = true;
    try {
      do { pendiente = false; await avatar.aplicar(perfil); } while (pendiente);
    } finally { aplicando = false; }
    enfocar(false);
    actualizarAltura();
  }
  function confirmar() {
    const s = JSON.stringify(perfil);
    if (s === historial[posHist]) return;
    historial.splice(posHist + 1);
    historial.push(s);
    if (historial.length > 80) historial.shift();
    posHist = historial.length - 1;
    estadoBotones();
  }
  function irHist(d) {
    const n = posHist + d;
    if (n < 0 || n >= historial.length) return;
    posHist = n;
    perfil = JSON.parse(historial[n]);
    refrescar(); pintarPanel(); estadoBotones();
  }
  function estadoBotones() {
    $('[data-deshacer]').disabled = posHist === 0;
    $('[data-rehacer]').disabled = posHist >= historial.length - 1;
    $('[data-reset]').disabled = JSON.stringify(perfil) === JSON.stringify(inicial);
  }

  // ---------- Cámara ----------
  const foco = { cuerpo: null, cara: null, cabeza: null };
  let focoActual = 'cuerpo', zoom = 0;
  function enfocar(saltar) {
    if (!avatar) return;
    const h = avatar.altura();
    const v = new THREE.Vector3();
    avatar.punto('head', v);
    const ojos = v.y + h * 0.02; // la articulación de la cabeza queda justo bajo los ojos
    const ancho = lienzoCont.clientWidth || 1, alto = lienzoCont.clientHeight || 1;
    const asp = ancho / alto;
    const tan = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    let mira, dist;
    if (focoActual === 'cara') { mira = ojos - 0.035; dist = 0.17 / tan * Math.max(1, 0.75 / asp); }
    else if (focoActual === 'cabeza') { mira = ojos + 0.03; dist = 0.25 / tan * Math.max(1, 0.75 / asp); }
    else { mira = h * 0.5; dist = (h * 0.5 + 0.2) / tan * Math.max(1, 0.62 / asp); }
    dist *= Math.pow(1.25, zoom);
    orbita.miraObj.set(0, mira, 0);
    orbita.distObj = THREE.MathUtils.clamp(dist, 0.45, 9);
    if (saltar) { orbita.mira.copy(orbita.miraObj); orbita.dist = orbita.distObj; }
  }
  function verPaso() {
    const f = PASOS[paso].id === 'rostro' ? (subRostro === 'piel' ? 'cara' : 'cara') : PASOS[paso].foco;
    if (f !== focoActual) { focoActual = f; zoom = 0; }
    enfocar(false);
  }

  // Arrastrar para girar; rueda o pellizco para acercar
  const punteros = new Map();
  let arrastre = null, pellizco = 0;
  lienzo.addEventListener('pointerdown', ev => {
    lienzo.setPointerCapture(ev.pointerId);
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    arrastre = { x: ev.clientX, y: ev.clientY };
    if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pellizco = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  lienzo.addEventListener('pointermove', ev => {
    if (!punteros.has(ev.pointerId)) return;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pellizco) { zoom = THREE.MathUtils.clamp(zoom + Math.log(pellizco / d) * 2.2, -3, 3); enfocar(false); }
      pellizco = d;
      return;
    }
    if (!arrastre) return;
    orbita.azObj -= (ev.clientX - arrastre.x) * 0.011;
    orbita.alt = THREE.MathUtils.clamp(orbita.alt + (ev.clientY - arrastre.y) * 0.004, -0.35, 0.6);
    arrastre = { x: ev.clientX, y: ev.clientY };
    marcarVista(-1);
  });
  const fin = ev => { punteros.delete(ev.pointerId); if (!punteros.size) { arrastre = null; pellizco = 0; } };
  lienzo.addEventListener('pointerup', fin);
  lienzo.addEventListener('pointercancel', fin);
  lienzo.addEventListener('wheel', ev => {
    ev.preventDefault();
    zoom = THREE.MathUtils.clamp(zoom + ev.deltaY * 0.0022, -3, 3);
    enfocar(false);
  }, { passive: false });
  lienzo.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft') { orbita.azObj += 0.3; marcarVista(-1); }
    if (ev.key === 'ArrowRight') { orbita.azObj -= 0.3; marcarVista(-1); }
    if (ev.key === '+' || ev.key === '=') { zoom = Math.max(-3, zoom - 0.5); enfocar(false); }
    if (ev.key === '-') { zoom = Math.min(3, zoom + 0.5); enfocar(false); }
  });
  function marcarVista(i) {
    raiz.querySelectorAll('[data-vista]').forEach(b => b.classList.toggle('activo', +b.dataset.vista === i));
  }
  function vista(i) {
    const objetivo = [0, Math.PI / 2, Math.PI][i];
    // Por el camino más corto
    const vueltas = Math.round((orbita.azObj - objetivo) / (Math.PI * 2));
    orbita.azObj = objetivo + vueltas * Math.PI * 2;
    marcarVista(i);
  }

  function medir() {
    const w = lienzoCont.clientWidth, h = lienzoCont.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    enfocar(false);
  }
  const ro = new ResizeObserver(medir);
  ro.observe(lienzoCont);
  medir();
  enfocar(true);
  orbita.az = 0.6; orbita.azObj = 0;

  const reloj = new THREE.Clock();
  let raf = 0;
  function bucle() {
    raf = requestAnimationFrame(bucle);
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (document.hidden) return;
    const k = Math.min(1, dt * 6);
    orbita.az += (orbita.azObj - orbita.az) * k;
    orbita.dist += (orbita.distObj - orbita.dist) * k;
    orbita.mira.lerp(orbita.miraObj, k);
    const d = orbita.dist;
    camara.position.set(Math.sin(orbita.az) * Math.cos(orbita.alt) * d, orbita.mira.y + Math.sin(orbita.alt) * d, Math.cos(orbita.az) * Math.cos(orbita.alt) * d);
    camara.lookAt(orbita.mira);
    anim?.actualizar(dt);
    renderer.render(escena, camara);
  }
  bucle();

  // ---------- Paneles ----------
  const slider = (k, nombre, v, { min = -1, max = 1, paso = 0.01, extremos = ['', ''] } = {}) => `
    <label class="cr-slider">
      <span class="cr-s-nombre">${nombre}</span>
      <input type="range" min="${min}" max="${max}" step="${paso}" value="${v}" data-k="${k}" aria-label="${nombre}">
      ${extremos[0] ? `<span class="cr-s-ext"><i>${extremos[0]}</i><i>${extremos[1]}</i></span>` : ''}
    </label>`;
  const muestras = (k, lista, actual, conNombre = false) => `
    <div class="cr-muestras" role="radiogroup">
      ${lista.map(([v, n, c]) => `<button role="radio" aria-checked="${v === actual}" class="cr-muestra${v === actual ? ' activo' : ''}${v === null ? ' original' : ''}" data-k="${k}" data-v="${v ?? ''}" style="--c:${c || v || '#fff'}" title="${esc(n)}" aria-label="${esc(n)}">${conNombre ? `<span>${esc(n)}</span>` : ''}</button>`).join('')}
    </div>`;
  const chips = (k, lista, actual) => `
    <div class="cr-chips" role="radiogroup">
      ${lista.map(([v, n]) => `<button role="radio" aria-checked="${v === actual}" class="cr-chip${v === actual ? ' activo' : ''}" data-k="${k}" data-v="${esc(v)}">${esc(n)}</button>`).join('')}
    </div>`;
  const tarjetas = (k, lista, actual, mini = v => v) => `
    <div class="cr-tarjetas" role="radiogroup">
      ${lista.map(([v, n]) => `<button role="radio" aria-checked="${v === actual}" class="cr-tarjeta${v === actual ? ' activo' : ''}" data-k="${k}" data-v="${esc(v)}">
        <span class="cr-mini">${mini(v) ? `<img src="${MINI}${mini(v)}.webp" alt="" decoding="async" onerror="this.remove()">` : ''}</span><span class="cr-t-nombre">${esc(n)}</span></button>`).join('')}
    </div>`;
  const grupo = (titulo, html, abierto = true) => `<details class="cr-grupo" ${abierto ? 'open' : ''}><summary>${titulo}</summary><div>${html}</div></details>`;
  const sub = (k, lista, actual) => `<div class="cr-sub" role="tablist">${lista.map(([v, n]) => `<button role="tab" aria-selected="${v === actual}" class="${v === actual ? 'activo' : ''}" data-sub="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;

  function alturaTexto() { return avatar ? `${Math.round(avatar.altura() * 100)} cm` : ''; }
  function actualizarAltura() { const el = panel.querySelector('[data-altura]'); if (el) el.textContent = alturaTexto(); }

  function htmlPaso() {
    const p = perfil;
    switch (PASOS[paso].id) {
      case 'base': return `
        <h3>Elige tu base</h3>
        <p class="cr-ayuda">Empieza por una base y luego ajústala a tu gusto. Puedes cambiarlo todo después.</p>
        <div class="cr-bases">
          ${[['mujer', 'Base femenina'], ['hombre', 'Base masculina']].map(([k, n]) => `
            <button class="cr-base${(k === 'mujer') === (p.genero < 0.5) ? ' activo' : ''}" data-base="${k}">
              <img src="${MINI}base-${k}.webp" alt="" onerror="this.remove()"><span>${n}</span></button>`).join('')}
        </div>
        ${grupo('Estructura facial', chips('rasgosIdx', RASGOS.map(([n], i) => [String(i), n]), String(RASGOS.findIndex(([, r]) => r.every((x, j) => Math.abs(x - p.rasgos[j]) < 0.02)))))}
        ${grupo('Ajuste fino', slider('genero', 'Rasgos', p.genero, { min: 0, max: 1, extremos: ['Femeninos', 'Masculinos'] }), false)}`;
      case 'cuerpo': return `
        <h3>Cuerpo <span class="cr-dato" data-altura>${alturaTexto()}</span></h3>
        ${slider('altura', 'Altura', p.altura, { min: 0, max: 1, extremos: ['Baja', 'Alta'] })}
        ${slider('musculo', 'Musculatura', p.musculo, { min: 0, max: 1, extremos: ['Poca', 'Mucha'] })}
        ${slider('grasa', 'Grasa corporal', p.grasa, { min: 0, max: 1, extremos: ['Poca', 'Mucha'] })}
        ${slider('proporciones', 'Proporciones', p.proporciones, { min: 0, max: 1, extremos: ['Singulares', 'Clásicas'] })}
        ${p.genero < 0.5 ? slider('pecho', 'Pecho', p.pecho, { min: 0, max: 1, extremos: ['Menos', 'Más'] }) : ''}
        ${grupo('Ajuste por zonas', CONTROLES_CUERPO.map(([k, n]) => slider(`forma.${k}`, n, p.forma[k] ?? 0)).join(''), false)}`;
      case 'rostro': return `
        ${sub('rostro', [['rostro', 'Rostro'], ['piel', 'Piel y ojos']], subRostro)}
        ${subRostro === 'rostro' ? `
          ${grupo('Forma de la cabeza', chips('rostro.forma', FORMAS_CABEZA, p.rostro.forma || '') + (p.rostro.forma ? slider('rostro.formaPeso', 'Intensidad', p.rostro.formaPeso, { min: 0, max: 1 }) : ''))}
          ${CONTROLES_ROSTRO.map(([g, l], i) => grupo(g, l.map(([k, n]) => slider(`rostro.${k}`, n, p.rostro[k] ?? 0)).join(''), i < 2)).join('')}` : `
          <h3>Tono de piel</h3>
          ${muestras('tono', TONOS_PIEL.map(t => [t.id, t.nombre, t.muestra]), p.tono, true)}
          <h3>Color de ojos</h3>
          ${muestras('ojos', COLORES_OJOS, p.ojos, true)}`}`;
      case 'pelo': return `
        <h3>Peinado</h3>
        ${tarjetas('pelo.estilo', PELOS, p.pelo.estilo, v => `pelo-${v}`)}
        <h3>Color del pelo</h3>
        ${muestras('pelo.color', COLORES_PELO, p.pelo.color)}
        ${grupo('Cejas', chips('cejas', CEJAS, p.cejas))}
        ${grupo('Barba y bigote', tarjetas('barba.estilo', BARBAS, p.barba.estilo, v => `barba-${v}`) + (p.barba.estilo !== 'ninguna' ? `<p class="cr-etiqueta">Color</p>${muestras('barba.color', COLORES_PELO.slice(0, 9), p.barba.color)}` : ''), p.genero >= 0.5)}`;
      case 'ropa': {
        const ranuras = [['arriba', 'Arriba'], ['abajo', 'Abajo'], ['conjunto', 'Conjuntos'], ['calzado', 'Calzado'], ['sombrero', 'Accesorios']];
        const r = subRopa;
        const lista = r === 'conjunto' ? [['', 'Ninguno'], ...PRENDAS.conjunto] : PRENDAS[r];
        const actual = p.ropa[r] || '';
        const conColor = r !== 'conjunto' ? (r === 'arriba' || r === 'abajo' ? !p.ropa.conjunto : !!actual) : !!actual;
        return `
          ${sub('ropa', ranuras, r)}
          ${tarjetas(`ropa.${r}`, lista, actual, v => (v ? `ropa-${v}` : ''))}
          ${conColor ? `<h3>Color</h3>${muestras(`ropa.colores.${r}`, PALETA_ROPA, p.ropa.colores?.[r] ?? null, true)}` : ''}
          ${r !== 'conjunto' && p.ropa.conjunto && (r === 'arriba' || r === 'abajo') ? '<p class="cr-ayuda">Llevas un conjunto: elige una prenda para cambiarlo por piezas sueltas.</p>' : ''}`;
      }
      case 'guardar': return `
        <h3>${primeraVez ? 'Tu avatar está listo' : 'Guardar cambios'}</h3>
        <p class="cr-ayuda">Aparecerá en tu Inicio, corriendo dentro de la rueda. Puedes probar sus animaciones abajo antes de guardar.</p>
        <p class="cr-ayuda">Se guarda en tu cuenta y solo tú puedes cambiarlo.</p>
        <button class="btn primario cr-grande" data-guardar>Guardar avatar</button>`;
    }
    return '';
  }

  function pintarPanel() {
    const scroll = panel.scrollTop;
    const abiertos = [...panel.querySelectorAll('details')].map(d => d.open);
    const mismoPaso = panel.dataset.paso === `${paso}${subRostro}${subRopa}`;
    panel.innerHTML = htmlPaso();
    if (mismoPaso) {
      panel.querySelectorAll('details').forEach((d, i) => { if (abiertos[i] !== undefined) d.open = abiertos[i]; });
      panel.scrollTop = scroll;
    } else panel.scrollTop = 0;
    panel.dataset.paso = `${paso}${subRostro}${subRopa}`;
    panel.querySelectorAll('input[type=range]').forEach(rellenoSlider);
    raiz.querySelectorAll('[data-paso]').forEach(b => {
      const i = +b.dataset.paso;
      b.classList.toggle('activo', i === paso);
      b.setAttribute('aria-current', i === paso ? 'step' : 'false');
    });
    raiz.querySelector('.cr-pasos .activo')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    raiz.querySelectorAll('.cr-progreso i').forEach((el, i) => el.classList.toggle('hecho', i <= paso));
    $('.cr-paso').textContent = `Paso ${paso + 1} de ${PASOS.length} · ${PASOS[paso].nombre}`;
    $('[data-atras]').disabled = paso === 0;
    $('[data-siguiente]').textContent = paso === PASOS.length - 1 ? 'Guardar avatar' : 'Siguiente';
    estadoBotones();
  }

  // Escribe un valor en el perfil a partir de una ruta "a.b.c"
  function poner(ruta, valor) {
    const partes = ruta.split('.');
    let o = perfil;
    for (const k of partes.slice(0, -1)) o = o[k] ??= {};
    o[partes.at(-1)] = valor;
  }

  function rellenoSlider(el) { el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`); }
  panel.addEventListener('input', ev => {
    const el = ev.target;
    if (el.type !== 'range') return;
    rellenoSlider(el);
    poner(el.dataset.k, +el.value);
    refrescar();
  });
  panel.addEventListener('change', ev => { if (ev.target.type === 'range') confirmar(); });
  // Doble clic en un deslizador: vuelve a su valor neutro
  panel.addEventListener('dblclick', ev => {
    const el = ev.target.closest('input[type=range]');
    if (!el) return;
    el.value = +el.min < 0 ? 0 : 0.5;
    rellenoSlider(el);
    poner(el.dataset.k, +el.value);
    refrescar(); confirmar();
  });

  panel.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.sub) {
      if (b.dataset.sub === 'rostro') subRostro = b.dataset.v; else subRopa = b.dataset.v;
      pintarPanel(); verPaso();
      return;
    }
    if (b.dataset.base) {
      const base = structuredClone(PERFILES[b.dataset.base]);
      perfil = normalizar({ ...base, tono: perfil.tono, ojos: perfil.ojos });
    } else if (b.dataset.k === 'rasgosIdx') {
      perfil.rasgos = [...RASGOS[+b.dataset.v][1]];
    } else if (b.dataset.k) {
      const k = b.dataset.k, v = b.dataset.v;
      if (k.startsWith('ropa.colores.')) poner(k, v || null);
      else poner(k, v);
      if (k === 'ropa.conjunto' && v) { /* el conjunto sustituye a arriba y abajo */ }
      if ((k === 'ropa.arriba' || k === 'ropa.abajo') && perfil.ropa.conjunto) {
        perfil.ropa.conjunto = '';
        perfil.ropa.arriba ||= PERFILES.hombre.ropa.arriba;
        perfil.ropa.abajo ||= PERFILES.hombre.ropa.abajo;
      }
      if (k === 'pelo.color' && perfil.barba) perfil.barba.color = v;
    } else return;
    perfil = normalizar(perfil);
    refrescar(); confirmar(); pintarPanel();
    if (b.dataset.k === 'barba.estilo' || b.dataset.k === 'cejas') { focoActual = 'cara'; enfocar(false); }
  });

  // ---------- Barra superior, pasos y escena ----------
  function irPaso(i) {
    paso = THREE.MathUtils.clamp(i, 0, PASOS.length - 1);
    pintarPanel(); verPaso();
    if (PASOS[paso].id === 'guardar') anim?.gesto('saludar');
  }
  async function guardar() {
    guardarPerfil(perfil);
    guardado = true;
    window.dispatchEvent(new CustomEvent('avatar-cambiado', { detail: perfil }));
    alGuardar?.(perfil);
    anim?.gesto('megusta');
    raiz.classList.add('guardado');
    setTimeout(() => cerrar(), 650);
  }
  const hayCambios = () => !guardado && JSON.stringify(perfil) !== JSON.stringify(inicial);
  function pedirCerrar() {
    if (hayCambios()) { $('.cr-confirmar').hidden = false; $('[data-seguir]').focus(); return; }
    cerrar();
  }

  raiz.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b || (panel.contains(b) && b.dataset.guardar === undefined)) return;
    if (b.dataset.cancelar !== undefined) return pedirCerrar();
    if (b.dataset.seguir !== undefined) { $('.cr-confirmar').hidden = true; return; }
    if (b.dataset.salir !== undefined) return cerrar();
    if (b.dataset.guardar !== undefined) return guardar();
    if (b.dataset.deshacer !== undefined) return irHist(-1);
    if (b.dataset.rehacer !== undefined) return irHist(1);
    if (b.dataset.reset !== undefined) {
      perfil = structuredClone(inicial); refrescar(); confirmar(); pintarPanel(); return;
    }
    if (b.dataset.paso !== undefined) return irPaso(+b.dataset.paso);
    if (b.dataset.atras !== undefined) return irPaso(paso - 1);
    if (b.dataset.siguiente !== undefined) return paso === PASOS.length - 1 ? guardar() : irPaso(paso + 1);
    if (b.dataset.vista !== undefined) return vista(+b.dataset.vista);
    if (b.dataset.zoom !== undefined) { zoom = THREE.MathUtils.clamp(zoom + +b.dataset.zoom * 0.6, -3, 3); enfocar(false); return; }
    if (b.dataset.anim) {
      raiz.querySelectorAll('[data-anim]').forEach(x => x.classList.toggle('activo', x === b && ['idle', 'walk', 'run'].includes(b.dataset.anim)));
      if (['idle', 'walk', 'run'].includes(b.dataset.anim)) anim?.estado(b.dataset.anim);
      else { anim?.gesto(b.dataset.anim); raiz.querySelector('[data-anim="idle"]').classList.add('activo'); anim?.estado('idle'); }
    }
  });

  function teclas(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); if (!$('.cr-confirmar').hidden) $('.cr-confirmar').hidden = true; else pedirCerrar(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); irHist(ev.shiftKey ? 1 : -1); }
  }
  addEventListener('keydown', teclas);

  function cerrar() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener('keydown', teclas);
    raiz.classList.add('saliendo');
    setTimeout(() => {
      avatar?.destruir(); anim?.destruir();
      pmrem.dispose(); renderer.dispose();
      raiz.remove();
      document.body.classList.remove('con-creador');
    }, 320);
    abierto = null;
  }

  pintarPanel();
  verPaso();
  $('[data-paso="0"]').focus({ preventScroll: true });
  abierto = { cerrar };
  return abierto;
}
