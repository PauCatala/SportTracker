// SALUD · PERFIL: tus datos, tu peso, tus marcas objetivo y calculadoras rápidas.
// Funciona sin cuenta (se guarda en el navegador) y se sincroniza al entrar.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { grafica, ejeX, ejeY, C } from './graficos.js';
import { icono } from './iconos.js';
import { aviso, fmtCorta, parseTiempo, fmtTiempo } from './utils.js';

export const PERFIL_VACIO = { sexo: 'h', edad: '', altura: '', peso: '', pesoObjetivo: '', actividad: 1.55, objetivo: 'mantener' };

const ACTIVIDAD = [
  [1.2, 'Sedentaria (poco o nada de ejercicio)'],
  [1.375, 'Ligera (1-3 días por semana)'],
  [1.55, 'Moderada (3-5 días por semana)'],
  [1.725, 'Alta (6-7 días por semana)'],
  [1.9, 'Muy alta (doble sesión o trabajo físico)'],
];
const OBJETIVOS = { perder: ['Perder grasa', -0.15], mantener: ['Mantener', 0], ganar: ['Ganar músculo', 0.1] };

// ---------- Cálculos (los usa también Nutrición) ----------
export function perfilCompleto(p) {
  return [p.edad, p.altura, p.peso].every(v => Number(v) > 0);
}
// Metabolismo basal (Mifflin-St Jeor) y gasto diario
export function caloriasMantenimiento(p) {
  if (!perfilCompleto(p)) return null;
  const base = 10 * p.peso + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'm' ? -161 : 5);
  return Math.round(base * p.actividad);
}
export function caloriasObjetivo(p) {
  const m = caloriasMantenimiento(p);
  return m ? Math.round(m * (1 + OBJETIVOS[p.objetivo][1])) : null;
}
export const imc = p => (perfilCompleto(p) ? p.peso / (p.altura / 100) ** 2 : null);
function textoImc(v) {
  if (v < 18.5) return 'Bajo peso';
  if (v < 25) return 'Saludable';
  if (v < 30) return 'Sobrepeso';
  return 'Obesidad';
}
const fmt = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d });

// Progreso de una marca (0..1). En tiempo, menos es mejor.
function progresoMarca(m) {
  const act = m.tipo === 'tiempo' ? parseTiempo(m.actual, 'min') : Number(m.actual);
  const obj = m.tipo === 'tiempo' ? parseTiempo(m.objetivo, 'min') : Number(m.objetivo);
  if (!(act > 0) || !(obj > 0)) return 0;
  return Math.min(1, m.tipo === 'tiempo' ? obj / act : act / obj);
}
const UNIDAD = { peso: 'kg', reps: 'reps', tiempo: '' };

function kpisHTML(p) {
  const vImc = imc(p), mant = caloriasMantenimiento(p), obj = caloriasObjetivo(p);
  const falta = p.pesoObjetivo && p.peso ? p.pesoObjetivo - p.peso : null;
  return `
      <div class="kpi"><span>IMC</span><b>${vImc ? fmt(vImc) : '–'}</b><small>${vImc ? textoImc(vImc) : 'Completa tus datos'}</small></div>
      <div class="kpi"><span>Hasta tu objetivo</span><b>${falta != null && p.pesoObjetivo ? `${falta > 0 ? '+' : ''}${fmt(falta)} kg` : '–'}</b><small>${p.pesoObjetivo ? `Objetivo: ${fmt(p.pesoObjetivo)} kg` : 'Pon un peso objetivo'}</small></div>
      <div class="kpi"><span>Calorías al día</span><b>${obj ? obj.toLocaleString('es-ES') : '–'}</b><small>${mant ? `Mantenimiento: ${mant.toLocaleString('es-ES')}` : 'Completa tus datos'}</small></div>`;
}

function pintarGraficaPeso(cont) {
  const p = leer('perfil', PERFIL_VACIO);
  const pesos = leer('pesos', []).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const lienzo = cont.querySelector('#g-peso');
  if (!lienzo || pesos.length < 2) return;
  grafica(lienzo, {
    type: 'line',
    data: {
      labels: pesos.map(x => fmtCorta(x.fecha)),
      datasets: [
        { data: pesos.map(x => x.kg), borderColor: C.electrico, backgroundColor: C.electricoSuave, fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: C.electrico },
        ...(p.pesoObjetivo ? [{ data: pesos.map(() => Number(p.pesoObjetivo)), borderColor: C.acero, borderDash: [6, 6], pointRadius: 0, fill: false }] : []),
      ],
    },
    options: { scales: { x: ejeX(), y: ejeY({ ticks: { callback: v => `${v} kg` } }) } },
  });
}

// =====================================================================
export function renderPerfil(cont) {
  const p = leer('perfil', PERFIL_VACIO);
  const pesos = leer('pesos', []).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const marcas = leer('marcas', []);
  cont.innerHTML = `
    <section class="panel">
      <div class="panel-cab"><h3>Tus datos</h3><span class="tenue">Se guardan solos</span></div>
      <form class="campos" id="pf-form" autocomplete="off">
        <div class="segmento" role="group" aria-label="Sexo">
          <button type="button" data-sexo="h" class="${p.sexo === 'h' ? 'activo' : ''}">Hombre</button>
          <button type="button" data-sexo="m" class="${p.sexo === 'm' ? 'activo' : ''}">Mujer</button>
        </div>
        <div class="campos-3">
          <label class="campo">Edad <input name="edad" type="number" inputmode="numeric" min="12" max="99" value="${p.edad}"></label>
          <label class="campo">Altura (cm) <input name="altura" type="number" inputmode="numeric" min="120" max="230" value="${p.altura}"></label>
          <label class="campo">Peso (kg) <input name="peso" type="number" inputmode="decimal" step="0.1" value="${p.peso}"></label>
        </div>
        <div class="campos-2">
          <label class="campo">Peso objetivo (kg) <input name="pesoObjetivo" type="number" inputmode="decimal" step="0.1" value="${p.pesoObjetivo}"></label>
          <label class="campo">Objetivo
            <select name="objetivo">${Object.entries(OBJETIVOS).map(([k, [t]]) => `<option value="${k}" ${p.objetivo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </label>
        </div>
        <label class="campo">Actividad
          <select name="actividad">${ACTIVIDAD.map(([v, t]) => `<option value="${v}" ${Number(p.actividad) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </form>
    </section>

    <div class="kpis" id="pf-kpis">${kpisHTML(p)}</div>

    <section class="panel">
      <div class="panel-cab"><h3>Tu peso</h3><span class="tenue">${pesos.length ? `${pesos.length} registros` : ''}</span></div>
      <form class="fila-anadir" id="pf-peso">
        <input name="kg" type="number" inputmode="decimal" step="0.1" placeholder="Peso de hoy (kg)" required>
        <input name="fecha" type="date" value="${hoyISO()}" max="${hoyISO()}" required>
        <button class="btn primario" type="submit">Añadir</button>
      </form>
      ${pesos.length >= 2 ? '<div class="grafico"><canvas id="g-peso"></canvas></div>'
        : `<p class="tenue" style="margin-top:12px">Añade al menos dos pesos para ver tu evolución.</p>`}
      ${pesos.length ? `<ul class="lista-simple">${pesos.slice(-5).reverse().map(x => `
        <li><span>${fmtCorta(x.fecha)}</span><b>${fmt(x.kg)} kg</b>
          <button class="btn-icono" data-borrar-peso="${x.fecha}" aria-label="Borrar">${icono('papelera')}</button></li>`).join('')}</ul>` : ''}
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Marcas objetivo</h3><span class="tenue">Fuerza, carrera o lo que quieras</span></div>
      <div class="marcas">
        ${marcas.length ? marcas.map(m => {
          const pr = progresoMarca(m);
          return `
          <div class="marca">
            <div class="marca-cab">
              <b>${escapar(m.nombre)}</b>
              <button class="btn-icono" data-borrar-marca="${m.id}" aria-label="Borrar marca">${icono('papelera')}</button>
            </div>
            <div class="marca-datos">
              <label>Ahora <input data-actual="${m.id}" value="${escapar(m.actual)}" ${m.tipo === 'tiempo' ? 'placeholder="mm:ss"' : 'inputmode="decimal"'}></label>
              <span>Objetivo <b>${escapar(m.objetivo)} ${UNIDAD[m.tipo]}</b></span>
            </div>
            <div class="progreso"><i style="width:${Math.round(pr * 100)}%"></i></div>
            <small class="tenue">${pr >= 1 ? '¡Conseguida!' : `${Math.round(pr * 100)}% del objetivo`}</small>
          </div>`;
        }).join('') : '<p class="tenue">Aún no tienes marcas. Por ejemplo: press banca 100 kg, 5 km en 22:00 o 20 dominadas.</p>'}
      </div>
      <form class="campos" id="pf-marca" style="margin-top:14px">
        <div class="campos-2">
          <label class="campo">Marca <input name="nombre" placeholder="Press banca, 5 km..." required></label>
          <label class="campo">Se mide en
            <select name="tipo"><option value="peso">Peso (kg)</option><option value="reps">Repeticiones</option><option value="tiempo">Tiempo (mm:ss)</option></select>
          </label>
        </div>
        <div class="campos-2">
          <label class="campo">Ahora <input name="actual" placeholder="80"></label>
          <label class="campo">Objetivo <input name="objetivo" placeholder="100" required></label>
        </div>
        <button class="btn suave" type="submit">${icono('mas')}Añadir marca</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Calculadoras</h3></div>
      <div class="calculadoras">
        <form class="calc" id="calc-rm">
          <h4>Repetición máxima (1RM)</h4>
          <div class="campos-2">
            <label class="campo">Peso (kg) <input name="kg" type="number" inputmode="decimal" step="0.5"></label>
            <label class="campo">Repeticiones <input name="reps" type="number" inputmode="numeric" min="1" max="20"></label>
          </div>
          <p class="calc-res" id="res-rm">Escribe un peso y tus repeticiones.</p>
        </form>
        <form class="calc" id="calc-ritmo">
          <h4>Ritmo de carrera</h4>
          <div class="campos-2">
            <label class="campo">Distancia (km) <input name="km" type="number" inputmode="decimal" step="0.01"></label>
            <label class="campo">Tiempo (mm:ss o h:mm:ss) <input name="tiempo" placeholder="25:00"></label>
          </div>
          <p class="calc-res" id="res-ritmo">Escribe distancia y tiempo.</p>
        </form>
      </div>
    </section>`;

  pintarGraficaPeso(cont);

  // ---------- Eventos ----------
  const form = cont.querySelector('#pf-form');
  const guardarPerfil = (cambios, repintar = false) => {
    guardar('perfil', { ...leer('perfil', PERFIL_VACIO), ...cambios });
    if (repintar) renderPerfil(cont);
  };
  form.onchange = ev => {
    const { name, value } = ev.target;
    if (!name) return;
    guardarPerfil({ [name]: name === 'objetivo' ? value : value === '' ? '' : Number(value) });
    cont.querySelector('#pf-kpis').innerHTML = kpisHTML(leer('perfil', PERFIL_VACIO));
    if (name === 'pesoObjetivo') pintarGraficaPeso(cont);
  };

  cont.onclick = ev => {
    const sexo = ev.target.closest('[data-sexo]');
    if (sexo) return guardarPerfil({ sexo: sexo.dataset.sexo }, true);
    const bp = ev.target.closest('[data-borrar-peso]');
    if (bp) {
      guardar('pesos', leer('pesos', []).filter(x => x.fecha !== bp.dataset.borrarPeso));
      return renderPerfil(cont);
    }
    const bm = ev.target.closest('[data-borrar-marca]');
    if (bm && confirm('¿Borrar esta marca?')) {
      guardar('marcas', leer('marcas', []).filter(m => m.id !== bm.dataset.borrarMarca));
      renderPerfil(cont);
    }
  };

  cont.querySelector('#pf-peso').onsubmit = ev => {
    ev.preventDefault();
    const d = new FormData(ev.target);
    const kg = Number(d.get('kg')), fecha = d.get('fecha');
    const lista = leer('pesos', []).filter(x => x.fecha !== fecha);
    lista.push({ fecha, kg });
    guardar('pesos', lista);
    // El último peso registrado pasa a ser tu peso actual
    const ultimo = lista.sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
    guardarPerfil({ peso: ultimo.kg });
    aviso('Peso guardado');
    renderPerfil(cont);
  };

  cont.querySelector('#pf-marca').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    guardar('marcas', [...leer('marcas', []), { id: nuevoId(), ...d }]);
    renderPerfil(cont);
  };

  cont.oninput = ev => {
    const act = ev.target.dataset.actual;
    if (act) {
      guardar('marcas', leer('marcas', []).map(m => (m.id === act ? { ...m, actual: ev.target.value } : m)));
      return;
    }
    const f = ev.target.form;
    if (f?.id === 'calc-rm') {
      const kg = Number(f.kg.value), reps = Number(f.reps.value);
      cont.querySelector('#res-rm').innerHTML = kg > 0 && reps > 0
        ? `Tu 1RM estimado: <b>${fmt(kg * (1 + reps / 30))} kg</b> · al 80%: ${fmt(kg * (1 + reps / 30) * 0.8)} kg`
        : 'Escribe un peso y tus repeticiones.';
    }
    if (f?.id === 'calc-ritmo') {
      const km = Number(f.km.value), seg = parseTiempo(f.tiempo.value, 'min');
      cont.querySelector('#res-ritmo').innerHTML = km > 0 && seg > 0
        ? `Ritmo: <b>${fmtTiempo(seg / km)} /km</b> · ${fmt(km / (seg / 3600))} km/h`
        : 'Escribe distancia y tiempo.';
    }
  };
}
