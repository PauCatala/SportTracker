// SALUD · PERFIL: tus datos, tu peso, tus marcas objetivo y calculadoras rápidas.
// Funciona sin cuenta (se guarda en el navegador) y se sincroniza al entrar.
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { grafica, ejeX, ejeY, C } from './graficos.js';
import { icono } from './iconos.js';
import { aviso, fmtCorta, parseTiempo, fmtTiempo, sumarDias, diasEntre } from './utils.js';

export const PERFIL_VACIO = { sexo: 'h', edad: '', altura: '', peso: '', actividad: 1.55, pesoObjetivo: '', meses: '', inicio: null };

const ACTIVIDAD = [
  [1.2, 'Sedentaria (poco o nada de ejercicio)'],
  [1.375, 'Ligera (1-3 días por semana)'],
  [1.55, 'Moderada (3-5 días por semana)'],
  [1.725, 'Alta (6-7 días por semana)'],
  [1.9, 'Muy alta (doble sesión o trabajo físico)'],
];

// Límites para que el objetivo tenga sentido físico (orientativos, no médicos)
export const LIMITES = {
  perderPctMes: 4,     // perder más de ~1 % del peso por semana no es sostenible
  ganarPctMes: 2,      // ganar más de ~0,5 % por semana suele ser casi todo grasa
  imcMin: 17,          // peso objetivo demasiado bajo para tu altura
  imcMax: 35,
  kcalMin: { h: 1500, m: 1200 },
};
const KCAL_POR_KG = 7700;
const DIAS_MES = 30.44;

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

// El plan de peso: comprueba que el objetivo es realista y calcula ritmo y calorías
export function planPeso(p) {
  if (!perfilCompleto(p)) return { estado: 'incompleto' };
  const obj = Number(p.pesoObjetivo);
  if (!obj) return { estado: 'mantener' };
  const m2 = (p.altura / 100) ** 2;
  const imcObj = obj / m2;
  if (imcObj < LIMITES.imcMin) {
    return { estado: 'error', mensaje: `Con ${fmt(obj)} kg tu IMC sería ${fmt(imcObj)}, demasiado bajo para tu altura. El mínimo razonable es ${fmt(Math.ceil(LIMITES.imcMin * m2))} kg.` };
  }
  if (imcObj > LIMITES.imcMax) {
    return { estado: 'error', mensaje: `Con ${fmt(obj)} kg tu IMC sería ${fmt(imcObj)}, demasiado alto. El máximo razonable es ${fmt(Math.floor(LIMITES.imcMax * m2))} kg.` };
  }
  const inicio = p.inicio || { fecha: hoyISO(), peso: Number(p.peso) };
  const diff = obj - inicio.peso;
  if (Math.abs(diff) < 0.5) return { estado: 'mantener' };
  const meses = Number(p.meses);
  if (!meses) return { estado: 'error', mensaje: '¿En cuántos meses quieres conseguirlo? Elige un plazo.' };

  const pierde = diff < 0;
  const pctMes = (Math.abs(diff) / inicio.peso / meses) * 100;
  const max = pierde ? LIMITES.perderPctMes : LIMITES.ganarPctMes;
  if (pctMes > max) {
    const mesesMin = Math.ceil((Math.abs(diff) / inicio.peso) * 100 / max);
    return {
      estado: 'error', mesesMin,
      mensaje: `Es demasiado rápido: ${pierde ? 'perder' : 'ganar'} ${fmt(Math.abs(diff))} kg en ${meses} ${meses === 1 ? 'mes' : 'meses'} es un ${fmt(pctMes)} % de tu peso al mes. Lo realista es como máximo un ${max} %: necesitas al menos ${mesesMin} meses.`,
    };
  }
  const dias = meses * DIAS_MES;
  const mant = caloriasMantenimiento(p);
  const kcal = Math.max(LIMITES.kcalMin[p.sexo], Math.round(mant + (diff * KCAL_POR_KG) / dias));
  const fin = sumarDias(inicio.fecha, Math.round(dias));
  const transcurridos = Math.max(0, Math.min(dias, diasEntre(inicio.fecha, hoyISO())));
  return {
    estado: 'ok', inicio, obj, diff, meses, fin, kcal,
    kgSemana: (diff / dias) * 7,
    esperadoHoy: inicio.peso + diff * (transcurridos / dias),
    esperadoEn: fecha => inicio.peso + diff * Math.max(0, Math.min(1, diasEntre(inicio.fecha, fecha) / dias)),
  };
}

export function caloriasObjetivo(p) {
  const plan = planPeso(p);
  return plan.estado === 'ok' ? plan.kcal : caloriasMantenimiento(p);
}
const fmt = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d });
export const imc = p => (perfilCompleto(p) ? p.peso / (p.altura / 100) ** 2 : null);
function textoImc(v) {
  if (v < 18.5) return 'Bajo peso';
  if (v < 25) return 'Saludable';
  if (v < 30) return 'Sobrepeso';
  return 'Obesidad';
}

// Progreso de una marca (0..1). En tiempo, menos es mejor.
function progresoMarca(m) {
  const act = m.tipo === 'tiempo' ? parseTiempo(m.actual, 'min') : Number(m.actual);
  const obj = m.tipo === 'tiempo' ? parseTiempo(m.objetivo, 'min') : Number(m.objetivo);
  if (!(act > 0) || !(obj > 0)) return 0;
  return Math.min(1, m.tipo === 'tiempo' ? obj / act : act / obj);
}
const UNIDAD = { peso: 'kg', reps: 'reps', tiempo: '' };

function kpisHTML(p) {
  const vImc = imc(p), mant = caloriasMantenimiento(p), plan = planPeso(p);
  const kcal = caloriasObjetivo(p);
  return `
      <div class="kpi"><span>IMC</span><b>${vImc ? fmt(vImc) : '–'}</b><small>${vImc ? textoImc(vImc) : 'Completa tus datos'}</small></div>
      <div class="kpi"><span>Mantenimiento</span><b>${mant ? mant.toLocaleString('es-ES') : '–'}</b><small>kcal al día</small></div>
      <div class="kpi"><span>Tu objetivo diario</span><b>${kcal ? kcal.toLocaleString('es-ES') : '–'}</b><small>${plan.estado === 'ok' ? `kcal · ${plan.diff < 0 ? 'déficit' : 'superávit'} de ${Math.abs(kcal - mant).toLocaleString('es-ES')}` : 'kcal al día'}</small></div>`;
}

// Texto del plan de peso (verde si es realista, aviso si no lo es)
function planHTML(p) {
  const plan = planPeso(p);
  if (plan.estado === 'incompleto') return '<p class="tenue">Completa edad, altura y peso para calcular tu plan.</p>';
  if (plan.estado === 'mantener') return '<p class="plan-ok">Sin objetivo de cambio: tus calorías son las de mantenimiento.</p>';
  if (plan.estado === 'error') {
    return `<div class="plan-error"><p>${plan.mensaje}</p>${plan.mesesMin ? `<button class="btn suave chico" type="button" data-usar-meses="${plan.mesesMin}">Usar ${plan.mesesMin} meses</button>` : ''}</div>`;
  }
  const fin = new Date(plan.fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<p class="plan-ok"><b>${plan.kgSemana > 0 ? '+' : ''}${fmt(plan.kgSemana, 2)} kg por semana</b> · ${plan.kcal.toLocaleString('es-ES')} kcal al día · llegarías el ${fin}.</p>`;
}

function pintarGraficaPeso(cont) {
  const p = leer('perfil', PERFIL_VACIO);
  const pesos = leer('pesos', []).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const lienzo = cont.querySelector('#g-peso');
  if (!lienzo || pesos.length < 1) return;
  const plan = planPeso(p);
  // Fechas: tus registros + inicio y fin del plan, para ver el camino completo
  const fechas = [...new Set([...pesos.map(x => x.fecha), ...(plan.estado === 'ok' ? [plan.inicio.fecha, plan.fin] : [])])].sort();
  const porFecha = new Map(pesos.map(x => [x.fecha, x.kg]));
  grafica(lienzo, {
    type: 'line',
    data: {
      labels: fechas.map(f => fmtCorta(f)),
      datasets: [
        { label: 'Tu peso', data: fechas.map(f => porFecha.get(f) ?? null), spanGaps: true, borderColor: C.electrico, backgroundColor: C.electricoSuave, fill: true, tension: .3, pointRadius: 3, pointBackgroundColor: C.electrico },
        ...(plan.estado === 'ok' ? [{ label: 'Tu plan', data: fechas.map(f => (f >= plan.inicio.fecha ? +plan.esperadoEn(f).toFixed(1) : null)), borderColor: C.acero, borderDash: [6, 6], pointRadius: 0, fill: false }] : []),
      ],
    },
    options: { scales: { x: ejeX(), y: ejeY({ ticks: { callback: v => `${v} kg` } }) }, plugins: { legend: { display: plan.estado === 'ok', position: 'bottom', labels: { boxWidth: 12, boxHeight: 2 } } } },
  });
}

// Progreso hacia el objetivo y comparación con lo previsto para hoy
function progresoPesoHTML(p) {
  const plan = planPeso(p);
  if (plan.estado !== 'ok') return '';
  const hecho = Number(p.peso) - plan.inicio.peso;
  const frac = Math.max(0, Math.min(1, hecho / plan.diff));
  const desvio = Number(p.peso) - plan.esperadoHoy;           // + = por encima de lo previsto
  const bien = plan.diff < 0 ? desvio <= 0.3 : desvio >= -0.3;
  const verbo = plan.diff < 0 ? 'bajado' : 'subido';
  return `
    <div class="progreso-peso">
      <div class="progreso-peso-cab">
        <span>Has ${verbo} <b>${fmt(Math.abs(hecho))} kg</b> de ${fmt(Math.abs(plan.diff))} kg</span>
        <b>${Math.round(frac * 100)}%</b>
      </div>
      <div class="progreso"><i style="width:${frac * 100}%"></i></div>
      <p class="${bien ? 'plan-ok' : 'plan-aviso'}">Según tu plan hoy estarías en ${fmt(plan.esperadoHoy)} kg: ${Math.abs(desvio) <= 0.3 ? 'vas justo a ritmo' : bien ? 'vas por delante' : `vas ${fmt(Math.abs(desvio))} kg por detrás`}.</p>
    </div>`;
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
        <label class="campo">Actividad
          <select name="actividad">${ACTIVIDAD.map(([v, t]) => `<option value="${v}" ${Number(p.actividad) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </form>
    </section>

    <section class="panel">
      <div class="panel-cab"><h3>Tu objetivo</h3><span class="tenue">Peso y plazo</span></div>
      <form class="campos" id="pf-objetivo" autocomplete="off">
        <div class="campos-2">
          <label class="campo">Peso objetivo (kg) <input name="pesoObjetivo" type="number" inputmode="decimal" step="0.1" placeholder="Vacío = mantener" value="${p.pesoObjetivo}"></label>
          <label class="campo">En cuántos meses
            <select name="meses"><option value="">Elige</option>${Array.from({ length: 24 }, (_, i) => i + 1).map(m => `<option value="${m}" ${Number(p.meses) === m ? 'selected' : ''}>${m} ${m === 1 ? 'mes' : 'meses'}</option>`).join('')}</select>
          </label>
        </div>
      </form>
      <div id="pf-plan">${planHTML(p)}</div>
    </section>

    <div class="kpis" id="pf-kpis">${kpisHTML(p)}</div>

    <section class="panel">
      <div class="panel-cab"><h3>Tu peso</h3><span class="tenue">${pesos.length ? `${pesos.length} ${pesos.length === 1 ? 'registro' : 'registros'}` : 'Pésate por la mañana, en ayunas'}</span></div>
      <form id="pf-peso" class="peso-hoy">
        <div class="paso-peso">
          <button type="button" class="btn-paso" data-paso="-0.1" aria-label="Restar 100 g">−</button>
          <label><input name="kg" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${pesos.at(-1)?.kg ?? p.peso ?? ''}" required><span>kg</span></label>
          <button type="button" class="btn-paso" data-paso="0.1" aria-label="Sumar 100 g">+</button>
        </div>
        <button class="btn primario" type="submit">Guardar peso de hoy</button>
        <details class="otra-fecha"><summary>Otra fecha</summary><input name="fecha" type="date" value="${hoyISO()}" max="${hoyISO()}"></details>
      </form>
      <div id="pf-progreso">${progresoPesoHTML(p)}</div>
      ${pesos.length ? '<div class="grafico"><canvas id="g-peso"></canvas></div>' : ''}
      ${pesos.length ? `<details class="historial-peso"><summary>Últimos registros</summary><ul class="lista-simple">${pesos.slice(-8).reverse().map(x => `
        <li><span>${fmtCorta(x.fecha)}</span><b>${fmt(x.kg)} kg</b>
          <button class="btn-icono" data-borrar-peso="${x.fecha}" aria-label="Borrar">${icono('papelera')}</button></li>`).join('')}</ul></details>` : ''}
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
  const refrescar = () => {
    const actual = leer('perfil', PERFIL_VACIO);
    cont.querySelector('#pf-kpis').innerHTML = kpisHTML(actual);
    cont.querySelector('#pf-plan').innerHTML = planHTML(actual);
    cont.querySelector('#pf-progreso').innerHTML = progresoPesoHTML(actual);
    pintarGraficaPeso(cont);
  };
  form.onchange = ev => {
    const { name, value } = ev.target;
    if (!name) return;
    guardarPerfil({ [name]: value === '' ? '' : Number(value) });
    if (name === 'peso') {
      const campo = cont.querySelector('#pf-peso [name=kg]');
      if (!campo.value) campo.value = value;
    }
    refrescar();
  };
  // Al cambiar el objetivo o el plazo, el plan empieza hoy con tu peso actual
  cont.querySelector('#pf-objetivo').onchange = ev => {
    const { name, value } = ev.target;
    const actual = leer('perfil', PERFIL_VACIO);
    guardarPerfil({ [name]: value === '' ? '' : Number(value), inicio: { fecha: hoyISO(), peso: Number(actual.peso) } });
    refrescar();
  };

  cont.onclick = ev => {
    const usar = ev.target.closest('[data-usar-meses]');
    if (usar) {
      guardarPerfil({ meses: Number(usar.dataset.usarMeses) });
      cont.querySelector('#pf-objetivo [name=meses]').value = usar.dataset.usarMeses;
      return refrescar();
    }
    const paso = ev.target.closest('[data-paso]');
    if (paso) {
      const campo = cont.querySelector('#pf-peso [name=kg]');
      const base = Number(campo.value) || Number(leer('perfil', PERFIL_VACIO).peso) || 70;
      campo.value = (base + Number(paso.dataset.paso)).toFixed(1);
      return;
    }
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
    const kg = Number(d.get('kg')), fecha = d.get('fecha') || hoyISO();
    if (!(kg >= 30 && kg <= 300)) return aviso('Escribe un peso entre 30 y 300 kg', 'error');
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
