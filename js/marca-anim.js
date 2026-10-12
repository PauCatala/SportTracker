// Animaciones de la marca SYNCO
// - cargador(): los cuatro trazos del logo caen uno tras otro como fichas de dominó forman el logo y vuelven a la vez a vertical.

export const barras = (clase = '') => `<span class="sy-barras ${clase}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
export const cargador = (texto = '') => `<div class="sy-carga" role="status">${barras()}${texto ? `<span>${texto}</span>` : '<span class="sr">Cargando</span>'}</div>`;

// Pantalla de arranque: se retira cuando la app ya ha pintado
export function quitarArranque() {
  const a = document.getElementById('arranque');
  if (!a || a.classList.contains('fuera')) return;
  a.classList.add('fuera');
  setTimeout(() => a.remove(), 650);
}

