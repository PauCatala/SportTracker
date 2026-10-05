// PERSONAL: hábitos (verde = hecho, rojo = no hecho), lista general de tareas y notas.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { renderNotas } from './notas.js';
import { icono } from './iconos.js';
import { sumarDias, parseISO } from './utils.js';

// ============================== HÁBITOS ==============================
const estadoDe = (dias, id, fecha) => dias[id]?.[fecha] || '';

export function racha(dias, id) {
  let fecha = hoyISO();
  if (estadoDe(dias, id, fecha) !== 'si') fecha = sumarDias(fecha, -1);   // hoy aún puede estar pendiente
  let n = 0;
  while (estadoDe(dias, id, fecha) === 'si') { n++; fecha = sumarDias(fecha, -1); }
  return n;
}
export function habitosDeHoy() {
  const habitos = leer('habitos', []);
  const dias = leer('habitos-dias', {});
  const hoy = hoyISO();
  return { total: habitos.length, hechos: habitos.filter(h => estadoDe(dias, h.id, hoy) === 'si').length };
}

export function renderHabitos(cont) {
  const habitos = leer('habitos', []);
  const dias = leer('habitos-dias', {});
  const hoy = hoyISO();
  const n = innerWidth < 700 ? 7 : 14;
  const fechas = Array.from({ length: n }, (_, i) => sumarDias(hoy, i - n + 1));
  const letra = f => parseISO(f).toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();
  const pct30 = id => {
    const ult = Array.from({ length: 30 }, (_, i) => sumarDias(hoy, -i));
    const marcados = ult.filter(f => estadoDe(dias, id, f));
    return marcados.length ? Math.round((marcados.filter(f => estadoDe(dias, id, f) === 'si').length / marcados.length) * 100) : null;
  };

  cont.innerHTML = `
    <section class="panel">
      <div class="panel-cab">
        <h3>Tus hábitos</h3>
        <span class="leyenda-habitos"><i class="si"></i>Hecho <i class="no"></i>No hecho</span>
      </div>
      ${habitos.length ? `
      <div class="habitos" style="--dias:${n}">
        <div class="habitos-fila cabeza">
          <span></span>
          ${fechas.map(f => `<span class="dia-h ${f === hoy ? 'hoy' : ''}">${letra(f)}<small>${parseISO(f).getDate()}</small></span>`).join('')}
          <span class="tenue">Racha</span>
        </div>
        ${habitos.map(h => `
          <div class="habitos-fila">
            <span class="habito-nombre">
              ${escapar(h.nombre)}
              <button class="btn-icono mini" data-borrar-habito="${h.id}" aria-label="Borrar hábito">${icono('x')}</button>
            </span>
            ${fechas.map(f => {
              const e = estadoDe(dias, h.id, f);
              return `<button class="celda-h ${e} ${f === hoy ? 'hoy' : ''}" data-h="${h.id}" data-f="${f}" aria-label="${escapar(h.nombre)}, ${f}: ${e === 'si' ? 'hecho' : e === 'no' ? 'no hecho' : 'sin marcar'}">${e === 'si' ? icono('check') : e === 'no' ? icono('x') : ''}</button>`;
            }).join('')}
            <span class="racha-h"><b>${racha(dias, h.id)}</b><small>${pct30(h.id) != null ? `${pct30(h.id)}%` : ''}</small></span>
          </div>`).join('')}
      </div>
      <p class="tenue" style="margin-top:10px">Toca una casilla: una vez para verde, otra para rojo y otra para dejarla vacía.</p>`
      : '<p class="tenue">Aún no tienes hábitos. Prueba con "Beber 2 litros de agua", "Leer 20 minutos" o "Dormir 8 horas".</p>'}
      <form class="fila-anadir" id="h-form" style="margin-top:14px" autocomplete="off">
        <input name="nombre" placeholder="Nuevo hábito" required>
        <button class="btn primario" type="submit">${icono('mas')}Añadir</button>
      </form>
    </section>`;

  cont.onclick = ev => {
    const c = ev.target.closest('[data-h]');
    if (c) {
      const todos = leer('habitos-dias', {});
      const actual = todos[c.dataset.h]?.[c.dataset.f] || '';
      const siguiente = { '': 'si', si: 'no', no: '' }[actual];
      todos[c.dataset.h] = { ...(todos[c.dataset.h] || {}), [c.dataset.f]: siguiente };
      if (!siguiente) delete todos[c.dataset.h][c.dataset.f];
      guardar('habitos-dias', todos);
      return renderHabitos(cont);
    }
    const b = ev.target.closest('[data-borrar-habito]');
    if (b && confirm('¿Borrar este hábito y su historial?')) {
      guardar('habitos', leer('habitos', []).filter(h => h.id !== b.dataset.borrarHabito));
      const todos = leer('habitos-dias', {});
      delete todos[b.dataset.borrarHabito];
      guardar('habitos-dias', todos);
      renderHabitos(cont);
    }
  };
  cont.querySelector('#h-form').onsubmit = ev => {
    ev.preventDefault();
    const nombre = new FormData(ev.target).get('nombre').trim();
    if (!nombre) return;
    guardar('habitos', [...leer('habitos', []), { id: nuevoId(), nombre }]);
    renderHabitos(cont);
  };
}

// ============================== LISTA ==============================
export const pendientesLista = () => leer('lista', []).filter(x => !x.hecho).length;

export function renderLista(cont) {
  const lista = leer('lista', []);
  const pendientes = lista.filter(x => !x.hecho), hechas = lista.filter(x => x.hecho);
  const item = x => `
    <li class="item-lista ${x.hecho ? 'hecho' : ''}">
      <button class="caja-lista" data-marcar="${x.id}" aria-pressed="${x.hecho}" aria-label="${x.hecho ? 'Desmarcar' : 'Marcar como hecha'}">${icono('check')}</button>
      <span>${escapar(x.texto)}</span>
      <button class="btn-icono" data-borrar="${x.id}" aria-label="Borrar">${icono('papelera')}</button>
    </li>`;

  cont.innerHTML = `
    <section class="panel">
      <form class="fila-anadir" id="l-form" autocomplete="off">
        <input name="texto" placeholder="Añadir a tu lista: comprar, llamar, reservar..." required>
        <button class="btn primario" type="submit">${icono('mas')}Añadir</button>
      </form>
      <ul class="lista-tareas">${pendientes.map(item).join('') || '<li class="tenue" style="padding:14px 0">Todo hecho. Buen trabajo.</li>'}</ul>
    </section>
    ${hechas.length ? `
    <section class="panel">
      <div class="panel-cab"><h3>Hechas</h3><button class="btn-texto" data-limpiar>Borrar hechas</button></div>
      <ul class="lista-tareas">${hechas.map(item).join('')}</ul>
    </section>` : ''}`;

  const form = cont.querySelector('#l-form');
  form.onsubmit = ev => {
    ev.preventDefault();
    const texto = new FormData(form).get('texto').trim();
    if (!texto) return;
    guardar('lista', [...leer('lista', []), { id: nuevoId(), texto, hecho: false }]);
    renderLista(cont);
    cont.querySelector('#l-form input').focus();
  };
  cont.onclick = ev => {
    const m = ev.target.closest('[data-marcar]');
    if (m) {
      guardar('lista', leer('lista', []).map(x => (x.id === m.dataset.marcar ? { ...x, hecho: !x.hecho } : x)));
      return renderLista(cont);
    }
    const b = ev.target.closest('[data-borrar]');
    if (b) { guardar('lista', leer('lista', []).filter(x => x.id !== b.dataset.borrar)); return renderLista(cont); }
    if (ev.target.closest('[data-limpiar]')) { guardar('lista', leer('lista', []).filter(x => !x.hecho)); renderLista(cont); }
  };
}

export const renderNotasPersonal = cont => renderNotas(cont, 'notas-personal');
