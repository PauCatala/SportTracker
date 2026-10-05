// INTROS: pequeñas películas que se ven al entrar en un apartado, antes de mostrar su contenido.
//  - Nutrición: un salero echa sal sobre un filete; la cámara vuela como un dron hasta debajo
//    del salero, sigue un grano de sal… y "pum": aparece la pantalla de Nutrición.
//  - Running: tu zapatilla (o una genérica) se inclina 45°, tiembla, aparece una pierna
//    y sale corriendo hacia la izquierda: aparece tu semana de running.
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
