// CONCENTRACIÓN (Estudios y trabajo): métodos de estudio con un reloj de hojas que caen.
//  - Pomodoro: 25 min de estudio y 5 de descanso; cada 4, un descanso largo de 15.
//  - Flowtime + Pomodoro (contra la procrastinación): te comprometes solo a 10 minutos; si después
//    sigues concentrado, el reloj cuenta hacia arriba hasta que pares. El descanso es proporcional
//    (una quinta parte de lo trabajado, entre 5 y 20 minutos).
//  - Focus Tree: eliges un tiempo y un árbol crece mientras te concentras. Si sales de SYNCO
//    o abandonas, se marchita. Los árboles que completas forman tu bosque.
//  - Leitner: tarjetas de memoria en 5 cajas. Si aciertas, la tarjeta sube de caja y la repasas
//    más tarde (1, 2, 4, 8 y 16 días); si fallas, vuelve a la caja 1.
// El reloj sigue en marcha aunque cambies de pestaña dentro de SYNCO (el estado vive en este módulo).
import { leer, guardar, hoyISO, nuevoId, escapar } from './almacen.js';
import { abrirModal } from './interaccion.js';
import { aviso } from './utils.js';

export const METODOS = {
  pomodoro: { nombre: 'Pomodoro', corto: '25 / 5', explica: '25 minutos de estudio y 5 de descanso. Cada 4 rondas, un descanso largo de 15.' },
  flow: { nombre: 'Flowtime', corto: 'Anti-procrastinación', explica: 'Empieza con solo 10 minutos. Si sigues concentrado, continúa hasta que notes que bajas; el descanso será proporcional a lo que hayas trabajado.' },
  arbol: { nombre: 'Focus Tree', corto: 'Planta un árbol', explica: 'Tu árbol crece mientras te concentras. Si sales de SYNCO o abandonas, se marchita.' },
  leitner: { nombre: 'Leitner', corto: 'Memorizar', explica: 'Tarjetas de pregunta y respuesta en 5 cajas. Las que aciertas suben de caja y se repasan cada vez más espaciadas.' },
};

// ---------- Estado del reloj (en memoria, sobrevive al repintado) ----------
const R = {
  metodo: leer('foco-metodo', 'pomodoro'),
  fase: 'listo',         // listo | trabajo | descanso | flujo
  corriendo: false,
  fin: 0,                // marca de tiempo en la que acaba la cuenta atrás
  restante: 25 * 60,     // segundos (cuando está en pausa)
  inicioFlujo: 0,        // para contar hacia arriba
  acumulado: 0,          // segundos trabajados en esta ronda (flowtime)
  ronda: 1,
  arbolMin: 25, arbolMuerto: false,
  total: 25 * 60,        // duración de la fase actual (para la barra y el árbol)
};
let tic = null, vista = null;

const MIN = { pomodoro: 25, descanso: 5, largo: 15, arranque: 10 };
const ahora = () => Date.now();
const segundosQueda = () => (R.corriendo ? Math.max(0, Math.round((R.fin - ahora()) / 1000)) : R.restante);
const segundosFlujo = () => R.acumulado + (R.corriendo && R.fase === 'flujo' ? Math.round((ahora() - R.inicioFlujo) / 1000) : 0);

function sonido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22, 0.44].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = [660, 880, 990][i]; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    });
  } catch {}
  navigator.vibrate?.([120, 80, 120]);
}

// Minutos de concentración de hoy (para el resumen)
function sumarMinutos(seg, tipo) {
  const h = leer('foco-historial', {});
  const d = hoyISO();
  h[d] = h[d] || { min: 0, pomodoros: 0, arboles: 0, secos: 0 };
  h[d].min += Math.round(seg / 60);
  if (tipo) h[d][tipo] = (h[d][tipo] || 0) + 1;
  guardar('foco-historial', h);
}

function preparar(metodo = R.metodo) {
  R.metodo = metodo; guardar('foco-metodo', metodo);
  R.corriendo = false; R.fase = 'listo'; R.ronda = 1; R.acumulado = 0; R.arbolMuerto = false;
  R.total = R.restante = (metodo === 'pomodoro' ? MIN.pomodoro : metodo === 'flow' ? MIN.arranque : R.arbolMin) * 60;
}

function empezar() {
  if (R.fase === 'listo') R.fase = 'trabajo';
  if (R.fase === 'flujo') R.inicioFlujo = ahora();
  else R.fin = ahora() + R.restante * 1000;
  R.corriendo = true;
  arrancarTic();
}
function pausar() {
  if (R.fase === 'flujo') R.acumulado = segundosFlujo();
  else R.restante = segundosQueda();
  R.corriendo = false;
  // En Focus Tree, pausar es abandonar: el árbol se marchita
  if (R.metodo === 'arbol' && R.fase === 'trabajo') marchitar();
}
function marchitar() {
  if (R.arbolMuerto) return;
  R.arbolMuerto = true; R.corriendo = false;
  sumarMinutos(R.total - segundosQueda(), 'secos');
  aviso('Tu árbol se ha marchitado. Planta otro cuando estés listo.', 'error');
}

// Fin de una cuenta atrás: pasa a la siguiente fase
function terminarFase() {
  sonido();
  if (R.metodo === 'pomodoro') {
    if (R.fase === 'trabajo') {
      sumarMinutos(MIN.pomodoro * 60, 'pomodoros');
      const largo = R.ronda % 4 === 0;
      R.fase = 'descanso'; R.total = R.restante = (largo ? MIN.largo : MIN.descanso) * 60;
      aviso(largo ? '¡4 pomodoros! Descanso largo de 15 minutos.' : 'Pomodoro completado. 5 minutos de descanso.');
    } else {
      R.ronda++; R.fase = 'trabajo'; R.total = R.restante = MIN.pomodoro * 60;
      aviso('Descanso terminado: a por el siguiente.');
    }
    R.fin = ahora() + R.restante * 1000;   // sigue solo
    return;
  }
  if (R.metodo === 'flow') {
    if (R.fase === 'trabajo') {
      // Ya has vencido la pereza: ahora el reloj cuenta hacia arriba mientras sigas
      R.fase = 'flujo'; R.acumulado = MIN.arranque * 60; R.inicioFlujo = ahora();
      aviso('¡Has arrancado! Sigue mientras estés concentrado y pulsa «Descansar» cuando bajes.');
    } else {                                   // fin del descanso
      R.fase = 'listo'; R.corriendo = false; R.acumulado = 0; R.total = R.restante = MIN.arranque * 60;
      aviso('Descanso terminado.');
    }
    return;
  }
  if (R.metodo === 'arbol') {
    sumarMinutos(R.total, 'arboles');
    const b = leer('foco-bosque', []); b.push({ fecha: hoyISO(), min: Math.round(R.total / 60) }); guardar('foco-bosque', b);
    R.corriendo = false; R.fase = 'hecho';
    aviso('¡Árbol plantado! Ya forma parte de tu bosque.');
  }
}
// Flowtime: paras cuando bajas la concentración y te toca un descanso proporcional
function descansarFlow() {
  const trabajado = segundosFlujo();
  sumarMinutos(trabajado);
  const desc = Math.min(20, Math.max(5, Math.round(trabajado / 60 / 5))) * 60;
  R.fase = 'descanso'; R.total = R.restante = desc; R.acumulado = 0;
  R.fin = ahora() + desc * 1000; R.corriendo = true;
  aviso(`Has estado ${Math.round(trabajado / 60)} minutos. Descansa ${desc / 60}.`);
}

function arrancarTic() {
  clearInterval(tic);
  tic = setInterval(() => {
    if (!R.corriendo) return;
    if (R.fase !== 'flujo' && segundosQueda() <= 0) terminarFase();
    if (vista?.isConnected) pintarReloj(vista); else if (!R.corriendo) clearInterval(tic);
  }, 250);
}
// Focus Tree: si sales de SYNCO (otra pestaña o app) más de 10 s mientras crece, se marchita
let salida = 0;
document.addEventListener('visibilitychange', () => {
  if (R.metodo !== 'arbol' || R.fase !== 'trabajo' || !R.corriendo) return;
  if (document.hidden) salida = ahora();
  else if (salida && ahora() - salida > 10000) { marchitar(); if (vista?.isConnected) pintar(vista); }
});

// ---------- Reloj de hojas ----------
const dos = n => String(Math.max(0, n)).padStart(2, '0');
function hoja(valor, clase = '') {
  return `<div class="flip ${clase}" data-v="${valor}">
    <div class="flip-mitad sup"><span>${valor}</span></div>
    <div class="flip-mitad inf"><span>${valor}</span></div>
  </div>`;
}
// Cambia una hoja con la animación de pasar página
function voltear(el, nuevo) {
  if (!el || el.dataset.v === nuevo) return;
  const viejo = el.dataset.v;
  el.dataset.v = nuevo;
  const sup = el.querySelector('.flip-mitad.sup span'), inf = el.querySelector('.flip-mitad.inf span');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { sup.textContent = inf.textContent = nuevo; return; }
  sup.textContent = nuevo;                       // arriba ya se ve el nuevo (debajo de la hoja que cae)
  el.querySelectorAll('.flip-hoja').forEach(x => x.remove());
  const caeSup = document.createElement('div'); caeSup.className = 'flip-hoja sup'; caeSup.innerHTML = `<span>${viejo}</span>`;
  const caeInf = document.createElement('div'); caeInf.className = 'flip-hoja inf'; caeInf.innerHTML = `<span>${nuevo}</span>`;
  el.append(caeSup, caeInf);
  caeInf.addEventListener('animationend', () => { inf.textContent = nuevo; caeSup.remove(); caeInf.remove(); }, { once: true });
}

function valoresReloj() {
  const seg = R.fase === 'flujo' ? segundosFlujo() : segundosQueda();
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return h ? [dos(h * 60 + m), dos(s)] : [dos(m), dos(s)];
}
function textoFase() {
  if (R.metodo === 'pomodoro') return R.fase === 'descanso' ? (R.ronda % 4 === 0 ? 'Descanso largo' : 'Descanso') : `Estudio · ronda ${((R.ronda - 1) % 4) + 1} de 4`;
  if (R.metodo === 'flow') return R.fase === 'flujo' ? 'En flujo · sigue mientras puedas' : R.fase === 'descanso' ? 'Descanso proporcional' : 'Solo 10 minutos para arrancar';
  if (R.metodo === 'arbol') return R.arbolMuerto ? 'Se ha marchitado' : R.fase === 'hecho' ? '¡Árbol plantado!' : R.fase === 'trabajo' ? 'Creciendo… no salgas de SYNCO' : 'Elige cuánto tiempo';
  return '';
}

// Árbol que crece (0 … 1) o seco
function arbol(p, seco) {
  const t = Math.max(0, Math.min(1, p));
  const verde = seco ? '#A99A82' : '#4E8F5E', verde2 = seco ? '#BBAE97' : '#6FAE77', tronco = seco ? '#8B7B66' : '#7A5A3E';
  const alto = 18 + 44 * Math.min(1, t * 1.6);
  const copa = t < 0.2 ? 0 : (t - 0.2) / 0.8;
  return `<svg class="arbol ${seco ? 'seco' : ''}" viewBox="0 0 120 120" aria-hidden="true">
    <ellipse cx="60" cy="108" rx="${26 + 12 * t}" ry="5" fill="rgba(34,43,61,.08)"/>
    <path d="M60 108 L60 ${108 - alto}" stroke="${tronco}" stroke-width="${3 + 3 * t}" stroke-linecap="round"/>
    ${t > 0.35 ? `<path d="M60 ${108 - alto * 0.55} l${-12 * t} ${-10 * t}" stroke="${tronco}" stroke-width="${2 + 1.5 * t}" stroke-linecap="round"/>` : ''}
    ${copa > 0 ? `<g transform="translate(60 ${108 - alto}) scale(${0.35 + 0.65 * copa}) ${seco ? 'rotate(8)' : ''}">
      <circle cx="0" cy="-6" r="22" fill="${verde}"/><circle cx="-16" cy="6" r="15" fill="${verde2}"/><circle cx="16" cy="6" r="15" fill="${verde}"/><circle cx="0" cy="-22" r="13" fill="${verde2}"/>
    </g>` : `<circle cx="60" cy="${104 - alto}" r="${3 + 6 * t}" fill="${verde2}"/>`}
  </svg>`;
}

/* ============================== PANEL ============================== */
export function renderFoco(cont) {
  vista = cont;
  pintar(cont);
  if (R.corriendo) arrancarTic();
}

function resumenHoy() {
  const h = leer('foco-historial', {})[hoyISO()];
  if (!h) return 'Hoy aún no has empezado.';
  const partes = [`${h.min} min de concentración`];
  if (h.pomodoros) partes.push(`${h.pomodoros} pomodoro${h.pomodoros > 1 ? 's' : ''}`);
  if (h.arboles) partes.push(`${h.arboles} árbol${h.arboles > 1 ? 'es' : ''}`);
  return `Hoy: ${partes.join(' · ')}`;
}

function pintar(cont) {
  const m = METODOS[R.metodo];
  const enMarcha = R.fase !== 'listo' && R.fase !== 'hecho' && !R.arbolMuerto;
  cont.innerHTML = `
    <div class="fo">
      <div class="fo-cab"><h3>Concentración</h3><small>${escapar(resumenHoy())}</small></div>
      <div class="fo-metodos" role="tablist" aria-label="Método">
        ${Object.entries(METODOS).map(([k, x]) => `<button role="tab" aria-selected="${k === R.metodo}" class="${k === R.metodo ? 'activo' : ''}" data-metodo="${k}"><b>${x.nombre}</b><small>${x.corto}</small></button>`).join('')}
      </div>
      ${R.metodo === 'leitner' ? panelLeitner() : `
      <p class="fo-explica">${m.explica}</p>
      <div class="fo-reloj ${R.fase}">
        ${R.metodo === 'arbol' ? `<div class="fo-arbol">${arbol(R.fase === 'hecho' ? 1 : 1 - segundosQueda() / R.total, R.arbolMuerto)}</div>` : ''}
        <p class="fo-fase">${textoFase()}</p>
        <div class="fo-hojas" aria-live="off">${valoresReloj().map((v, i) => hoja(v, i ? 'seg' : 'min')).join('')}</div>
        <div class="fo-progreso"><i style="width:0%"></i></div>
        ${R.metodo === 'arbol' && R.fase === 'listo' ? `<div class="fo-tiempos">${[15, 25, 45, 60, 90].map(n => `<button class="${R.arbolMin === n ? 'activo' : ''}" data-arbol-min="${n}">${n} min</button>`).join('')}</div>` : ''}
        <div class="fo-controles">
          ${R.fase === 'hecho' || R.arbolMuerto ? `<button class="btn primario" data-a="reiniciar">${R.metodo === 'arbol' ? 'Plantar otro' : 'Empezar de nuevo'}</button>`
            : R.corriendo ? `<button class="btn primario" data-a="pausa">${R.metodo === 'arbol' ? 'Abandonar' : 'Pausa'}</button>`
            : `<button class="btn primario" data-a="empezar">${enMarcha ? 'Seguir' : R.metodo === 'arbol' ? 'Plantar' : 'Empezar'}</button>`}
          ${R.metodo === 'flow' && R.fase === 'flujo' ? '<button class="btn suave" data-a="descansar">Descansar</button>' : ''}
          ${enMarcha && R.metodo === 'pomodoro' ? '<button class="btn suave" data-a="saltar">Saltar</button>' : ''}
          ${enMarcha && !R.corriendo ? '<button class="btn-texto" data-a="reiniciar">Reiniciar</button>' : ''}
        </div>
      </div>
      ${R.metodo === 'arbol' ? bosque() : ''}`}
    </div>`;
  pintarReloj(cont);
  cont.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.metodo) { if (R.corriendo && !confirm('¿Cambiar de método? Se para el reloj.')) return; if (R.corriendo) pausar(); preparar(b.dataset.metodo); return pintar(cont); }
    if (b.dataset.arbolMin) { R.arbolMin = Number(b.dataset.arbolMin); preparar('arbol'); return pintar(cont); }
    const a = b.dataset.a;
    if (a === 'empezar') empezar();
    if (a === 'pausa') pausar();
    if (a === 'descansar') descansarFlow();
    if (a === 'saltar') { R.fin = ahora(); terminarFase(); }
    if (a === 'reiniciar') preparar();
    if (a?.startsWith('lt-')) return accionLeitner(a, b, cont);
    pintar(cont);
  };
}

function pintarReloj(cont) {
  const hojas = cont.querySelectorAll('.fo-hojas .flip');
  if (!hojas.length) return;
  const [a, b] = valoresReloj();
  voltear(hojas[0], a); voltear(hojas[1], b);
  const barra = cont.querySelector('.fo-progreso i');
  if (barra) barra.style.width = R.fase === 'flujo' ? '100%' : `${Math.round((1 - segundosQueda() / R.total) * 100)}%`;
  const arb = cont.querySelector('.fo-arbol');
  if (arb && R.fase === 'trabajo') arb.innerHTML = arbol(1 - segundosQueda() / R.total, R.arbolMuerto);
  // Cambió la fase (fin de pomodoro, etc.): repintar textos y botones
  const fase = cont.querySelector('.fo-fase');
  if (fase && fase.textContent !== textoFase()) pintar(cont);
}

function bosque() {
  const b = leer('foco-bosque', []);
  if (!b.length) return '<p class="fo-bosque-vacio">Tu bosque está vacío. Cada sesión completada planta un árbol.</p>';
  return `<div class="fo-bosque"><small>Tu bosque · ${b.length} árbol${b.length > 1 ? 'es' : ''}</small><div>${b.slice(-40).map(() => arbol(1, false)).join('')}</div></div>`;
}

/* ============================== LEITNER ============================== */
const INTERVALO = [0, 1, 2, 4, 8, 16];        // días hasta el siguiente repaso, por caja
const datosL = () => leer('leitner', { mazos: [], tarjetas: [] });
const sumarDiasISO = (iso, n) => { const d = new Date(`${iso}T12:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
let mazoSel = null;

function panelLeitner() {
  const D = datosL();
  if (!mazoSel || !D.mazos.some(m => m.id === mazoSel)) mazoSel = D.mazos[0]?.id || null;
  const hoy = hoyISO();
  const del = D.tarjetas.filter(t => t.mazo === mazoSel);
  const tocan = del.filter(t => t.proxima <= hoy);
  return `
    <p class="fo-explica">${METODOS.leitner.explica}</p>
    <div class="lt">
      <div class="lt-mazos">
        ${D.mazos.map(m => `<button class="${m.id === mazoSel ? 'activo' : ''}" data-a="lt-mazo" data-id="${m.id}">${escapar(m.nombre)}</button>`).join('')}
        <button class="lt-nuevo" data-a="lt-nuevo-mazo">+ Mazo</button>
      </div>
      ${mazoSel ? `
        <div class="lt-cajas">${[1, 2, 3, 4, 5].map(c => {
          const n = del.filter(t => t.caja === c).length;
          return `<div class="lt-caja"><b>${n}</b><i style="height:${Math.min(100, n * 8)}%"></i><small>Caja ${c}</small><em>${INTERVALO[c] === 1 ? 'cada día' : `cada ${INTERVALO[c]} días`}</em></div>`;
        }).join('')}</div>
        <div class="fo-controles">
          <button class="btn primario" data-a="lt-repasar" ${tocan.length ? '' : 'disabled'}>${tocan.length ? `Repasar ${tocan.length} tarjeta${tocan.length > 1 ? 's' : ''}` : 'Nada que repasar hoy'}</button>
          <button class="btn suave" data-a="lt-tarjeta">+ Tarjeta</button>
        </div>` : '<p class="fo-bosque-vacio">Crea un mazo por asignatura (por ejemplo, «Anatomía») y añade tarjetas de pregunta y respuesta.</p>'}
    </div>`;
}

function accionLeitner(a, b, cont) {
  const D = datosL();
  if (a === 'lt-mazo') { mazoSel = b.dataset.id; return pintar(cont); }
  if (a === 'lt-nuevo-mazo') {
    const nombre = prompt('Nombre del mazo (por ejemplo, una asignatura):');
    if (!nombre?.trim()) return;
    const m = { id: nuevoId(), nombre: nombre.trim() };
    D.mazos.push(m); guardar('leitner', D); mazoSel = m.id; return pintar(cont);
  }
  if (a === 'lt-tarjeta') return nuevaTarjeta(cont);
  if (a === 'lt-repasar') return repasar(cont);
}

function nuevaTarjeta(cont) {
  abrirModal({
    titulo: 'Nueva tarjeta', subtitulo: 'Leitner',
    contenido: `<form class="ev-form" novalidate>
      <label class="campo">Pregunta <textarea name="frente" rows="2" required placeholder="¿Qué es la ley de Frank-Starling?"></textarea></label>
      <label class="campo">Respuesta <textarea name="reverso" rows="3" required></textarea></label>
      <p class="tenue">Al guardar puedes seguir añadiendo otra.</p>
      <div class="ev-acciones fin"><button type="button" class="btn suave" data-cerrar-modal>Terminar</button><button class="btn primario" type="submit">Guardar tarjeta</button></div>
    </form>`,
    alAbrir: (cuerpo) => {
      const form = cuerpo.querySelector('form');
      form.onsubmit = ev => {
        ev.preventDefault();
        const f = new FormData(form);
        const frente = f.get('frente').trim(), reverso = f.get('reverso').trim();
        if (!frente || !reverso) return;
        const D = datosL();
        D.tarjetas.push({ id: nuevoId(), mazo: mazoSel, frente, reverso, caja: 1, proxima: hoyISO() });
        guardar('leitner', D);
        form.reset(); form.elements.frente.focus();
        aviso('Tarjeta guardada en la caja 1');
        pintar(cont);
      };
    },
  });
}

function repasar(cont) {
  const hoy = hoyISO();
  const cola = datosL().tarjetas.filter(t => t.mazo === mazoSel && t.proxima <= hoy).sort(() => Math.random() - 0.5);
  let i = 0, bien = 0;
  abrirModal({
    titulo: 'Repaso', subtitulo: 'Leitner',
    contenido: '<div class="lt-repaso"></div>',
    alAbrir: (cuerpo, cerrar) => {
      const zona = cuerpo.querySelector('.lt-repaso');
      const mostrar = () => {
        if (i >= cola.length) {
          zona.innerHTML = `<div class="lt-fin"><b>${bien} de ${cola.length}</b><p>${bien === cola.length ? '¡Perfecto! Todas suben de caja.' : 'Las falladas vuelven a la caja 1 y las verás mañana.'}</p><button class="btn primario" data-lt="fin">Terminar</button></div>`;
          return;
        }
        const t = cola[i];
        zona.innerHTML = `
          <p class="lt-cuenta">${i + 1} de ${cola.length} · caja ${t.caja}</p>
          <div class="lt-carta"><div class="lt-cara frente">${escapar(t.frente)}</div><div class="lt-cara reverso">${escapar(t.reverso)}</div></div>
          <div class="fo-controles lt-ver"><button class="btn primario" data-lt="ver">Ver respuesta</button></div>
          <div class="fo-controles lt-juzgar" hidden><button class="btn suave" data-lt="mal">No lo sabía</button><button class="btn primario" data-lt="bien">Lo sabía</button></div>`;
      };
      zona.addEventListener('click', async ev => {
        const b = ev.target.closest('[data-lt]'); if (!b) return;
        const acc = b.dataset.lt;
        if (acc === 'fin') { await cerrar(); return pintar(cont); }
        if (acc === 'ver') { zona.querySelector('.lt-carta').classList.add('girada'); zona.querySelector('.lt-ver').hidden = true; zona.querySelector('.lt-juzgar').hidden = false; return; }
        const D = datosL();
        const t = D.tarjetas.find(x => x.id === cola[i].id);
        if (t) {
          t.caja = acc === 'bien' ? Math.min(5, t.caja + 1) : 1;
          t.proxima = sumarDiasISO(hoy, INTERVALO[t.caja]);
          guardar('leitner', D);
        }
        if (acc === 'bien') bien++;
        i++; mostrar();
      });
      mostrar();
    },
  });
}
