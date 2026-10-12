// Primer paso al entrar en SYNCO: crear tu avatar (escaneando tu cara o eligiendo uno).
// Se enseña una sola vez por cuenta; luego está siempre en el menú de perfil → Tu avatar.
import { leer, guardar } from '../almacen.js';

export function bienvenidaAvatar({ forzar = false } = {}) {
  if (!forzar && (leer('avatar-bienvenida', false) || leer('avatar-avaturn', null))) return;
  guardar('avatar-bienvenida', true);
  const movil = matchMedia('(pointer: coarse)').matches;
  const h = document.createElement('div');
  h.className = 'bv';
  h.innerHTML = `
    <div class="bv-hoja" role="dialog" aria-modal="true" aria-labelledby="bv-t">
      <div class="bv-arte" aria-hidden="true"><img src="icons/synco-isotipo.svg" alt=""><i></i><i></i><i></i></div>
      <h2 id="bv-t">Hazte tu avatar</h2>
      <p>Te acompañará en tu Inicio y en Salud, corriendo, entrenando y estirando contigo. ${movil ? 'Con tres fotos de tu cara tendrás uno que se te parece de verdad.' : 'Desde el móvil puedes escanear tu cara con tres fotos.'}</p>
      <div class="bv-acciones">
        <button class="btn primario" data-bv="escanear">Escanear mi cara</button>
        <button class="btn" data-bv="elegir">Elegir uno de SYNCO</button>
        <button class="bv-luego" data-bv="luego">Más tarde</button>
      </div>
    </div>`;
  document.body.append(h);
  requestAnimationFrame(() => h.classList.add('ver'));
  const cerrar = () => { h.classList.remove('ver'); setTimeout(() => h.remove(), 280); removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', tecla);
  h.addEventListener('click', e => {
    const b = e.target.closest('[data-bv]');
    if (!b && e.target !== h) return;
    cerrar();
    if (b?.dataset.bv === 'escanear' || b?.dataset.bv === 'elegir') {
      import('./elegir.js').then(m => m.abrirPersonalizacion({ escanear: b.dataset.bv === 'escanear' }));
    }
  });
}
