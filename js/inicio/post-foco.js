// Vista ampliada de una publicación de la cinta: plana, legible y con interacciones reales.
// Tocar la imagen o «Entrar» abre la sección; los iconos (me gusta, comentar, compartir,
// guardar) solo hacen su función y nunca te sacan de aquí.
import { escapar } from '../almacen.js';
import { interacciones, cambiarInteraccion, textoMeGusta, textoComentarios, pintarImagen } from './publicaciones.js';

const SVG = {
  corazon: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  comentario: '<path d="M20.5 11.6a8.4 8.4 0 01-12.6 7.3L3.5 20.5l1.6-4.2A8.4 8.4 0 1120.5 11.6z"/>',
  enviar: '<path d="M21.5 3.5L10.6 13.4M21.5 3.5l-6.9 17-4-7.1-7.1-4 18-5.9z"/>',
  guardar: '<path d="M6 3.5h12v17l-6-4.6-6 4.6z"/>',
  mas: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const ico = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${SVG[n]}</svg>`;
const hace = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

let abierta = null;
/**
 * @param {{ area, pub, usuario, alEntrar: () => void, alCerrar: () => void, alCambiar: () => void }} o
 */
export function abrirPost({ area, pub, usuario, alEntrar, alCerrar, alCambiar }) {
  abierta?.cerrar(false);
  const invitado = !usuario;
  const nombre = invitado ? 'Invitado' : usuario.toLowerCase().replace(/\s+/g, '');
  const raiz = document.createElement('div');
  raiz.className = 'pf entrando';
  raiz.innerHTML = `
    <div class="pf-fondo" data-cerrar></div>
    <article class="pf-post" role="dialog" aria-modal="true" aria-label="Publicación de ${escapar(area.titulo)}" style="--a-fuerte:${area.fuerte};--a-suave:${area.suave}">
      <header class="pf-cab">
        <span class="pf-foto${invitado ? ' invitado' : ''}">${invitado ? '' : escapar(nombre[0].toUpperCase())}</span>
        <div><b>${escapar(nombre)}</b><small>${invitado ? 'Sin cuenta · solo en este navegador' : area.titulo}</small></div>
        <button class="pf-icono" data-menu aria-label="Más opciones" aria-haspopup="true">${ico('mas', 'fill="currentColor" stroke="none"')}</button>
        <button class="pf-icono" data-cerrar aria-label="Cerrar">${ico('x')}</button>
        <div class="pf-menu" hidden role="menu">
          <button role="menuitem" data-entrar>Entrar en ${escapar(area.titulo)}</button>
          <button role="menuitem" data-copiar>Copiar enlace</button>
        </div>
      </header>
      <button class="pf-media" data-entrar aria-label="Entrar en ${escapar(area.titulo)}"><canvas width="1080" height="840"></canvas></button>
      <div class="pf-barra">
        <button class="pf-icono pf-like" data-like aria-label="Me gusta" aria-pressed="false">${ico('corazon')}</button>
        <button class="pf-icono" data-comentar aria-label="Comentar">${ico('comentario')}</button>
        <button class="pf-icono" data-compartir aria-label="Compartir">${ico('enviar')}</button>
        <span></span>
        <button class="pf-icono pf-guardar" data-guardar aria-label="Guardar" aria-pressed="false">${ico('guardar')}</button>
      </div>
      <div class="pf-texto">
        <p class="pf-likes"></p>
        <p><b>${escapar(nombre)}</b> ${escapar(area.titulo)} <span class="pf-tenue">· ${escapar(pub.dato || area.frase)}</span></p>
        <button class="pf-vercom" data-vercom></button>
        <ul class="pf-coms" hidden></ul>
        <form class="pf-form"><input name="c" maxlength="280" autocomplete="off" placeholder="Añade un comentario…" aria-label="Comentario"><button class="pf-publicar" disabled>Publicar</button></form>
        <div class="pf-pie"><small>HOY</small><button class="btn primario pf-entrar" data-entrar>Entrar en ${escapar(area.titulo)} ${ico('flecha')}</button></div>
      </div>
    </article>
    <p class="pf-aviso" role="status" aria-live="polite"></p>`;
  document.body.append(raiz);
  requestAnimationFrame(() => raiz.classList.remove('entrando'));
  const $ = s => raiz.querySelector(s);

  // Imagen
  const lienzo = $('canvas'), c2 = lienzo.getContext('2d');
  pintarImagen(c2, area, 0, 0, lienzo.width, lienzo.height);

  function pintar() {
    const e = interacciones(area.id);
    $('[data-like]').setAttribute('aria-pressed', String(e.like));
    $('[data-like]').classList.toggle('activo', e.like);
    $('[data-guardar]').setAttribute('aria-pressed', String(e.guardado));
    $('[data-guardar]').classList.toggle('activo', e.guardado);
    $('.pf-likes').textContent = textoMeGusta(e.like ? 1 : 0);
    $('[data-vercom]').textContent = textoComentarios(e.comentarios.length);
    $('[data-vercom]').hidden = !e.comentarios.length;
    $('.pf-coms').innerHTML = e.comentarios.map((c, i) => `
      <li><p><b>${escapar(nombre)}</b> ${escapar(c.texto)}</p><small>${hace(c.fecha)}</small><button class="pf-borrar" data-borrar="${i}" aria-label="Borrar comentario">Borrar</button></li>`).join('');
  }
  pintar();

  const aviso = t => { const a = $('.pf-aviso'); a.textContent = t; a.classList.add('ver'); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('ver'), 1800); };
  const cambio = fn => { cambiarInteraccion(area.id, fn); pintar(); alCambiar?.(); };

  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('button, [data-cerrar]');
    if (!b) return;
    if (b.matches('[data-cerrar]')) return cerrar(true);
    if (b.matches('[data-entrar]')) { cerrar(false); return alEntrar?.(); }
    if (b.matches('[data-menu]')) { const m = $('.pf-menu'); m.hidden = !m.hidden; return; }
    if (b.matches('[data-like]')) {
      cambio(e => ({ like: !e.like }));
      if (interacciones(area.id).like) { b.classList.remove('late'); void b.offsetWidth; b.classList.add('late'); }
      return;
    }
    if (b.matches('[data-guardar]')) { cambio(e => ({ guardado: !e.guardado })); return aviso(interacciones(area.id).guardado ? 'Guardada' : 'Quitada de guardadas'); }
    if (b.matches('[data-comentar]')) { $('.pf-coms').hidden = false; return $('.pf-form input').focus(); }
    if (b.matches('[data-vercom]')) { $('.pf-coms').hidden = !$('.pf-coms').hidden; if (!interacciones(area.id).comentarios.length) $('.pf-form input').focus(); return; }
    if (b.matches('[data-borrar]')) { const i = +b.dataset.borrar; return cambio(e => ({ comentarios: e.comentarios.filter((_, k) => k !== i) })); }
    if (b.matches('[data-compartir], [data-copiar]')) {
      $('.pf-menu').hidden = true;
      const url = `${location.origin}${location.pathname}#${area.ir.split('|')[0]}`;
      try {
        if (b.matches('[data-compartir]') && navigator.share) { await navigator.share({ title: `SYNCO · ${area.titulo}`, url }); return; }
        await navigator.clipboard.writeText(url); aviso('Enlace copiado');
      } catch { /* cancelado */ }
    }
  });
  const form = $('.pf-form'), campo = form.c;
  campo.addEventListener('input', () => { form.querySelector('button').disabled = !campo.value.trim(); });
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    cambio(e => ({ comentarios: [...e.comentarios, { texto, fecha: new Date().toISOString() }] }));
    campo.value = ''; form.querySelector('button').disabled = true;
    $('.pf-coms').hidden = false;
  });
  const teclas = ev => { if (ev.key === 'Escape') cerrar(true); };
  addEventListener('keydown', teclas);

  function cerrar(avisar = true) {
    removeEventListener('keydown', teclas);
    raiz.classList.add('saliendo');
    setTimeout(() => raiz.remove(), 260);
    abierta = null;
    if (avisar) alCerrar?.();
  }
  $('[data-like]').focus({ preventScroll: true });
  abierta = { cerrar };
  return abierta;
}
