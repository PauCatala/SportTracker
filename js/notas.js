// NOTAS: bloc de notas sencillo. Lo usan Estudios y trabajo y Personal (cada uno con su propia lista).
import { leer, guardar, nuevoId, escapar } from './almacen.js';
import { icono } from './iconos.js';

const abiertaEn = {};   // qué nota está abierta en cada lista

export function renderNotas(cont, clave) {
  const notas = leer(clave, []).sort((a, b) => b.editada - a.editada);
  const abierta = notas.find(n => n.id === abiertaEn[clave]);

  if (abierta) {
    cont.innerHTML = `
      <div class="nota-barra">
        <button class="btn-texto" data-volver>${icono('izq')}Todas las notas</button>
        <button class="btn-icono" data-borrar aria-label="Borrar nota">${icono('papelera')}</button>
      </div>
      <section class="panel nota-editor">
        <input class="nota-titulo" placeholder="Título" value="${escapar(abierta.titulo)}" data-campo="titulo">
        <textarea class="nota-texto" placeholder="Escribe aquí…" data-campo="texto">${escapar(abierta.texto)}</textarea>
        <p class="tenue">Se guarda sola mientras escribes.</p>
      </section>`;
    const texto = cont.querySelector('.nota-texto');
    texto.focus();
    texto.setSelectionRange(texto.value.length, texto.value.length);

    cont.oninput = ev => {
      const campo = ev.target.dataset.campo;
      if (!campo) return;
      guardar(clave, leer(clave, []).map(n => (n.id === abierta.id ? { ...n, [campo]: ev.target.value, editada: Date.now() } : n)));
    };
    cont.onclick = ev => {
      if (ev.target.closest('[data-volver]')) { abiertaEn[clave] = null; return renderNotas(cont, clave); }
      if (ev.target.closest('[data-borrar]') && confirm('¿Borrar esta nota?')) {
        guardar(clave, leer(clave, []).filter(n => n.id !== abierta.id));
        abiertaEn[clave] = null;
        renderNotas(cont, clave);
      }
    };
    return;
  }

  cont.innerHTML = `
    <div class="fila-botones">
      <button class="btn primario" data-nueva>${icono('mas')}Nueva nota</button>
      <input class="buscador" type="search" placeholder="Buscar en tus notas" data-buscar>
    </div>
    <div class="notas-grid">
      ${notas.length ? notas.map(n => `
        <button class="nota-tarjeta" data-abrir="${n.id}" data-busqueda="${escapar((n.titulo + ' ' + n.texto).toLowerCase())}">
          <b>${escapar(n.titulo || 'Sin título')}</b>
          <p>${escapar(n.texto.slice(0, 140)) || '<span class="tenue">Vacía</span>'}</p>
          <small class="tenue">${new Date(n.editada).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</small>
        </button>`).join('') : '<p class="tenue">Aún no tienes notas. Crea la primera.</p>'}
    </div>`;

  cont.onclick = ev => {
    if (ev.target.closest('[data-nueva]')) {
      const n = { id: nuevoId(), titulo: '', texto: '', editada: Date.now() };
      guardar(clave, [...leer(clave, []), n]);
      abiertaEn[clave] = n.id;
      return renderNotas(cont, clave);
    }
    const a = ev.target.closest('[data-abrir]');
    if (a) { abiertaEn[clave] = a.dataset.abrir; renderNotas(cont, clave); }
  };
  cont.oninput = ev => {
    if (!ev.target.matches('[data-buscar]')) return;
    const q = ev.target.value.trim().toLowerCase();
    cont.querySelectorAll('.nota-tarjeta').forEach(t => { t.hidden = q && !t.dataset.busqueda.includes(q); });
  };
}
