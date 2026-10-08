// INTROS: pequeñas películas que se ven al entrar en un apartado, antes de mostrar su contenido.
//  - Nutrición: un salero echa sal sobre un filete; la cámara vuela como un dron hasta debajo
//    del salero, sigue un grano de sal… y "pum": aparece la pantalla de Nutrición.
//  - Running: vídeo real de la zapatilla (Z1) expuesta que coge impulso y sale disparada;
//    a pantalla completa; el color (blanco, amarillo, rosa) se elige en "Tu zapatilla".
//  - Gimnasio: una persona extiende el brazo, le llega volando una mancuerna, hace una sentadilla y sale de un salto.
//  - Flexibilidad: un esqueleto se toca los pies, se abre de piernas contra el suelo y se desmonta.
// Se pueden saltar tocándolas y no se reproducen si el sistema pide reducir el movimiento.
import { leer, guardar } from './almacen.js';

import { sinMovimiento, espera, montar, cerrar, reproducir } from './intro-base.js';
export { introNutricion } from './intro-nutricion.js';
export { introGimnasio } from './intro-gym.js';
export { introFlexibilidad } from './intro-flex.js';

/* ============================== RUNNING ============================== */
// Vídeo real: la zapatilla expuesta sobre tela coge impulso y sale disparada.
// Hay un vídeo por color; se reproduce el del color elegido.
export const MODELOS = {
  z1: { nombre: 'Z1', colores: { blanco: 'Blanco', amarillo: 'Amarillo', rosa: 'Rosa' } },
};
export function zapatillaElegida() {
  const z = leer('zapatilla', null);
  const modelo = MODELOS[z?.modelo] ? z.modelo : 'z1';
  const color = MODELOS[modelo].colores[z?.color] ? z.color : 'blanco';
  return { modelo, color };
}
export const elegirZapatilla = (modelo, color) => guardar('zapatilla', { modelo, color });

const video = (modelo, color, visible) => `
  <video class="run-video${visible ? ' visible' : ''}" data-color="${color}" muted playsinline preload="auto" poster="media/${modelo}_${color}.jpg">
    <source src="media/${modelo}_${color}.webm" type="video/webm">
    <source src="media/${modelo}_${color}.mp4" type="video/mp4">
  </video>`;

export async function introRunning(cont) {
  if (sinMovimiento()) return;
  const { modelo, color } = zapatillaElegida();
  const colores = Object.keys(MODELOS[modelo].colores);
  // A pantalla completa y sin marco: la tela es el fondo de la web y, cuando la zapatilla
  // sale disparada, la tela se disuelve y aparece Running debajo.
  const { intro, saltada } = montar(cont, 'intro-run', `
    <div class="escena-run">${colores.map(c => video(modelo, c, c === color)).join('')}</div>
    <div class="run-colores" role="group" aria-label="Color de la zapatilla">
      ${colores.map(c => `<button class="run-color${c === color ? ' activo' : ''}" data-color="${c}" aria-label="${MODELOS[modelo].colores[c]}" aria-pressed="${c === color}"></button>`).join('')}
    </div>`);
  const videos = [...intro.querySelectorAll('.run-video')];
  let v = videos.find(x => x.dataset.color === color);
  document.body.classList.add('con-intro-run');

  // Cambiar de color: el vídeo nuevo sigue desde el mismo instante y se funde encima
  intro.querySelector('.run-colores').addEventListener('click', ev => {
    ev.stopPropagation();   // tocar un color no salta la intro
    const b = ev.target.closest('.run-color');
    if (!b || b.dataset.color === v.dataset.color) return;
    const nuevo = videos.find(x => x.dataset.color === b.dataset.color);
    try { nuevo.currentTime = v.currentTime; } catch { /* aún sin cargar */ }
    if (!v.paused) nuevo.play().catch(() => {});
    nuevo.classList.add('visible');
    const viejo = v; v = nuevo;
    setTimeout(() => { viejo.classList.remove('visible'); viejo.pause(); }, 250);
    intro.querySelectorAll('.run-color').forEach(x => { x.classList.toggle('activo', x === b); x.setAttribute('aria-pressed', x === b); });
    elegirZapatilla(modelo, b.dataset.color);
  });

  const listo = v.readyState >= 3 ? 0 : new Promise(r => { v.addEventListener('canplaythrough', r, { once: true }); v.addEventListener('error', r, { once: true }); setTimeout(r, 2500); });
  const SALE = 2.55;   // segundo del vídeo en que la zapatilla cruza el borde
  await reproducir([
    () => listo,
    () => new Promise(r => {
      v.currentTime = 0; v.play().catch(r);
      const mira = () => (v.currentTime >= SALE || v.ended) ? r() : requestAnimationFrame(mira);
      requestAnimationFrame(mira);
      setTimeout(r, 5000);
    }),
  ], saltada);
  // La tela se disuelve y el contenido aparece a la vez
  cont.classList.remove('con-intro');
  intro.classList.add('fundiendo');
  await espera(750);
  videos.forEach(x => x.pause());
  intro.remove();
  document.body.classList.remove('con-intro-run');
}
