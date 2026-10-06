// INTRO DEL GIMNASIO
// Un hombre de frente extiende el brazo y abre la mano: una mancuerna llega volando y se la clava
// en la palma. Se la lleva al pecho en vertical (posición copa), hace una sentadilla y sale de un salto.
import { sinMovimiento, montar, cerrar, reproducir, estilos } from './intro-base.js';

/* ======================= FIGURA ARTICULADA (DE FRENTE) ======================= */
// Cada pieza cuelga de otra y gira sobre su articulación. Además puede encogerse a lo largo
// (clave "<pieza>_s"): así los muslos se acortan en la sentadilla, como vistos en escorzo.
// I = lado izquierdo de la pantalla, D = lado derecho.
const SUELO = 272;
const PIEZAS = [ // nombre, pieza de la que cuelga, punto de enganche en ella
  ['cadera', 'raiz', [0, 0]], ['tronco', 'raiz', [0, 0]], ['cabeza', 'tronco', [0, -79]],
  ['brazoI', 'tronco', [-21.5, -65]], ['antebrazoI', 'brazoI', [0, 44]], ['manoI', 'antebrazoI', [0, 38]],
  ['brazoD', 'tronco', [21.5, -65]], ['antebrazoD', 'brazoD', [0, 44]], ['manoD', 'antebrazoD', [0, 38]],
  ['musloI', 'raiz', [-10, 0]], ['piernaI', 'musloI', [0, 56]], ['pieI', 'piernaI', [0, 54]],
  ['musloD', 'raiz', [10, 0]], ['piernaD', 'musloD', [0, 56]], ['pieD', 'piernaD', [0, 54]],
];
// Orden de dibujo (de atrás a delante). La mancuerna va entre la cabeza y los brazos.
const DIBUJO = ['pieI', 'pieD', 'piernaI', 'piernaD', 'musloI', 'musloD', 'cadera', 'tronco', 'cabeza',
  'brazoI', 'brazoD', 'antebrazoI', 'antebrazoD', 'manoI', 'manoD'];
const rad = g => g * Math.PI / 180;
const grados = r => r * 180 / Math.PI;
const mezclar = (a, b, t) => a + (b - a) * t;
const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const CURVAS = { suave, sale: t => 1 - Math.pow(1 - t, 3), despega: t => 0.45 * t + 0.55 * t * t };

function cinematica(p, raiz) {
  const r = { raiz: { x: raiz[0], y: raiz[1], a: 0, s: 1 } };
  for (const [n, padre, [ox, oy]] of PIEZAS) {
    const P = r[padre], c = Math.cos(rad(P.a)), s = Math.sin(rad(P.a)), y = oy * P.s;
    // Los pies siempre planos en el suelo: su ángulo es absoluto
    const a = (n === 'pieI' || n === 'pieD') ? (p[n] || 0) : P.a + (p[n] || 0);
    r[n] = { x: P.x + ox * c - y * s, y: P.y + ox * s + y * c, a, s: p[`${n}_s`] ?? 1 };
  }
  return r;
}
// Punto (x, y) en las coordenadas propias de una pieza, pasado a coordenadas de la escena
function enPieza(seg, x, y) {
  const c = Math.cos(rad(seg.a)), s = Math.sin(rad(seg.a));
  return { x: seg.x + x * c - y * seg.s * s, y: seg.y + x * s + y * seg.s * c };
}
// Dónde va la cadera para que los dos tobillos pisen el suelo, centrados en anclaX
function raizApoyada(p, anclaX) {
  const r = cinematica(p, [0, 0]);
  return [anclaX - (r.pieI.x + r.pieD.x) / 2, SUELO - 10 - Math.max(r.pieI.y, r.pieD.y)];
}
// Brazo de dos piezas que lleva la muñeca a un punto (coordenadas del tronco). Devuelve [brazo, antebrazo]
function alcanzar(hombro, muneca, l1, l2, lado) {
  const dx = muneca[0] - hombro[0], dy = muneca[1] - hombro[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = grados(Math.atan2(-dx, dy));
  const giro = grados(Math.acos(limitar((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)));
  const codo = b => hombro[0] - l1 * Math.sin(rad(b));
  // El codo, hacia fuera del cuerpo
  const b = lado * codo(base + giro) > lado * codo(base - giro) ? base + giro : base - giro;
  const ex = codo(b), ey = hombro[1] + l1 * Math.cos(rad(b));
  return [b, grados(Math.atan2(-(muneca[0] - ex), muneca[1] - ey)) - b];
}

// Reproduce una lista de poses. Cada pose: ángulos + { ms, curva, suelo, desplaza, al }
function animarFigura({ intro, partes, poses, anclaX, alCuadro }) {
  const raices = [];
  poses.forEach((p, i) => {
    raices[i] = p.suelo !== false ? raizApoyada(p, anclaX)
      : [raices[i - 1][0] + (p.desplaza?.[0] || 0), raices[i - 1][1] + (p.desplaza?.[1] || 0)];
  });
  const claves = [...new Set(poses.flatMap(p => Object.keys(p)))].filter(k => poses.some(p => typeof p[k] === 'number'));
  const valor = (p, k) => (typeof p[k] === 'number' ? p[k] : (k.endsWith('_s') ? 1 : 0));

  const pintarPose = (p, raiz) => {
    const r = cinematica(p, raiz);
    for (const n of DIBUJO) {
      const { x, y, a, s } = r[n];
      partes[n].setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.toFixed(2)})${s !== 1 ? ` scale(1 ${s.toFixed(3)})` : ''}`);
    }
    alCuadro?.(r, p, raiz);
    return r;
  };

  return new Promise(fin => {
    let i = 0, t0 = performance.now();
    pintarPose(poses[0], raices[0]);
    const cuadro = ahora => {
      const A = poses[i], B = poses[i + 1];
      if (!intro.isConnected || !B) return fin();
      const t = Math.min(1, (ahora - t0) / (B.ms || 1));
      const k = (CURVAS[B.curva] || suave)(t);
      const p = {};
      for (const c of claves) p[c] = mezclar(valor(A, c), valor(B, c), k);
      const raiz = A.suelo !== false && B.suelo !== false
        ? raizApoyada(p, anclaX)
        : [mezclar(raices[i][0], raices[i + 1][0], k), mezclar(raices[i][1], raices[i + 1][1], k)];
      pintarPose(p, raiz);
      if (t >= 1) { i++; t0 = ahora; poses[i + 1]?.al?.(); }
      requestAnimationFrame(cuadro);
    };
    poses[1]?.al?.();
    requestAnimationFrame(cuadro);
  });
}

// Refleja un trazado en horizontal (solo admite órdenes con pares x,y: M L C Q Z)
const espejar = d => {
  let i = 0;
  return d.replace(/[A-Za-z]|-?\d*\.?\d+/g, t => (/[A-Za-z]/.test(t) ? ((i = 0), t) : (i++ % 2 === 0 ? String(-t) : t)));
};

/* ============================== EL PERSONAJE ============================== */
// Diseño propio (no es nadie real): unos 30 años, delgado y atlético, pelo castaño ondulado hacia
// atrás, barba de pocos días. Camiseta blanca, vaqueros azules y zapatillas blancas. Luz desde arriba a la izquierda.
const C = {
  piel: '#E2B796', pielSombra: '#C99673', pielLuz: '#EFCBAE', pelo: '#3B2A20', peloLuz: '#5A4232',
  camiseta: '#F7F5F0', camisetaSombra: '#E3DED3', vaquero: '#4F6F9A', vaqueroOscuro: '#3A5578', vaqueroLuz: '#6B8AB3',
  zapa: '#F5F3EE', suela: '#DAD6CD',
};
const linea = (d, color, ancho, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" ${extra}/>`;

const DEGRADADOS = `
  <linearGradient id="gy-piel" x1="0" x2="1"><stop offset="0" stop-color="${C.pielSombra}"/><stop offset=".22" stop-color="${C.pielLuz}"/><stop offset=".55" stop-color="${C.piel}"/><stop offset="1" stop-color="${C.pielSombra}"/></linearGradient>
  <radialGradient id="gy-cara" cx=".36" cy=".38" r=".8"><stop offset="0" stop-color="${C.pielLuz}"/><stop offset=".5" stop-color="${C.piel}"/><stop offset="1" stop-color="${C.pielSombra}"/></radialGradient>
  <linearGradient id="gy-cuello" x1="0" x2="1"><stop offset="0" stop-color="${C.piel}"/><stop offset=".6" stop-color="${C.piel}"/><stop offset="1" stop-color="${C.pielSombra}"/></linearGradient>
  <linearGradient id="gy-pelo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.peloLuz}"/><stop offset=".55" stop-color="${C.pelo}"/><stop offset="1" stop-color="#2A1D15"/></linearGradient>
  <linearGradient id="gy-camiseta" x1="0" y1="0" x2="1" y2=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="${C.camiseta}"/><stop offset="1" stop-color="${C.camisetaSombra}"/></linearGradient>
  <linearGradient id="gy-manga" x1="0" x2="1"><stop offset="0" stop-color="${C.camisetaSombra}"/><stop offset=".3" stop-color="#FFFFFF"/><stop offset=".65" stop-color="${C.camiseta}"/><stop offset="1" stop-color="${C.camisetaSombra}"/></linearGradient>
  <linearGradient id="gy-vaquero" x1="0" x2="1"><stop offset="0" stop-color="${C.vaqueroOscuro}"/><stop offset=".28" stop-color="${C.vaqueroLuz}"/><stop offset=".6" stop-color="${C.vaquero}"/><stop offset="1" stop-color="${C.vaqueroOscuro}"/></linearGradient>
  <linearGradient id="gy-cadera" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.vaqueroLuz}"/><stop offset=".5" stop-color="${C.vaquero}"/><stop offset="1" stop-color="${C.vaqueroOscuro}"/></linearGradient>
  <linearGradient id="gy-zapa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="${C.zapa}"/><stop offset="1" stop-color="${C.suela}"/></linearGradient>
  <linearGradient id="gy-goma" x1="0" x2="1"><stop offset="0" stop-color="#1B1C1F"/><stop offset=".2" stop-color="#4A4C52"/><stop offset=".42" stop-color="#2B2C30"/><stop offset=".85" stop-color="#141517"/><stop offset="1" stop-color="#2E2F34"/></linearGradient>
  <radialGradient id="gy-goma-cara" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#46484D"/><stop offset="1" stop-color="#222327"/></radialGradient>
  <linearGradient id="gy-cromo" x1="0" x2="1"><stop offset="0" stop-color="#6E7177"/><stop offset=".3" stop-color="#F4F5F7"/><stop offset=".55" stop-color="#A9ACB2"/><stop offset="1" stop-color="#55585E"/></linearGradient>
  <filter id="gy-difuso" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".6"/></filter>
  <pattern id="gy-moleteado" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V1.4M0 0H1.4" stroke="#55585E" stroke-width=".35"/></pattern>`;

// Camiseta, cuello y torso (el origen es el centro de la cadera; el tronco sube hacia y negativa)
const TRONCO = `
  <path d="M-7.4 -72 C-7 -76 -6.8 -80 -6.9 -84 L6.9 -84 C6.8 -80 7 -76 7.4 -72 Z" fill="url(#gy-cuello)"/>
  <path d="M-6.9 -84 L6.9 -84 L6.8 -78.5 Q0 -75.5 -6.8 -78.5 Z" fill="${C.pielSombra}" opacity=".55"/>
  ${linea('M-4.5 -80 Q-3 -76 -1.2 -73.6', C.pielSombra, .5, 'opacity=".6"')}
  <path d="M-7.6 -75.6 C-11.5 -74.8 -16 -73.6 -19.5 -72 C-22.5 -70.5 -23.5 -67 -23 -62 L-21.6 -52 C-20.2 -40 -17.6 -30 -17.6 -20
    C-17.6 -12 -18.6 -7 -19.2 -2.4 Q0 1.2 19.2 -2.4 C18.6 -7 17.6 -12 17.6 -20 C17.6 -30 20.2 -40 21.6 -52 L23 -62
    C23.5 -67 22.5 -70.5 19.5 -72 C16 -73.6 11.5 -74.8 7.6 -75.6 C5 -70.4 -5 -70.4 -7.6 -75.6 Z" fill="url(#gy-camiseta)"/>
  <path d="M21.6 -52 C20.2 -40 17.6 -30 17.6 -20 C17.6 -12 18.6 -7 19.2 -2.4 Q15 -1.6 11 -1.4 C14 -10 13.5 -30 16 -46 Z" fill="${C.camisetaSombra}" opacity=".75"/>
  ${linea('M-7.6 -75.6 C-5 -70.4 5 -70.4 7.6 -75.6', C.camisetaSombra, 2.2)}
  ${linea('M-6.4 -74.6 C-4 -71.8 4 -71.8 6.4 -74.6', '#D6D0C3', .5)}
  ${linea('M-15 -51 Q-8 -45.6 -1.5 -47', C.camisetaSombra, .9, 'opacity=".7"')}
  ${linea('M15 -51 Q8 -45.6 1.5 -47', C.camisetaSombra, .9, 'opacity=".9"')}
  ${linea('M-20.5 -52 Q-15.5 -48.5 -11 -47.5', C.camisetaSombra, 1)}
  ${linea('M20.5 -52 Q15.5 -48.5 11 -47.5', C.camisetaSombra, 1)}
  ${linea('M-16 -27 Q-10.5 -22.5 -6 -16', C.camisetaSombra, 1.1)}
  ${linea('M16.5 -31 Q10.5 -25.5 5 -21.5', C.camisetaSombra, 1.1)}
  ${linea('M-14.5 -8 Q-8.5 -5.4 -3 -6.2', C.camisetaSombra, 1)}
  ${linea('M5.5 -5.4 Q11 -6.4 15.4 -8.8', C.camisetaSombra, 1)}
  ${linea('M-19.2 -2.4 Q0 1.2 19.2 -2.4', '#D9D3C6', .8)}`;

// Cadera del vaquero: bragueta, bolsillos y cinturilla (asoma bajo la camiseta)
const CADERA = `
  <path d="M-19 -10 L19 -10 C20.6 -3 21.2 4 20.6 10.5 Q10 12.6 2 15.2 L0 16.2 L-2 15.2 Q-10 12.6 -20.6 10.5 C-21.2 4 -20.6 -3 -19 -10 Z" fill="url(#gy-cadera)"/>
  ${linea('M1.4 -2 L1.4 9.5 Q1.4 13 -1 14.5', C.vaqueroOscuro, .9)}
  ${linea('M4 -2 L4 8.5 Q4 12.4 0.4 14.4', C.vaqueroLuz, .5, 'stroke-dasharray="1 .8"')}
  ${linea('M-18.6 -1 Q-13.5 0 -12 5.5', C.vaqueroOscuro, .9)}
  ${linea('M18.6 -1 Q13.5 0 12 5.5', C.vaqueroOscuro, .9)}
  ${linea('M-17.8 0.6 Q-14 1.4 -13 5', C.vaqueroLuz, .5, 'stroke-dasharray="1 .8" opacity=".8"')}`;

// Muslo y pierna del lado izquierdo (el derecho es su reflejo)
const MUSLO = `
  <path d="M-11.6 -8 C-12.6 8 -11.6 30 -9.2 51 Q-8.6 58.5 -3.5 60.2 L3.6 60.2 Q8.6 58.5 8.6 51 C9.6 32 10.6 10 10.6 -8 Z" fill="url(#gy-vaquero)"/>
  ${linea('M-11.7 -2 C-12.2 15 -11.2 33 -9.2 51', C.vaqueroLuz, .6, 'opacity=".8"')}
  ${linea('M-6 45.5 Q-1 48.2 4.2 45.6', C.vaqueroOscuro, .7, 'opacity=".55"')}
  ${linea('M-5 50.5 Q0 52.2 5 49.6', C.vaqueroOscuro, .7, 'opacity=".45"')}
  ${linea('M-8 20 Q-5 28 -6.5 38', C.vaqueroLuz, 2.6, 'opacity=".22"')}`;
const PIERNA = `
  <path d="M-8.6 -1 C-9.1 10 -8.6 30 -8.7 45 C-9.1 49.5 -9.7 53 -9.8 55.6 Q0 58.3 9.8 55.6 C9.7 53 9.1 49.5 8.7 45 C8.6 30 9.1 10 8.6 -1 C8.6 -5.6 4.6 -8 0 -8 C-4.6 -8 -8.6 -5.6 -8.6 -1 Z" fill="url(#gy-vaquero)"/>
  <ellipse cx="-1.5" cy="-2" rx="5" ry="3.2" fill="${C.vaqueroLuz}" opacity=".35"/>
  ${linea('M-8.8 0 C-9 15 -8.6 30 -8.7 45', C.vaqueroLuz, .6, 'opacity=".75"')}
  ${linea('M-8 43.5 Q-2 46.4 4.5 43.8', C.vaqueroOscuro, .7, 'opacity=".55"')}
  ${linea('M-6.5 49 Q0 51.4 7.5 48.4', C.vaqueroOscuro, .7, 'opacity=".5"')}
  ${linea('M-9.6 55.4 Q0 58 9.6 55.4', C.vaqueroOscuro, .8)}`;
// Zapatilla blanca vista de frente (la puntera mira al espectador)
const PIE = `
  <path d="M-7.6 -1 C-9.6 2 -10.8 5 -10.8 7.6 L10.4 7.6 C10.4 5 9.4 2 7.4 -1 Z" fill="url(#gy-zapa)"/>
  <ellipse cx="-.6" cy="5.6" rx="8" ry="3" fill="#FCFBF8"/>
  ${linea('M-2.6 1.2 L2.4 1.2 M-3.2 3 L3 3', C.suela, .8)}
  <path d="M-11.3 7 L11 7 Q11.6 10.2 10 10.2 L-10.2 10.2 Q-11.9 10.2 -11.3 7 Z" fill="${C.suela}"/>
  ${linea('M-11 7.2 L10.8 7.2', '#ECE8E0', .7)}`;

// Brazo: manga de la camiseta, bíceps y la sombra que deja la manga
const BRAZO = `
  <path d="M-6.2 0 C-7.2 12 -6.6 26 -5.3 42 Q0 47.5 5.3 42 C6.2 28 7.2 14 6.2 0 Z" fill="url(#gy-piel)"/>
  <path d="M-6.4 18 Q0 21 6.4 18 L6.3 22 Q0 24.6 -6.3 22 Z" fill="${C.pielSombra}" opacity=".55"/>
  <path d="M-8.4 17.2 C-8.8 12 -9 6 -8.2 0 C-8.2 -4.6 -4.4 -7.2 0 -7.2 C4.4 -7.2 7.6 -4.6 7.8 -.5 L8.4 17.4 Q0 20.4 -8.4 17.2 Z" fill="url(#gy-manga)"/>
  ${linea('M7.8 3 C7.6 -3 4.5 -7 -1 -7.1', C.camisetaSombra, .7)}
  ${linea('M-8.6 16.2 Q0 19.4 8.6 16', C.camisetaSombra, 1.3)}
  ${linea('M-6 5 Q-2 8.6 3.5 7.4', C.camisetaSombra, .9)}`;
const ANTEBRAZO = `
  <circle cx="0" cy="0" r="5.3" fill="url(#gy-piel)"/>
  <path d="M-5.5 -2 C-6.3 7 -5.5 20 -4.1 36 Q0 39.6 4.1 36 C4.9 20 5.7 8 5.5 -2 Z" fill="url(#gy-piel)"/>
  ${linea('M-3.4 5 Q-2 14 -1.6 26', C.pielSombra, .6, 'opacity=".45"')}`;
// Tres manos que se funden entre sí: relajada, abierta (palma al frente) y cerrada en puño
const dedo = (x1, y1, x2, y2, g = 2.5) => `${linea(`M${x1} ${y1} L${x2} ${y2}`, C.pielSombra, g + 0.7)}${linea(`M${x1} ${y1} L${x2} ${y2}`, C.piel, g)}`;
const MANO_RELAJADA = `
  <path d="M-4.1 -1 C-4.7 4 -4.9 9 -4.1 13 C-3.5 16.6 -1 18.2 1 17.6 C3.5 16.9 4.6 13 4.4 8 C4.2 4 4.1 1 4.1 -1 Z" fill="url(#gy-piel)"/>
  ${linea('M-1.5 10 L-1.6 16.6 M1.3 9.6 L1.6 16.6', C.pielSombra, .5)}
  <path d="M3.8 2.8 C6.1 4.8 6.6 8 5.7 11 C5.1 12.2 4 11.6 4 10 Z" fill="${C.piel}"/>`;
const MANO_ABIERTA = `
  <path d="M-4.6 -1 C-5.4 4 -5.4 8 -4.9 10.8 L4.9 10.8 C5.4 8 5.4 4 4.6 -1 Z" fill="url(#gy-piel)"/>
  ${dedo(-3.7, 10, -4.8, 18.4)}${dedo(-1.2, 10.4, -1.4, 20.2)}${dedo(1.3, 10.4, 1.7, 19.6)}${dedo(3.6, 10, 4.9, 17)}
  ${dedo(4.4, 2.6, 8.8, 8.4, 2.7)}
  ${linea('M-3.6 7.6 Q0 5.6 3.4 3.4', C.pielSombra, .45, 'opacity=".8"')}`;
const MANO_PUNO = `
  <path d="M-5.6 -1 C-6.1 3 -6.1 7 -5.3 10 Q-5 13.6 -2 13.8 L3 13.8 Q6.2 13.4 6.1 9.6 C6.3 6 6.1 2 5.6 -1 Z" fill="url(#gy-piel)"/>
  ${linea('M-2.8 4.4 L-2.8 13.4 M0 4.2 L0 13.6 M2.8 4.4 L2.8 13.4', C.pielSombra, .55)}
  ${linea('M-5.4 12.6 Q-4.2 14.2 -2.8 13.4 Q-1.4 14.4 0 13.6 Q1.4 14.4 2.8 13.4 Q4.4 14.2 5.8 12', '#B98665', .6)}
  <path d="M5.8 1.6 C3 4.6 -0.5 5.4 -4.2 4.4 C-1.4 6.6 3.6 6.4 6 4.4 Z" fill="${C.pielLuz}"/>
  ${linea('M5.8 1.6 C3 4.6 -0.5 5.4 -4.2 4.4', C.pielSombra, .55)}`;
const mano = esp => {
  const e = d => (esp ? d.replace(/d="([^"]+)"/g, (_, t) => `d="${espejar(t)}"`) : d);
  return `<g class="gy-relajada">${e(MANO_RELAJADA)}</g><g class="gy-abierta" opacity="0">${e(MANO_ABIERTA)}</g><g class="gy-puno" opacity="0">${e(MANO_PUNO)}</g>`;
};

// Cabeza: cara ovalada, orejas, rasgos sutiles, barba de pocos días y pelo ondulado peinado hacia atrás
const CABEZA = `
  <ellipse cx="-11.6" cy="-13.6" rx="2.3" ry="4.2" fill="${C.piel}"/><ellipse cx="11.6" cy="-13.6" rx="2.3" ry="4.2" fill="${C.pielSombra}"/>
  ${linea('M-11.9 -16 Q-10.8 -13.6 -11.6 -11', C.pielSombra, .5)}${linea('M11.9 -16 Q10.8 -13.6 11.6 -11', '#B5835F', .5)}
  <path d="M0 -32 C-7.4 -32 -11.6 -27 -11.6 -18.5 C-11.6 -12 -10.6 -7 -8 -3.4 C-6 -0.5 -3.4 1 0 1 C3.4 1 6 -0.5 8 -3.4 C10.6 -7 11.6 -12 11.6 -18.5 C11.6 -27 7.4 -32 0 -32 Z" fill="url(#gy-cara)"/>
  <path d="M-10.6 -11 C-9.6 -6 -7 -1.5 -3.5 .3 C-1 1.2 1 1.2 3.5 .3 C7 -1.5 9.6 -6 10.6 -11 C8 -7.6 6 -7.4 4 -7.4 C2 -6.6 -2 -6.6 -4 -7.4 C-6 -7.4 -8 -7.6 -10.6 -11 Z" fill="${C.pelo}" opacity=".12" filter="url(#gy-difuso)"/>
  <path d="M-3.8 -6.4 Q0 -7.9 3.8 -6.4 Q0 -5.6 -3.8 -6.4 Z" fill="${C.pelo}" opacity=".16" filter="url(#gy-difuso)"/>
  <path d="M-6.8 -14.4 Q-4.6 -16.2 -2.4 -14.4 Q-4.6 -13.3 -6.8 -14.4 Z" fill="#F3EDE6"/>
  <path d="M6.8 -14.4 Q4.6 -16.2 2.4 -14.4 Q4.6 -13.3 6.8 -14.4 Z" fill="#F3EDE6"/>
  <circle cx="-4.4" cy="-14.5" r="1.15" fill="#4A3426"/><circle cx="4.6" cy="-14.5" r="1.15" fill="#4A3426"/>
  <circle cx="-4.4" cy="-14.5" r=".55" fill="#1E1410"/><circle cx="4.6" cy="-14.5" r=".55" fill="#1E1410"/>
  <circle cx="-4.8" cy="-14.9" r=".3" fill="#fff"/><circle cx="4.2" cy="-14.9" r=".3" fill="#fff"/>
  ${linea('M-7 -14.3 Q-4.6 -16.6 -2.2 -14.6', C.pelo, .75)}${linea('M7 -14.3 Q4.6 -16.6 2.2 -14.6', C.pelo, .75)}
  ${linea('M-6.4 -15.8 Q-4.6 -17.1 -2.7 -16', C.pielSombra, .4)}${linea('M6.4 -15.8 Q4.6 -17.1 2.7 -16', C.pielSombra, .4)}
  ${linea('M-7.8 -18 Q-5 -19.8 -2 -18.8', C.pelo, 1.3)}${linea('M7.8 -18 Q5 -19.8 2 -18.8', C.pelo, 1.3)}
  ${linea('M.9 -14 C1.7 -11.6 2.7 -9.8 2.6 -8.6 C2.2 -7.8 1 -7.6 0 -7.8', C.pielSombra, .7)}
  <ellipse cx="-.4" cy="-9.2" rx=".9" ry=".6" fill="${C.pielLuz}" opacity=".8"/>
  <ellipse cx="-1.4" cy="-8.2" rx=".7" ry=".32" fill="#9E6B52"/><ellipse cx="1.4" cy="-8.2" rx=".7" ry=".32" fill="#9E6B52"/>
  ${linea('M-3.4 -4.6 Q-1.5 -3.9 0 -4.1 Q1.5 -3.9 3.4 -4.6', '#A0644E', .75)}
  ${linea('M-2.2 -3.2 Q0 -2.4 2.2 -3.2', C.pielSombra, .6, 'opacity=".7"')}
  <path d="M-12.2 -16 C-13.2 -24 -11.2 -33 -5 -36.4 C0 -39 7.2 -38.4 10.8 -34.6 C13.4 -31.6 13.2 -24 12.2 -16 L11.2 -19.6
    C10.6 -23.4 9.2 -25.8 7 -26.6 C3 -27.4 -2 -26 -5 -27.4 C-7.6 -26.4 -9.6 -24 -10.6 -19.6 Z" fill="url(#gy-pelo)"/>
  ${linea('M-8.4 -30.6 Q-3 -35.4 4 -34.6', C.peloLuz, 1.3)}${linea('M-9.6 -26.6 Q-4.4 -31.6 2.6 -31', C.peloLuz, 1)}
  ${linea('M1.6 -27.4 Q6 -30.6 10.4 -28.4', '#2A1D15', .8)}${linea('M-5 -27.4 Q-1 -30 4 -29.2', '#2A1D15', .6, 'opacity=".7"')}`;

const PERSONA = {
  cadera: CADERA, tronco: TRONCO, cabeza: CABEZA,
  brazoI: BRAZO, antebrazoI: ANTEBRAZO, manoI: mano(true),
  brazoD: BRAZO.replace(/d="([^"]+)"/g, (_, t) => `d="${espejar(t)}"`), antebrazoD: ANTEBRAZO, manoD: mano(false),
  musloI: MUSLO, piernaI: PIERNA, pieI: PIE,
  musloD: MUSLO.replace(/d="([^"]+)"/g, (_, t) => `d="${espejar(t)}"`),
  piernaD: PIERNA.replace(/d="([^"]+)"/g, (_, t) => `d="${espejar(t)}"`),
  pieD: PIE.replace(/d="([^"]+)"/g, (_, t) => `d="${espejar(t)}"`).replace('cx="-.6"', 'cx=".6"'),
};

// Mancuerna de goma negra redonda con mango cromado moleteado, dibujada en vertical con el centro en el agarre
const MANCUERNA = `
  <g id="gy-mc">
    <path d="M-13 10 L-13 22.5 C-13 27.8 13 27.8 13 22.5 L13 10 Z" fill="url(#gy-goma)"/>
    <ellipse cx="0" cy="10" rx="13" ry="4" fill="#2E2F33"/>
    ${linea('M-12.6 10.8 Q-6 13.6 0 13.9', '#5C5E64', .5, 'opacity=".8"')}
    <rect x="-4.8" y="5.6" width="9.6" height="4.4" rx="1" fill="url(#gy-cromo)"/><ellipse cx="0" cy="10" rx="4.8" ry="1.5" fill="#8C8F95"/>
    <rect x="-2.7" y="-7" width="5.4" height="15" fill="url(#gy-cromo)"/><rect x="-2.7" y="-5" width="5.4" height="11" fill="url(#gy-moleteado)" opacity=".7"/>
    <rect x="-4.8" y="-7.4" width="9.6" height="3" rx="1" fill="url(#gy-cromo)"/>
    <path d="M-13 -23 L-13 -10.5 C-13 -5.2 13 -5.2 13 -10.5 L13 -23 Z" fill="url(#gy-goma)"/>
    <ellipse cx="0" cy="-23" rx="13" ry="4" fill="url(#gy-goma-cara)"/>
    <ellipse cx="0" cy="-23" rx="10.4" ry="3.1" fill="none" stroke="#1A1B1E" stroke-width=".7"/>
    <ellipse cx="0" cy="-22.8" rx="10.4" ry="3.1" fill="none" stroke="#55575C" stroke-width=".35"/>
    <text transform="translate(0 -23) scale(1 .3)" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#5A5C61">20</text>
    ${linea('M-12.4 -24.4 Q-8 -26.8 0 -27', '#7A7C82', .6)}
    ${linea('M-11 -21 L-11 -11.5', '#5A5C62', .8, 'opacity=".6"')}${linea('M-11 13 L-11 23', '#5A5C62', .8, 'opacity=".6"')}
  </g>`;

const PESA = '<g class="gy-pesa" opacity="0"><use href="#gy-mc"/></g>';

const CSS = `
.gy-intro { background: #F4F0E8; }
.gy-intro svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.gy-intro .gy-onda, .gy-intro .gy-destello, .gy-intro .gy-polvo ellipse { transform-box: fill-box; transform-origin: center; }`;

/* ============================== LA ESCENA ============================== */
export async function introGimnasio(cont) {
  if (sinMovimiento()) return;
  estilos('intro-gym', CSS);
  const X = 200; // centro de la escena, donde está el hombre
  const { intro, saltada } = montar(cont, 'gy-intro', `
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" overflow="visible" aria-hidden="true">
      <defs>${DEGRADADOS}
        <linearGradient id="gy-pared" x1="0" y1="-120" x2="0" y2="214" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#CFDFEE"/><stop offset=".7" stop-color="#DCE8F3"/><stop offset="1" stop-color="#E9EEF1"/></linearGradient>
        <linearGradient id="gy-suelo" x1="0" y1="206" x2="0" y2="330" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ECE7DC"/><stop offset=".35" stop-color="#F4F0E8"/><stop offset="1" stop-color="#F8F5EF"/></linearGradient>
        <linearGradient id="gy-horizonte" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#E9EEF1" stop-opacity="0"/><stop offset=".5" stop-color="#E8E4DA"/><stop offset="1" stop-color="#ECE7DC" stop-opacity="0"/></linearGradient>
        <radialGradient id="gy-luz" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(70 -10) scale(300 220)"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <radialGradient id="gy-sombra"><stop offset="0" stop-color="#5B5246" stop-opacity=".38"/><stop offset=".6" stop-color="#5B5246" stop-opacity=".14"/><stop offset="1" stop-color="#5B5246" stop-opacity="0"/></radialGradient>
        <linearGradient id="gy-estela" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2B2D33" stop-opacity="0"/><stop offset="1" stop-color="#2B2D33" stop-opacity=".22"/></linearGradient>
        ${MANCUERNA}
      </defs>
      <rect x="-2000" y="-600" width="4400" height="816" fill="url(#gy-pared)"/>
      <rect x="-2000" y="206" width="4400" height="900" fill="url(#gy-suelo)"/>
      <rect x="-2000" y="200" width="4400" height="16" fill="url(#gy-horizonte)"/>
      <rect x="-2000" y="-600" width="4400" height="1200" fill="url(#gy-luz)"/>
      <g class="gy-escena">
        <ellipse class="gy-sombra-larga" cx="${X + 26}" cy="${SUELO}" rx="56" ry="5" fill="url(#gy-sombra)" opacity=".55"/>
        <ellipse class="gy-sombra" cx="${X}" cy="${SUELO}" rx="34" ry="6" fill="url(#gy-sombra)"/>
        <g class="gy-polvo"><ellipse cx="${X - 24}" cy="${SUELO - 2}" rx="10" ry="3.4" fill="#E6DFD2" opacity="0"/><ellipse cx="${X + 24}" cy="${SUELO - 2}" rx="10" ry="3.4" fill="#E6DFD2" opacity="0"/></g>
        <path class="gy-rastro" d="" fill="none" stroke="url(#gy-estela)" stroke-width="22" stroke-linecap="round"/>
        <g class="gy-fantasmas"><use href="#gy-mc" opacity="0"/><use href="#gy-mc" opacity="0"/><use href="#gy-mc" opacity="0"/></g>
        <g class="gy-velocidad" stroke="#B4C4D6" stroke-width="1.6" stroke-linecap="round" opacity="0">
          <line x1="-14" y1="0" x2="-14" y2="46"/><line x1="0" y1="10" x2="0" y2="70"/><line x1="14" y1="0" x2="14" y2="50"/>
        </g>
        <g class="gy-figura">${DIBUJO.map(n => `<g data-pieza="${n}">${PERSONA[n]}</g>${n === 'cabeza' ? PESA : ''}`).join('')}</g>
        <circle class="gy-onda" r="10" fill="none" stroke="#FFFFFF" stroke-width="2.4" opacity="0"/>
        <g class="gy-destello" opacity="0" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round">
          <circle r="5" fill="#FFFFFF" stroke="none" opacity=".9"/>
          <path d="M0 -9 L0 -16 M9 0 L16 0 M0 9 L0 16 M6.4 -6.4 L11 -11 M6.4 6.4 L11 11"/>
        </g>
      </g>
    </svg>`);
  intro.setAttribute('aria-label', 'Un hombre atrapa al vuelo una mancuerna, hace una sentadilla y sale de un salto');

  const $ = s => intro.querySelector(s);
  const partes = Object.fromEntries([...intro.querySelectorAll('[data-pieza]')].map(g => [g.dataset.pieza, g]));
  const figura = $('.gy-figura'), pesa = $('.gy-pesa'), escena = $('.gy-escena');
  const sombra = $('.gy-sombra'), sombraLarga = $('.gy-sombra-larga'), polvo = $('.gy-polvo'), velocidad = $('.gy-velocidad');
  const rastro = $('.gy-rastro'), estela = $('#gy-estela'), fantasmas = [...intro.querySelectorAll('.gy-fantasmas use')];
  const onda = $('.gy-onda'), destello = $('.gy-destello');
  const manos = lado => ['relajada', 'abierta', 'puno'].map(c => partes[`mano${lado}`].querySelector(`.gy-${c}`));

  // Los muslos se dibujan delante de la cadera solo en la sentadilla (vienen hacia nosotros)
  const muslosDelante = si => {
    const ref = si ? partes.tronco : partes.cadera;
    figura.insertBefore(partes.musloI, ref);
    figura.insertBefore(partes.musloD, ref);
  };

  // Posiciones clave (el lado derecho es el reflejo del izquierdo)
  const DE_PIE = {
    brazoI: 7, antebrazoI: -5, manoI: 3, brazoD: -7, antebrazoD: 5, manoD: -3,
    musloI: 2, piernaI: -1.5, musloD: -2, piernaD: 1.5,
  };
  const BRAZO_FUERA = { ...DE_PIE, brazoD: -94, antebrazoD: -2, manoD: -4, tronco: -1.5, cabeza: 4, abreD: 1 };
  // Copa: las dos manos bajo el disco de arriba, la mancuerna en vertical frente al pecho
  const [bI, aI] = alcanzar([-21.5, -65], [-13.7, -44.1], 44, 38 * 0.6, -1);
  const COPA = {
    ...DE_PIE, brazoI: bI, antebrazoI: aI, antebrazoI_s: 0.6, manoI: -105 - bI - aI,
    // (-360: el antebrazo derecho sube por dentro, como en un curl, en vez de dar la vuelta por fuera)
    brazoD: -bI, antebrazoD: -aI - 360, antebrazoD_s: 0.6, manoD: 105 + bI + aI, punoI: 1, punoD: 1, copa: 1,
  };
  const SENTADILLA = {
    ...COPA, tronco_s: 0.9, cadera_s: 0.75, cabeza: 0,
    musloI: 38, musloI_s: 0.32, piernaI: -49, piernaI_s: 0.95,
    musloD: -38, musloD_s: 0.32, piernaD: 49, piernaD_s: 0.95,
  };
  const VUELO = { ...COPA, musloI: 9, musloD: -9, piernaI: -16, piernaD: 16, musloI_s: 0.9, musloD_s: 0.9 };

  // La mancuerna: escondida, volando hacia la mano, en la mano
  const vuelo = { modo: 'oculta', t0: 0, ms: 520, desde: { x: 760, y: -70 } };
  const curvaVuelo = (t, a, b) => { // curva que entra desde arriba a la derecha
    const cx = b.x + 150, cy = b.y - 70, u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
  };
  const giroVuelo = (k, final) => final + Math.pow(1 - k, 1.4) * 820;
  const avanceVuelo = t => 0.35 * t + 0.65 * t * t;
  const colocar = (el, x, y, a) => el.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.toFixed(2)})`);

  function impacto(x, y) {
    onda.setAttribute('cx', x); onda.setAttribute('cy', y);
    onda.animate([{ opacity: 0.95, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(3.2)' }], { duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)' });
    destello.setAttribute('transform', `translate(${x} ${y})`);
    destello.firstElementChild.animate([{ opacity: 1, transform: 'scale(1.3)' }, { opacity: 0, transform: 'scale(.4)' }], { duration: 260, easing: 'ease-out' });
    destello.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
    escena.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(2.5px,-1.5px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 180 });
  }

  function alCuadro(r, p, raiz) {
    // Manos: relajada / abierta / puño
    for (const lado of ['I', 'D']) {
      const [rel, abi, pun] = manos(lado);
      const abre = limitar(((p[`abre${lado}`] || 0) - 0.5) * 2), puno = limitar(p[`puno${lado}`] || 0);
      abi.setAttribute('opacity', (abre * (1 - puno)).toFixed(2));
      pun.setAttribute('opacity', puno.toFixed(2));
      rel.setAttribute('opacity', ((1 - abre) * (1 - puno)).toFixed(2));
    }
    // Sombra en el suelo: se encoge y se aclara al despegar
    const alto = Math.max(0, SUELO - 10 - Math.max(r.pieI.y, r.pieD.y));
    const f = limitar(1 - alto / 160);
    sombra.setAttribute('rx', (34 * (0.35 + 0.65 * f)).toFixed(1));
    sombra.setAttribute('opacity', f.toFixed(2));
    sombraLarga.setAttribute('opacity', (0.55 * f).toFixed(2));
    velocidad.setAttribute('transform', `translate(${raiz[0]} ${raiz[1] + 135})`);

    // Mancuerna
    const agarre = enPieza(r.manoD, 0, 7.5);
    if (vuelo.modo === 'vuela') {
      const t = Math.min(1, (performance.now() - vuelo.t0) / vuelo.ms);
      const k = avanceVuelo(t), final = r.manoD.a + 90;
      const pos = curvaVuelo(k, vuelo.desde, agarre);
      pesa.setAttribute('opacity', 1);
      colocar(pesa, pos.x, pos.y, giroVuelo(k, final));
      fantasmas.forEach((u, j) => {
        const kj = Math.max(0, k - 0.05 * (j + 1)), q = curvaVuelo(kj, vuelo.desde, agarre);
        colocar(u, q.x, q.y, giroVuelo(kj, final));
        u.setAttribute('opacity', t < 1 ? [0.24, 0.13, 0.06][j] : 0);
      });
      const cola = curvaVuelo(Math.max(0, k - 0.3), vuelo.desde, agarre), medio = curvaVuelo(Math.max(0, k - 0.15), vuelo.desde, agarre);
      rastro.setAttribute('d', t < 1 ? `M${cola.x} ${cola.y} Q${medio.x} ${medio.y} ${pos.x} ${pos.y}` : '');
      estela.setAttribute('x1', cola.x); estela.setAttribute('y1', cola.y); estela.setAttribute('x2', pos.x); estela.setAttribute('y2', pos.y);
      if (t >= 1) { vuelo.modo = 'mano'; impacto(agarre.x, agarre.y); }
    } else if (vuelo.modo === 'mano') {
      // De la mano derecha al pecho: se mezcla con el punto entre las dos manos
      const otra = enPieza(r.manoI, 0, 7.5), k = p.copa || 0;
      const cx = (agarre.x + otra.x) / 2 - Math.sin(rad(r.tronco.a)) * 3, cy = (agarre.y + otra.y) / 2 + Math.cos(rad(r.tronco.a)) * 3;
      const enMano = r.manoD.a + 90, giro = ((r.tronco.a - enMano) % 360 + 540) % 360 - 180; // por el camino corto
      colocar(pesa, mezclar(agarre.x, cx, k), mezclar(agarre.y, cy, k), enMano + giro * k);
    }
  }

  await reproducir([
    () => animarFigura({
      intro, partes, anclaX: X, alCuadro,
      poses: [
        { ...DE_PIE },
        { ...DE_PIE, tronco_s: 1.01, ms: 380 },                                           // de pie, mirándonos
        { ...BRAZO_FUERA, ms: 440 },                                                     // extiende el brazo y abre la mano
        { ...BRAZO_FUERA, ms: 520, al: () => { vuelo.modo = 'vuela'; vuelo.t0 = performance.now(); } }, // ¡llega volando!
        { ...BRAZO_FUERA, brazoD: -82, antebrazoD: 10, manoD: 9, tronco: -3.5, cabeza: 2, abreD: 0, punoD: 1, ms: 110, curva: 'sale' }, // el golpe
        { ...BRAZO_FUERA, brazoD: -91, antebrazoD: 2, manoD: 0, tronco: -1, abreD: 0, punoD: 1, ms: 260 },
        { ...COPA, ms: 560 },                                                            // al pecho, en vertical
        { ...COPA, ms: 110, al: () => muslosDelante(true) },
        { ...SENTADILLA, ms: 620 },                                                      // sentadilla
        { ...SENTADILLA, ms: 110 },
        { ...COPA, ms: 230, curva: 'sale', al: () => muslosDelante(false) },            // sube con fuerza…
        { ...VUELO, suelo: false, desplaza: [0, -470], ms: 540, curva: 'despega',        // …y despega
          al: () => {
            for (const nube of polvo.children) nube.animate([{ opacity: 0.9, transform: 'scale(.5)' }, { opacity: 0, transform: 'scale(2.2)' }], { duration: 520, easing: 'ease-out' });
            velocidad.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], { duration: 540 });
          } },
      ],
    }),
  ], saltada);

  await cerrar(cont, intro);
}
