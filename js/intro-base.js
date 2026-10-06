// Piezas comunes de las intros: montar la escena, reproducir pasos y cerrarla.
// Cada intro vive en su propio archivo (intro-*.js) y trae sus estilos dentro (estilos()).
export const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const espera = ms => new Promise(r => setTimeout(r, ms));

// Inyecta una sola vez los estilos de una intro
export function estilos(id, css) {
  if (document.getElementById(`estilo-${id}`)) return;
  const s = document.createElement('style');
  s.id = `estilo-${id}`;
  s.textContent = css;
  document.head.appendChild(s);
}

// Prepara el contenedor: la intro arriba y el contenido oculto hasta que termine
export function montar(cont, clase, html) {
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
export async function cerrar(cont, intro) {
  intro.style.height = `${intro.offsetHeight}px`;
  intro.getBoundingClientRect();
  intro.classList.add('cerrando');
  intro.style.height = '0px';
  cont.classList.remove('con-intro');
  await espera(450);
  intro.remove();
}

// Ejecuta los pasos de la animación; si el usuario la salta, se corta en el acto
export async function reproducir(pasos, saltada) {
  for (const paso of pasos) {
    const r = await Promise.race([paso(), saltada]);
    if (r === 'saltar') return;
  }
}
