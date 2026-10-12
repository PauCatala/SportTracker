// SALUD · NUTRICIÓN · RECETAS
// Biblioteca de recetas (media/recetas/recetas.json, se descarga al abrirla) con búsqueda,
// filtros combinables, ficha con raciones ajustables, favoritas, plan semanal y lista de la compra.
// Los macros se calculan sumando ingredientes con tablas de composición: son estimaciones.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { abrirModal } from './interaccion.js';
import { aviso, sumarDias } from './utils.js';
import { objetivosDelDia, anadirComida } from './nutricion.js';

const RUTA = new URL('../media/recetas/recetas.json', import.meta.url).href;
let datosP = null;
const datos = () => {
  if (!datosP) { datosP = fetch(RUTA).then(r => r.json()); datosP.catch(() => { datosP = null; }); }
  return datosP;
};

const TIPOS = [['', 'Todas'], ['desayuno', 'Desayunos'], ['comida', 'Comidas'], ['cena', 'Cenas'], ['snack', 'Snacks'], ['postre', 'Postres'], ['batido', 'Batidos']];
const OBJETIVOS = [['', 'Cualquier objetivo'], ['deficit', 'Déficit calórico'], ['mantenimiento', 'Mantenimiento'], ['volumen', 'Volumen']];
const PREFS = [
  ['alta-proteina', 'Alta en proteína'], ['ligera', 'Ligera (≤ 400 kcal)'], ['baja-grasa', 'Baja en grasa'], ['baja-azucar', 'Baja en azúcares'],
  ['sin-azucares-anadidos', 'Sin azúcares añadidos'], ['alta-fibra', 'Alta en fibra'], ['comida-real', 'Comida real'], ['mediterranea', 'Mediterránea'],
  ['vegetariana', 'Vegetariana'], ['vegana', 'Vegana'], ['sin-gluten', 'Sin gluten'], ['sin-lactosa', 'Sin lactosa'],
  ['rapida', 'Rápida (≤ 15 min)'], ['elaborada', 'Elaborada'], ['meal-prep', 'Meal prep'], ['para-llevar', 'Para llevar'], ['temporada', 'De temporada'],
];
// Qué significa cada etiqueta (se enseña en la ficha)
const AYUDA = {
  'alta-proteina': 'Al menos el 20 % de las calorías vienen de la proteína.',
  'baja-grasa': 'Como máximo 3 g de grasa por 100 g de receta.',
  'baja-azucar': 'Como máximo 5 g de azúcares (naturales o añadidos) por 100 g.',
  'sin-azucares-anadidos': 'No lleva azúcar, miel, siropes ni ingredientes con azúcar añadido. Puede tener azúcares naturales de la fruta o la leche.',
  'alta-fibra': 'Al menos 3 g de fibra por cada 100 kcal.',
  'comida-real': 'Sin ingredientes ultraprocesados.',
  'sin-gluten': 'Ningún ingrediente lleva gluten. Si eres celíaco, comprueba que cada producto esté certificado sin gluten (trazas).',
  'sin-lactosa': 'Ningún ingrediente lácteo con lactosa.',
  'vegana': 'Sin ingredientes de origen animal.',
  'vegetariana': 'Sin carne, pescado ni marisco.',
  'ligera': 'Hasta 400 kcal por ración.',
};
const DIF = { f: 'Fácil', m: 'Media', d: 'Elaborada' };
const TIPO_NOMBRE = Object.fromEntries(TIPOS);
const ESTACION = () => ['invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano', 'verano', 'verano', 'otoño', 'otoño', 'otoño', 'invierno'][new Date().getMonth()];
const COLORES = { 'Frutería': '#B9D3B0', 'Carnicería': '#E7B9B3', 'Pescadería': '#AFC6DE', 'Lácteos': '#F1EADB', 'Despensa': '#E5D3B5', 'Congelados': '#CFE0EA', 'Panadería': '#E9CF9E', 'Huevos': '#F2DE9C', 'Refrigerados': '#D8D2E8', 'Charcutería': '#E3B7B7' };

const FILTROS_VACIOS = { q: '', tipo: '', objetivo: '', prefs: [], kcalMax: 900, protMin: 0, carbMax: 150, grasaMax: 60, minMax: 90, dif: '', tengo: '', excluir: '', favoritas: false, raciones: 1 };
const favoritas = () => new Set(leer('recetas-favoritas', []));
const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('es-ES');
const gramos = g => (g >= 1000 ? `${fmt(g / 1000)} kg` : `${Math.round(g)} g`);

// Portada: un plato visto desde arriba con los colores de sus ingredientes principales
function portada(r, D) {
  const top = [...r.ing].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = top.reduce((s, [, g]) => s + g, 0) || 1;
  let a = 0;
  const partes = top.map(([k, g]) => {
    const c = COLORES[D.ingredientes[k]?.[1]] || '#E7E2DA';
    const desde = a; a += (g / total) * 360;
    return `${c} ${desde}deg ${a}deg`;
  });
  return `background: radial-gradient(circle at 50% 50%, transparent 0 34%, rgba(255,255,255,.9) 34.5% 41%, transparent 41.5%), conic-gradient(from 20deg, ${partes.join(',')});`;
}

function cumple(r, f, D, favs) {
  if (f.tipo && r.t !== f.tipo) return false;
  if (f.objetivo && !r.et.includes(f.objetivo)) return false;
  for (const p of f.prefs) {
    if (p === 'temporada') { if (!r.et.includes(`temporada-${ESTACION()}`)) return false; }
    else if (!r.et.includes(p)) return false;
  }
  const k = r.kcal * 1;
  if (k > f.kcalMax || r.p < f.protMin || r.c > f.carbMax || r.g > f.grasaMax || r.min > f.minMax) return false;
  if (f.dif && r.dif !== f.dif) return false;
  if (f.favoritas && !favs.has(r.id)) return false;
  const nombres = r.ing.map(([i]) => normal(D.ingredientes[i]?.[0] || i));
  if (f.excluir) {
    const ex = f.excluir.split(',').map(x => normal(x.trim())).filter(Boolean);
    if (ex.some(e => nombres.some(n => n.includes(e)))) return false;
  }
  if (f.q) {
    const q = normal(f.q.trim());
    if (q && !normal(r.n).includes(q) && !nombres.some(n => n.includes(q))) return false;
  }
  return true;
}
function coincidencias(r, f, D) {
  const tengo = f.tengo.split(',').map(x => normal(x.trim())).filter(Boolean);
  if (!tengo.length) return null;
  const relevantes = r.ing.filter(([i]) => !['especias', 'sal_pimienta', 'aceite_oliva', 'vinagre'].includes(i));
  const si = relevantes.filter(([i]) => tengo.some(t => normal(D.ingredientes[i][0]).includes(t))).length;
  return { si, de: relevantes.length };
}

// ============================== LISTA ==============================
export async function renderRecetas(cont) {
  cont.innerHTML = '<p class="tenue">Cargando recetas…</p>';
  let D;
  try { D = await datos(); } catch { cont.innerHTML = '<div class="vacio"><p>No se han podido cargar las recetas. Revisa la conexión.</p></div>'; return; }
  const f = { ...FILTROS_VACIOS, ...leer('recetas-filtros', {}), q: '' };
  let mostrar = 24;

  cont.innerHTML = `
    <section class="rec">
      <div class="rec-busca">
        <input type="search" data-f="q" placeholder="Busca una receta o un ingrediente" aria-label="Buscar recetas">
        <button class="btn rec-btn-filtros" data-abrir-filtros aria-expanded="false">Filtros<span class="rec-n"></span></button>
      </div>
      <div class="segmento-suave" role="tablist" aria-label="Tipo de comida">${TIPOS.map(([k, n]) => `<button role="tab" data-tipo="${k}">${n}</button>`).join('')}</div>
      <div class="rec-objetivos" role="group" aria-label="Objetivo">${OBJETIVOS.map(([k, n]) => `<button class="chip" data-objetivo="${k}">${n}</button>`).join('')}</div>
      <div class="rec-filtros" hidden>
        <div class="rec-grupo"><h4>Preferencias</h4><div class="chips">${PREFS.map(([k, n]) => `<button class="chip" data-pref="${k}">${n}</button>`).join('')}</div></div>
        <div class="rec-rangos">
          ${[['kcalMax', 'Calorías máx. por ración', 100, 900, 25, 'kcal'], ['protMin', 'Proteína mín.', 0, 60, 5, 'g'], ['carbMax', 'Carbohidratos máx.', 0, 150, 5, 'g'], ['grasaMax', 'Grasas máx.', 0, 60, 2, 'g'], ['minMax', 'Tiempo máx.', 5, 90, 5, 'min']]
            .map(([k, n, mn, mx, st, u]) => `<label class="rec-rango"><span>${n} <b data-valor="${k}"></b> ${u}</span><input type="range" data-f="${k}" min="${mn}" max="${mx}" step="${st}"></label>`).join('')}
        </div>
        <div class="rec-grupo"><h4>Dificultad</h4><div class="chips">${[['', 'Cualquiera'], ['f', 'Fácil'], ['m', 'Media'], ['d', 'Elaborada']].map(([k, n]) => `<button class="chip" data-dif="${k}">${n}</button>`).join('')}</div></div>
        <div class="rec-textos">
          <label><span>Tengo en casa</span><input data-f="tengo" placeholder="huevo, espinacas, arroz…"></label>
          <label><span>Sin estos ingredientes</span><input data-f="excluir" placeholder="cebolla, gambas…"></label>
        </div>
        <div class="rec-pie-filtros">
          <label class="rec-check"><input type="checkbox" data-f="favoritas"> Solo mis favoritas</label>
          <button class="btn" data-limpiar>Quitar filtros</button>
        </div>
      </div>
      <p class="rec-cuenta tenue" aria-live="polite"></p>
      <div class="rec-rejilla"></div>
      <div class="rec-mas"><button class="btn" data-mas hidden>Ver más recetas</button></div>
      <p class="rec-fuente">${escapar(D.fuente)} Las cifras son estimaciones por ración.</p>
    </section>`;

  const $ = s => cont.querySelector(s);
  const rejilla = $('.rec-rejilla');

  function sincronizarControles() {
    cont.querySelectorAll('[data-tipo]').forEach(b => { b.classList.toggle('activo', b.dataset.tipo === f.tipo); b.setAttribute('aria-selected', String(b.dataset.tipo === f.tipo)); });
    cont.querySelectorAll('[data-objetivo]').forEach(b => b.classList.toggle('activo', b.dataset.objetivo === f.objetivo));
    cont.querySelectorAll('[data-pref]').forEach(b => { const on = f.prefs.includes(b.dataset.pref); b.classList.toggle('activo', on); b.setAttribute('aria-pressed', String(on)); });
    cont.querySelectorAll('[data-dif]').forEach(b => b.classList.toggle('activo', b.dataset.dif === f.dif));
    cont.querySelectorAll('input[data-f]').forEach(i => {
      if (i.type === 'checkbox') i.checked = !!f[i.dataset.f];
      else if (document.activeElement !== i) i.value = f[i.dataset.f];
    });
    cont.querySelectorAll('[data-valor]').forEach(b => { b.textContent = f[b.dataset.valor]; });
    const n = f.prefs.length + (f.kcalMax < 900) + (f.protMin > 0) + (f.carbMax < 150) + (f.grasaMax < 60) + (f.minMax < 90) + !!f.dif + !!f.tengo.trim() + !!f.excluir.trim() + f.favoritas;
    $('.rec-n').textContent = n ? ` · ${n}` : '';
  }

  function pintar(reiniciar = true) {
    if (reiniciar) mostrar = 24;
    guardar('recetas-filtros', { ...f, q: '' });
    const favs = favoritas();
    let lista = D.recetas.filter(r => cumple(r, f, D, favs));
    const conTengo = f.tengo.trim();
    if (conTengo) {
      lista = lista.map(r => ({ r, m: coincidencias(r, f, D) })).filter(x => x.m.si > 0)
        .sort((a, b) => b.m.si / b.m.de - a.m.si / a.m.de).map(x => x.r);
    }
    $('.rec-cuenta').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'receta' : 'recetas'}` : '';
    rejilla.innerHTML = lista.length ? lista.slice(0, mostrar).map(r => {
      const m = conTengo ? coincidencias(r, f, D) : null;
      const etq = r.et.filter(e => ['alta-proteina', 'vegana', 'vegetariana', 'sin-gluten', 'ligera', 'meal-prep'].includes(e)).slice(0, 2);
      return `
        <article class="rec-tarjeta" data-receta="${r.id}" tabindex="0" aria-label="${escapar(r.n)}">
          <div class="rec-portada" style="${portada(r, D)}"><span>${TIPO_NOMBRE[r.t]?.replace(/s$/, '') || ''}</span></div>
          <button class="rec-fav${favs.has(r.id) ? ' activo' : ''}" data-fav="${r.id}" aria-label="Favorita" aria-pressed="${favs.has(r.id)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg></button>
          <h4>${escapar(r.n)}</h4>
          <p class="rec-meta"><b>${r.kcal} kcal</b><span>${fmt(r.p)} g prot.</span><span>${r.min} min</span></p>
          ${m ? `<p class="rec-tengo">Tienes ${m.si} de ${m.de} ingredientes</p>` : ''}
          ${etq.length ? `<p class="rec-etq">${etq.map(e => `<span>${PREFS.find(p => p[0] === e)?.[1].replace(/ \(.+\)/, '')}</span>`).join('')}</p>` : ''}
        </article>`;
    }).join('') : `<div class="vacio rec-vacio"><h3>Sin resultados</h3><p>Prueba a quitar algún filtro o busca otro ingrediente.</p><button class="btn" data-limpiar>Quitar filtros</button></div>`;
    $('[data-mas]').hidden = lista.length <= mostrar;
    sincronizarControles();
  }

  let espera = 0;
  cont.oninput = ev => {
    const i = ev.target.closest('input[data-f]');
    if (!i) return;
    const k = i.dataset.f;
    f[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' ? Number(i.value) : i.value;
    clearTimeout(espera);
    espera = setTimeout(() => pintar(), i.type === 'range' ? 60 : 160);
  };
  cont.onclick = ev => {
    const b = ev.target.closest('button, [data-receta]');
    if (!b) return;
    if (b.dataset.fav) {
      ev.stopPropagation();
      const s = favoritas(); s.has(b.dataset.fav) ? s.delete(b.dataset.fav) : s.add(b.dataset.fav);
      guardar('recetas-favoritas', [...s]);
      b.classList.toggle('activo'); b.setAttribute('aria-pressed', String(s.has(b.dataset.fav)));
      return;
    }
    if (b.dataset.tipo !== undefined) { f.tipo = b.dataset.tipo; return pintar(); }
    if (b.dataset.objetivo !== undefined) { f.objetivo = b.dataset.objetivo; return pintar(); }
    if (b.dataset.pref) { f.prefs = f.prefs.includes(b.dataset.pref) ? f.prefs.filter(x => x !== b.dataset.pref) : [...f.prefs, b.dataset.pref]; return pintar(); }
    if (b.dataset.dif !== undefined) { f.dif = b.dataset.dif; return pintar(); }
    if (b.matches('[data-abrir-filtros]')) {
      const p = $('.rec-filtros'); p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); return;
    }
    if (b.matches('[data-limpiar]')) { Object.assign(f, FILTROS_VACIOS); return pintar(); }
    if (b.matches('[data-mas]')) { mostrar += 24; return pintar(false); }
    if (b.dataset.receta) return abrirReceta(b, D.recetas.find(r => r.id === b.dataset.receta), D);
  };
  cont.onkeydown = ev => {
    const t = ev.target.closest('[data-receta]');
    if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirReceta(t, D.recetas.find(r => r.id === t.dataset.receta), D); }
  };
  pintar();
}

// ============================== FICHA ==============================
function abrirReceta(origen, r, D) {
  let rac = r.rac;
  const obj = objetivosDelDia();
  const html = () => {
    const k = rac / r.rac;
    return `
      <p class="rec-desc">${escapar(r.d)}</p>
      <div class="rec-ficha-meta">
        <span>${r.min} min</span><span>${DIF[r.dif]}</span>
        <span class="rec-raciones">
          <button class="btn chico" data-rac="-1" aria-label="Menos raciones">−</button>
          <b>${rac} ${rac === 1 ? 'ración' : 'raciones'}</b>
          <button class="btn chico" data-rac="1" aria-label="Más raciones">+</button>
        </span>
      </div>
      <div class="rec-macros">
        <div><b>${r.kcal}</b><span>kcal</span></div><div><b>${fmt(r.p)} g</b><span>proteína</span></div>
        <div><b>${fmt(r.c)} g</b><span>carbohidratos</span></div><div><b>${fmt(r.g)} g</b><span>grasas</span></div>
      </div>
      <p class="rec-nota">Por ración · estimado${obj ? ` · ${Math.round((r.kcal / obj.kcal) * 100)} % de tus calorías del día` : ''} · ${fmt(r.f)} g de fibra · ${fmt(r.az)} g de azúcares</p>
      <h3>Ingredientes</h3>
      <ul class="rec-ings">${r.ing.map(([i, g]) => {
        const nombre = D.ingredientes[i]?.[0] || i;
        const cant = ['especias', 'sal_pimienta'].includes(i) ? 'al gusto' : gramos(g * k);
        return `<li><span>${escapar(nombre)}</span><b>${cant}</b></li>`;
      }).join('')}</ul>
      <h3>Preparación</h3>
      <ol class="rec-pasos">${r.pasos.map(p => `<li>${escapar(p)}</li>`).join('')}</ol>
      ${r.et.length ? `<h3>Etiquetas</h3><div class="rec-etiquetas">${r.et.filter(e => !e.startsWith('temporada-') || true).map(e => {
        const n = PREFS.find(p => p[0] === e)?.[1] || OBJETIVOS.find(o => o[0] === e)?.[1] || (e.startsWith('temporada-') ? `Temporada: ${e.slice(10)}` : e);
        return `<span${AYUDA[e] ? ` title="${escapar(AYUDA[e])}"` : ''}>${escapar(n)}</span>`;
      }).join('')}</div>` : ''}
      ${r.sus.length ? `<h3>Sustituciones</h3><ul class="rec-sus">${r.sus.map(([a, b, m]) => `<li><b>${escapar(D.ingredientes[a][0])}</b> → ${escapar(D.ingredientes[b][0])} <span class="tenue">(${escapar(m)})</span></li>`).join('')}</ul>` : ''}
      <p class="rec-aviso tenue">Si tienes alergias o intolerancias, revisa siempre las etiquetas de cada producto.</p>
      <div class="modal-acciones rec-acciones">
        <button class="btn" data-fav-modal>${favoritas().has(r.id) ? 'Quitar de favoritas' : 'Guardar en favoritas'}</button>
        <button class="btn" data-compra>Añadir a la compra</button>
        <button class="btn" data-plan>Planificar</button>
        <button class="btn primario" data-hoy>Añadir a hoy</button>
      </div>
      <div class="rec-plan" hidden>
        <label><span>Día</span><select data-dia>${Array.from({ length: 7 }, (_, i) => { const d = sumarDias(hoyISO(), i); return `<option value="${d}">${new Date(`${d}T12:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</option>`; }).join('')}</select></label>
        <label><span>Comida</span><select data-momento>${['desayuno', 'comida', 'cena', 'snack'].map(m => `<option ${m === r.t ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <button class="btn primario" data-guardar-plan>Guardar en el plan</button>
      </div>`;
  };
  abrirModal({
    origen, subtitulo: TIPO_NOMBRE[r.t] || '', titulo: escapar(r.n), contenido: `<div class="rec-ficha">${html()}</div>`,
    alAbrir: (cuerpo, cerrar) => {
      const caja = cuerpo.querySelector('.rec-ficha');
      caja.onclick = ev => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.rac) { rac = Math.max(1, Math.min(12, rac + Number(b.dataset.rac))); caja.innerHTML = html(); return; }
        if (b.matches('[data-fav-modal]')) {
          const s = favoritas(); s.has(r.id) ? s.delete(r.id) : s.add(r.id); guardar('recetas-favoritas', [...s]);
          b.textContent = s.has(r.id) ? 'Quitar de favoritas' : 'Guardar en favoritas'; return;
        }
        if (b.matches('[data-hoy]')) {
          anadirComida({ nombre: r.n, kcal: r.kcal, p: Math.round(r.p), c: Math.round(r.c), g: Math.round(r.g), receta: r.id });
          return cerrar();
        }
        if (b.matches('[data-plan]')) { caja.querySelector('.rec-plan').hidden = false; return; }
        if (b.matches('[data-guardar-plan]')) {
          const dia = caja.querySelector('[data-dia]').value, momento = caja.querySelector('[data-momento]').value;
          const plan = leer('nutri-plan', {});
          (plan[dia] ||= []).push({ id: nuevoId(), receta: r.id, rac: 1, momento });
          guardar('nutri-plan', plan);
          aviso('Añadida a tu plan');
          caja.querySelector('.rec-plan').hidden = true; return;
        }
        if (b.matches('[data-compra]')) {
          anadirACompra(r, rac);
          aviso('Ingredientes añadidos a la compra');
        }
      };
    },
  });
}

function anadirACompra(r, rac) {
  const lista = leer('nutri-compra', []);
  const k = rac / r.rac;
  for (const [i, g] of r.ing) {
    if (['especias', 'sal_pimienta'].includes(i)) continue;
    const ya = lista.find(x => x.ing === i && !x.hecho);
    if (ya) ya.g += g * k; else lista.push({ id: nuevoId(), ing: i, g: g * k, hecho: false });
  }
  guardar('nutri-compra', lista);
}

// ============================== PLAN Y COMPRA ==============================
export async function renderPlanCompra(cont) {
  cont.innerHTML = '<p class="tenue">Cargando…</p>';
  let D;
  try { D = await datos(); } catch { cont.innerHTML = '<div class="vacio"><p>No se han podido cargar las recetas.</p></div>'; return; }
  const porId = new Map(D.recetas.map(r => [r.id, r]));
  const obj = objetivosDelDia();

  function pintar() {
    const plan = leer('nutri-plan', {});
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoyISO(), i));
    const compra = leer('nutri-compra', []);
    const secciones = {};
    for (const it of compra) (secciones[D.ingredientes[it.ing]?.[1] || 'Otros'] ||= []).push(it);
    cont.innerHTML = `
      <section class="panel">
        <div class="panel-cab"><h3>Tu semana</h3><button class="btn chico" data-compra-semana>Lista de la compra de la semana</button></div>
        <div class="plan-dias">${dias.map(d => {
          const items = (plan[d] || []).filter(x => porId.has(x.receta));
          const kcal = items.reduce((s, x) => s + porId.get(x.receta).kcal * x.rac, 0);
          return `
            <div class="plan-dia">
              <h4>${new Date(`${d}T12:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}${kcal ? `<span>${Math.round(kcal)} kcal${obj ? ` · ${Math.round((kcal / obj.kcal) * 100)} %` : ''}</span>` : ''}</h4>
              ${items.length ? `<ul>${items.map(x => `<li><small>${x.momento}</small><span>${escapar(porId.get(x.receta).n)}</span><button class="btn chico" data-quitar="${d}|${x.id}" aria-label="Quitar">×</button></li>`).join('')}</ul>` : '<p class="tenue">Sin recetas. Planifícalas desde la ficha de cada receta.</p>'}
            </div>`;
        }).join('')}</div>
      </section>
      <section class="panel">
        <div class="panel-cab"><h3>Lista de la compra</h3>${compra.length ? '<button class="btn chico" data-vaciar>Vaciar</button>' : ''}</div>
        ${compra.length ? Object.entries(secciones).map(([s, its]) => `
          <h4 class="compra-seccion">${escapar(s)}</h4>
          <ul class="compra">${its.map(it => `<li><label><input type="checkbox" data-hecho="${it.id}" ${it.hecho ? 'checked' : ''}><span>${escapar(D.ingredientes[it.ing]?.[0] || it.ing)}</span><b>${gramos(it.g)}</b></label></li>`).join('')}</ul>`).join('')
        : '<p class="tenue">Vacía. Añade ingredientes desde una receta o genera la lista de tu semana.</p>'}
      </section>`;
  }
  cont.onclick = ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.quitar) {
      const [d, id] = b.dataset.quitar.split('|');
      const plan = leer('nutri-plan', {}); plan[d] = (plan[d] || []).filter(x => x.id !== id); guardar('nutri-plan', plan); return pintar();
    }
    if (b.matches('[data-compra-semana]')) {
      const plan = leer('nutri-plan', {});
      let n = 0;
      for (let i = 0; i < 7; i++) for (const x of plan[sumarDias(hoyISO(), i)] || []) { const r = porId.get(x.receta); if (r) { anadirACompra(r, x.rac); n++; } }
      aviso(n ? 'Lista de la compra actualizada' : 'Aún no has planificado recetas esta semana');
      return pintar();
    }
    if (b.matches('[data-vaciar]')) { guardar('nutri-compra', []); return pintar(); }
  };
  cont.onchange = ev => {
    const c = ev.target.closest('[data-hecho]');
    if (!c) return;
    const lista = leer('nutri-compra', []);
    const it = lista.find(x => x.id === c.dataset.hecho); if (it) it.hecho = c.checked;
    guardar('nutri-compra', lista);
  };
  pintar();
}

// Abre la ficha de una receta desde fuera (p. ej. la sugerencia del centro corporal de Salud)
export async function abrirRecetaPorId(id, origen = null) {
  const D = await datos();
  const r = D.recetas.find(x => x.id === id);
  if (r) abrirReceta(origen, r, D);
}
// Receta que mejor encaja con lo que te queda hoy (kcal y proteína), para sugerirla
export async function recetaSugerida(restante, tipo = null) {
  const D = await datos();
  const lista = D.recetas.filter(r => (!tipo || r.t === tipo) && r.kcal <= Math.max(250, restante.kcal + 60));
  if (!lista.length) return null;
  const nota = r => -Math.abs(r.kcal - Math.min(restante.kcal, 650)) / 120 + (restante.p > 0 ? Math.min(r.p, restante.p) / 12 : 0) + (r.et.includes('comida-real') ? 0.5 : 0);
  const dia = Number(hoyISO().replaceAll('-', '')) % 3;       // varía un poco cada día entre las mejores
  return lista.sort((a, b) => nota(b) - nota(a))[dia] || lista[0];
}
