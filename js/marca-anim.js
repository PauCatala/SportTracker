// Animaciones de la marca SYNCO
// - cargador(): los cuatro trazos del logo caen uno tras otro como fichas de dominó y vuelven a levantarse.
// - transicionSynco(): al cambiar de sección, unos círculos ruedan sobre un anillo, se cierran hacia el centro
//   y se funden en uno solo; en ese instante cambia la pantalla y el círculo se desvanece.

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const barras = (clase = '') => `<span class="sy-barras ${clase}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
export const cargador = (texto = '') => `<div class="sy-carga" role="status">${barras()}${texto ? `<span>${texto}</span>` : '<span class="sr">Cargando</span>'}</div>`;

// Pantalla de arranque: se retira cuando la app ya ha pintado
export function quitarArranque() {
  const a = document.getElementById('arranque');
  if (!a || a.classList.contains('fuera')) return;
  a.classList.add('fuera');
  setTimeout(() => a.remove(), 650);
}

let enCurso = null;
export function transicionSynco(cambio) {
  if (reducido() || !Element.prototype.animate) { cambio(); return Promise.resolve(); }
  if (enCurso) { cambio(); return enCurso; }
  const N = 8, R = 44;
  const capa = document.createElement('div');
  capa.className = 'sy-trans';
  capa.innerHTML = `<svg viewBox="-70 -70 140 140" aria-hidden="true">${Array.from({ length: N }, () => '<circle r="6.4"/>').join('')}<circle class="nucleo" r="12"/></svg>`;
  document.body.append(capa);
  const circulos = [...capa.querySelectorAll('circle:not(.nucleo)')];
  const nucleo = capa.querySelector('.nucleo');
  const T = 620;   // ruedan y se juntan
  const curva = 'cubic-bezier(.55, 0, .3, 1)';
  capa.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'forwards' });
  circulos.forEach((c, i) => {
    const a = (360 / N) * i;
    c.animate([
      { transform: `rotate(${a}deg) translateX(${R}px) scale(.2)`, opacity: 0 },
      { transform: `rotate(${a + 70}deg) translateX(${R}px) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `rotate(${a + 250}deg) translateX(${R * 0.55}px) scale(1)`, opacity: 1, offset: 0.7 },
      { transform: `rotate(${a + 330}deg) translateX(0px) scale(1.25)`, opacity: 1 },
    ], { duration: T, easing: curva, fill: 'forwards' });
  });
  nucleo.animate([{ transform: 'scale(0)' }, { transform: 'scale(0)', offset: 0.82 }, { transform: 'scale(1)' }], { duration: T, easing: 'ease-out', fill: 'forwards' });
  enCurso = new Promise(fin => {
    setTimeout(() => {
      cambio();
      circulos.forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
      nucleo.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 1, offset: 0.35 }, { transform: 'scale(0)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.3, 0, .2, 1)', fill: 'forwards' });
      const salida = capa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 120, easing: 'ease-out', fill: 'forwards' });
      salida.onfinish = () => { capa.remove(); enCurso = null; fin(); };
    }, T);
  });
  return enCurso;
}
