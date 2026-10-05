// INTERACCIÓN estilo Apple: pequeños detalles que hacen que la app se sienta viva.
//  1. Aparición suave de las piezas al entrar en una sección o al llegar a ellas con el scroll
//  2. Números que cuentan hasta su valor y barras que se llenan
//  3. Píldora deslizante bajo la opción elegida (menú, apartados y pestañas)
//  4. Ventanas ampliadas que nacen del propio mosaico (como "Más información +" en apple.com)
//  5. Carruseles con flechas
//  6. Transición entre secciones
// Todo respeta la opción del sistema "reducir movimiento".

const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ======================= 1-2. APARICIONES ======================= */
const observador = 'IntersectionObserver' in window
  ? new IntersectionObserver(entradas => entradas.forEach(e => {
    if (!e.isIntersecting) return;
    mostrar(e.target);
    observador.unobserve(e.target);
  }), { rootMargin: '0px 0px -6% 0px' })
  : null;

// Las piezas que aparecen: hijos directos de la vista y los mosaicos de las cuadrículas
const PIEZAS = ':scope > *, .resumen-grid > *, .kpis > *, .tablero > *, .doble > *, .marcas > *, .tr-fases > *';

export function revelar(cont) {
  // Las cuadrículas no aparecen ellas mismas: aparecen sus mosaicos, uno detrás de otro
  const piezas = [...cont.querySelectorAll(PIEZAS)].filter(el => !el.matches('.resumen-grid, .kpis, .tablero, .doble, .marcas, .tr-fases'));
  piezas.forEach((el, i) => {
    if (sinMovimiento() || !observador) return mostrar(el, true);
    el.classList.add('revela');
    el.style.setProperty('--retraso', `${Math.min(i, 8) * 45}ms`);
    // Las barras empiezan vacías y se llenan al aparecer
    el.querySelectorAll('.progreso i').forEach(b => { b.dataset.ancho = b.style.width; b.style.width = '0%'; });
    observador.observe(el);
  });
}

function mostrar(el, inmediato = false) {
  if (inmediato) return;
  requestAnimationFrame(() => {
    el.classList.add('visto');
    el.querySelectorAll('.progreso i').forEach(b => { if (b.dataset.ancho != null) b.style.width = b.dataset.ancho; });
    el.querySelectorAll('[data-contar], .kpi b').forEach(contar);
    // Al terminar, se quitan las clases para que los efectos al pasar el ratón no hereden el retraso
    setTimeout(() => { el.classList.remove('revela', 'visto'); el.style.removeProperty('--retraso'); }, 900);
  });
}

// Cuenta desde 0 hasta el número que muestra el elemento (formato español: 1.590 · 25,2).
// Solo toca el primer texto del elemento, así lo que va detrás (unidades, <small>…) se queda igual.
export function contar(el) {
  if (el.dataset.contado) return;
  const nodo = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim());
  const m = nodo?.nodeValue.match(/^(\s*[+-]?)([\d.]+(?:,\d+)?)(.*)$/s);
  if (!m) return;
  el.dataset.contado = '1';
  const final = Number(m[2].replace(/\./g, '').replace(',', '.'));
  if (!isFinite(final) || final === 0) return;
  const decimales = (m[2].split(',')[1] || '').length;
  const t0 = performance.now(), dur = 700;
  const paso = ahora => {
    const t = Math.min(1, (ahora - t0) / dur);
    const v = final * (1 - Math.pow(1 - t, 3));
    nodo.nodeValue = m[1] + v.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + m[3];
    if (t < 1) requestAnimationFrame(paso);
    else nodo.nodeValue = m[1] + m[2] + m[3];
  };
  requestAnimationFrame(paso);
}

/* ======================= 3. PÍLDORA DESLIZANTE ======================= */
// Coloca un indicador detrás (o debajo) de la opción activa de un menú y lo anima al cambiar
export function indicador(nav, vertical = false) {
  if (!nav || nav.classList.contains('oculto')) return;
  let ind = nav.querySelector(':scope > .indicador');
  if (!ind) {
    ind = document.createElement('span');
    ind.className = 'indicador';
    nav.prepend(ind);
    nav.classList.add('con-indicador');
    // Si el menú se ha vuelto a dibujar, la píldora sale desde donde estaba antes
    if (nav.dataset.antes) {
      ind.style.transition = 'none';
      ind.style.transform = nav.dataset.antes;
      ind.style.width = nav.dataset.ancho;
      ind.getBoundingClientRect();
      ind.style.transition = '';
    }
  }
  const activo = nav.querySelector('.activo');
  if (!activo) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1;
  if (vertical) {
    ind.style.transform = `translateY(${activo.offsetTop}px)`;
    ind.style.height = `${activo.offsetHeight}px`;
    ind.style.width = `${activo.offsetWidth}px`;
  } else {
    ind.style.transform = `translateX(${activo.offsetLeft}px)`;
    ind.style.width = `${activo.offsetWidth}px`;
    nav.dataset.antes = ind.style.transform;
    nav.dataset.ancho = ind.style.width;
    // Que la opción elegida quede a la vista en el móvil
    if (nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: activo.offsetLeft - nav.clientWidth / 2 + activo.offsetWidth / 2, behavior: sinMovimiento() ? 'auto' : 'smooth' });
    }
  }
}

/* ======================= 4. VENTANA AMPLIADA ======================= */
// Se abre desde el mosaico pulsado y crece hasta el centro, como las tarjetas "+" de apple.com
export function abrirModal({ origen, titulo, subtitulo = '', contenido, alAbrir }) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `
    <div class="modal-tarjeta" role="dialog" aria-modal="true" aria-label="${titulo}">
      <button class="modal-cerrar" aria-label="Cerrar">×</button>
      <div class="modal-cuerpo">
        ${subtitulo ? `<p class="modal-sub">${subtitulo}</p>` : ''}
        <h2 class="modal-titulo">${titulo}</h2>
        ${contenido}
      </div>
    </div>`;
  document.body.appendChild(fondo);
  document.documentElement.classList.add('sin-scroll');
  const tarjeta = fondo.querySelector('.modal-tarjeta');

  // Animación FLIP: la tarjeta empieza con la forma y posición del mosaico
  const desde = origen?.getBoundingClientRect();
  const hasta = tarjeta.getBoundingClientRect();
  const animar = desde && !sinMovimiento();
  if (animar) {
    const sx = desde.width / hasta.width, sy = desde.height / hasta.height;
    const dx = desde.left - hasta.left, dy = desde.top - hasta.top;
    tarjeta.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '28px', opacity: 0.6 },
      { transform: 'none', borderRadius: '28px', opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    fondo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    fondo.querySelector('.modal-cuerpo').animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 160, fill: 'backwards', easing: 'ease-out' });
  }

  const cerrar = async () => {
    removeEventListener('keydown', alTeclado);
    if (animar && origen.isConnected) {
      const r = origen.getBoundingClientRect(), h = tarjeta.getBoundingClientRect();
      fondo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
      await tarjeta.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${r.left - h.left}px, ${r.top - h.top}px) scale(${r.width / h.width}, ${r.height / h.height})`, opacity: 0 },
      ], { duration: 340, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).finished;
    }
    fondo.remove();
    document.documentElement.classList.remove('sin-scroll');
  };
  const alTeclado = ev => { if (ev.key === 'Escape') cerrar(); };
  addEventListener('keydown', alTeclado);
  fondo.addEventListener('click', ev => {
    if (ev.target === fondo || ev.target.closest('.modal-cerrar') || ev.target.closest('[data-cerrar-modal]')) cerrar();
  });
  fondo.querySelector('.modal-cerrar').focus({ preventScroll: true });
  alAbrir?.(fondo.querySelector('.modal-cuerpo'), cerrar);
  return cerrar;
}

/* ======================= 5. CARRUSELES ======================= */
// <div class="carrusel"><div class="carrusel-pista">…tarjetas…</div></div>
export function carruseles(cont) {
  cont.querySelectorAll('.carrusel').forEach(c => {
    if (c.dataset.listo) return;
    c.dataset.listo = '1';
    const pista = c.querySelector('.carrusel-pista');
    const controles = document.createElement('div');
    controles.className = 'carrusel-flechas';
    controles.innerHTML = `
      <button class="flecha" data-dir="-1" aria-label="Anterior"><svg viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg></button>
      <button class="flecha" data-dir="1" aria-label="Siguiente"><svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg></button>`;
    c.appendChild(controles);
    const actualizar = () => {
      const [ant, sig] = controles.querySelectorAll('.flecha');
      ant.disabled = pista.scrollLeft < 4;
      sig.disabled = pista.scrollLeft + pista.clientWidth > pista.scrollWidth - 4;
      controles.hidden = pista.scrollWidth <= pista.clientWidth + 4;
    };
    controles.onclick = ev => {
      const b = ev.target.closest('.flecha');
      if (b) pista.scrollBy({ left: Number(b.dataset.dir) * pista.clientWidth * 0.85, behavior: sinMovimiento() ? 'auto' : 'smooth' });
    };
    pista.addEventListener('scroll', actualizar, { passive: true });
    addEventListener('resize', actualizar);
    requestAnimationFrame(actualizar);
    setTimeout(actualizar, 600);   // tras la animación de aparición
  });
}

/* ======================= 6. TRANSICIÓN ENTRE SECCIONES ======================= */
export function transicion(cambio) {
  if (!document.startViewTransition || sinMovimiento()) return cambio();
  document.startViewTransition(cambio);
}
