// INICIO: tu avatar corriendo dentro de la rueda de Lumen y, al lado, lo que tienes hoy.
// - La rueda (3D) está en inicio/rueda.js, las publicaciones en inicio/publicaciones.js
//   y el avatar en inicio/avatar.js.
// - Los widgets usan datos reales de cada módulo y puedes elegir cuáles ver.
import { leer, guardar, hoyISO, escapar } from './almacen.js';
import { icono } from './iconos.js';
import { capitalizar } from './utils.js';
import { eventosEntre } from './agenda.js';
import { tareasDeLaSemana } from './estudios.js';
import { habitosDeHoy, pendientesLista } from './personal.js';
import { objetivosDelDia, totalesDe } from './nutricion.js';
import { fotosDe, avisoProgreso } from './fotos.js';
import { AREAS, pintarPublicacion } from './inicio/publicaciones.js';
import { soporta3D, crearRueda } from './inicio/rueda.js';
import { MODELOS, ASPECTO_BASE, leerAspecto, guardarAspecto } from './inicio/avatar.js';

let actual = null;          // la escena viva (para destruirla al salir)
let urls = [];              // fotos abiertas como URL temporales

export function cerrarInicio() {
  actual?.destruir();
  actual = null;
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  document.body.classList.remove('en-inicio');
}

const sinEtiquetas = html => html.replace(/<[^>]+>/g, '');
const ahoraHHMM = () => new Date().toTimeString().slice(0, 5);
const areaDe = id => AREAS.find(a => a.id === id);

// ---------- Datos de hoy (todo de los módulos que ya existen) ----------
function datosDeHoy(ctx) {
  const hoy = hoyISO();
  const eventos = eventosEntre(hoy, hoy).sort((a, b) => (a.inicio || '00:00').localeCompare(b.inicio || '00:00'));
  const ahora = ahoraHHMM();
  const proximo = eventos.find(e => !e.todoElDia && (e.fin || e.inicio) >= ahora && !e.hecho) || eventos.find(e => e.todoElDia && !e.hecho);
  const entreno = ctx.entrenoDeHoy();
  const pendiente = entreno.find(l => l.estado === 'pendiente') || entreno[0];
  const obj = objetivosDelDia();
  const tot = totalesDe(hoy);
  const semana = tareasDeLaSemana();
  const hab = habitosDeHoy();
  const lista = pendientesLista();
  return { hoy, eventos, proximo, entreno, pendiente, obj, tot, semana, hab, lista };
}

// ---------- Widgets ----------
const WIDGETS = {
  proximo: { nombre: 'Lo próximo', area: 'calendario', ico: 'calendario' },
  entreno: { nombre: 'Entreno de hoy', area: 'salud', ico: 'running' },
  comida: { nombre: 'Calorías del día', area: 'salud', ico: 'nutricion' },
  tareas: { nombre: 'Entregas de la semana', area: 'estudios', ico: 'estudios' },
  habitos: { nombre: 'Hábitos de hoy', area: 'personal', ico: 'organizacion' },
  lista: { nombre: 'Tu lista', area: 'personal', ico: 'check' },
  foto: { nombre: 'Foto de progreso', area: 'imagen', ico: 'imagen' },
};
const POR_DEFECTO = ['proximo', 'entreno', 'comida', 'tareas', 'habitos'];

function widget(id, d, ctx) {
  const w = WIDGETS[id], a = areaDe(w.area);
  const estilo = `--w-suave:${a.suave};--w-fuerte:${a.fuerte}`;
  const marco = (pequeno, grande, dato = '', ir = a.ir, barra = null) => `
    <button class="widget" style="${estilo}" data-ir="${ir}">
      <span class="w-ico">${icono(w.ico)}</span>
      <span><small>${pequeno}</small><b>${grande}</b></span>
      <span class="w-dato">${dato}</span>
      ${barra !== null ? `<span class="w-barra"><i style="width:${Math.round(Math.min(1, barra) * 100)}%"></i></span>` : ''}
    </button>`;
  if (id === 'proximo') {
    const e = d.proximo;
    return e ? marco(e.todoElDia ? 'Hoy' : (e.inicio <= ahoraHHMM() ? 'Ahora' : `A las ${e.inicio}`), escapar(e.titulo), '', 'calendario')
      : marco('Lo próximo', d.eventos.length ? 'Nada más por hoy' : 'Día libre en el calendario', '', 'calendario');
  }
  if (id === 'entreno') {
    const l = d.pendiente;
    return marco(l?.estado === 'hecho' ? 'Hecho' : 'Te toca', escapar(sinEtiquetas(l?.texto || 'Descanso')), '', l?.ir || 'salud');
  }
  if (id === 'comida') {
    if (!d.obj) return marco('Calorías', 'Completa tu perfil', '', 'salud|perfil|datos');
    return marco('Calorías de hoy', `${Math.round(d.tot.kcal).toLocaleString('es-ES')} de ${d.obj.kcal.toLocaleString('es-ES')}`, '', 'salud|nutricion|hoy', d.tot.kcal / d.obj.kcal);
  }
  if (id === 'tareas') {
    const n = d.semana.length;
    return marco('Esta semana', n ? `${n} ${n === 1 ? 'entrega' : 'entregas'}` : 'Sin entregas', n ? escapar(d.semana[0].titulo).slice(0, 18) : '', 'estudios|estudios|tablero');
  }
  if (id === 'habitos') {
    return d.hab.total
      ? marco('Hábitos de hoy', `${d.hab.hechos} de ${d.hab.total}`, '', 'personal|personal|habitos', d.hab.hechos / d.hab.total)
      : marco('Hábitos', 'Crea tu primer hábito', '', 'personal|personal|habitos');
  }
  if (id === 'lista') {
    const n = d.lista.length;
    return marco('Tu lista', n ? `${n} por hacer` : 'Todo hecho', n ? escapar(d.lista[0].texto).slice(0, 18) : '', 'personal|personal|lista');
  }
  if (id === 'foto') return marco('Foto de progreso', 'Cada domingo', '', 'imagen|imagen|progreso').replace('<b>Cada domingo</b>', '<b data-foto>Cada domingo</b>');
  return '';
}

function pintarWidgets(cont, d, ctx) {
  const elegidos = leer('inicio-widgets', POR_DEFECTO).filter(id => WIDGETS[id]);
  cont.querySelector('#widgets').innerHTML = elegidos.map(id => widget(id, d, ctx)).join('')
    || '<p class="tenue">Elige qué quieres ver aquí.</p>';
  cont.querySelector('#widgets-panel').innerHTML = Object.entries(WIDGETS).map(([id, w]) =>
    `<label><input type="checkbox" data-widget="${id}" ${elegidos.includes(id) ? 'checked' : ''}>${w.nombre}</label>`).join('');
  if (elegidos.includes('foto')) avisoProgreso().then(estado => {
    const b = cont.querySelector('[data-foto]');
    if (b && estado) b.textContent = estado === 'hoy' ? 'Hoy toca foto' : 'Falta la del domingo';
  });
}

// ---------- Publicaciones de la rueda ----------
async function publicaciones(d) {
  const proximo = d.proximo ? `${d.proximo.inicio ? `${d.proximo.inicio} · ` : ''}${d.proximo.titulo}` : 'Nada más por hoy';
  let foto = null;
  try {
    const f = (await fotosDe('progreso'))[0] || (await fotosDe('dia'))[0] || (await fotosDe('comidas'))[0];
    if (f) { foto = URL.createObjectURL(f.blob); urls.push(foto); }
  } catch { /* sin fotos */ }
  const datos = {
    salud: { dato: sinEtiquetas(d.pendiente?.texto || 'Día de descanso'), detalle: d.obj ? `Llevas ${Math.round(d.tot.kcal)} de ${d.obj.kcal} kcal` : 'Completa tu perfil para tus objetivos' },
    calendario: { dato: d.eventos.length ? `${d.eventos.length} ${d.eventos.length === 1 ? 'plan' : 'planes'} hoy` : 'Día libre', detalle: proximo },
    estudios: { dato: d.semana.length ? `${d.semana.length} ${d.semana.length === 1 ? 'entrega' : 'entregas'} esta semana` : 'Semana despejada', detalle: d.semana[0]?.titulo || 'Organiza tus tareas y proyectos' },
    personal: { dato: d.hab.total ? `Hábitos: ${d.hab.hechos} de ${d.hab.total}` : 'Tus hábitos y retos', detalle: d.lista.length ? `${d.lista.length} cosas en tu lista` : 'Tu lista está al día' },
    imagen: { dato: foto ? 'Tu última foto' : 'Tu progreso, en fotos', detalle: 'Privadas por defecto', foto },
  };
  return Promise.all(AREAS.map(area => pintarPublicacion({ area, ...datos[area.id] })));
}

// ---------- Editor del avatar ----------
function abrirEditor(escenaEl, rueda) {
  if (escenaEl.querySelector('.editor-avatar')) return;
  const guardado = leerAspecto();
  let a = { ...guardado };
  const spec = MODELOS[a.modelo];
  const panel = document.createElement('aside');
  panel.className = 'editor-avatar';
  panel.setAttribute('aria-label', 'Editor de tu avatar');
  const pintar = () => {
    panel.innerHTML = `
      <div class="editor-cab"><h3>Tu avatar</h3><button data-cerrar aria-label="Cerrar sin guardar">${icono('x')}</button></div>
      <div class="editor-cuerpo">
        ${spec.opciones.map(o => `
          <div class="editor-grupo"><h4>${o.nombre}</h4><div class="editor-opciones">
            ${o.tipo === 'estilos' ? spec.estilos.map((e, i) => `<button class="op-texto" data-estilo="${i}">${e.nombre}</button>`).join('') : ''}
            ${o.tipo === 'color' ? o.valores.map(c => `<button class="op-color ${a[o.id] === c ? 'activo' : ''}" style="--c:${c}" data-op="${o.id}" data-val="${c}" aria-label="${o.nombre} ${c}"></button>`).join('') : ''}
            ${o.tipo === 'texto' ? o.valores.map(([v, n]) => `<button class="op-texto ${a[o.id] === v ? 'activo' : ''}" data-op="${o.id}" data-val="${v}">${n}</button>`).join('') : ''}
          </div></div>`).join('')}
        <p class="editor-nota">Arrastra sobre la escena para girar tu avatar y usa la rueda del ratón para acercarte. Pelo, ropa, zapatillas y tipo de cuerpo llegan con el personaje definitivo.</p>
      </div>
      <div class="editor-pie">
        <button class="btn" data-reset>Restablecer</button>
        <button class="btn primario" data-guardar>Guardar</button>
      </div>`;
  };
  pintar();
  escenaEl.append(panel);
  if (innerWidth < 900) escenaEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  escenaEl.querySelector('.escena-pie')?.setAttribute('hidden', '');
  rueda.modoEditor(true);

  const cerrar = guardar => {
    if (!guardar) rueda.aplicarAspecto(guardado);
    panel.remove();
    escenaEl.querySelector('.escena-pie')?.removeAttribute('hidden');
    rueda.modoEditor(false);
  };
  panel.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.cerrar !== undefined) return cerrar(false);
    if (b.dataset.guardar !== undefined) { guardarAspecto(a); rueda.saludar(); return cerrar(true); }
    if (b.dataset.reset !== undefined) a = { ...ASPECTO_BASE };
    if (b.dataset.estilo !== undefined) { const e = spec.estilos[b.dataset.estilo]; a = { ...a, cuerpo: e.cuerpo, detalles: e.detalles, acabado: e.acabado }; }
    if (b.dataset.op) a = { ...a, [b.dataset.op]: b.dataset.val };
    rueda.aplicarAspecto(a);
    pintar();
  });
  panel.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrar(false); });
  panel.querySelector('button')?.focus();
}

// ---------- La pantalla ----------
export async function renderInicio(cont, ctx) {
  cerrarInicio();
  document.body.classList.add('en-inicio');
  const d = datosDeHoy(ctx);
  const h = new Date().getHours();
  const saludo = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const fecha = capitalizar(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches || leer('inicio-pausa', false);

  cont.innerHTML = `
    <section class="inicio">
      <div class="inicio-escenario">
        <div class="inicio-cab">
          <p class="inicio-fecha">${fecha}</p>
          <h2 class="inicio-saludo">${saludo}${ctx.nombre ? `,<span>${escapar(ctx.nombre)}.</span>` : '.'}</h2>
        </div>
        <div class="inicio-lado">
          <div class="widgets" id="widgets"></div>
          <button class="widgets-editar" data-editar-widgets aria-expanded="false">Elegir qué ver</button>
          <div class="widgets-panel" id="widgets-panel" hidden></div>
          ${ctx.sesionIniciada ? '' : `<div class="hoy-aviso"><p>Sin cuenta, tus datos se guardan solo en este navegador.</p><button class="btn primario chico" data-entrar>Entrar</button></div>`}
        </div>
        <div class="inicio-escena" id="escena">
          <div class="halo" aria-hidden="true"></div>
          <p class="escena-cargando">Preparando tu rueda…</p>
          <p class="escena-ayuda">${matchMedia('(pointer: coarse)').matches ? 'Desliza para girar · toca tu avatar' : 'Arrastra para girar · toca tu avatar para cambiarlo'}</p>
          <span class="escena-tip" aria-hidden="true"></span>
          <div class="escena-pie">
            <button class="flecha" data-pausa aria-label="${quieto ? 'Mover la rueda' : 'Detener el movimiento'}" aria-pressed="${quieto}">${icono(quieto ? 'rayo' : 'x')}</button>
            <button class="flecha" data-girar="-1" aria-label="Publicación anterior">${icono('izq')}</button>
            <button class="destacada" data-destacada><span class="d-ico"></span><b></b><span></span></button>
            <button class="flecha" data-girar="1" aria-label="Publicación siguiente">${icono('der')}</button>
          </div>
        </div>
      </div>
      <nav class="areas" aria-label="Áreas de Lumen">
        ${AREAS.map(a => `<button class="area" style="--a-suave:${a.suave};--a-fuerte:${a.fuerte}" data-area="${a.id}">${icono(a.icono)}${a.titulo}</button>`).join('')}
      </nav>
    </section>`;

  pintarWidgets(cont, d, ctx);
  const escenaEl = cont.querySelector('#escena');
  const destacadaEl = escenaEl.querySelector('[data-destacada]');
  const tip = escenaEl.querySelector('.escena-tip');
  const datosArea = {};

  const marcarDestacada = area => {
    destacadaEl.style.setProperty('--d-suave', area.suave);
    destacadaEl.style.setProperty('--d-fuerte', area.fuerte);
    destacadaEl.querySelector('.d-ico').innerHTML = icono(area.icono);
    destacadaEl.querySelector('b').textContent = area.titulo;
    destacadaEl.querySelector('span:last-child').textContent = datosArea[area.id] || '';
    destacadaEl.dataset.area = area.id;
    destacadaEl.setAttribute('aria-label', `Entrar en ${area.titulo}`);
  };

  // Entrar en un área: un velo de su color cubre la pantalla y aparece la sección
  const entrar = (area, alTerminar) => {
    const cortina = Object.assign(document.createElement('div'), { className: 'cortina' });
    cortina.style.setProperty('--c', area.suave);
    document.body.append(cortina);
    requestAnimationFrame(() => cortina.classList.add('ver'));
    setTimeout(() => {
      ctx.irA(area.ir);
      alTerminar?.();
      requestAnimationFrame(() => { cortina.classList.remove('ver'); setTimeout(() => cortina.remove(), 400); });
    }, quieto ? 0 : 520);
  };

  // ---------- La escena 3D (o, si no se puede, solo los botones de área) ----------
  let rueda = null;
  if (!soporta3D()) {
    cont.querySelector('.inicio').classList.add('sin-3d');
    escenaEl.innerHTML = '<p class="tenue">Tu navegador no muestra escenas 3D. Entra en cada área con los botones de abajo.</p>';
  } else {
    try {
      const lienzos = await publicaciones(d);
      if (!escenaEl.isConnected) return;
      rueda = await crearRueda(escenaEl, {
        lienzos, areas: AREAS, quieto,
        alDestacar: marcarDestacada,
        alElegir: (area, listo) => entrar(area, listo),
        alPulsarAvatar: () => abrirEditor(escenaEl, rueda),
        alSobre: info => {
          if (!info) { tip.classList.remove('ver'); return; }
          const r = escenaEl.getBoundingClientRect();
          tip.textContent = info.avatar ? 'Personalizar tu avatar' : info.area.titulo;
          tip.style.left = `${info.x - r.left}px`;
          tip.style.top = `${info.y - r.top}px`;
          tip.classList.add('ver');
        },
      });
      if (!escenaEl.isConnected) { rueda.destruir(); return; }
      actual = rueda;
    } catch (e) {
      console.warn('No se pudo crear la escena 3D', e);
      cont.querySelector('.inicio').classList.add('sin-3d');
    }
  }
  escenaEl.querySelector('.escena-cargando')?.classList.add('fuera');
  // Texto corto de cada área para la píldora destacada
  Object.assign(datosArea, {
    salud: sinEtiquetas(d.pendiente?.texto || ''),
    calendario: d.proximo ? `${d.proximo.inicio || 'Hoy'} · ${d.proximo.titulo}` : 'Día libre',
    estudios: d.semana.length ? `${d.semana.length} esta semana` : 'Semana despejada',
    personal: d.hab.total ? `${d.hab.hechos}/${d.hab.total} hábitos` : '',
    imagen: 'Privado por defecto',
  });
  const dActual = destacadaEl.dataset.area;
  if (dActual) marcarDestacada(areaDe(dActual));
  else marcarDestacada(AREAS[0]);

  // Abrir el editor desde el menú de perfil
  const alPedirAvatar = () => rueda && abrirEditor(escenaEl, rueda);
  window.addEventListener('abrir-avatar', alPedirAvatar);
  const prevDestruir = rueda?.destruir;
  if (rueda) rueda.destruir = () => { window.removeEventListener('abrir-avatar', alPedirAvatar); prevDestruir(); };
  if (ctx.abrirAvatar) { ctx.abrirAvatar = false; alPedirAvatar(); }

  // ---------- Clics ----------
  cont.onclick = ev => {
    if (ev.target.closest('[data-entrar]')) return ctx.abrirLogin();
    const ed = ev.target.closest('[data-editar-widgets]');
    if (ed) {
      const p = cont.querySelector('#widgets-panel');
      p.hidden = !p.hidden;
      ed.setAttribute('aria-expanded', String(!p.hidden));
      ed.textContent = p.hidden ? 'Elegir qué ver' : 'Listo';
      return;
    }
    const pa = ev.target.closest('[data-pausa]');
    if (pa) {
      const ahora = pa.getAttribute('aria-pressed') !== 'true';
      pa.setAttribute('aria-pressed', String(ahora));
      pa.setAttribute('aria-label', ahora ? 'Mover la rueda' : 'Detener el movimiento');
      pa.innerHTML = icono(ahora ? 'rayo' : 'x');
      guardar('inicio-pausa', ahora);
      rueda?.pausar(ahora);
      return;
    }
    const gi = ev.target.closest('[data-girar]');
    if (gi) return rueda?.siguiente(Number(gi.dataset.girar));
    if (ev.target.closest('[data-destacada]')) {
      const area = areaDe(destacadaEl.dataset.area);
      return rueda ? rueda.irA(area.id) : entrar(area);
    }
    const ar = ev.target.closest('[data-area]');
    if (ar) {
      const area = areaDe(ar.dataset.area);
      return rueda ? rueda.irA(area.id) : entrar(area);
    }
    const w = ev.target.closest('.widget[data-ir]');
    if (w) return ctx.irA(w.dataset.ir);
  };
  cont.onchange = ev => {
    const c = ev.target.closest('[data-widget]');
    if (!c) return;
    const marcados = [...cont.querySelectorAll('[data-widget]:checked')].map(x => x.dataset.widget);
    guardar('inicio-widgets', marcados);
    pintarWidgets(cont, datosDeHoy(ctx), ctx);
    cont.querySelector('#widgets-panel').hidden = false;
  };
}
