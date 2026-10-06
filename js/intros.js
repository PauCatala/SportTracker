// INTROS: pequeñas películas que se ven al entrar en un apartado, antes de mostrar su contenido.
//  - Nutrición: un salero echa sal sobre un filete; la cámara vuela como un dron hasta debajo
//    del salero, sigue un grano de sal… y "pum": aparece la pantalla de Nutrición.
//  - Running: tu zapatilla (o una genérica) se inclina 45°, tiembla, aparece una pierna
//    y sale corriendo hacia la izquierda: aparece tu semana de running.
//  - Gimnasio: una persona extiende el brazo, le llega volando una mancuerna, hace una sentadilla y sale de un salto.
//  - Flexibilidad: un esqueleto se toca los pies, se abre de piernas contra el suelo y se desmonta.
// Se pueden saltar tocándolas y no se reproducen si el sistema pide reducir el movimiento.
import { leer, guardar } from './almacen.js';

import { sinMovimiento, espera, montar, cerrar, reproducir } from './intro-base.js';
export { introNutricion } from './intro-nutricion.js';
export { introGimnasio } from './intro-gym.js';
export { introFlexibilidad } from './intro-flex.js';

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
