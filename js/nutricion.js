// SALUD · NUTRICIÓN: objetivos de calorías y macros, registro del día e ideas de comidas.
// Los objetivos salen de tu Perfil. Funciona sin cuenta y se sincroniza al entrar.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { PERFIL_VACIO, perfilCompleto, caloriasObjetivo } from './perfil.js';
import { grafica, ejeX, ejeY, C } from './graficos.js';
import { icono } from './iconos.js';
import { aviso, sumarDias, fmtCorta } from './utils.js';
import { abrirModal, revelar, carruseles } from './interaccion.js';

export const AJUSTES_VACIOS = { proteinaKg: 1.8, grasaPct: 27, tipo: 'real' };

const TIPOS = {
  real: 'Comida real',
  barata: 'Barata',
  rapida: 'Rápida',
  proteina: 'Alta en proteína',
  vegetariana: 'Vegetariana',
};

// Ideas de comidas: kcal y macros por ración (aproximados)
const IDEAS = [
  { n: 'Avena con plátano, yogur griego y nueces', m: 'Desayuno', kcal: 520, p: 28, c: 66, g: 16, t: ['real', 'barata', 'rapida'] },
  { n: 'Tostadas integrales con huevos revueltos y tomate', m: 'Desayuno', kcal: 450, p: 25, c: 42, g: 19, t: ['real', 'barata', 'rapida'] },
  { n: 'Batido de proteína con leche, avena y cacao', m: 'Desayuno', kcal: 430, p: 38, c: 48, g: 9, t: ['rapida', 'proteina'] },
  { n: 'Skyr con frutos rojos y granola', m: 'Desayuno', kcal: 380, p: 30, c: 45, g: 8, t: ['rapida', 'proteina', 'vegetariana'] },
  { n: 'Pollo a la plancha con arroz y brócoli', m: 'Comida', kcal: 620, p: 48, c: 70, g: 14, t: ['real', 'barata', 'proteina'] },
  { n: 'Lentejas estofadas con verduras', m: 'Comida', kcal: 540, p: 28, c: 78, g: 10, t: ['real', 'barata', 'vegetariana'] },
  { n: 'Pasta integral con atún, tomate y aceitunas', m: 'Comida', kcal: 650, p: 40, c: 82, g: 16, t: ['barata', 'rapida', 'proteina'] },
  { n: 'Salmón al horno con patata y espárragos', m: 'Comida', kcal: 680, p: 42, c: 55, g: 30, t: ['real', 'proteina'] },
  { n: 'Bowl de garbanzos, quinoa, aguacate y verduras', m: 'Comida', kcal: 610, p: 24, c: 70, g: 24, t: ['real', 'vegetariana'] },
  { n: 'Ternera salteada con fideos de arroz', m: 'Comida', kcal: 640, p: 40, c: 72, g: 18, t: ['rapida', 'proteina'] },
  { n: 'Tortilla de patata con ensalada', m: 'Cena', kcal: 520, p: 22, c: 40, g: 28, t: ['real', 'barata', 'vegetariana'] },
  { n: 'Merluza con verduras al vapor', m: 'Cena', kcal: 380, p: 38, c: 22, g: 14, t: ['real', 'proteina'] },
  { n: 'Revuelto de huevos con champiñones y pan integral', m: 'Cena', kcal: 430, p: 26, c: 30, g: 22, t: ['real', 'barata', 'rapida', 'vegetariana'] },
  { n: 'Wrap de pavo, queso fresco y hojas verdes', m: 'Cena', kcal: 450, p: 34, c: 40, g: 15, t: ['rapida', 'barata', 'proteina'] },
  { n: 'Yogur griego con miel y almendras', m: 'Snack', kcal: 260, p: 14, c: 22, g: 13, t: ['rapida', 'vegetariana'] },
  { n: 'Fruta y un puñado de frutos secos', m: 'Snack', kcal: 230, p: 6, c: 24, g: 13, t: ['real', 'barata', 'rapida', 'vegetariana'] },
  { n: 'Lata de atún con tortitas de arroz', m: 'Snack', kcal: 220, p: 26, c: 20, g: 4, t: ['barata', 'rapida', 'proteina'] },
  { n: 'Requesón con fruta', m: 'Snack', kcal: 200, p: 18, c: 20, g: 5, t: ['rapida', 'proteina', 'vegetariana'] },
];

// ---------- Objetivos del día a partir del perfil ----------
export function objetivosDelDia() {
  const p = leer('perfil', PERFIL_VACIO);
  const a = leer('nutri-ajustes', AJUSTES_VACIOS);
  const kcal = caloriasObjetivo(p);
  if (!kcal) return null;
  const prot = Math.round(p.peso * a.proteinaKg);
  const grasa = Math.round((kcal * a.grasaPct / 100) / 9);
  const carb = Math.max(0, Math.round((kcal - prot * 4 - grasa * 9) / 4));
  return { kcal, p: prot, c: carb, g: grasa };
}
export const comidasDe = fecha => leer(`comidas:${fecha}`, []);
export function totalesDe(fecha) {
  return comidasDe(fecha).reduce((t, x) => ({ kcal: t.kcal + x.kcal, p: t.p + x.p, c: t.c + x.c, g: t.g + x.g }), { kcal: 0, p: 0, c: 0, g: 0 });
}

function sinPerfil(cont) {
  cont.innerHTML = `
    <div class="vacio">
      <h3>Primero, tu perfil</h3>
      <p>Para calcular tus calorías y macros necesitamos tu edad, altura, peso y objetivo. Tardas 20 segundos.</p>
      <button class="btn primario" data-ir-perfil>Completar perfil</button>
    </div>`;
  cont.onclick = ev => {
    if (ev.target.closest('[data-ir-perfil]')) dispatchEvent(new CustomEvent('navegar', { detail: { bloque: 'perfil', vista: 'datos' } }));
  };
}

const barraMacro = (nombre, hecho, meta, color) => `
  <div class="macro-fila">
    <div><span>${nombre}</span><span class="tenue">${Math.round(hecho)} / ${meta} g</span></div>
    <div class="progreso"><i style="width:${Math.min(100, (hecho / meta) * 100)}%; background:${color}"></i></div>
  </div>`;

// ============================== HOY ==============================
export function renderNutriHoy(cont) {
  const obj = objetivosDelDia();
  if (!obj) return sinPerfil(cont);
  const hoy = hoyISO();
  const comidas = comidasDe(hoy);
  const t = totalesDe(hoy);
  const restan = obj.kcal - t.kcal;
  const R = 52, L = 2 * Math.PI * R, frac = Math.min(1, t.kcal / obj.kcal);

  cont.innerHTML = `
    <section class="panel nutri-resumen">
      <div class="anillo-kcal">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" class="pista"/><circle cx="60" cy="60" r="${R}" class="relleno" stroke-dasharray="${frac * L} ${L}"/></svg>
        <div><b>${Math.round(t.kcal).toLocaleString('es-ES')}</b><span>de ${obj.kcal.toLocaleString('es-ES')} kcal</span></div>
      </div>
      <div class="macros">
        <p class="${restan < 0 ? 'texto-error' : ''}"><b>${restan >= 0 ? `Te quedan ${Math.round(restan).toLocaleString('es-ES')} kcal` : `Te has pasado ${Math.round(-restan).toLocaleString('es-ES')} kcal`}</b></p>
        ${barraMacro('Proteína', t.p, obj.p, C.electrico)}
        ${barraMacro('Carbohidratos', t.c, obj.c, C.medio)}
        ${barraMacro('Grasas', t.g, obj.g, C.acero)}
      </div>
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Comidas de hoy</h3><span class="tenue">${comidas.length || 'Ninguna'} ${comidas.length === 1 ? 'comida' : comidas.length ? 'comidas' : ''}</span></div>
      ${comidas.length ? `<ul class="lista-simple">${comidas.map(x => `
        <li><span><b>${escapar(x.nombre)}</b><small class="tenue">${x.p} P · ${x.c} C · ${x.g} G</small></span><b>${x.kcal} kcal</b>
          <button class="btn-icono" data-borrar="${x.id}" aria-label="Borrar">${icono('papelera')}</button></li>`).join('')}</ul>` : ''}
      <form class="campos" id="n-form" style="margin-top:12px" autocomplete="off">
        <label class="campo">Qué has comido <input name="nombre" placeholder="Ej.: pollo con arroz" required></label>
        <div class="campos-4">
          <label class="campo">kcal <input name="kcal" type="number" inputmode="numeric" required></label>
          <label class="campo">Proteína <input name="p" type="number" inputmode="numeric" placeholder="g"></label>
          <label class="campo">Carbos <input name="c" type="number" inputmode="numeric" placeholder="g"></label>
          <label class="campo">Grasas <input name="g" type="number" inputmode="numeric" placeholder="g"></label>
        </div>
        <div class="fila-botones">
          <button class="btn primario" type="submit">${icono('mas')}Añadir comida</button>
          <button class="btn suave" type="button" data-ideas>Elegir de las ideas</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Últimos 7 días</h3><span class="tenue">kcal frente a tu objetivo</span></div>
      <div class="grafico"><canvas id="g-kcal"></canvas></div>
    </section>`;

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
  grafica(cont.querySelector('#g-kcal'), {
    type: 'bar',
    data: {
      labels: dias.map(d => fmtCorta(d).split(' ')[0]),
      datasets: [
        { type: 'line', data: dias.map(() => obj.kcal), borderColor: C.acero, borderDash: [6, 6], pointRadius: 0 },
        { data: dias.map(d => totalesDe(d).kcal), backgroundColor: dias.map(d => (d === hoy ? C.electrico : C.pervinca)), borderRadius: 8, maxBarThickness: 34 },
      ],
    },
    options: { scales: { x: ejeX(), y: ejeY({ beginAtZero: true }) } },
  });

  cont.onclick = ev => {
    const b = ev.target.closest('[data-borrar]');
    if (b) {
      guardar(`comidas:${hoy}`, comidasDe(hoy).filter(x => x.id !== b.dataset.borrar));
      return renderNutriHoy(cont);
    }
    if (ev.target.closest('[data-ideas]')) dispatchEvent(new CustomEvent('navegar', { detail: { bloque: 'nutricion', vista: 'ideas' } }));
  };
  cont.querySelector('#n-form').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    anadirComida({ nombre: d.nombre, kcal: Number(d.kcal) || 0, p: Number(d.p) || 0, c: Number(d.c) || 0, g: Number(d.g) || 0 });
    renderNutriHoy(cont);
  };
}

function anadirComida(c) {
  const hoy = hoyISO();
  guardar(`comidas:${hoy}`, [...comidasDe(hoy), { id: nuevoId(), ...c }]);
  aviso('Comida añadida');
}

// =========================== OBJETIVOS ===========================
export function renderNutriObjetivos(cont) {
  const obj = objetivosDelDia();
  if (!obj) return sinPerfil(cont);
  const a = leer('nutri-ajustes', AJUSTES_VACIOS);
  const pct = x => Math.round((x / obj.kcal) * 100);

  cont.innerHTML = `
    <div class="kpis kpis-4">
      <div class="kpi"><span>Calorías</span><b>${obj.kcal.toLocaleString('es-ES')}</b><small>al día</small></div>
      <div class="kpi"><span>Proteína</span><b>${obj.p} g</b><small>${pct(obj.p * 4)}% de las kcal</small></div>
      <div class="kpi"><span>Carbohidratos</span><b>${obj.c} g</b><small>${pct(obj.c * 4)}% de las kcal</small></div>
      <div class="kpi"><span>Grasas</span><b>${obj.g} g</b><small>${pct(obj.g * 9)}% de las kcal</small></div>
    </div>

    <section class="panel">
      <div class="panel-cab"><h3>Ajusta tus macros</h3><span class="tenue">Las calorías salen de tu perfil</span></div>
      <form class="campos" id="n-ajustes">
        <label class="campo"><span>Proteína: <b>${a.proteinaKg} g por kg</b> de peso</span>
          <input type="range" name="proteinaKg" min="1.2" max="2.4" step="0.1" value="${a.proteinaKg}">
        </label>
        <label class="campo"><span>Grasas: <b>${a.grasaPct}%</b> de las calorías</span>
          <input type="range" name="grasaPct" min="20" max="40" step="1" value="${a.grasaPct}">
        </label>
      </form>
      <p class="tenue" style="margin-top:10px">Los carbohidratos se calculan solos con las calorías que quedan.</p>
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Tu tipo de comida</h3><span class="tenue">Filtra las ideas de comidas</span></div>
      <div class="chips">${Object.entries(TIPOS).map(([k, v]) => `<button class="chip ${a.tipo === k ? 'activo' : ''}" data-tipo="${k}">${v}</button>`).join('')}</div>
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Reparto por comida</h3><span class="tenue">Con 4 comidas al día</span></div>
      <table class="tabla">
        <tr><th>Comida</th><th>kcal</th><th>Proteína</th><th>Carbos</th><th>Grasas</th></tr>
        ${[['Desayuno', .25], ['Comida', .35], ['Cena', .3], ['Snack', .1]].map(([n, f]) => `
          <tr><td>${n}</td><td>${Math.round(obj.kcal * f)}</td><td>${Math.round(obj.p * f)} g</td><td>${Math.round(obj.c * f)} g</td><td>${Math.round(obj.g * f)} g</td></tr>`).join('')}
      </table>
    </section>`;

  cont.oninput = ev => {
    if (ev.target.type !== 'range') return;
    guardar('nutri-ajustes', { ...leer('nutri-ajustes', AJUSTES_VACIOS), [ev.target.name]: Number(ev.target.value) });
  };
  cont.onchange = ev => { if (ev.target.type === 'range') renderNutriObjetivos(cont); };
  cont.onclick = ev => {
    const t = ev.target.closest('[data-tipo]');
    if (!t) return;
    guardar('nutri-ajustes', { ...leer('nutri-ajustes', AJUSTES_VACIOS), tipo: t.dataset.tipo });
    renderNutriObjetivos(cont);
  };
}

// ============================== IDEAS ==============================
const DEGRADADOS = {
  Desayuno: 'linear-gradient(150deg, #E4EBFF, #C9D7FF)',
  Comida: 'linear-gradient(150deg, #DDEBFB, #9FC0F2)',
  Cena: 'linear-gradient(150deg, #E6E8F0, #B9C3DD)',
  Snack: 'linear-gradient(150deg, #EEF1F6, #D5DDEB)',
};

// Ideas en carruseles por momento del día; cada tarjeta se amplía al pulsarla
export function renderNutriIdeas(cont) {
  const a = leer('nutri-ajustes', AJUSTES_VACIOS);
  const lista = IDEAS.filter(x => x.t.includes(a.tipo));
  const momentos = ['Desayuno', 'Comida', 'Cena', 'Snack'];

  cont.innerHTML = `
    <div class="chips">${Object.entries(TIPOS).map(([k, v]) => `<button class="chip ${a.tipo === k ? 'activo' : ''}" data-tipo="${k}">${v}</button>`).join('')}</div>
    ${momentos.map(m => {
      const de = lista.filter(x => x.m === m);
      if (!de.length) return '';
      return `
      <section class="bloque-ideas">
        <h3>${m}</h3>
        <div class="carrusel">
          <div class="carrusel-pista">
            ${de.map(x => `
              <article class="idea" data-idea="${IDEAS.indexOf(x)}" tabindex="0">
                <div class="idea-visual" style="background:${DEGRADADOS[m]}"><b>${x.kcal}</b><span>kcal</span></div>
                <h4>${x.n}</h4>
                <p class="idea-macros"><span>${x.p} g proteína</span><span>${x.c} g carbos</span><span>${x.g} g grasas</span></p>
                <span class="mas-info" aria-hidden="true">${icono('mas')}</span>
              </article>`).join('')}
          </div>
        </div>
      </section>`;
    }).join('')}`;

  const abrirIdea = tarjeta => {
    const x = IDEAS[Number(tarjeta.dataset.idea)];
    const obj = objetivosDelDia();
    const barra = (n, g, meta) => `<div class="macro-fila"><div><span>${n}</span><span class="tenue">${g} g${meta ? ` · ${Math.round((g / meta) * 100)}% de tu día` : ''}</span></div><div class="progreso"><i style="width:${meta ? Math.min(100, (g / meta) * 100) : 0}%"></i></div></div>`;
    abrirModal({
      origen: tarjeta, subtitulo: x.m, titulo: x.n,
      contenido: `
        <p class="modal-cifra">${x.kcal} <small>kcal${obj ? ` · ${Math.round((x.kcal / obj.kcal) * 100)}% de tu objetivo diario` : ''}</small></p>
        <div class="macros">${barra('Proteína', x.p, obj?.p)}${barra('Carbohidratos', x.c, obj?.c)}${barra('Grasas', x.g, obj?.g)}</div>
        <div class="modal-acciones"><button class="btn primario" data-anadir-modal>${icono('mas')}Añadir a hoy</button></div>`,
      alAbrir: (cuerpo, cerrar) => {
        cuerpo.querySelector('[data-anadir-modal]').onclick = async () => {
          anadirComida({ nombre: x.n, kcal: x.kcal, p: x.p, c: x.c, g: x.g });
          await cerrar();
        };
      },
    });
  };

  cont.onclick = ev => {
    const t = ev.target.closest('[data-tipo]');
    if (t) {
      guardar('nutri-ajustes', { ...leer('nutri-ajustes', AJUSTES_VACIOS), tipo: t.dataset.tipo });
      renderNutriIdeas(cont);
      revelar(cont);
      carruseles(cont);
      return;
    }
    const idea = ev.target.closest('[data-idea]');
    if (idea) abrirIdea(idea);
  };
  cont.onkeydown = ev => {
    const idea = ev.target.closest('[data-idea]');
    if (idea && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirIdea(idea); }
  };
}
