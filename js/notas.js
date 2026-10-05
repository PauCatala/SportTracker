// POST-ITS: recordatorios rápidos al lado de tus tareas.
// Los usan Estudios y trabajo y Personal, cada uno con su propia lista.
// Se escriben directamente encima y se guardan solos.
import { leer, guardar, nuevoId, escapar } from './almacen.js';
import { icono } from './iconos.js';

// Tonos de papel (familia de azules y un gris), uno por post-it
const PAPELES = ['#E4EBFF', '#DDEBFB', '#E2F0FF', '#ECEEF2'];

// Las notas antiguas (con título y texto) pasan a ser post-its
function leerPostits(clave) {
  return leer(clave, []).map((n, i) => ({
    id: n.id, color: n.color ?? i % PAPELES.length, editada: n.editada || Date.now(),
    texto: n.texto != null && n.titulo != null ? [n.titulo, n.texto].filter(Boolean).join('\n') : (n.texto || ''),
  }));
}

export function renderPostits(el, clave) {
  const postits = leerPostits(clave);
  el.innerHTML = `
    <div class="postits-cab">
      <h3>Post-its</h3>
      <button class="btn suave chico" data-nuevo>${icono('mas')}Nuevo</button>
    </div>
    <div class="postits">
      ${postits.map((n, i) => `
        <div class="postit" data-id="${n.id}" style="--papel:${PAPELES[n.color % PAPELES.length]}; --giro:${[-1.6, 1.2, -0.6, 1.8][i % 4]}deg">
          <textarea aria-label="Post-it" placeholder="Escribe un recordatorio…">${escapar(n.texto)}</textarea>
          <div class="postit-acciones">
            <button class="postit-btn" data-color aria-label="Cambiar color"><i></i></button>
            <button class="postit-btn" data-quitar aria-label="Quitar post-it">${icono('x')}</button>
          </div>
        </div>`).join('') || '<p class="tenue postits-vacio">Pega aquí tus recordatorios: llamadas, ideas, cosas que no quieres olvidar.</p>'}
    </div>`;

  const actualizar = (id, cambios) =>
    guardar(clave, leerPostits(clave).map(n => (n.id === id ? { ...n, ...cambios, editada: Date.now() } : n)));

  el.oninput = ev => {
    const p = ev.target.closest('.postit');
    if (p && ev.target.tagName === 'TEXTAREA') actualizar(p.dataset.id, { texto: ev.target.value });
  };
  el.onclick = ev => {
    if (ev.target.closest('[data-nuevo]')) {
      const lista = leerPostits(clave);
      const nuevo = { id: nuevoId(), texto: '', color: lista.length % PAPELES.length, editada: Date.now() };
      guardar(clave, [nuevo, ...lista]);
      renderPostits(el, clave);
      el.querySelector(`[data-id="${nuevo.id}"] textarea`)?.focus();
      return;
    }
    const p = ev.target.closest('.postit');
    if (!p) return;
    if (ev.target.closest('[data-color]')) {
      const n = leerPostits(clave).find(x => x.id === p.dataset.id);
      actualizar(p.dataset.id, { color: (n.color + 1) % PAPELES.length });
      return renderPostits(el, clave);
    }
    if (ev.target.closest('[data-quitar]')) {
      guardar(clave, leerPostits(clave).filter(n => n.id !== p.dataset.id));
      renderPostits(el, clave);
    }
  };
}
