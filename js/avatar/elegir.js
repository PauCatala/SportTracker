// "Tu avatar": elige entre los avatares de SYNCO (Él, Ella) o sube el tuyo de Avaturn.
// Vista previa 3D con la misma luz que la rueda: arrastra para girarlo y prueba la carrera.
import * as THREE from 'three';
import { cargador } from '../marca-anim.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AVATARES, eleccionAvatar, modeloPropio, elegirAvatar, cargarAvatarRealista, TONOS_PIEL, COLORES_PELO, ajustesAvatar, guardarAjustes, aplicarAjustes, ALTURA, COLORES_ROPA, GORROS } from './avaturn.js';
import { abrirEscaner } from './escaner.js';
import { leer } from '../almacen.js';

const ICO = {
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  cara: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="11" r="3.2"/><path d="M7.5 17.2c1.1-1.6 2.7-2.4 4.5-2.4s3.4.8 4.5 2.4"/>',
  subir: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  camara: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.4"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const MAX_MB = 40;

let abierto = null;
export function abrirPersonalizacion({ escanear: vieneAEscanear = false } = {}) {
  if (abierto) return abierto;
  const inicial = eleccionAvatar().eleccion;
  const ajustesIniciales = ajustesAvatar();
  let elegido = vieneAEscanear ? 'propio' : inicial, propioNuevo = null, modo = 'idle', hayGuardado = false, ajustes = { ...ajustesIniciales };
  const CLAVES = ['piel', 'pelo', 'altura', 'complexion', 'camiseta', 'pantalon', 'zapatos', 'gorro', 'gorroColor'];
  const cambiaronAjustes = () => CLAVES.some(k => String(ajustes[k] ?? '') !== String(ajustesIniciales[k] ?? ''));
  const alturaPerfil = Number(leer('perfil', null)?.altura) || ALTURA.base;
  const alturaDe = a => THREE.MathUtils.clamp(Number(a.altura) || alturaPerfil, ALTURA.min, ALTURA.max);
  const textoComplexion = c => (c <= -0.6 ? 'Delgada' : c < -0.2 ? 'Fina' : c <= 0.2 ? 'Media' : c < 0.6 ? 'Atlética' : 'Fuerte');
  const muestras = (tipo, lista, nombre) => `<div class="ta-muestras" role="radiogroup" aria-label="${nombre}">${lista.map(([c, n]) =>
    `<button type="button" role="radio" data-ajuste="${tipo}|${c}" title="${n}" aria-label="${n}" class="${c ? '' : 'original'}" style="${c ? `--c:${c}` : ''}"></button>`).join('')}</div>`;
  const fila = (titulo, html) => `<div class="ta-fila"><span>${titulo}</span>${html}</div>`;

  const raiz = document.createElement('div');
  raiz.className = 'ta entrando';
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-label', 'Tu avatar');
  raiz.innerHTML = `
    <header class="ta-cab">
      <div><h2>Tu avatar</h2><p>Te acompaña en el Inicio, corriendo por tu día.</p></div>
      <button class="ta-icono" data-cerrar aria-label="Cerrar">${ico('cerrar')}</button>
    </header>
    <div class="ta-escenario">
      <canvas aria-label="Vista previa del avatar. Arrastra para girarlo."></canvas>
      <div class="ta-cargando" hidden>${cargador('Cargando avatar…')}</div>
      <div class="segmento-suave ta-modo" role="tablist" aria-label="Movimiento">
        <button class="activo" data-modo="idle" role="tab" aria-selected="true">Reposo</button>
        <button data-modo="run" role="tab" aria-selected="false">Correr</button>
      </div>
      <small class="ta-pista">Arrastra para girarlo</small>
    </div>
    <div class="ta-panel">
      <div class="segmento-suave ta-pestanas" role="tablist" aria-label="Personalizar">
        <button class="activo" data-pestana="avatar" role="tab" aria-selected="true">Avatar</button>
        <button data-pestana="cuerpo" role="tab" aria-selected="false">Cuerpo</button>
        <button data-pestana="ropa" role="tab" aria-selected="false">Ropa</button>
      </div>
      <div class="ta-hoja" data-hoja="avatar">
        <div class="ta-opciones" role="radiogroup" aria-label="Elige tu avatar">
          ${Object.entries(AVATARES).map(([k, a]) => `
            <button class="ta-opcion" role="radio" data-elegir="${k}"><span class="ta-retrato" data-retrato="${k}"></span><b>${a.nombre}</b></button>`).join('')}
          <button class="ta-opcion" role="radio" data-elegir="propio"><span class="ta-retrato" data-retrato="propio">${ico('cara')}</span><b>Con tu cara</b></button>
        </div>
        <div class="ta-propio" hidden>
          <h3>${ico('cara')}Tu avatar, con tu cara</h3>
          <p>Hazte tres fotos (de frente y de cada lado) y en un minuto tendrás un avatar que se te parece de verdad. Después podrás cambiarle el cuerpo y la ropa.</p>
          <button class="btn primario ta-escanear" data-escanear>${ico('camara')}<span>Escanear mi cara</span></button>
          <label class="ta-subir-enlace">o sube un avatar <i>.glb</i> de Avaturn<input type="file" accept=".glb,model/gltf-binary" hidden></label>
          <p class="ta-error" role="alert" hidden></p>
        </div>
      </div>
      <div class="ta-hoja" data-hoja="cuerpo" hidden>
        <label class="ta-rango"><span>Altura <b data-valor="altura"></b></span>
          <input type="range" data-rango="altura" min="${ALTURA.min}" max="${ALTURA.max}" step="1"></label>
        <label class="ta-rango"><span>Complexión <b data-valor="complexion"></b></span>
          <input type="range" data-rango="complexion" min="-100" max="100" step="5"><small><i>Delgada</i><i>Fuerte</i></small></label>
        ${fila('Piel', muestras('piel', TONOS_PIEL, 'Tono de piel'))}
        ${fila('Pelo', muestras('pelo', COLORES_PELO, 'Color de pelo'))}
      </div>
      <div class="ta-hoja" data-hoja="ropa" hidden>
        ${fila('Camiseta', muestras('camiseta', COLORES_ROPA, 'Color de la camiseta'))}
        ${fila('Pantalón', muestras('pantalon', COLORES_ROPA, 'Color del pantalón'))}
        ${fila('Calzado', muestras('zapatos', COLORES_ROPA, 'Color del calzado'))}
        ${fila('Gorro', `<div class="ta-gorros" role="radiogroup" aria-label="Gorro">${GORROS.map(([k, n]) => `<button type="button" role="radio" data-ajuste="gorro|${k}">${n}</button>`).join('')}</div>`)}
        <div class="ta-fila ta-gorro-color" hidden><span></span>${muestras('gorroColor', COLORES_ROPA.slice(1), 'Color del gorro')}</div>
      </div>
      <button class="btn primario ta-usar" data-usar disabled>Usar este avatar</button>
    </div>`;
  document.body.append(raiz);
  document.body.classList.add('con-creador');
  requestAnimationFrame(() => raiz.classList.remove('entrando'));

  // ---------- Escena ----------
  const lienzo = raiz.querySelector('canvas');
  const r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const esc = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(r);
  esc.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  esc.add(new THREE.HemisphereLight(0xffffff, 0xd9dde3, 0.5));
  const clave = new THREE.DirectionalLight(0xfff4ea, 1.7); clave.position.set(1.6, 3.2, 2.6); clave.castShadow = true;
  clave.shadow.mapSize.set(1024, 1024); clave.shadow.radius = 6; clave.shadow.bias = -0.0004;
  Object.assign(clave.shadow.camera, { left: -1.2, right: 1.2, top: 2.2, bottom: -0.2, near: 0.5, far: 8 });
  esc.add(clave);
  const contra = new THREE.DirectionalLight(0xdfe8ff, 1.1); contra.position.set(-2, 2.6, -2.4); esc.add(contra);
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.16 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; esc.add(suelo);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  const soporte = new THREE.Group(); esc.add(soporte);

  const cache = {};            // eleccion -> avatar cargado (o promesa)
  let actual = null, giro = -0.35, girando = false, inercia = 0, vivo = true;
  const cargando = raiz.querySelector('.ta-cargando');

  async function cargar(k, fuente) {
    if (!cache[k]) cache[k] = (async () => {
      const av = await cargarAvatarRealista(fuente ?? (k === 'propio' ? await modeloPropio() : AVATARES[k].url), { ajustes });
      av.objeto.scale.setScalar(1.8 / av.altura);
      return av;
    })();
    return cache[k];
  }
  async function mostrar(k, forzar = false) {
    cargando.hidden = false;
    try {
      const av = await cargar(k, k === 'propio' ? propioNuevo : undefined);
      if (!vivo || (!forzar && elegido !== k)) return;
      if (actual) soporte.remove(actual.objeto);
      actual = av; soporte.add(av.objeto); av.estado(modo);
    } catch (e) {
      delete cache[k];
      console.warn('Vista previa del avatar', e);
      if (k === 'propio') error('No se ha podido abrir ese archivo. Comprueba que es el .glb descargado de Avaturn.');
    } finally { cargando.hidden = true; }
  }

  // Retratos de las tarjetas, hechos con la misma escena
  async function retrato(k) {
    const caja = raiz.querySelector(`[data-retrato="${k}"]`);
    try {
      const av = await cargar(k, k === 'propio' ? propioNuevo : undefined);
      const t = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      t.setSize(160, 160); t.outputColorSpace = THREE.SRGBColorSpace; t.toneMapping = THREE.ACESFilmicToneMapping;
      const e2 = new THREE.Scene(); e2.environment = esc.environment;
      e2.add(clave.clone(), contra.clone(), new THREE.HemisphereLight(0xffffff, 0xd9dde3, 0.5));
      const copia = av.objeto.parent; e2.add(av.objeto); av.fijar('idle', 0.4);
      const c2 = new THREE.PerspectiveCamera(24, 1, 0.05, 10); c2.position.set(0.22, 1.66, 0.95); c2.lookAt(0, 1.58, 0);
      t.render(e2, c2);
      caja.style.backgroundImage = `url(${t.domElement.toDataURL('image/png')})`;
      caja.classList.add('con-foto'); caja.innerHTML = '';
      t.dispose();
      if (copia) copia.add(av.objeto); else e2.remove(av.objeto);
      av.estado(modo);
    } catch (e) { console.warn('Retrato', e); }
  }

  function medir() {
    const { width: w, height: h } = lienzo.getBoundingClientRect();
    if (!w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h;
    // Que quepa entero con aire arriba y abajo
    // Alto visible de 2,5 m centrado algo por debajo de la cintura: los pies quedan por encima de los controles
    const d = 1.25 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(1, 0.62 / cam.aspect);
    cam.position.set(0, 0.95, d); cam.lookAt(0, 0.78, 0); cam.updateProjectionMatrix();
  }
  const obs = new ResizeObserver(medir); obs.observe(lienzo); medir();

  const reloj = new THREE.Clock();
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function bucle() {
    if (!vivo) return;
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (!girando) { giro += inercia * dt; inercia *= Math.pow(0.04, dt); if (!reducido && Math.abs(inercia) < 0.02) giro += dt * 0.12; }
    soporte.rotation.y = giro;
    actual?.actualizar(dt);
    r.render(esc, cam);
    requestAnimationFrame(bucle);
  })();

  // Arrastrar para girar
  let x0 = 0, t0 = 0;
  lienzo.addEventListener('pointerdown', e => { girando = true; x0 = e.clientX; t0 = performance.now(); inercia = 0; lienzo.setPointerCapture(e.pointerId); });
  lienzo.addEventListener('pointermove', e => {
    if (!girando) return;
    const dx = e.clientX - x0, ahora = performance.now();
    giro += dx * 0.012; inercia = (dx * 0.012) / Math.max(0.016, (ahora - t0) / 1000);
    x0 = e.clientX; t0 = ahora;
  });
  const soltar = () => { girando = false; inercia = THREE.MathUtils.clamp(inercia, -6, 6); };
  lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);

  // ---------- Interfaz ----------
  const usar = raiz.querySelector('[data-usar]');
  const panelPropio = raiz.querySelector('.ta-propio');
  const msgError = raiz.querySelector('.ta-error');
  function error(t) { msgError.textContent = t; msgError.hidden = !t; }
  function marcar() {
    raiz.querySelectorAll('[data-elegir]').forEach(b => { const si = b.dataset.elegir === elegido; b.classList.toggle('activo', si); b.setAttribute('aria-checked', String(si)); });
    panelPropio.hidden = elegido !== 'propio';
    const hayPropio = !!propioNuevo || !!cache.propio || hayGuardado;
    const sinCambios = elegido === inicial && !propioNuevo && !cambiaronAjustes();
    usar.disabled = sinCambios || (elegido === 'propio' && !hayPropio);
    usar.textContent = sinCambios ? 'Es tu avatar actual' : elegido === inicial && !propioNuevo ? 'Guardar cambios' : 'Usar este avatar';
    raiz.querySelectorAll('[data-ajuste]').forEach(x => {
      const [t, c] = x.dataset.ajuste.split('|');
      const actualT = ajustes[t] || '';
      const si = actualT === c; x.classList.toggle('activo', si); x.setAttribute('aria-checked', String(si));
    });
    const alt = alturaDe(ajustes), comp = Math.round((Number(ajustes.complexion) || 0) * 100);
    raiz.querySelector('[data-rango="altura"]').value = alt;
    raiz.querySelector('[data-rango="complexion"]').value = comp;
    raiz.querySelector('[data-valor="altura"]').textContent = `${alt} cm`;
    raiz.querySelector('[data-valor="complexion"]').textContent = textoComplexion(comp / 100);
    raiz.querySelector('.ta-gorro-color').hidden = !ajustes.gorro;
  }
  // Cambia un ajuste y se ve al momento en el avatar
  function ajustar(cambio) {
    ajustes = { ...ajustes, ...cambio };
    for (const p of Object.values(cache)) p.then?.(av => av && aplicarAjustes(av, ajustes)).catch?.(() => {});
    marcar();
  }
  raiz.addEventListener('input', e => {
    const r = e.target.closest('[data-rango]'); if (!r) return;
    ajustar(r.dataset.rango === 'altura' ? { altura: Number(r.value) } : { complexion: Number(r.value) / 100 });
  });

  raiz.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-cerrar]')) return cerrar();
    if (b.dataset.modo) {
      modo = b.dataset.modo; actual?.estado(modo);
      raiz.querySelectorAll('[data-modo]').forEach(x => { x.classList.toggle('activo', x === b); x.setAttribute('aria-selected', String(x === b)); });
      return;
    }
    if (b.dataset.ajuste) {
      const [t, c] = b.dataset.ajuste.split('|');
      ajustar({ [t]: c });
      return;
    }
    if (b.dataset.pestana) {
      raiz.querySelectorAll('[data-pestana]').forEach(x => { x.classList.toggle('activo', x === b); x.setAttribute('aria-selected', String(x === b)); });
      raiz.querySelectorAll('[data-hoja]').forEach(h => { h.hidden = h.dataset.hoja !== b.dataset.pestana; });
      return;
    }
    if (b.matches('[data-escanear]')) return escanear();
    if (b.dataset.elegir) {
      elegido = b.dataset.elegir; error(''); marcar();
      if (elegido !== 'propio' || propioNuevo || cache.propio || hayGuardado) mostrar(elegido);
      return;
    }
    if (b.matches('[data-usar]')) {
      usar.disabled = true; usar.textContent = 'Guardando…';
      try {
        if (cambiaronAjustes()) guardarAjustes(ajustes);
        if (elegido !== inicial || propioNuevo) await elegirAvatar(elegido, elegido === 'propio' ? propioNuevo : null);
        cerrar();
      } catch (err) { console.warn(err); usar.disabled = false; usar.textContent = 'Usar este avatar'; error('No se ha podido guardar. Inténtalo de nuevo.'); }
    }
  });

  // Un avatar nuevo con tu cara (escaneado aquí mismo o subido como .glb)
  async function usarArchivo(blob) {
    error('');
    const previo = cache.propio; delete cache.propio;
    propioNuevo = blob;
    try {
      await cargar('propio', blob);
      if (previo) (await previo.catch(() => null))?.destruir();
      elegido = 'propio'; marcar(); await mostrar('propio'); retrato('propio');
      return true;
    } catch (err) {
      console.warn(err); propioNuevo = null; delete cache.propio; if (previo) cache.propio = previo;
      error('No se ha podido abrir ese avatar. Vuelve a intentarlo.');
      marcar();
      return false;
    }
  }
  function escanear() {
    error('');
    abrirEscaner({
      alTerminar: async blob => {
        cargando.hidden = false;
        const ok = await usarArchivo(blob);
        if (ok) { usar.focus(); }
      },
      alFallar: msg => error(msg),
    });
  }
  raiz.querySelector('input[type=file]').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/\.glb$/i.test(f.name)) return error('Sube un archivo .glb de Avaturn.');
    if (f.size > MAX_MB * 1024 * 1024) return error(`El archivo pesa demasiado (máximo ${MAX_MB} MB).`);
    usarArchivo(f);
  });

  const teclas = ev => { if (ev.key === 'Escape') cerrar(); };
  addEventListener('keydown', teclas);

  function cerrar() {
    if (!vivo) return;
    vivo = false;
    raiz.classList.add('saliendo');
    removeEventListener('keydown', teclas); obs.disconnect();
    setTimeout(async () => {
      for (const p of Object.values(cache)) (await p.catch(() => null))?.destruir();
      pmrem.dispose(); r.dispose(); raiz.remove(); document.body.classList.remove('con-creador');
    }, 300);
    abierto = null;
  }

  // Arranque: el avatar actual, y los retratos de las opciones
  marcar();
  (async () => {
    hayGuardado = !!(await modeloPropio().catch(() => null));
    if (inicial === 'propio' && !hayGuardado) elegido = 'hombre';
    marcar();
    // Si vienes a escanear tu cara y aún no tienes avatar propio, de fondo se ve el actual
    if (elegido === 'propio' && !hayGuardado) { mostrar(inicial === 'propio' ? 'hombre' : inicial, true); if (vieneAEscanear) setTimeout(() => raiz.querySelector('[data-escanear]')?.click(), 350); }
    else await mostrar(elegido);
    for (const k of [...Object.keys(AVATARES), ...(hayGuardado ? ['propio'] : [])]) await retrato(k);
    marcar();
  })();

  abierto = { cerrar };
  return abierto;
}
