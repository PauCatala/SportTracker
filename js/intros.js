// INTROS: pequeñas películas que se ven al entrar en un apartado, antes de mostrar su contenido.
//  - Nutrición: un salero echa sal sobre un filete; la cámara vuela como un dron hasta debajo
//    del salero, sigue un grano de sal… y "pum": aparece la pantalla de Nutrición.
//  - Running: vídeo real de la zapatilla (Z1) expuesta que coge impulso y sale disparada;
//    el color (blanco, amarillo, rosa) se elige en Running o durante la propia intro.
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
// Hay un vídeo por color con el MISMO movimiento: los tres suenan a la vez y solo se ve el elegido,
// así el color se puede cambiar en cualquier momento sin saltos.
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
  const { intro, saltada } = montar(cont, 'intro-run', `
    <div class="escena-run">${colores.map(c => video(modelo, c, c === color)).join('')}</div>
    <div class="run-colores" role="group" aria-label="Color de la zapatilla">
      ${colores.map(c => `<button class="run-color${c === color ? ' activo' : ''}" data-color="${c}" aria-label="${MODELOS[modelo].colores[c]}" aria-pressed="${c === color}"></button>`).join('')}
    </div>`);
  const videos = [...intro.querySelectorAll('.run-video')];
  // Cambiar de color sin parar el vídeo (y sin que el toque cuente como "saltar")
  intro.querySelector('.run-colores').addEventListener('click', ev => {
    ev.stopPropagation();
    const b = ev.target.closest('.run-color');
    if (!b) return;
    intro.querySelectorAll('.run-color').forEach(x => { x.classList.toggle('activo', x === b); x.setAttribute('aria-pressed', x === b); });
    videos.forEach(v => v.classList.toggle('visible', v.dataset.color === b.dataset.color));
    elegirZapatilla(modelo, b.dataset.color);
  });

  const listos = Promise.all(videos.map(v => v.readyState >= 3 ? 0 : new Promise(r => { v.addEventListener('canplaythrough', r, { once: true }); v.addEventListener('error', r, { once: true }); setTimeout(r, 2500); })));
  await reproducir([
    () => listos,
    () => new Promise(r => {
      const guia = videos.find(v => v.classList.contains('visible')) || videos[0];
      videos.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
      // Mantiene los tres vídeos sincronizados con el que se ve
      const sync = setInterval(() => videos.forEach(v => { if (v !== guia && Math.abs(v.currentTime - guia.currentTime) > 0.06) v.currentTime = guia.currentTime; }), 250);
      guia.addEventListener('ended', () => { clearInterval(sync); r(); }, { once: true });
      setTimeout(() => { clearInterval(sync); r(); }, 6000);
    }),
  ], saltada);
  videos.forEach(v => v.pause());
  await cerrar(cont, intro);
}
