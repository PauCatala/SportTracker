// INTROS: pequeñas películas que se ven al entrar en un apartado, antes de mostrar su contenido.
//  - Nutrición: un salero echa sal sobre un filete; la cámara vuela como un dron hasta debajo
//    del salero, sigue un grano de sal… y "pum": aparece la pantalla de Nutrición.
//  - Running: tu zapatilla (o una genérica) se inclina 45°, tiembla, aparece una pierna
//    y sale corriendo hacia la izquierda: aparece tu semana de running.
//  - Gimnasio: una persona extiende el brazo, le llega volando una mancuerna, hace una sentadilla y sale de un salto.
//  - Flexibilidad: un esqueleto se toca los pies, se abre de piernas contra el suelo y se desmonta.
// Se pueden saltar tocándolas y no se reproducen si el sistema pide reducir el movimiento.
import { leer, guardar } from './almacen.js';

const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const espera = ms => new Promise(r => setTimeout(r, ms));

// Prepara el contenedor: la intro arriba y el contenido oculto hasta que termine
function montar(cont, clase, html) {
  const intro = document.createElement('div');
  intro.className = `intro-anim ${clase}`;
  intro.setAttribute('role', 'img');
  intro.innerHTML = `${html}<button class="intro-saltar">Saltar</button>`;
  cont.prepend(intro);
  cont.classList.add('con-intro');
  let saltar;
  const saltada = new Promise(r => { saltar = r; });
  intro.addEventListener('click', () => saltar('saltar'));
  return { intro, saltada };
}

// Cierra la intro: se pliega y el contenido aparece
async function cerrar(cont, intro) {
  intro.style.height = `${intro.offsetHeight}px`;
  intro.getBoundingClientRect();
  intro.classList.add('cerrando');
  intro.style.height = '0px';
  cont.classList.remove('con-intro');
  await espera(450);
  intro.remove();
}

// Ejecuta los pasos de la animación; si el usuario la salta, se corta en el acto
async function reproducir(pasos, saltada) {
  for (const paso of pasos) {
    const r = await Promise.race([paso(), saltada]);
    if (r === 'saltar') return;
  }
}

/* ============================== NUTRICIÓN ============================== */
const ESCENA_SAL = `
  <div class="escena-sal">
    <div class="camara-sal">
      <svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="g-cristal" x1="0" x2="1"><stop offset="0" stop-color="#E9EEF8"/><stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D6DDEA"/></linearGradient>
          <linearGradient id="g-tapa" x1="0" x2="1"><stop offset="0" stop-color="#8E9197"/><stop offset=".5" stop-color="#E4E6E9"/><stop offset="1" stop-color="#A7AAB0"/></linearGradient>
          <radialGradient id="g-carne" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#C86A5C"/><stop offset="1" stop-color="#8E3B33"/></radialGradient>
        </defs>
        <!-- Tabla -->
        <ellipse cx="360" cy="262" rx="270" ry="38" fill="#E6E7EA"/>
        <ellipse cx="360" cy="252" rx="270" ry="38" fill="#F3F4F6"/>
        <!-- Filete con vetas de grasa -->
        <path d="M200 238c-10-38 26-62 74-66 40-4 70-22 110-20 54 2 96 26 98 58 2 30-36 44-96 46-60 2-176 10-186-18z" fill="url(#g-carne)"/>
        <path d="M232 222c34-6 58-18 96-16M300 240c36-4 80-6 120-18M372 196c22 4 40 12 56 26" stroke="#F1D3CB" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>
        <!-- Sal ya caída sobre la carne -->
        <g fill="#fff" class="sal-posada">${Array.from({ length: 26 }, (_, i) => `<rect x="${300 + ((i * 37) % 140)}" y="${206 + ((i * 23) % 34)}" width="3.4" height="3.4" rx=".8" transform="rotate(${i * 17} ${302 + ((i * 37) % 140)} ${208 + ((i * 23) % 34)})"/>`).join('')}</g>
        <!-- Salero (inclinado, sacudiéndose) -->
        <g class="salero">
          <rect x="-34" y="-120" width="68" height="104" rx="18" fill="url(#g-cristal)" stroke="#C9D0DE" stroke-width="2"/>
          <rect x="-28" y="-62" width="56" height="40" rx="10" fill="#FFFFFF" opacity=".9"/>
          <path d="M-36 -16h72v14c0 10-8 18-18 18h-36c-10 0-18-8-18-18z" fill="url(#g-tapa)"/>
          <g fill="#5B6380">${[-14, 0, 14, -7, 7].map((x, i) => `<circle cx="${x}" cy="${i < 3 ? 6 : 11}" r="2.2"/>`).join('')}</g>
        </g>
        <!-- Granos cayendo -->
        <g class="granos" fill="#fff" stroke="#D5DAE6" stroke-width=".8">
          ${Array.from({ length: 16 }, (_, i) => `<rect class="grano" width="4.5" height="4.5" rx="1" style="--x:${(i % 5) * 7 - 14}px; --d:${(i * 0.13) % 1.1}s; --g:${(i * 47) % 360}deg"/>`).join('')}
        </g>
      </svg>
    </div>
    <div class="grano-cerca" aria-hidden="true"></div>
    <div class="destello" aria-hidden="true"></div>
  </div>`;

export async function introNutricion(cont) {
  if (sinMovimiento()) return;
  const { intro, saltada } = montar(cont, 'intro-nutri', ESCENA_SAL);
  const camara = intro.querySelector('.camara-sal');
  const grano = intro.querySelector('.grano-cerca');
  const destello = intro.querySelector('.destello');
  const anim = (el, frames, ops) => el.animate(frames, { fill: 'forwards', easing: 'cubic-bezier(.45, 0, .2, 1)', ...ops }).finished;

  await reproducir([
    // 1. Plano general: se ve cómo cae la sal sobre la carne (en tercera persona)
    () => espera(1100),
    // 2. La cámara vuela como un dron hasta debajo del salero, mirando los agujeros
    () => anim(camara, [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      { transform: 'translate(-12%, 34%) scale(3.4) rotate(-6deg)' },
    ], { duration: 1300 }),
    // 3. Sigue a un grano que cae hacia ella…
    () => anim(grano, [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(40deg)', offset: 0.35 },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(14) rotate(110deg)' },
    ], { duration: 900, easing: 'cubic-bezier(.6, 0, .9, .4)' }),
    // 4. …y "pum": destello blanco
    () => anim(destello, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 }),
  ], saltada);

  await cerrar(cont, intro);
}

/* ============================== RUNNING ============================== */
// Zapatilla genérica (diseño propio), de perfil y con la punta hacia la izquierda
const ZAPATILLA_GENERICA = `
  <g class="zapatilla-svg">
    <path d="M52 168c-10 0-16-8-12-16l6-10h214c10 0 16 8 14 16l-2 4c-2 4-6 6-10 6z" fill="#FFFFFF" stroke="#B4B6BA" stroke-width="3"/>
    <path d="M46 142c4-14 20-22 40-24l52-6c12-1 22-8 30-18l12-14c6-6 16-8 24-4l30 14c8 4 14 12 16 20l8 32z" fill="#1F4FD1"/>
    <path d="M178 82l28 12c6 3 10 8 10 14v6l-36-6z" fill="#0C3084"/>
    <path d="M96 128l34-16M108 136l34-16M120 144l34-16" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
    <path d="M60 150h200" stroke="#C9D7FF" stroke-width="4"/>
    <path d="M232 104c10 4 22 16 26 38" stroke="#5B7FE6" stroke-width="6" stroke-linecap="round" fill="none"/>
  </g>`;

const escenaRun = foto => `
  <div class="escena-run">
    <div class="lineas-vel" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="corredor">
      <svg viewBox="0 0 300 200" aria-hidden="true">
        <!-- Pierna: sale de la boca de la zapatilla -->
        <g class="pierna">
          <path d="M196 96c-6-40-4-90 6-150l40 4c4 52 2 104-10 146z" fill="#0E1A3F"/>
          <path d="M198 92c10-6 24-6 34 2" stroke="#0E1A3F" stroke-width="10" stroke-linecap="round"/>
        </g>
        ${foto ? `<image class="zapatilla-foto" href="${foto}" x="30" y="60" width="250" height="120" preserveAspectRatio="xMidYMid meet"/>` : ZAPATILLA_GENERICA}
      </svg>
    </div>
  </div>`;

export async function introRunning(cont) {
  if (sinMovimiento()) return;
  const ajustes = leer('zapatilla', null);
  const { intro, saltada } = montar(cont, 'intro-run', escenaRun(ajustes?.foto));
  const corredor = intro.querySelector('.corredor');
  const pierna = intro.querySelector('.pierna');
  const lineas = intro.querySelector('.lineas-vel');
  if (ajustes?.girar) corredor.querySelector('.zapatilla-foto')?.setAttribute('transform', 'translate(310 0) scale(-1 1)');
  const anim = (el, frames, ops) => el.animate(frames, { fill: 'forwards', easing: 'cubic-bezier(.45, 0, .2, 1)', ...ops }).finished;

  await reproducir([
    // 1. La zapatilla, quieta, sin nadie dentro
    () => espera(700),
    // 2. Se inclina 45°: punta abajo a la izquierda, talón arriba a la derecha
    () => anim(corredor, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-45deg)' }], { duration: 650 }),
    // 3. Tiembla… y aparece una pierna dentro
    () => Promise.all([
      anim(corredor, [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ transform: `rotate(${-45 + (i % 2 ? 2.5 : -2.5)}deg) translate(${i % 2 ? 2 : -2}px, ${i % 3 ? -1 : 1}px)` })).concat({ transform: 'rotate(-45deg)' }), { duration: 520, easing: 'linear' }),
      anim(pierna, [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 460, delay: 120, easing: 'cubic-bezier(.2, .8, .2, 1)' }),
    ]),
    // 4. ¡Arranca a correr hacia la izquierda y desaparece!
    () => Promise.all([
      anim(lineas, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 700 }),
      anim(corredor, [
        { transform: 'rotate(-45deg) translate(0, 0)', filter: 'blur(0)' },
        { transform: 'rotate(-30deg) translate(-20px, -14px)', offset: 0.25, filter: 'blur(0)' },
        { transform: 'rotate(-38deg) translate(-150vw, 40px)', filter: 'blur(6px)' },
      ], { duration: 700, easing: 'cubic-bezier(.5, 0, .9, .3)' }),
    ]),
  ], saltada);

  await cerrar(cont, intro);
}

/* ======================= TU ZAPATILLA ======================= */
// Guarda la foto de la zapatilla del usuario (reducida a 600 px) para usarla en la intro
export async function guardarZapatilla(archivo, girar = false) {
  const img = await createImageBitmap(archivo);
  const k = Math.min(1, 600 / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * k);
  lienzo.height = Math.round(img.height * k);
  lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
  guardar('zapatilla', { foto: lienzo.toDataURL('image/jpeg', 0.85), girar });
}
export const zapatillaGuardada = () => leer('zapatilla', null);
export const quitarZapatilla = () => guardar('zapatilla', null);
export function girarZapatilla() {
  const z = leer('zapatilla', null);
  if (z) guardar('zapatilla', { ...z, girar: !z.girar });
}

/* ======================= FIGURAS ARTICULADAS ======================= */
// Un muñeco de perfil (mirando a la derecha) hecho de piezas que giran sobre sus articulaciones.
// Cada pose es un conjunto de ángulos; entre poses se interpola, y los pies se quedan en el suelo.
const SUELO = 262;
const PIEZAS = [ // nombre, pieza de la que cuelga, punto de enganche en ella
  ['tronco', 'raiz', [0, 0]], ['cabeza', 'tronco', [0, -72]],
  ['brazoL', 'tronco', [0, -64]], ['antebrazoL', 'brazoL', [0, 40]],
  ['brazoR', 'tronco', [0, -64]], ['antebrazoR', 'brazoR', [0, 40]],
  ['musloL', 'raiz', [0, 0]], ['piernaL', 'musloL', [0, 48]], ['pieL', 'piernaL', [0, 46]],
  ['musloR', 'raiz', [0, 0]], ['piernaR', 'musloR', [0, 48]], ['pieR', 'piernaR', [0, 46]],
];
// Orden de dibujo: lo del lado lejano (L) detrás del cuerpo, lo cercano (R) delante
const DIBUJO = ['brazoL', 'antebrazoL', 'musloL', 'piernaL', 'pieL', 'tronco', 'cabeza', 'musloR', 'piernaR', 'pieR', 'brazoR', 'antebrazoR'];
const rad = g => g * Math.PI / 180;
const mezclar = (a, b, t) => a + (b - a) * t;
const suave = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const CURVAS = { suave, entra: t => t * t * t, sale: t => 1 - Math.pow(1 - t, 3), lineal: t => t };

function cinematica(p, raiz) {
  const r = { raiz: { x: raiz[0], y: raiz[1], a: 0 } };
  for (const [n, padre, [ox, oy]] of PIEZAS) {
    const P = r[padre], c = Math.cos(rad(P.a)), s = Math.sin(rad(P.a));
    r[n] = { x: P.x + ox * c - oy * s, y: P.y + ox * s + oy * c, a: P.a + (p[n] || 0) };
  }
  return r;
}
// Punto a "largo" píxeles a lo largo de una pieza
const punta = (seg, largo) => ({ x: seg.x - largo * Math.sin(rad(seg.a)), y: seg.y + largo * Math.cos(rad(seg.a)) });
// Dónde va la cadera para que el tobillo cercano pise el suelo en su sitio
function raizApoyada(p, anclaX) {
  const r = cinematica(p, [0, 0]);
  return [anclaX - r.pieR.x, SUELO - 6 - r.pieR.y];
}

// Reproduce una lista de poses. Cada pose: ángulos + { ms, curva, suelo, raiz, desplaza, al }
function animarFigura({ intro, partes, poses, anclaX, alCuadro }) {
  const raices = [];
  poses.forEach((p, i) => {
    if (p.suelo !== false) raices[i] = raizApoyada(p, anclaX);
    else if (p.raiz) raices[i] = p.raiz;
    else raices[i] = [raices[i - 1][0] + (p.desplaza?.[0] || 0), raices[i - 1][1] + (p.desplaza?.[1] || 0)];
  });
  const claves = [...new Set(poses.flatMap(p => Object.keys(p)))].filter(k => typeof poses[0][k] === 'number' || poses.some(p => typeof p[k] === 'number'));
  const valor = (p, k) => (typeof p[k] === 'number' ? p[k] : (k === 'opacidad' ? 1 : 0));

  const pintarPose = (p, raiz) => {
    const r = cinematica(p, raiz);
    for (const n of DIBUJO) partes[n].setAttribute('transform', `translate(${r[n].x.toFixed(2)} ${r[n].y.toFixed(2)}) rotate(${r[n].a.toFixed(2)})`);
    alCuadro?.(r, p);
    return r;
  };

  return new Promise(fin => {
    let i = 0, t0 = performance.now(), ultimo = pintarPose(poses[0], raices[0]);
    poses[0].al?.();
    const cuadro = ahora => {
      if (!intro.isConnected) return fin(ultimo);
      const A = poses[i], B = poses[i + 1];
      if (!B) return fin(ultimo);
      const t = Math.min(1, (ahora - t0) / (B.ms || 1));
      const k = (CURVAS[B.curva] || suave)(t);
      const p = {};
      for (const c of claves) p[c] = mezclar(valor(A, c), valor(B, c), k);
      const raiz = A.suelo !== false && B.suelo !== false
        ? raizApoyada(p, anclaX)
        : [mezclar(raices[i][0], raices[i + 1][0], k), mezclar(raices[i][1], raices[i + 1][1], k)];
      ultimo = pintarPose(p, raiz);
      if (t >= 1) { i++; t0 = ahora; poses[i + 1]?.al?.(); }
      requestAnimationFrame(cuadro);
    };
    poses[1]?.al?.();
    requestAnimationFrame(cuadro);
  });
}

// Crea los <g> de cada pieza a partir de sus dibujos (en coordenadas propias, colgando hacia abajo)
function piezasSVG(dibujos) {
  return DIBUJO.map(n => `<g class="pz pz-${n}" data-pieza="${n}">${dibujos[n]}</g>`).join('');
}
const recogerPiezas = intro => Object.fromEntries([...intro.querySelectorAll('[data-pieza]')].map(g => [g.dataset.pieza, g]));

/* ============================== GIMNASIO ============================== */
// Persona en pictograma (diseño propio): extiende el brazo, abre la mano y una mancuerna
// llega volando hasta ella. La coge en vertical, hace una sentadilla y sale de un salto.
const linea = (largo, grosor, color) => `<line x1="0" y1="0" x2="0" y2="${largo}" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round"/>`;
const CERCA = '#0C3084', LEJOS = '#7C98EA', CUERPO = '#1F4FD1';
const PERSONA = {
  tronco: `<line x1="0" y1="-4" x2="0" y2="-60" stroke="${CUERPO}" stroke-width="24" stroke-linecap="round"/>`,
  cabeza: `<circle cx="1" cy="-16" r="14" fill="${CERCA}"/>`,
  brazoL: linea(40, 12, LEJOS), antebrazoL: `${linea(34, 11, LEJOS)}<circle cx="0" cy="38" r="6.5" fill="${LEJOS}"/>`,
  brazoR: linea(40, 12, CERCA),
  antebrazoR: `${linea(34, 11, CERCA)}<circle cx="0" cy="38" r="6.5" fill="${CERCA}"/>
    <g class="dedos" stroke="${CERCA}" stroke-width="4" stroke-linecap="round"><line x1="0" y1="40" x2="-6" y2="50"/><line x1="0" y1="41" x2="0" y2="52"/><line x1="0" y1="40" x2="6" y2="50"/><line x1="4" y1="36" x2="11" y2="40"/></g>`,
  musloL: linea(48, 15, LEJOS), piernaL: linea(46, 13, LEJOS), pieL: `<line x1="-3" y1="3" x2="15" y2="3" stroke="${LEJOS}" stroke-width="9" stroke-linecap="round"/>`,
  musloR: linea(48, 15, CERCA), piernaR: linea(46, 13, CERCA), pieR: `<line x1="-3" y1="3" x2="15" y2="3" stroke="${CERCA}" stroke-width="9" stroke-linecap="round"/>`,
};
const MANCUERNA = `
  <g class="mancuerna">
    <rect x="-3.5" y="-22" width="7" height="44" rx="3" fill="url(#g-acero)"/>
    <rect x="-14" y="-34" width="28" height="13" rx="4" fill="#4E535B"/><rect x="-11" y="-38" width="22" height="6" rx="3" fill="#6B7079"/>
    <rect x="-14" y="21" width="28" height="13" rx="4" fill="#4E535B"/><rect x="-11" y="32" width="22" height="6" rx="3" fill="#6B7079"/>
  </g>`;

export async function introGimnasio(cont) {
  if (sinMovimiento()) return;
  const { intro, saltada } = montar(cont, 'intro-figura intro-gym', `
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><linearGradient id="g-acero" x1="0" x2="1"><stop offset="0" stop-color="#8E9197"/><stop offset=".5" stop-color="#E4E6E9"/><stop offset="1" stop-color="#8E9197"/></linearGradient></defs>
      <ellipse class="sombra" cx="0" cy="${SUELO + 2}" rx="46" ry="6" fill="#0C3084" opacity=".12"/>
      <g class="figura">${piezasSVG(PERSONA)}</g>
      <g class="pesa-vuelo">${MANCUERNA}</g>
      <circle class="impacto" r="14" fill="none" stroke="#5B7FE6" stroke-width="3" opacity="0"/>
    </svg>`);
  const partes = recogerPiezas(intro);
  const figura = intro.querySelector('.figura');
  const pesa = intro.querySelector('.pesa-vuelo');
  const sombra = intro.querySelector('.sombra');
  const impacto = intro.querySelector('.impacto');
  const dedos = intro.querySelector('.dedos');
  dedos.style.opacity = 0;

  // Estado de la mancuerna: escondida, volando hacia la mano o agarrada
  const estado = { modo: 'oculta', t0: 0, ms: 520, desde: { x: 470, y: 20 } };
  pesa.style.opacity = 0;
  const DE_PIE = { brazoR: 4, antebrazoR: -6, brazoL: -4, antebrazoL: -8, musloL: -3, musloR: 3, pieL: 3, pieR: -3 };
  const COPA = { brazoR: -30, antebrazoR: -135, brazoL: -24, antebrazoL: -142 };   // mancuerna en vertical frente al pecho

  await reproducir([
    () => animarFigura({
      intro, partes, anclaX: 170,
      alCuadro: (r, p) => {
        const mano = punta(r.antebrazoR, 38);
        sombra.setAttribute('cx', r.pieR.x - 4);
        const alto = Math.max(0, SUELO - 6 - r.pieR.y);
        sombra.setAttribute('rx', Math.max(10, 46 - alto * 0.3));
        figura.style.opacity = p.opacidad ?? 1;
        if (estado.modo === 'vuela') {
          const t = Math.min(1, (performance.now() - estado.t0) / estado.ms);
          const k = t * t;
          pesa.style.opacity = 1;
          pesa.style.filter = `blur(${(1 - t) * 2}px)`;
          pesa.setAttribute('transform', `translate(${mezclar(estado.desde.x, mano.x, k)} ${mezclar(estado.desde.y, mano.y, k)}) rotate(${(1 - k) * 540})`);
          if (t >= 1) {
            estado.modo = 'mano';
            pesa.style.filter = '';
            dedos.style.opacity = 0;
            impacto.setAttribute('cx', mano.x); impacto.setAttribute('cy', mano.y);
            impacto.animate([{ opacity: 0.9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(2.6)' }], { duration: 420, easing: 'ease-out' });
          }
        } else if (estado.modo === 'mano') {
          pesa.setAttribute('transform', `translate(${mano.x} ${mano.y})`);
          pesa.style.opacity = p.opacidad ?? 1;
        }
      },
      poses: [
        { ...DE_PIE },
        { ...DE_PIE, ms: 450 },                                                     // quieto
        { ...DE_PIE, brazoR: -88, antebrazoR: 0, tronco: -3, ms: 480, al: () => setTimeout(() => { dedos.style.opacity = 1; }, 380) },  // extiende el brazo y abre la mano
        { ...DE_PIE, brazoR: -88, antebrazoR: 0, tronco: -3, ms: 540, al: () => { estado.modo = 'vuela'; estado.t0 = performance.now(); } },  // ¡llega la mancuerna!
        { ...DE_PIE, brazoR: -74, antebrazoR: -16, tronco: -6, ms: 140, curva: 'sale' },  // el golpe al cogerla
        { ...DE_PIE, brazoR: -86, antebrazoR: -4, tronco: -2, ms: 220 },
        { ...DE_PIE, ...COPA, ms: 520 },                                            // la pone en vertical
        { ...COPA, tronco: 38, musloR: -88, piernaR: 105, pieR: -17, musloL: -84, piernaL: 101, pieL: -17, cabeza: -20, ms: 620 },  // sentadilla
        { ...COPA, tronco: 38, musloR: -88, piernaR: 105, pieR: -17, musloL: -84, piernaL: 101, pieL: -17, cabeza: -20, ms: 140 },
        { ...COPA, tronco: 2, musloR: 4, piernaR: 0, pieR: 14, musloL: -2, piernaL: 0, pieL: 16, ms: 300, curva: 'sale' },  // sube con fuerza…
        { ...COPA, tronco: 2, musloR: -55, piernaR: 95, pieR: -10, musloL: -50, piernaL: 90, pieL: -10, suelo: false, desplaza: [6, -340], opacidad: 0, ms: 560, curva: 'entra' },  // …y de un salto, ¡fuera!
      ],
    }),
  ], saltada);

  await cerrar(cont, intro);
}

/* ============================== FLEXIBILIDAD ============================== */
// Un esqueleto se toca las puntas de los pies, se abre de piernas de golpe contra el suelo…
// y se desmonta en sus piezas, que rebotan y desaparecen.
const HUESO_C = '#8F95A1';
const hueso = largo => `
  <line x1="0" y1="2" x2="0" y2="${largo - 2}" stroke="${HUESO_C}" stroke-width="9" stroke-linecap="round"/>
  <line x1="0" y1="2" x2="0" y2="${largo - 2}" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <circle cy="0" r="4.5" fill="#fff" stroke="${HUESO_C}" stroke-width="2"/><circle cy="${largo}" r="4.5" fill="#fff" stroke="${HUESO_C}" stroke-width="2"/>`;
const ESQUELETO = {
  tronco: `
    <path d="M-12 2c2 8 22 8 24 0l-4-10h-16z" fill="#fff" stroke="${HUESO_C}" stroke-width="2"/>
    ${Array.from({ length: 7 }, (_, i) => `<rect x="-4" y="${-8 - i * 9}" width="8" height="7" rx="2.5" fill="#fff" stroke="${HUESO_C}" stroke-width="1.6"/>`).join('')}
    <g fill="none" stroke="${HUESO_C}" stroke-width="3" stroke-linecap="round">
      <path d="M2 -60c14 2 22 10 22 22"/><path d="M2 -50c12 2 20 8 20 18"/><path d="M2 -40c10 2 16 6 17 14"/><path d="M2 -31c8 1 12 4 13 9"/>
    </g>
    <g fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round">
      <path d="M2 -60c14 2 22 10 22 22"/><path d="M2 -50c12 2 20 8 20 18"/><path d="M2 -40c10 2 16 6 17 14"/>
    </g>
    <line x1="0" y1="-66" x2="22" y2="-60" stroke="${HUESO_C}" stroke-width="4" stroke-linecap="round"/>`,
  cabeza: `
    <circle cx="1" cy="-17" r="14" fill="#fff" stroke="${HUESO_C}" stroke-width="2"/>
    <path d="M3 -6h10c2 0 3 2 2 4l-2 4h-9z" fill="#fff" stroke="${HUESO_C}" stroke-width="2"/>
    <ellipse cx="7" cy="-18" rx="3.6" ry="4.2" fill="#0E1A3F"/><path d="M12 -11l2 3h-3z" fill="#0E1A3F"/>
    <path d="M6 -2v3M9 -2v3" stroke="${HUESO_C}" stroke-width="1.2"/>`,
  brazoL: hueso(40), antebrazoL: `${hueso(34)}<path d="M-4 36l-2 8M0 37v9M4 36l2 8" stroke="${HUESO_C}" stroke-width="2.4" stroke-linecap="round"/>`,
  brazoR: hueso(40), antebrazoR: `${hueso(34)}<path d="M-4 36l-2 8M0 37v9M4 36l2 8" stroke="${HUESO_C}" stroke-width="2.4" stroke-linecap="round"/>`,
  musloL: hueso(48), piernaL: hueso(46), pieL: `<path d="M-4 0h4l14 2c3 0 4 4 1 5h-19z" fill="#fff" stroke="${HUESO_C}" stroke-width="2" stroke-linejoin="round"/>`,
  musloR: hueso(48), piernaR: hueso(46), pieR: `<path d="M-4 0h4l14 2c3 0 4 4 1 5h-19z" fill="#fff" stroke="${HUESO_C}" stroke-width="2" stroke-linejoin="round"/>`,
};

// Las piezas salen disparadas, rebotan contra el suelo y se desvanecen
function desmontar(intro, partes, r, ms = 1300) {
  const centro = r.raiz.x;
  const piezas = DIBUJO.map(n => ({
    g: partes[n], x: r[n].x, y: r[n].y, a: r[n].a,
    vx: (r[n].x - centro) * 2.4 + (Math.random() - 0.5) * 140,
    vy: -(70 + Math.random() * 170) - (n === 'cabeza' ? 120 : 0),
    w: (Math.random() - 0.5) * (n === 'cabeza' ? 500 : 900),
  }));
  return new Promise(fin => {
    let antes = performance.now(); const t0 = antes;
    const cuadro = ahora => {
      if (!intro.isConnected) return fin();
      const dt = Math.min(0.04, (ahora - antes) / 1000); antes = ahora;
      const t = ahora - t0;
      for (const p of piezas) {
        p.vy += 1100 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt;
        if (p.y > SUELO - 4) {
          p.y = SUELO - 4; p.vy *= -0.38; p.vx *= 0.7; p.w *= 0.5;
          // Al tocar el suelo, el hueso se tumba
          const tumbado = Math.round((p.a - 90) / 180) * 180 + 90;
          p.a += (tumbado - p.a) * 0.25;
        }
        p.g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.a.toFixed(2)})`);
        p.g.style.opacity = Math.max(0, Math.min(1, (ms - t) / 500));
      }
      if (t < ms) requestAnimationFrame(cuadro); else fin();
    };
    requestAnimationFrame(cuadro);
  });
}

export async function introFlexibilidad(cont) {
  if (sinMovimiento()) return;
  const { intro, saltada } = montar(cont, 'intro-figura intro-flex', `
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="-400" x2="800" y1="${SUELO + 1}" y2="${SUELO + 1}" stroke="#C9D7FF" stroke-width="2"/>
      <ellipse class="polvo" cx="200" cy="${SUELO}" rx="70" ry="10" fill="#B4B6BA" opacity="0"/>
      <g class="figura">${piezasSVG(ESQUELETO)}</g>
    </svg>`);
  const partes = recogerPiezas(intro);
  const svg = intro.querySelector('svg');
  const polvo = intro.querySelector('.polvo');
  const DE_PIE = { brazoR: 4, antebrazoR: -6, brazoL: -4, antebrazoL: -8, musloL: -3, musloR: 3, pieL: 3, pieR: -3 };
  const TOCAR = { tronco: 115, cabeza: 12, brazoR: -76, antebrazoR: 2, brazoL: -80, antebrazoL: 4, musloR: 9, pieR: -9, musloL: 6, pieL: -6 };
  let final = null;

  await reproducir([
    async () => {
      final = await animarFigura({
        intro, partes, anclaX: 214,
        poses: [
          { ...DE_PIE },
          { ...DE_PIE, ms: 400 },
          { ...TOCAR, ms: 780 },                                          // se toca las puntas de los pies
          { ...TOCAR, tronco: 118, brazoR: -79, ms: 420 },
          { ...DE_PIE, ms: 420 },                                          // vuelve arriba
          { ...DE_PIE, brazoR: -168, antebrazoR: -6, brazoL: -160, antebrazoL: -8, ms: 300 },  // brazos arriba
          { brazoR: -168, antebrazoR: -6, brazoL: -160, antebrazoL: -8,     // ¡spagat de golpe contra el suelo!
            musloR: -90, piernaR: 0, pieR: 0, musloL: 90, piernaL: 0, pieL: 90,
            suelo: false, raiz: [200, SUELO - 12], ms: 260, curva: 'entra' },
          { brazoR: -168, antebrazoR: -6, brazoL: -160, antebrazoL: -8,
            musloR: -90, piernaR: 0, pieR: 0, musloL: 90, piernaL: 0, pieL: 90,
            suelo: false, raiz: [200, SUELO - 12], ms: 140 },
        ],
      });
    },
    () => {
      svg.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(5px)' }, { transform: 'translateY(-2px)' }, { transform: 'none' }], { duration: 220 });
      polvo.animate([{ opacity: 0.5, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.8)' }], { duration: 700, easing: 'ease-out' });
      return desmontar(intro, partes, final);
    },
  ], saltada);

  await cerrar(cont, intro);
}
