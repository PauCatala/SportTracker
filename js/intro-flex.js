// INTRO DE FLEXIBILIDAD
// Un esqueleto, de frente, se toca las puntas de los pies, vuelve arriba, se abre de piernas
// de golpe contra el suelo… y se desmonta: cada hueso cae, rebota y desaparece.
import { sinMovimiento, montar, cerrar, reproducir, estilos } from './intro-base.js';

/* ============================ MATERIAL DEL HUESO ============================ */
const C = {
  base: '#EDE3CC', sombra: '#CDBE9C', hondo: '#B8A57E', luz: '#FAF5E9',
  linea: '#8C7752', atras: '#D7CAAA', lineaAtras: '#A8956F',
};
const SUELO = 272;
const CENTRO = 200;

// Degradados y textura. Los que terminan en "-m" son la versión espejada
// (para que la luz venga siempre de arriba a la izquierda en los dos lados del cuerpo).
const DEFS = `
  <linearGradient id="fx-cil" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#DCCDA9"/><stop offset=".24" stop-color="${C.luz}"/>
    <stop offset=".55" stop-color="${C.base}"/><stop offset=".82" stop-color="${C.sombra}"/><stop offset="1" stop-color="${C.hondo}"/>
  </linearGradient>
  <linearGradient id="fx-cil-m" href="#fx-cil" x1="1" x2="0"/>
  <linearGradient id="fx-placa" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.luz}"/><stop offset=".45" stop-color="${C.base}"/>
    <stop offset=".8" stop-color="${C.sombra}"/><stop offset="1" stop-color="${C.hondo}"/>
  </linearGradient>
  <linearGradient id="fx-placa-m" href="#fx-placa" x1="1" x2="0"/>
  <radialGradient id="fx-bola" cx=".36" cy=".32" r=".75">
    <stop offset="0" stop-color="${C.luz}"/><stop offset=".55" stop-color="${C.base}"/><stop offset="1" stop-color="${C.hondo}"/>
  </radialGradient>
  <radialGradient id="fx-bola-m" href="#fx-bola" cx=".64"/>
  <radialGradient id="fx-craneo" cx=".4" cy=".3" r=".8">
    <stop offset="0" stop-color="${C.luz}"/><stop offset=".45" stop-color="${C.base}"/>
    <stop offset=".8" stop-color="${C.sombra}"/><stop offset="1" stop-color="${C.hondo}"/>
  </radialGradient>
  <radialGradient id="fx-hueco" cx=".5" cy=".45" r=".6">
    <stop offset="0" stop-color="#231D15"/><stop offset=".65" stop-color="#3E3426"/><stop offset="1" stop-color="#6E5D42"/>
  </radialGradient>
  <radialGradient id="fx-sombra-suelo">
    <stop offset="0" stop-color="#8F897C" stop-opacity=".55"/><stop offset="1" stop-color="#8F897C" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="fx-polvo">
    <stop offset="0" stop-color="#CFC8BA" stop-opacity=".85"/><stop offset="1" stop-color="#DDD7CB" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fx-linea-suelo" x1="0" x2="1">
    <stop offset="0" stop-color="#CDC9C0" stop-opacity="0"/><stop offset=".5" stop-color="#CDC9C0"/><stop offset="1" stop-color="#CDC9C0" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="fx-suelo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#E9E4DA"/><stop offset="1" stop-color="#F4F0E8" stop-opacity="0"/>
  </linearGradient>
  <filter id="fx-poro" x="-30%" y="-15%" width="160%" height="130%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves="2" seed="7" result="ruido"/>
    <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 .5  0 0 0 0 .42  0 0 0 0 .28  1.1 0 0 0 -.66" result="motas"/>
    <feComposite in="motas" in2="SourceAlpha" operator="in" result="poros"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation=".6"/>
    <feOffset dx=".45" dy=".7" result="desenfoque"/>
    <feFlood flood-color="#6E5B39" flood-opacity=".3"/>
    <feComposite in2="desenfoque" operator="in" result="sombra"/>
    <feMerge><feMergeNode in="sombra"/><feMergeNode in="SourceGraphic"/><feMergeNode in="poros"/></feMerge>
  </filter>`;

// Ayudas de dibujo
const f = n => +n.toFixed(2);
const grad = (lado, id) => `url(#fx-${id}${lado < 0 ? '-m' : ''})`;
const espejo = (lado, s) => (lado > 0 ? s : `<g transform="scale(-1 1)">${s}</g>`);
const ambos = dibujo => dibujo(1) + espejo(-1, dibujo(-1));
// Hueso fino dibujado como trazo: contorno, cuerpo, sombra inferior y brillo
function trazo(d, w, atras = false) {
  if (atras) {
    return `<path d="${d}" fill="none" stroke="${C.lineaAtras}" stroke-width="${f(w + 0.8)}" stroke-linecap="round"/>`
      + `<path d="${d}" fill="none" stroke="${C.atras}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return `<path d="${d}" fill="none" stroke="${C.linea}" stroke-width="${f(w + 0.9)}" stroke-linecap="round"/>`
    + `<path d="${d}" fill="none" stroke="${C.base}" stroke-width="${w}" stroke-linecap="round"/>`
    + `<path d="${d}" fill="none" stroke="${C.sombra}" stroke-width="${f(w * 0.4)}" stroke-linecap="round" transform="translate(.25 .4)"/>`
    + `<path d="${d}" fill="none" stroke="${C.luz}" stroke-width="${f(w * 0.32)}" stroke-linecap="round" transform="translate(-.2 -.35)"/>`;
}
const linea = (x1, y1, x2, y2, w, atras) => trazo(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, w, atras);
// Cadena de falanges a partir de un punto y una dirección
function falanges(x, y, ux, uy, largos, w) {
  let s = '';
  largos.forEach((l, i) => {
    const g = w * Math.pow(0.86, i);
    s += linea(x, y, x + ux * l, y + uy * l, g);
    x += ux * (l + 0.6); y += uy * (l + 0.6);
  });
  return s;
}

/* ================================ HUESOS ================================ */
// Cada hueso se dibuja en sus coordenadas propias: (0,0) es la articulación de la que cuelga.
// "lado" = 1 para el lado derecho de la pantalla, -1 para el izquierdo (se dibuja espejado).

// Cráneo de frente (y su cara de atrás, para cuando cuelga boca abajo al tocarse los pies)
const CRANEO_SILUETA = 'M0 -21.6C7.2 -21.6 12 -17.6 12.2 -11C12.3 -8.6 11.6 -7 12.4 -5C13.2 -3.6 12.8 -1.8 11 -1.4C9.6 -1 8.8 .4 7.6 1.4C6.6 2.4 5.8 3.6 5 4.4L-5 4.4C-5.8 3.6 -6.6 2.4 -7.6 1.4C-8.8 .4 -9.6 -1 -11 -1.4C-12.8 -1.8 -13.2 -3.6 -12.4 -5C-11.6 -7 -12.3 -8.6 -12.2 -11C-12 -17.6 -7.2 -21.6 0 -21.6Z';
const dientes = (y1, y2, n, ancho) => {
  let s = `<path d="M${-ancho} ${y1}H${ancho}V${y2 - 0.5}Q0 ${y2 + 0.4} ${-ancho} ${y2 - 0.5}Z" fill="#F7F1E2" stroke="${C.linea}" stroke-width=".35"/>`;
  for (let i = 1; i < n; i++) {
    const x = -ancho + (2 * ancho * i) / n;
    s += `<path d="M${f(x)} ${y1 + 0.2}V${y2 - 0.3}" stroke="#A8936B" stroke-width=".3"/>`;
  }
  return s;
};
const CRANEO = `
  <g class="fx-cara">
    <path d="${CRANEO_SILUETA}" fill="url(#fx-craneo)"/>
    ${ambos(l => `
      <path d="M12 -10.5C10.8 -8 10.4 -5.6 11.4 -3.4C9.8 -4.4 9.4 -7 10 -9.6Z" fill="${C.hondo}" opacity=".45" stroke="none"/>
      <path d="M1.6 -8.6C2 -10.6 4.6 -11 6.4 -10.8C8.4 -10.6 9.6 -9.6 9.6 -7.6C9.6 -5.6 8.8 -3.8 6.4 -3.8C4.2 -3.8 2.2 -4.4 1.8 -6C1.6 -6.8 1.5 -7.8 1.6 -8.6Z" fill="url(#fx-hueco)" stroke="${C.linea}" stroke-width=".45"/>
      <path d="M2 -9.6C3.6 -11.4 7.4 -11.8 9.4 -9.8" fill="none" stroke="${C.luz}" stroke-width=".9" stroke-linecap="round"/>
      <path d="M7.2 -3.4C8.8 -2.6 9.6 -1.6 10.6 -1.6" fill="none" stroke="${C.luz}" stroke-width=".7" stroke-linecap="round"/>
      <path d="M2.6 -2.8C3.6 -1.4 5 -.6 6.6 .4C5.6 1.6 4.4 2.2 3 2.2C2.6 .8 2.4 -1 2.6 -2.8Z" fill="${C.sombra}" opacity=".55" stroke="none"/>
      <path d="M3 -17.2C5.6 -18.6 8.4 -18 10 -16.4" fill="none" stroke="#B49F78" stroke-width=".3" stroke-dasharray=".8 .5"/>
      <circle cx="4.4" cy="-1.6" r=".35" fill="#5A4B35" stroke="none"/>`)}
    <path d="M0 -4.6C1 -4.6 2.2 -2.4 2.2 -.6C2.2 .6 1.2 1.2 0 .8C-1.2 1.2 -2.2 .6 -2.2 -.6C-2.2 -2.4 -1 -4.6 0 -4.6Z" fill="url(#fx-hueco)" stroke="${C.linea}" stroke-width=".4"/>
    <path d="M0 -3.4V.7" stroke="#CDBE9C" stroke-width=".45"/>
    <path d="M-1.2 -8.2C-.6 -6.8 .6 -6.8 1.2 -8.2L.8 -4.8H-.8Z" fill="${C.luz}" opacity=".8" stroke="none"/>
    <path d="M-4.4 1.6Q0 2.5 4.4 1.6" fill="none" stroke="#B49F78" stroke-width=".35"/>
    ${dientes(2, 4.6, 8, 4.7)}
  </g>
  <g class="fx-nuca" opacity="0">
    <ellipse cy="-8.6" rx="12.6" ry="13.4" fill="url(#fx-craneo)"/>
    <path d="M0 -21.4V-.6" fill="none" stroke="#A08A62" stroke-width=".4" stroke-dasharray="1 .5"/>
    <path d="M-10.6 -16.4Q0 -13 10.6 -16.4M-9 -1.8Q0 -6.6 9 -1.8" fill="none" stroke="#A08A62" stroke-width=".4" stroke-dasharray="1 .5"/>
    <path d="M-8.6 -18.6C-5.4 -20.8 -1.6 -21.2 1.4 -21" fill="none" stroke="${C.luz}" stroke-width="1.2" stroke-linecap="round"/>
  </g>`;
const MANDIBULA = `
  <path d="M-10.4 -3.6C-10.8 0 -10.6 3.6 -9.2 5.6C-7.2 8.2 -4 9.6 0 9.8C4 9.6 7.2 8.2 9.2 5.6C10.6 3.6 10.8 0 10.4 -3.6L8.6 -3C8.6 0 8 2.8 6 4.4H-6C-8 2.8 -8.6 0 -8.6 -3Z" fill="url(#fx-placa)"/>
  <path d="M-3 8.6Q0 9.6 3 8.6" fill="none" stroke="${C.luz}" stroke-width=".8" stroke-linecap="round"/>
  <path d="M-9.4 4.6C-7.8 6.8 -5 8 -2 8.4" fill="none" stroke="${C.sombra}" stroke-width=".7" stroke-linecap="round"/>
  <circle cx="-4.6" cy="7" r=".35" fill="#5A4B35" stroke="none"/><circle cx="4.6" cy="7" r=".35" fill="#5A4B35" stroke="none"/>
  ${dientes(4.4, 6.5, 8, 4.5)}`;

// Tórax: columna dorsal y cervical, costillas, esternón, clavículas y omóplatos.
// [vértebra donde nace atrás, ancho, altura del punto más externo, extremo óseo delantero, fin del cartílago]
const COSTILLAS = [
  [-40.5, 12.5, -33.5, [7, -35.5], [3, -36.5], 2.1],
  [-37.2, 17, -28.5, [9, -31], [3.2, -33], 2.3],
  [-33.8, 20, -24, [10.5, -27], [3.3, -29.5], 2.3],
  [-30.4, 21.6, -19.5, [11.5, -23], [3.3, -26], 2.4],
  [-27, 22.6, -15, [12.5, -19], [3.2, -23], 2.4],
  [-23.6, 23.2, -10.5, [13.5, -14.5], [3, -19.5], 2.4],
  [-20.2, 23.2, -6, [15, -9.5], [2.6, -16.5], 2.3],
  [-16.8, 22.6, -1.5, [17, -4.5], [9.5, -11.5], 2.2],
  [-13.4, 21.6, 3, [18.5, .8], [14.2, -5.4], 2],
  [-10, 20.2, 7, [19, 5.5], [17, .4], 1.9],
];
const costillaAtras = ([yp, w, yl]) => `M2.6 ${yp}C${f(2.6 + (w - 2.6) * 0.55)} ${yp - 1.2} ${w + 0.6} ${f(yl - (yl - yp) * 0.6)} ${w} ${yl}`;
const costillaDelante = ([, w, yl, [ax, ay]]) => `M${w} ${yl}C${w + 0.4} ${f(yl - (yl - ay) * 0.55)} ${f(ax + (w - ax) * 0.6)} ${f(ay + (yl - ay) * 0.15)} ${ax} ${ay}`;
const cartilago = ([, , , [ax, ay], [cx, cy]]) => `M${ax} ${ay}Q${f((ax + cx) / 2)} ${ay} ${cx} ${cy}`;
const FLOTANTES = ['M2.6 -6.6Q11 -6 14 1.5', 'M2.6 -3.2Q7.6 -2.6 9.4 3'];

const vertebra = (y, w, h, atras) => `
  <path d="M${f(-w / 2 - 0.3)} ${f(y - h / 2)}H${f(w / 2 + 0.3)}C${f(w / 2 - 0.4)} ${y} ${f(w / 2 - 0.4)} ${y} ${f(w / 2 + 0.3)} ${f(y + h / 2)}H${f(-w / 2 - 0.3)}C${f(-w / 2 + 0.4)} ${y} ${f(-w / 2 + 0.4)} ${y} ${f(-w / 2 - 0.3)} ${f(y - h / 2)}Z"
    fill="${atras ? C.atras : 'url(#fx-cil)'}" stroke="${atras ? C.lineaAtras : C.linea}"/>`;
const ESCAPULA = 'M27 -42.5C29.3 -42 29.8 -39.8 28.4 -38.2C26.6 -33 24.6 -26 21.6 -19C20.4 -18 19.2 -19 18.6 -20.4C16 -27 14 -33 13 -38.5C17 -40.8 22 -42.4 27 -42.5Z';
const CLAVICULA = 'M3.8 -38.4C9 -40.5 12 -38.5 17 -39.6S24.5 -41.8 27.6 -41.2';
const ESTERNON = 'M0 -38.8C2.4 -38.8 4.2 -38 4.4 -36.4C4.5 -34.6 3.4 -33.6 2.8 -32.6C3.4 -30 3.4 -24 3 -19.5C2.8 -17.6 2 -16.6 1.2 -16L.9 -13C.6 -12 -.6 -12 -.9 -13L-1.2 -16C-2 -16.6 -2.8 -17.6 -3 -19.5C-3.4 -24 -3.4 -30 -2.8 -32.6C-3.4 -33.6 -4.5 -34.6 -4.4 -36.4C-4.2 -38 -2.4 -38.8 0 -38.8Z';
const dorsales = atras => Array.from({ length: 12 }, (_, i) => vertebra(f(-2.2 - i * 3.4), f(7.6 - i * 0.25), 2.7, atras)).join('');
const cervicales = Array.from({ length: 7 }, (_, i) => {
  const y = f(-41.6 - i * 2.35);
  return linea(-4.6, y, 4.6, y, 0.9) + vertebra(y, 5.6, 1.9);
}).join('');

const TORAX = `
  <g class="fx-frente">
    ${ambos(l => `<path d="${ESCAPULA}" fill="#CBBC9A" stroke="${C.lineaAtras}" opacity=".75"/>`)}
    ${dorsales(true)}
    ${ambos(() => COSTILLAS.map(c => trazo(costillaAtras(c), 1.7, true)).join('') + FLOTANTES.map(d => trazo(d, 1.6, true)).join(''))}
    ${cervicales}
    ${ambos(() => COSTILLAS.map(c => trazo(cartilago(c), 1.5)).join('').replaceAll(C.base, '#E5DAC0'))}
    ${ambos(() => COSTILLAS.map(c => trazo(costillaDelante(c), c[5])).join(''))}
    <path d="${ESTERNON}" fill="url(#fx-placa)"/>
    <path d="M-2.6 -32.6H2.6" stroke="${C.sombra}" stroke-width=".5"/>
    <path d="M-.4 -37.6V-17" stroke="${C.luz}" stroke-width=".7" stroke-linecap="round"/>
    ${ambos(() => trazo(CLAVICULA, 2.4) + '<circle cx="27.8" cy="-41.3" r="1.6" fill="url(#fx-bola)"/>')}
  </g>
  <g class="fx-dorso" opacity="0">
    ${ambos(() => COSTILLAS.map(c => trazo(costillaDelante(c), 1.7, true)).join(''))}
    ${ambos(() => COSTILLAS.map(c => trazo(costillaAtras(c), c[5])).join('') + FLOTANTES.map(d => trazo(d, 1.8)).join(''))}
    ${dorsales(false)}
    ${Array.from({ length: 12 }, (_, i) => `<path d="M-1.3 ${f(-3.2 - i * 3.4)}L0 ${f(-0.4 - i * 3.4)}L1.3 ${f(-3.2 - i * 3.4)}Z" fill="${C.luz}" stroke="${C.linea}" stroke-width=".35"/>`).join('')}
    ${ambos(() => `<path d="${ESCAPULA}" fill="#DDD1B4" stroke="${C.lineaAtras}" opacity=".9"/>` + trazo('M14 -37C18 -38.4 23 -40 28.4 -41', 1.4))}
    ${cervicales}
    ${ambos(() => trazo(CLAVICULA, 2.2))}
  </g>`;

// Columna lumbar: cinco vértebras con sus apófisis transversas
const COLUMNA = Array.from({ length: 5 }, (_, i) => {
  const y = f(-3.2 - i * 6), w = f(10.6 - i * 0.4);
  return `<rect x="${-w / 2 + 0.6}" y="${f(y - 3.6)}" width="${f(w - 1.2)}" height="1.6" rx=".6" fill="#E2D7BD" stroke="none"/>`
    + ambos(() => trazo(`M${w / 2 - 1} ${y}Q${f(w / 2 + 2.6)} ${f(y - 0.4)} ${f(w / 2 + 4.6)} ${f(y - 1.4)}`, 1.6))
    + vertebra(y, w, 4.6);
}).join('');

// Pelvis: alas ilíacas, sacro, pubis y agujeros obturadores
const PELVIS = `
  ${ambos(l => `
    <path fill-rule="evenodd" fill="${grad(l, 'placa')}" d="M8.6 -17.5C11 -22 16 -25.5 21 -25.6C25.5 -25.6 28.8 -22.5 28.6 -18.5C28.4 -15.8 27.4 -13.6 27.6 -11.8C27.2 -10.2 25.6 -9.6 25.2 -8C24.4 -6.2 22 -5.4 20.8 -4.6C23.5 -2 22.6 3 20 5C19.2 7.5 18.6 10.5 17.2 13C16 15 13 15.4 11.6 14C9.2 12.6 5 11.6 1.6 11.8L1.6 6.4C4.6 5.6 8 4.4 10.8 2.6C10.4 1.4 10.2 -1 10.4 -3.4C9.4 -6.6 8.4 -11 8.6 -17.5Z
      M14.6 8.4A3 3.5 -20 1 0 8.6 8.4A3 3.5 -20 1 0 14.6 8.4Z
      M19.4 .4A4 4 0 1 0 11.4 .4A4 4 0 1 0 19.4 .4Z"/>
    <circle cx="15.4" cy=".4" r="4.25" fill="none" stroke="#7A6646" stroke-width=".9" opacity=".55"/>
    <path d="M11 -15.4C13.4 -19.6 18.4 -21.6 22 -20.4C20.2 -16 17 -11.4 12.4 -8.6C11.4 -10.6 10.8 -13 11 -15.4Z" fill="${C.sombra}" opacity=".45" stroke="none"/>
    <path d="M13 -7.6C17 -10 20.6 -13.6 22.6 -18M14.6 -6.2C18.4 -8 22 -10.6 24.6 -13.6" fill="none" stroke="${C.sombra}" stroke-width=".45" opacity=".8"/>
    <path d="M10.6 -19.6C14 -23.6 19 -24.8 23.4 -24.4" fill="none" stroke="${C.luz}" stroke-width="1" stroke-linecap="round"/>
    <path d="M2.4 9.6C5.6 9.2 9 10.2 11.6 12.4" fill="none" stroke="${C.sombra}" stroke-width=".7"/>`)}
  <path d="M-9 -17.6C-3 -18.8 3 -18.8 9 -17.6C8.6 -10 6 -2.6 3.2 2.4L1.4 6.6C.6 7.6 -.6 7.6 -1.4 6.6L-3.2 2.4C-6 -2.6 -8.6 -10 -9 -17.6Z" fill="url(#fx-placa)"/>
  ${[-14.4, -10.4, -6.6, -3].map((y, i) => `<ellipse cx="${f(3.6 - i * 0.5)}" cy="${y}" rx="${f(1.1 - i * 0.15)}" ry=".85" fill="#6E5B3E" stroke="none"/><ellipse cx="${f(-3.6 + i * 0.5)}" cy="${y}" rx="${f(1.1 - i * 0.15)}" ry=".85" fill="#6E5B3E" stroke="none"/>`).join('')}
  ${[-12.4, -8.6, -4.8].map(y => `<path d="M-4.4 ${y}Q0 ${y + 0.8} 4.4 ${y}" fill="none" stroke="${C.sombra}" stroke-width=".5"/>`).join('')}
  <path d="M-1.6 6.6H1.6V11.8H-1.6Z" fill="#E5DAC0"/>`;

// Fémur (con rótula), con la cabeza en (0,0) y la rodilla en (0,52)
const femur = l => espejo(l, `
  <path fill="${grad(l, 'cil')}" d="M1.5 -3.5C5 -4.5 8 -4 10 -5.5C12.5 -6 14 -3 13.2 .5C12.5 4 11 7 10.6 10C9.6 20 8 32 7.6 41C8.6 44 9.4 47.5 8.6 50.5C8 53.5 5.5 55 3 54C1.8 53.5 .6 52.5 -.4 53.2C-2 54.6 -5.5 54.5 -6.2 51.5C-6.8 48.5 -5.5 45 -3 42C-1 34 1.5 22 3 12C3.4 9.5 2.4 8 2.8 6.5C2 5 1.5 4.5 .5 4Z"/>
  <path d="M10.4 -4.6C11.6 -3 12 0 11.2 2.6" fill="none" stroke="${C.luz}" stroke-width=".8" stroke-linecap="round"/>
  <circle r="4.8" fill="${grad(l, 'bola')}"/>
  <path d="M-2.4 44.2C-2.4 42.6 4 42.6 4 44.2C4 47 2.4 50 .8 50.4C-.8 50 -2.4 47 -2.4 44.2Z" fill="${grad(l, 'bola')}"/>`);
// Tibia y peroné, de la rodilla (0,0) al tobillo (0,47.5)
const tibia = l => espejo(l, `
  <path fill="${grad(l, 'cil')}" d="M4.6 3.2C5.4 1.8 7.6 2 7.8 3.8C8 5.2 6.8 6.4 6.4 8C5.6 20 5.6 33 5.4 42C6.6 44 7 47 6 49.5C5 50.4 3.6 49.8 3.6 48C3.8 45 4.2 43.5 4.2 42C4.4 33 4.6 20 5 8.5C4.4 6.5 4 4.5 4.6 3.2Z"/>
  <path fill="${grad(l, 'cil')}" d="M-7 1C-7.5 -.5 -3 -1.2 0 -.6C3 -1.2 7 -.6 6.8 1.5C6.5 4 4 6 3 9C2.4 20 2 34 2.2 42C2.6 44.5 2 46.5 .5 47.5C-1.5 48.2 -4.5 48.5 -5 46C-5.3 43.5 -3.6 40 -3.4 36C-3.2 25 -3 15 -4 8C-5 5 -7 4 -7 1Z"/>
  <path d="M.4 6.4Q.8 9 .4 11.4" fill="none" stroke="${C.sombra}" stroke-width=".7" stroke-linecap="round"/>
  <path d="M-2.2 12C-2 22 -2 32 -2.4 40" fill="none" stroke="${C.luz}" stroke-width=".7" stroke-linecap="round"/>`);
// Pie visto de frente: astrágalo, tarso, metatarsianos y dedos (el gordo hacia dentro)
const pie = l => espejo(l, `
  <ellipse cx="1.6" cy="9.4" rx="4.6" ry="3.2" fill="${C.atras}" stroke="${C.lineaAtras}"/>
  ${[-3.6, -1.2, 1.2, 3.6].map(x => `<rect x="${f(x - 1.25)}" y="4.8" width="2.5" height="2.8" rx="1" fill="${grad(l, 'bola')}"/>`).join('')}
  <ellipse cy="1.9" rx="4.7" ry="2.7" fill="${grad(l, 'bola')}"/>
  ${[[-3.6, -6.6, 2.1], [-1.6, -3.4, 1.5], [.2, -.6, 1.4], [2, 2.2, 1.3], [3.8, 4.9, 1.3]].map(([x0, x1, w], i) =>
    linea(x0, 8.2, x1, 13.2, w) + falanges(x1 + (x1 - x0) * 0.08, 14, (x1 - x0) * 0.05, 1, i ? [2, 1.4, 1] : [3, 2.4], i ? 1.15 : 2)).join('')}`);

// Húmero, del hombro (0,0) al codo (0,50)
const humero = l => espejo(l, `
  <path fill="${grad(l, 'cil')}" d="M4.4 -2.6C6 -.5 5.6 3 4 6.5C3 14 2.6 22 2.8 30C3 38 4 42 5.6 45.5C6.4 47.2 5.8 49 4.4 50.2C3 51.6 1 51.2 0 51.8C-1.5 52.4 -3.4 51.8 -4.4 51C-6 50.4 -7.6 49 -7.2 47.4C-6.6 46 -4.6 44.6 -3.6 42C-2.6 34 -2.6 20 -2.4 9C-2.6 6 -3.6 3 -2 -1Z"/>
  <ellipse cx="-.6" cy="46" rx="1.5" ry="2" fill="${C.sombra}" stroke="none" opacity=".6"/>
  <circle cx="-1.4" cy="-.6" r="5.4" fill="${grad(l, 'bola')}"/>
  <path d="M3.4 0C4.4 2 4.2 4 3.4 6" fill="none" stroke="${C.sombra}" stroke-width=".6"/>`);
// Cúbito y radio, del codo (0,0) a la muñeca (0,38.5)
const antebrazo = l => espejo(l, `
  <path fill="${grad(l, 'cil')}" d="M-5.8 .4C-5.6 -1.6 -2.4 -1.6 -1 0C-.4 1.5 -1.2 3.4 -2 5C-2.6 16 -3 28 -3.4 35C-3 36.4 -3.6 38.6 -4.8 38.6C-6 38.4 -6 36.4 -5.6 35C-5 28 -4.6 16 -4.6 6C-5.4 4 -6 2.2 -5.8 .4Z"/>
  <path fill="${grad(l, 'cil')}" d="M.2 .4C.4 -.8 4.8 -.8 5 .4C5.1 1.6 4.6 2.2 3.8 2.6C3.6 4.6 3.4 6 3.6 8C4.4 18 5.2 28 6 34C6.4 36 6.2 38 5 38.8C3 39.6 .6 39.4 -1.4 38.6C-1.4 36.4 -.6 34.6 .4 33C1.8 26 2 17 1.8 9C1.4 6 1.2 4 1.2 2.6C.4 2.2 .1 1.4 .2 .4Z"/>`);
// Mano con la palma hacia delante: carpo, metacarpianos y falanges (pulgar hacia fuera)
const DEDOS = [
  [[3.4, 4.6], [6.4, 9.6], [3.6, 2.6], 1.6],
  [[2.2, 5.8], [3.2, 13.4], [4.6, 2.8, 2], 1.45],
  [[.6, 6], [.8, 14.2], [5, 3.2, 2.2], 1.45],
  [[-1.2, 5.8], [-1.8, 13.6], [4.7, 3, 2.1], 1.35],
  [[-3, 5.4], [-4.4, 12.4], [3.6, 2.3, 1.8], 1.25],
];
const mano = l => espejo(l, `
  ${[[-3.1, 1.7, 1.4], [-1, 1.4, 1.3], [1.1, 1.4, 1.3], [3.1, 1.8, 1.3], [-2.9, 4.2, 1.2], [-.9, 4.3, 1.2], [1.1, 4.3, 1.2], [3.1, 4, 1.3]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.9)}" fill="${grad(l, 'bola')}"/>`).join('')}
  ${DEDOS.map(([[x0, y0], [x1, y1], largos, w]) => {
    const d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    return linea(x0, y0, x1, y1, w) + falanges(x1 + ux * 0.7, y1 + uy * 0.7, ux, uy, largos, w * 0.88);
  }).join('')}`);

/* ======================= ESQUELETO ARTICULADO ======================= */
// Cada pieza cuelga de otra en un punto de enganche (en las coordenadas de la pieza madre).
// Lados según la pantalla: D = derecha, I = izquierda.
const PIEZAS = [
  ['pelvis', 'raiz', [0, 0]], ['columna', 'pelvis', [0, -17]], ['torax', 'columna', [0, -30]],
  ['craneo', 'torax', [0, -58]], ['mandibula', 'craneo', [0, 0]],
  ['humeroD', 'torax', [30, -37]], ['antebrazoD', 'humeroD', [0, 50]], ['manoD', 'antebrazoD', [0, 38.5]],
  ['humeroI', 'torax', [-30, -37]], ['antebrazoI', 'humeroI', [0, 50]], ['manoI', 'antebrazoI', [0, 38.5]],
  ['femurD', 'pelvis', [15, 0]], ['tibiaD', 'femurD', [0, 52]], ['pieD', 'tibiaD', [0, 47.5]],
  ['femurI', 'pelvis', [-15, 0]], ['tibiaI', 'femurI', [0, 52]], ['pieI', 'tibiaI', [0, 47.5]],
];
const DIBUJOS = {
  pelvis: PELVIS, columna: COLUMNA, torax: TORAX, craneo: CRANEO, mandibula: MANDIBULA,
  humeroD: humero(1), antebrazoD: antebrazo(1), manoD: mano(1),
  humeroI: humero(-1), antebrazoI: antebrazo(-1), manoI: mano(-1),
  femurD: femur(1), tibiaD: tibia(1), pieD: pie(1),
  femurI: femur(-1), tibiaI: tibia(-1), pieI: pie(-1),
};
// Orden de dibujo: lo que queda detrás, primero
const DIBUJO = ['pieI', 'tibiaI', 'femurI', 'pieD', 'tibiaD', 'femurD', 'pelvis',
  'manoI', 'antebrazoI', 'humeroI', 'manoD', 'antebrazoD', 'humeroD', 'columna', 'torax', 'mandibula', 'craneo'];
// Puntos que pueden tocar el suelo (planta de los pies y parte baja de la pelvis)
const APOYOS = [['pieD', 0, 19.5], ['pieI', 0, 19.5], ['pelvis', 0, 13]];
// Al inclinarse hacia nosotros, la columna y el tórax se acortan (escala vertical), pero nunca a cero
const ESCALA_MIN = { columna: 0.2, torax: 0.15 };

const rad = g => g * Math.PI / 180;
const mezclar = (a, b, t) => a + (b - a) * t;
const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const CURVAS = {
  suave: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  entra: t => t * t * t, sale: t => 1 - Math.pow(1 - t, 3),
};

// Cinemática directa: cada pose da el giro (grados) de cada pieza respecto a su madre y,
// opcionalmente, su escala vertical "pieza_s" (para el escorzo).
function cinematica(p, raiz) {
  const r = { raiz: { x: raiz[0], y: raiz[1], a: 0, s: 1 } };
  for (const [n, madre, [ox, oy]] of PIEZAS) {
    const M = r[madre], c = Math.cos(rad(M.a)), sn = Math.sin(rad(M.a)), oys = oy * M.s;
    let s = p[`${n}_s`] ?? 1;
    if (Math.abs(s) < (ESCALA_MIN[n] || 0)) s = (s < 0 ? -1 : 1) * ESCALA_MIN[n];
    if (n === 'craneo') s *= Math.sign(r.torax.s);   // si el tórax cuelga boca abajo, la cabeza también
    if (n === 'mandibula') s = r.craneo.s;
    r[n] = { x: M.x + ox * c - oys * sn, y: M.y + ox * sn + oys * c, a: M.a + (p[n] || 0), s };
  }
  return r;
}
const enMundo = (seg, lx, ly) => {
  const c = Math.cos(rad(seg.a)), s = Math.sin(rad(seg.a));
  return { x: seg.x + lx * c - ly * seg.s * s, y: seg.y + lx * s + ly * seg.s * c };
};
// La cadera se coloca para que el punto más bajo del esqueleto toque justo el suelo
function apoyar(p) {
  const r = cinematica(p, [0, 0]);
  const abajo = Math.max(...APOYOS.map(([n, x, y]) => enMundo(r[n], x, y).y));
  return cinematica(p, [CENTRO, SUELO - abajo]);
}

const transformar = (g, x, y, a, s) => g.setAttribute('transform', `translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(1 ${f(s)})`);

// Reproduce una lista de poses interpolando entre ellas. Cada pose: ángulos, escalas, { ms, curva }
function animarFigura({ intro, partes, poses, alCuadro }) {
  const claves = [...new Set(poses.flatMap(Object.keys))].filter(k => k !== 'ms' && k !== 'curva');
  const valor = (p, k) => p[k] ?? (k.endsWith('_s') ? 1 : 0);
  const pintar = p => {
    const r = apoyar(p);
    for (const n of DIBUJO) transformar(partes[n], r[n].x, r[n].y, r[n].a, r[n].s);
    alCuadro(r);
    return r;
  };
  return new Promise(fin => {
    let i = 0, t0 = performance.now(), ultimo = pintar(poses[0]);
    const cuadro = ahora => {
      if (!intro.isConnected) return fin(ultimo);
      const A = poses[i], B = poses[i + 1];
      if (!B) return fin(ultimo);
      const t = Math.min(1, (ahora - t0) / B.ms);
      const k = CURVAS[B.curva || 'suave'](t);
      const p = {};
      for (const c of claves) p[c] = mezclar(valor(A, c), valor(B, c), k);
      ultimo = pintar(p);
      if (t >= 1) { i++; t0 = ahora; }
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  });
}

/* ============================ POLVO Y DESMONTAJE ============================ */
const NS = 'http://www.w3.org/2000/svg';
const azar = (a, b) => a + Math.random() * (b - a);
// Una nubecilla de polvo que se abre y se desvanece
function polvo(capa, x, fuerza = 1) {
  const n = Math.round(2 + fuerza * 2);
  for (let i = 0; i < n; i++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'fx-mota');
    c.setAttribute('cx', f(x + azar(-4, 4)));
    c.setAttribute('cy', SUELO - 3);
    c.setAttribute('r', f(azar(4, 7) * fuerza));
    c.setAttribute('fill', 'url(#fx-polvo)');
    capa.appendChild(c);
    const dx = azar(-14, 14) * fuerza, dy = -azar(4, 14) * fuerza;
    c.animate([
      { transform: 'translate(0,0) scale(.4)', opacity: 0.85 },
      { transform: `translate(${f(dx)}px,${f(dy)}px) scale(${f(azar(1.6, 2.4))})`, opacity: 0 },
    ], { duration: azar(650, 1000), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => c.remove();
  }
}

// Cada hueso sale suelto: cae con gravedad, rebota contra el suelo, se tumba y desaparece
function desmontar(intro, partes, r, capaSombras, capaPolvo, ms = 1500) {
  const piezas = DIBUJO.map(n => {
    const g = partes[n], b = g.getBBox(), S = r[n];
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const centro = enMundo(S, cx, cy);
    const sombra = document.createElementNS(NS, 'ellipse');
    sombra.setAttribute('fill', 'url(#fx-sombra-suelo)');
    capaSombras.appendChild(sombra);
    return {
      g, sombra, cx, cy, s: S.s, x: centro.x, y: centro.y, a: S.a,
      mw: b.width / 2, mh: (b.height / 2) * Math.abs(S.s),
      vx: (centro.x - CENTRO) * 0.9 + azar(-45, 45), vy: -azar(30, 150), w: azar(-280, 280),
      tumbado: n === 'torax' || b.height * Math.abs(S.s) > b.width ? 90 : 0, golpes: 0, retraso: azar(0, 260),
    };
  });
  return new Promise(fin => {
    let antes = performance.now(); const t0 = antes;
    const cuadro = ahora => {
      if (!intro.isConnected) return fin();
      const dt = Math.min(0.035, (ahora - antes) / 1000); antes = ahora;
      const t = ahora - t0;
      for (const p of piezas) {
        p.vy += 1500 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt;
        // Distancia del centro al punto más bajo de la pieza girada
        const c = Math.abs(Math.cos(rad(p.a))), s = Math.abs(Math.sin(rad(p.a)));
        const bajo = p.mh * c + p.mw * s;
        if (p.y + bajo > SUELO) {
          p.y = SUELO - bajo;
          if (p.vy > 0) {
            if (p.vy > 140 && p.golpes < 2) polvo(capaPolvo, p.x, p.golpes ? 0.5 : 0.8);
            p.golpes++;
            p.vy *= -0.3; p.w *= 0.45;
          }
          p.vx *= 0.9;
          // Al tocar el suelo, el hueso se va tumbando sobre su lado largo
          const objetivo = p.tumbado + Math.round((p.a - p.tumbado) / 180) * 180;
          p.a += (objetivo - p.a) * 0.2;
        }
        const desvanece = limitar(1 - (t - 800 - p.retraso) / 500);
        const g = p.g, ca = Math.cos(rad(p.a)), sa = Math.sin(rad(p.a));
        g.setAttribute('transform', `translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.a)}) scale(1 ${f(p.s)}) translate(${f(-p.cx)} ${f(-p.cy)})`);
        g.style.opacity = desvanece;
        const ancho = p.mw * Math.abs(ca) + p.mh * Math.abs(sa);
        const altura = SUELO - (p.y + bajo);
        p.sombra.setAttribute('cx', f(p.x)); p.sombra.setAttribute('cy', SUELO + 1);
        p.sombra.setAttribute('rx', f(ancho * 1.15 + 3)); p.sombra.setAttribute('ry', 2.6);
        p.sombra.setAttribute('opacity', f(0.7 * limitar(1 - altura / 90) * desvanece));
      }
      if (t < ms) requestAnimationFrame(cuadro); else fin();
    };
    requestAnimationFrame(cuadro);
  });
}

/* ================================ ESTILOS ================================ */
const CSS = `
.fx-escena {
  background:
    radial-gradient(70% 85% at 50% 42%, rgba(251, 249, 245, .95), rgba(251, 249, 245, 0) 70%),
    linear-gradient(180deg, #DCE8F3 0%, #E7EDF1 38%, #F4F0E8 74%, #F1ECE3 100%);
}
.fx-escena svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; display: block; }
.fx-mota { transform-box: fill-box; transform-origin: center; }
.fx-figura { will-change: transform; }
`;

/* ============================== FLEXIBILIDAD ============================== */
// Poses (grados respecto a la pieza madre; "_s" = escala vertical para el escorzo)
const DE_PIE = {
  femurD: 2, femurI: -2, tibiaD: -2, tibiaI: 2, humeroD: -9, antebrazoD: -4, manoD: 3, humeroI: 9, antebrazoI: 4, manoI: -3,
};
// Doblado hacia nosotros: vemos la espalda y la coronilla, los brazos cuelgan hasta los pies
const TOCAR = {
  pelvis_s: 0.72, columna_s: -0.75, torax_s: -1, craneo_s: 0.92,
  humeroD: 12, antebrazoD: 2, manoD: 0, humeroI: -12, antebrazoI: -2, manoI: 0,
  humeroD_s: 0.62, antebrazoD_s: 0.62, manoD_s: 0.7, humeroI_s: 0.62, antebrazoI_s: 0.62, manoI_s: 0.7,
  femurD: 3, femurI: -3, tibiaD: -3, tibiaI: 3,
};
// Mitad del gesto: la espalda horizontal, mirando hacia nosotros
const MEDIO = {
  ...TOCAR, pelvis_s: 0.85, columna_s: 0.35, torax_s: 0.25, craneo_s: 0.9,
  humeroD: -2, humeroI: 2, humeroD_s: 0.4, antebrazoD_s: 0.45, humeroI_s: 0.4, antebrazoI_s: 0.45, manoD_s: 0.5, manoI_s: 0.5,
};
const BRAZOS = { ...DE_PIE, humeroD: -100, antebrazoD: -14, manoD: -6, humeroI: 100, antebrazoI: 14, manoI: 6 };
const SPAGAT = {
  femurD: -84, femurI: 84, tibiaD: -1, tibiaI: 1,
  humeroD: -112, antebrazoD: -18, manoD: -8, humeroI: 112, antebrazoI: 18, manoI: 8,
};

export async function introFlexibilidad(cont) {
  if (sinMovimiento()) return;
  estilos('intro-flex', CSS);
  const { intro, saltada } = montar(cont, 'fx-escena', `
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>${DEFS}</defs>
      <rect x="-800" y="${SUELO}" width="2000" height="120" fill="url(#fx-suelo)"/>
      <rect x="-200" y="${SUELO}" width="800" height=".8" fill="url(#fx-linea-suelo)"/>
      <ellipse class="fx-sombra" cx="${CENTRO}" cy="${SUELO + 1}" rx="40" ry="4" fill="url(#fx-sombra-suelo)"/>
      <g class="fx-sombras"></g>
      <g class="fx-figura">
        ${DIBUJO.map(n => `<g data-pieza="${n}"><g filter="url(#fx-poro)" stroke="${C.linea}" stroke-width=".5" stroke-linejoin="round">${DIBUJOS[n]}</g></g>`).join('')}
      </g>
      <g class="fx-polvo"></g>
    </svg>`);
  intro.setAttribute('aria-label', 'Un esqueleto se estira y se abre de piernas');
  const partes = Object.fromEntries([...intro.querySelectorAll('[data-pieza]')].map(g => [g.dataset.pieza, g]));
  const sombra = intro.querySelector('.fx-sombra');
  const figura = intro.querySelector('.fx-figura');
  const capaPolvo = intro.querySelector('.fx-polvo');
  const capas = {
    frente: partes.torax.querySelector('.fx-frente'), dorso: partes.torax.querySelector('.fx-dorso'),
    cara: partes.craneo.querySelector('.fx-cara'), nuca: partes.craneo.querySelector('.fx-nuca'),
  };

  // En cada cuadro: qué cara del tórax y del cráneo vemos, y la sombra bajo los apoyos
  const alCuadro = r => {
    const s = r.torax.s;
    const frente = limitar((s + 0.1) / 0.25);
    const cara = limitar((s - 0.2) / 0.4);
    capas.frente.setAttribute('opacity', f(frente)); capas.dorso.setAttribute('opacity', f(1 - frente));
    capas.cara.setAttribute('opacity', f(cara)); capas.nuca.setAttribute('opacity', f(1 - cara));
    partes.mandibula.style.opacity = cara;
    const xs = [enMundo(r.pieI, 0, 12).x, enMundo(r.pieD, 0, 12).x];
    sombra.setAttribute('rx', f((Math.max(...xs) - Math.min(...xs)) / 2 + 22));
  };

  let final = null;
  await reproducir([
    async () => {
      final = await animarFigura({
        intro, partes, alCuadro,
        poses: [
          { ...DE_PIE },
          { ...DE_PIE, ms: 320 },
          { ...MEDIO, ms: 380, curva: 'entra' },                 // se dobla hacia nosotros…
          { ...TOCAR, ms: 420, curva: 'sale' },                   // …y se toca las puntas de los pies
          { ...TOCAR, columna_s: -0.8, humeroD_s: 0.65, humeroI_s: 0.65, ms: 260 },
          { ...MEDIO, ms: 300, curva: 'entra' },                 // vuelve arriba
          { ...DE_PIE, ms: 300, curva: 'sale' },
          { ...BRAZOS, ms: 260 },                                 // brazos en cruz para equilibrarse
          { ...SPAGAT, ms: 380, curva: 'entra' },                 // ¡spagat de golpe contra el suelo!
          { ...SPAGAT, humeroD: -104, humeroI: 104, antebrazoD: -10, antebrazoI: 10, ms: 220, curva: 'sale' },  // aguanta un instante
        ],
      });
    },
    () => {
      figura.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(2.5px)' }, { transform: 'translateY(-1px)' }, { transform: 'none' }], { duration: 240 });
      sombra.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
      for (let x = -120; x <= 120; x += 24) polvo(capaPolvo, CENTRO + x, 1 - Math.abs(x) / 300);
      return desmontar(intro, partes, final, intro.querySelector('.fx-sombras'), capaPolvo);
    },
  ], saltada);

  await cerrar(cont, intro);
}
