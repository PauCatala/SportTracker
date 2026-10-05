// IMAGEN: tres carpetas de fotos.
//  - Progreso físico: una foto cada domingo por la mañana, en ayunas y sin haber entrenado.
//  - Comidas: fotos de lo que comes.
//  - Tu día: recuerdos.
import { leer, hoyISO, nuevoId, escapar } from './almacen.js';
import { guardarFoto, borrarFoto, fotosDe, comprimir, domingoDe, semanaDeFoto, avisoProgreso } from './fotos.js';
import { icono } from './iconos.js';
import { aviso, fmtCorta, sumarDias } from './utils.js';

let urls = [];                        // direcciones temporales de las fotos en pantalla
const urlDe = blob => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
const limpiarUrls = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
const fechaLarga = f => new Date(`${f}T12:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

// Peso registrado más cercano a una fecha (para acompañar la foto de progreso)
function pesoCerca(fecha) {
  const pesos = leer('pesos', []);
  if (!pesos.length) return null;
  return pesos.reduce((m, x) => (Math.abs(new Date(x.fecha) - new Date(fecha)) < Math.abs(new Date(m.fecha) - new Date(fecha)) ? x : m));
}

// Botón para subir fotos (en el móvil abre la cámara o la galería)
const botonSubir = (texto, multiple = false) => `
  <label class="btn primario subir-foto">
    ${icono('imagen')}${texto}
    <input type="file" accept="image/*" ${multiple ? 'multiple' : ''} hidden data-subir>
  </label>`;

async function subir(cont, carpeta, archivos, extra = {}) {
  if (!archivos.length) return;
  aviso(archivos.length > 1 ? `Guardando ${archivos.length} fotos…` : 'Guardando foto…');
  for (const archivo of archivos) {
    try {
      const blob = await comprimir(archivo);
      await guardarFoto({ id: nuevoId(), carpeta, fecha: hoyISO(), creada: Date.now(), nota: '', blob, ...extra });
    } catch (e) {
      console.warn(e);
      aviso('No se pudo guardar una de las fotos', 'error');
    }
  }
  aviso(archivos.length > 1 ? 'Fotos guardadas' : 'Foto guardada');
}

// Visor a pantalla completa
function abrirVisor(foto, alBorrar) {
  const visor = document.createElement('div');
  visor.className = 'visor';
  visor.innerHTML = `
    <figure>
      <img src="${urlDe(foto.blob)}" alt="">
      <figcaption>
        <span><b>${fechaLarga(foto.fecha)}</b>${foto.nota ? ` · ${escapar(foto.nota)}` : ''}</span>
        <span class="visor-acciones">
          <button class="btn chico" data-borrar>${icono('papelera')}Borrar</button>
          <button class="btn chico primario" data-cerrar>Cerrar</button>
        </span>
      </figcaption>
    </figure>`;
  const cerrar = () => visor.remove();
  visor.onclick = async ev => {
    if (ev.target === visor || ev.target.closest('[data-cerrar]')) return cerrar();
    if (ev.target.closest('[data-borrar]') && confirm('¿Borrar esta foto?')) {
      await borrarFoto(foto.id);
      cerrar();
      alBorrar();
    }
  };
  document.body.appendChild(visor);
}

// Cuadrícula de fotos agrupadas por fecha
function galeria(fotos, porSemana = false) {
  const grupos = new Map();
  fotos.forEach(f => {
    const clave = porSemana ? semanaDeFoto(f) : f.fecha;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(f);
  });
  return [...grupos].map(([clave, fs]) => `
    <div class="grupo-fotos">
      <h4>${porSemana ? `Semana del ${fmtCorta(sumarDias(clave, -6)).toLowerCase()}` : fechaLarga(clave)}</h4>
      <div class="fotos-grid">
        ${fs.map(f => `
          <button class="foto" data-foto="${f.id}">
            <img src="${urlDe(f.blob)}" alt="${escapar(f.nota || 'Foto')}" loading="lazy">
            ${f.nota ? `<span>${escapar(f.nota)}</span>` : ''}
          </button>`).join('')}
      </div>
    </div>`).join('');
}

function conectarGaleria(cont, fotos, repintar) {
  cont.querySelectorAll('[data-foto]').forEach(b => {
    b.onclick = () => abrirVisor(fotos.find(f => f.id === b.dataset.foto), repintar);
  });
}

// ============================== PROGRESO FÍSICO ==============================
let comparar = { antes: null, despues: null };

export async function renderProgresoFisico(cont) {
  limpiarUrls();
  const fotos = await fotosDe('progreso');
  const avisoEstado = await avisoProgreso();
  const semanaActual = domingoDe(hoyISO());
  const hechaEstaSemana = fotos.some(f => semanaDeFoto(f) === semanaActual);
  const ordenadas = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const antes = ordenadas.find(f => f.id === comparar.antes) || ordenadas[0];
  const despues = ordenadas.find(f => f.id === comparar.despues) || ordenadas.at(-1);
  const pie = f => { const p = pesoCerca(f.fecha); return `${fmtCorta(f.fecha)}${p ? ` · ${String(p.kg).replace('.', ',')} kg` : ''}`; };

  cont.innerHTML = `
    <section class="panel foto-semana ${avisoEstado ? 'pendiente' : ''}">
      <div>
        <h3>${avisoEstado === 'hoy' ? 'Hoy toca tu foto de progreso' : avisoEstado === 'falto' ? 'Te faltó la foto del domingo' : hechaEstaSemana ? 'Foto de esta semana hecha' : 'Tu foto semanal'}</h3>
        <p>Cada <b>domingo por la mañana</b>, <b>en ayunas</b> y <b>sin haber hecho ejercicio</b>. Misma luz, mismo sitio y misma postura: así la comparación es real.</p>
      </div>
      ${botonSubir(hechaEstaSemana && !avisoEstado ? 'Añadir otra' : 'Subir foto')}
    </section>

    ${ordenadas.length >= 2 ? `
    <section class="panel">
      <div class="panel-cab"><h3>Antes y después</h3><span class="tenue">${ordenadas.length} fotos</span></div>
      <div class="comparador">
        <figure>
          <img src="${urlDe(antes.blob)}" alt="Antes">
          <select data-comparar="antes" aria-label="Foto de antes">${ordenadas.map(f => `<option value="${f.id}" ${f.id === antes.id ? 'selected' : ''}>${pie(f)}</option>`).join('')}</select>
        </figure>
        <figure>
          <img src="${urlDe(despues.blob)}" alt="Después">
          <select data-comparar="despues" aria-label="Foto de después">${ordenadas.map(f => `<option value="${f.id}" ${f.id === despues.id ? 'selected' : ''}>${pie(f)}</option>`).join('')}</select>
        </figure>
      </div>
    </section>` : ''}

    <section class="panel">
      <div class="panel-cab"><h3>Todas tus semanas</h3></div>
      ${fotos.length ? galeria(fotos, true) : '<p class="tenue">Aún no hay fotos. La primera es la más importante: es tu punto de partida.</p>'}
    </section>`;

  const repintar = () => renderProgresoFisico(cont);
  conectarGaleria(cont, fotos, repintar);
  cont.onchange = async ev => {
    if (ev.target.matches('[data-subir]')) {
      // Si se sube lunes o martes y faltaba la del domingo, cuenta para la semana pasada
      const semana = avisoEstado === 'falto' ? domingoDe(sumarDias(hoyISO(), -7)) : semanaActual;
      await subir(cont, 'progreso', [...ev.target.files], { semana });
      return repintar();
    }
    const c = ev.target.dataset.comparar;
    if (c) { comparar[c] = ev.target.value; repintar(); }
  };
}

// ============================== COMIDAS ==============================
export async function renderFotosComidas(cont) {
  limpiarUrls();
  const fotos = await fotosDe('comidas');
  cont.innerHTML = `
    <section class="panel foto-semana">
      <div>
        <h3>Tus comidas</h3>
        <p>Haz una foto antes de comer. Te ayuda a ser consciente de lo que comes y a recordar qué te funcionó.</p>
        <input class="nota-foto" placeholder="Nota opcional: comida de hoy, cena fuera…" data-nota>
      </div>
      ${botonSubir('Subir fotos', true)}
    </section>
    <section class="panel">
      ${fotos.length ? galeria(fotos) : '<p class="tenue">Aún no hay fotos de comidas.</p>'}
    </section>`;
  const repintar = () => renderFotosComidas(cont);
  conectarGaleria(cont, fotos, repintar);
  cont.onchange = async ev => {
    if (!ev.target.matches('[data-subir]')) return;
    await subir(cont, 'comidas', [...ev.target.files], { nota: cont.querySelector('[data-nota]').value.trim() });
    repintar();
  };
}

// ============================== TU DÍA ==============================
export async function renderFotosDia(cont) {
  limpiarUrls();
  const fotos = await fotosDe('dia');
  cont.innerHTML = `
    <section class="panel foto-semana">
      <div>
        <h3>Tu día</h3>
        <p>Guarda los momentos que quieras recordar: un plan, un viaje, un logro.</p>
        <input class="nota-foto" placeholder="¿Qué pasó? (opcional)" data-nota>
      </div>
      ${botonSubir('Subir fotos', true)}
    </section>
    <section class="panel">
      ${fotos.length ? galeria(fotos) : '<p class="tenue">Aún no hay recuerdos guardados.</p>'}
    </section>`;
  const repintar = () => renderFotosDia(cont);
  conectarGaleria(cont, fotos, repintar);
  cont.onchange = async ev => {
    if (!ev.target.matches('[data-subir]')) return;
    await subir(cont, 'dia', [...ev.target.files], { nota: cont.querySelector('[data-nota]').value.trim() });
    repintar();
  };
}
