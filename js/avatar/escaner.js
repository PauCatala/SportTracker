// Escáner de cara dentro de SYNCO: abre el creador de Avaturn (lumen.avaturn.dev) a pantalla completa.
// Te haces tres fotos (de frente y de cada lado), eliges cuerpo y ropa, y al pulsar «Next»
// Avaturn nos devuelve el avatar (.glb), que pasa a ser el tuyo. Integrarlo así es gratuito.
import { cargador } from '../marca-anim.js';

const URL_AVATURN = 'https://lumen.avaturn.dev';
const TIEMPO_MAX = 25000;   // si en este tiempo no ha cargado, ofrecemos abrirlo aparte

// editar = URL pública de un avatar de Avaturn (.glb): se abre en el editor de Avaturn para cambiarle
// prendas, peinado y cuerpo con su vestuario completo. Si el editor no puede abrirlo, se abre el creador.
export function abrirEscaner({ alTerminar, alFallar, editar = null } = {}) {
  const capa = document.createElement('div');
  capa.className = 'esc';
  capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', 'Escanear tu cara');
  capa.innerHTML = `
    <header class="esc-cab">
      <div>${editar ? '<h2>Vestuario de Avaturn</h2><p>Elige prendas, calzado, peinado y gafas. Al terminar, pulsa <b>Next</b>.</p>'
        : '<h2>Escanea tu cara</h2><p>Tres fotos: de frente, y girando un poco a cada lado. Con buena luz y sin gafas.</p>'}</div>
      <button class="ta-icono" data-cerrar aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    <div class="esc-marco">
      <div class="esc-cargando">${cargador('Abriendo el escáner…')}</div>
    </div>
    <p class="esc-pie">Cuando acabes, pulsa <b>Next</b> y tu avatar aparecerá en SYNCO. Las fotos las procesa Avaturn; en SYNCO solo guardamos el avatar, en tu cuenta.</p>`;
  document.body.append(capa);
  requestAnimationFrame(() => capa.classList.add('ver'));

  let sdk = null, hecho = false;
  const marco = capa.querySelector('.esc-marco');
  const cerrar = () => {
    removeEventListener('keydown', tecla);
    capa.classList.remove('ver');
    setTimeout(() => { try { sdk?.destroy(); } catch {} capa.remove(); }, 280);
  };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', tecla);
  capa.querySelector('[data-cerrar]').onclick = cerrar;

  const aviso = () => {
    if (hecho || !capa.isConnected) return;
    marco.querySelector('.esc-cargando')?.remove();
    const p = document.createElement('div'); p.className = 'esc-fallo';
    p.innerHTML = `<p>El escáner tarda en abrirse. Si no aparece, ábrelo aparte, crea tu avatar, descárgalo (<i>.glb</i>) y súbelo en «Con tu cara».</p>
      <a class="btn" href="${URL_AVATURN}" target="_blank" rel="noopener">Abrir el escáner aparte</a>`;
    marco.append(p);
  };
  const espera = setTimeout(aviso, TIEMPO_MAX);

  (async () => {
    try {
      const { AvaturnSDK } = await import('../../vendor/avaturn-sdk.js');
      sdk = new AvaturnSDK();
      // Los avisos se registran antes de esperar a que cargue, para no perder ninguno
      const alExportar = async datos => {
        capa.classList.add('guardando');
        marco.insertAdjacentHTML('beforeend', `<div class="esc-cargando sobre">${cargador('Preparando tu avatar…')}</div>`);
        try {
          const r = await fetch(datos.url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const blob = await r.blob();
          cerrar();
          alTerminar?.(new Blob([blob], { type: 'model/gltf-binary' }));
        } catch (e) {
          console.warn('Avatar de Avaturn', e);
          cerrar();
          alFallar?.('No hemos podido traer tu avatar. Vuelve a intentarlo o descárgalo desde Avaturn y súbelo aquí.');
        }
      };
      let url = editar ? `${URL_AVATURN}/editor?avatar_link=${encodeURIComponent(editar)}` : URL_AVATURN;
      const alError = e => {
        console.warn('Avaturn', e);
        // Si el editor no puede abrir el avatar, se pasa al creador normal
        if (url !== URL_AVATURN && /avatar_load/i.test(e?.type || '')) {
          url = URL_AVATURN;
          try { sdk.destroy(); } catch {}
          sdk.on('export', alExportar).on('error', alError);
          sdk.init(marco, { url, iframeClassName: 'esc-iframe' }).catch(() => {});
        }
      };
      sdk.on('export', alExportar).on('error', alError);
      const listo = sdk.init(marco, { url, iframeClassName: 'esc-iframe' });
      // El iframe tapa al cargador en cuanto Avaturn se pinta
      marco.querySelector('iframe')?.addEventListener('load', () => { hecho = true; clearTimeout(espera); });
      await listo;
      hecho = true; clearTimeout(espera);
    } catch (e) {
      console.warn('Escáner', e);
      clearTimeout(espera); aviso();
    }
  })();
  return { cerrar };
}
