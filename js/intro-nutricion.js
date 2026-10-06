// INTRO DE NUTRICIÓN: un filete en el plato, el salero espolvorea sal y la cámara viaja hasta su tapa.
// Un grano blanco cae de uno de los agujeros y, al caer, la escena se funde en el color de la app.
import { sinMovimiento, espera, montar, cerrar, reproducir, estilos } from './intro-base.js';

/* ============================== UTILIDADES ============================== */
// Números "aleatorios" repetibles: el filete sale siempre igual
function semilla(s) {
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const r1 = n => Math.round(n * 10) / 10;

// El salero está dibujado en su propio sistema (tapa en 0,0, cuerpo hacia arriba) y luego se gira
const SALERO = { x: 574, y: 84, giro: 34 };
function aMundo(x, y) {
  const g = SALERO.giro * Math.PI / 180;
  return [r1(SALERO.x + x * Math.cos(g) - y * Math.sin(g)), r1(SALERO.y + x * Math.sin(g) + y * Math.cos(g))];
}

// Agujeros de la tapa (cúpula vista de lado): x, y, radio x, radio y
const AGUJEROS = [
  [-24, 5, 1.7, 2], [-12, 5.6, 2.4, 2], [0, 5.8, 2.6, 2.1], [12, 5.6, 2.4, 2], [24, 5, 1.7, 2],
  [-14, 12, 2.2, 1.5], [-4.7, 12.8, 2.5, 1.5], [4.7, 12.8, 2.5, 1.5], [14, 12, 2.2, 1.5],
];
const AGUJERO_HEROE = 7; // de este sale el grano protagonista

// Un grano de sal: un cubito con tres caras iluminadas desde arriba a la izquierda
const cubo = (t, extra = '') => `<g ${extra}>
  <polygon points="0,${-t} ${t * .87},${-t / 2} 0,0 ${-t * .87},${-t / 2}" fill="#FFFFFF"/>
  <polygon points="${-t * .87},${-t / 2} 0,0 0,${t} ${-t * .87},${t / 2}" fill="#ECEFF2"/>
  <polygon points="0,0 ${t * .87},${-t / 2} ${t * .87},${t / 2} 0,${t}" fill="#C3CAD3"/></g>`;

// Motas repartidas dentro de una elipse (pimienta, sal, moteado)
function motas({ n, cx, cy, rx, ry, azar, pinta }) {
  let html = '';
  for (let i = 0; i < n; i++) {
    const a = azar() * Math.PI * 2, d = Math.sqrt(azar());
    html += pinta(r1(cx + Math.cos(a) * rx * d), r1(cy + Math.sin(a) * ry * d), azar);
  }
  return html;
}
const pimienta = (x, y, azar) => {
  const t = .7 + azar() * 1.6, col = ['#120A06', '#1E120B', '#2E2017', '#5A4836', '#7A6550'][Math.floor(azar() * 5)];
  return `<ellipse cx="${x}" cy="${y}" rx="${r1(t)}" ry="${r1(t * .75)}" fill="${col}" transform="rotate(${Math.floor(azar() * 180)} ${x} ${y})"/>`;
};
const sal = (x, y, azar) => {
  const t = .9 + azar() * 1.3;
  return `<rect x="${x}" y="${y}" width="${r1(t)}" height="${r1(t)}" rx=".3" fill="${azar() > .3 ? '#FFFFFF' : '#E6E1D8'}" transform="rotate(${Math.floor(azar() * 90)} ${x} ${y})"/>`;
};

// Ramita de romero: tallo curvo con hojitas a ambos lados
function romero() {
  const azar = semilla(41);
  const p = [[598, 240], [632, 226], [668, 210], [714, 186]];
  const bez = t => {
    const m = 1 - t;
    return [0, 1].map(k => m * m * m * p[0][k] + 3 * m * m * t * p[1][k] + 3 * m * t * t * p[2][k] + t * t * t * p[3][k]);
  };
  let hojas = '';
  for (let i = 0; i < 34; i++) {
    const t = .04 + i / 35, [x, y] = bez(t), [x2, y2] = bez(Math.min(t + .02, 1));
    const dir = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
    const lado = i % 2 ? 1 : -1, largo = 17 + azar() * 7 - t * 5;
    const ang = dir + lado * (38 + azar() * 22);
    hojas += `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})">
      <path d="M0 0 C ${r1(largo * .3)} -2.6, ${r1(largo * .8)} -2, ${r1(largo)} 0 C ${r1(largo * .8)} 2, ${r1(largo * .3)} 2.6, 0 0Z" fill="url(#nt-g-hoja)"/>
      <path d="M1 -.3 L${r1(largo * .9)} -.2" stroke="#9DB57A" stroke-width=".45" opacity=".7"/></g>`;
  }
  return `<g class="nt-romero">
    <path d="M603 242 C 640 232, 676 216, 720 192" stroke="#000" stroke-opacity=".25" stroke-width="5" fill="none" filter="url(#nt-f-sombra)"/>
    <path d="M${p[0]} C ${p[1]}, ${p[2]}, ${p[3]}" stroke="#5B4A2C" stroke-width="2.8" fill="none"/>
    ${hojas}</g>`;
}

/* ============================== ESCENA ============================== */
// Forma de la cara superior del filete (la costra)
const FILETE = 'M258 146 C 262 122, 300 110, 360 106 C 420 101, 470 108, 520 104 C 560 101, 584 112, 588 132 C 592 152, 578 170, 552 178 C 500 192, 430 186, 370 194 C 330 199, 286 198, 268 186 C 254 176, 254 160, 258 146 Z';
const GROSOR = 44;
// Loncha cortada: la cara rosada y su borde de costra
const LONCHA_CARA = 'M152 210 C 156 200, 172 197, 196 198 L 318 204 C 336 205, 346 212, 348 224 L 350 246 C 351 254, 344 258, 334 258 L 168 252 C 156 251, 149 244, 149 236 Z';
const LONCHA_LADO = 'M149 236 C 149 244, 156 251, 168 252 L 334 258 C 344 258, 351 254, 350 246 L 351 258 C 351 266, 344 270, 332 270 L 170 266 C 157 265, 150 259, 150 250 Z';

const SVG = (contenido, defs = '') => `<svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${defs}</defs>${contenido}</svg>`;

// Filtros y degradados (en el primer SVG; los ids sirven para todo el documento)
const DEFS = `
  <filter id="nt-f-madera" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".0035 .085" numOctaves="4" seed="12"/>
    <feColorMatrix values="0 0 0 0 .14  0 0 0 0 .06  0 0 0 0 .025  -2.6 0 0 0 1.55"/>
  </filter>
  <filter id="nt-f-veta" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".012 .3" numOctaves="2" seed="5"/>
    <feColorMatrix values="0 0 0 0 .78  0 0 0 0 .5  0 0 0 0 .3  3 0 0 0 -1.75"/>
  </filter>
  <filter id="nt-f-moteado" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="21"/>
    <feColorMatrix values="0 0 0 0 .38  0 0 0 0 .27  0 0 0 0 .18  11 0 0 0 -7.1"/>
  </filter>
  <filter id="nt-f-grano-plato" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="2"/>
    <feColorMatrix values="0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .35  1.6 0 0 0 -.65"/>
  </filter>
  <filter id="nt-f-costra" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="2" seed="3" result="ruido"/>
    <feDiffuseLighting in="ruido" surfaceScale="1.6" diffuseConstant="1.15" lighting-color="#FFEBD6" result="difusa"><feDistantLight azimuth="225" elevation="40"/></feDiffuseLighting>
    <feSpecularLighting in="ruido" surfaceScale="1.6" specularConstant=".9" specularExponent="16" lighting-color="#FFD9B0" result="brillo"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting>
    <feComposite in="difusa" in2="SourceGraphic" operator="arithmetic" k1="1.05" result="base"/>
    <feComposite in="brillo" in2="SourceAlpha" operator="in" result="brillo2"/>
    <feComposite in="base" in2="brillo2" operator="arithmetic" k2="1" k3=".75"/>
  </filter>
  <filter id="nt-f-tostado" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".03 .05" numOctaves="3" seed="31"/>
    <feColorMatrix values="0 0 0 0 .05  0 0 0 0 .02  0 0 0 0 .01  6 0 0 0 -2.5"/>
  </filter>
  <filter id="nt-f-fibra" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".006 .17" numOctaves="3" seed="9"/>
    <feColorMatrix values="0 0 0 0 .4  0 0 0 0 .08  0 0 0 0 .08  -4 0 0 0 2.2"/>
  </filter>
  <filter id="nt-f-fibra-clara" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".01 .09" numOctaves="2" seed="17"/>
    <feColorMatrix values="0 0 0 0 1  0 0 0 0 .8  0 0 0 0 .78  4 0 0 0 -2.5"/>
  </filter>
  <filter id="nt-f-lino" x="0" y="0" width="1" height="1">
    <feTurbulence type="turbulence" baseFrequency=".7 .5" numOctaves="1" seed="4"/>
    <feColorMatrix values="0 0 0 0 .35  0 0 0 0 .3  0 0 0 0 .25  1.2 0 0 0 -.2"/>
  </filter>
  <filter id="nt-f-sal-dentro" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="8"/>
    <feColorMatrix values="0 0 0 0 .62  0 0 0 0 .64  0 0 0 0 .68  5 0 0 0 -2.6"/>
  </filter>
  <filter id="nt-f-cepillado" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency=".9 .02" numOctaves="2" seed="6"/>
    <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.4 0 0 0 -.6"/>
  </filter>
  <filter id="nt-f-sombra" x="-.3" y="-.3" width="1.6" height="1.6"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="nt-f-sombra-suave" x="-.3" y="-.5" width="1.6" height="2"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="nt-f-lejos" x="-.2" y="-.3" width="1.4" height="1.6"><feGaussianBlur stdDeviation="4.5"/></filter>
  <filter id="nt-f-mesa" x="0" y="0" width="1" height="1"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="nt-f-suave" x="-.1" y="-.1" width="1.2" height="1.2"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="nt-f-cerca" x="-.2" y="-.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="3.5"/></filter>

  <linearGradient id="nt-g-mesa" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2A160C"/><stop offset=".35" stop-color="#5A321C"/><stop offset=".75" stop-color="#6B3D22"/><stop offset="1" stop-color="#4A2915"/>
  </linearGradient>
  <radialGradient id="nt-g-luz-mesa" cx=".22" cy=".12" r=".75">
    <stop offset="0" stop-color="#E0A06A" stop-opacity=".55"/><stop offset=".55" stop-color="#B8743F" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="nt-g-plato" cx=".38" cy=".3" r=".8">
    <stop offset="0" stop-color="#F1ECE3"/><stop offset=".55" stop-color="#E4DCCF"/><stop offset="1" stop-color="#C9BCA8"/>
  </radialGradient>
  <radialGradient id="nt-g-pozo" cx=".42" cy=".35" r=".7">
    <stop offset="0" stop-color="#EAE3D8"/><stop offset=".8" stop-color="#DDD3C4"/><stop offset="1" stop-color="#CBBFAD"/>
  </radialGradient>
  <linearGradient id="nt-g-canto" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#C79A68"/><stop offset=".5" stop-color="#A9784B"/><stop offset="1" stop-color="#7B5232"/>
  </linearGradient>
  <radialGradient id="nt-g-jugo" cx=".55" cy=".45" r=".6">
    <stop offset="0" stop-color="#C98030"/><stop offset=".55" stop-color="#9C5418"/><stop offset=".85" stop-color="#6E3410"/><stop offset="1" stop-color="#5A2A0C" stop-opacity=".6"/>
  </radialGradient>
  <radialGradient id="nt-g-costra" cx=".3" cy=".25" r=".85">
    <stop offset="0" stop-color="#5E2C16"/><stop offset=".45" stop-color="#3C1B0E"/><stop offset="1" stop-color="#1C0B05"/>
  </radialGradient>
  <linearGradient id="nt-g-lado" x1="0" y1="170" x2="0" y2="242" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#24100A"/><stop offset=".22" stop-color="#4A2216"/><stop offset=".42" stop-color="#6A2E22"/><stop offset=".62" stop-color="#7E3C2E"/><stop offset=".85" stop-color="#5E2A1C"/><stop offset="1" stop-color="#26110A"/>
  </linearGradient>
  <linearGradient id="nt-g-lado-luz" x1="250" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#C06A62" stop-opacity=".55"/><stop offset=".25" stop-color="#C06A62" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/>
  </linearGradient>
  <radialGradient id="nt-g-rosa" cx=".45" cy=".42" r=".62">
    <stop offset="0" stop-color="#E0686B"/><stop offset=".45" stop-color="#E07B78"/><stop offset=".78" stop-color="#C9665E"/><stop offset=".9" stop-color="#9A5F52"/><stop offset="1" stop-color="#5E2E20"/>
  </radialGradient>
  <linearGradient id="nt-g-loncha-lado" x1="0" y1="236" x2="0" y2="284" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#5A2A18"/><stop offset=".5" stop-color="#3A1A0E"/><stop offset="1" stop-color="#1E0D06"/>
  </linearGradient>
  <linearGradient id="nt-g-hoja" x1="0" y1="-2" x2="0" y2="2" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#6F8C4B"/><stop offset=".5" stop-color="#3F5A2A"/><stop offset="1" stop-color="#22341A"/>
  </linearGradient>
  <linearGradient id="nt-g-cuenco" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9A6038"/><stop offset=".35" stop-color="#7A4626"/><stop offset="1" stop-color="#3E2112"/>
  </linearGradient>
  <linearGradient id="nt-g-lino" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#C4B8A6"/><stop offset=".6" stop-color="#9E917F"/><stop offset="1" stop-color="#6E6354"/>
  </linearGradient>
  <linearGradient id="nt-g-cristal" x1="-34" y1="0" x2="34" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity=".65"/><stop offset=".07" stop-color="#C9D3D8" stop-opacity=".3"/>
    <stop offset=".22" stop-color="#FFFFFF" stop-opacity=".06"/><stop offset=".3" stop-color="#FFFFFF" stop-opacity=".5"/>
    <stop offset=".37" stop-color="#FFFFFF" stop-opacity=".08"/><stop offset=".8" stop-color="#8A5A3A" stop-opacity=".18"/>
    <stop offset=".94" stop-color="#3A2A22" stop-opacity=".35"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".55"/>
  </linearGradient>
  <linearGradient id="nt-g-acero" x1="-34" y1="0" x2="34" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#5C6067"/><stop offset=".12" stop-color="#B9BEC4"/><stop offset=".26" stop-color="#F6F7F8"/>
    <stop offset=".4" stop-color="#9DA2A8"/><stop offset=".62" stop-color="#4A4E55"/><stop offset=".82" stop-color="#8B7466"/>
    <stop offset=".93" stop-color="#C9CDD2"/><stop offset="1" stop-color="#6A6E75"/>
  </linearGradient>
  <radialGradient id="nt-g-cupula" cx="-14" cy="2" r="44" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset=".25" stop-color="#D3D7DC"/><stop offset=".55" stop-color="#8A8F96"/>
    <stop offset=".8" stop-color="#4E423B"/><stop offset="1" stop-color="#2E2724"/>
  </radialGradient>
  <linearGradient id="nt-g-sal" x1="-32" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#EEF0F2"/><stop offset="1" stop-color="#B9BFC7"/>
  </linearGradient>`;

/* --- Capa del fondo: mesa de madera y, desenfocados, un paño y dos cuencos --- */
function capaFondo() {
  const azar = semilla(7);
  const cuenco = (cx, cy, rx, ry, relleno) => `<g>
    <path d="M${cx - rx} ${cy} C ${cx - rx} ${cy + ry * 2.2}, ${cx + rx} ${cy + ry * 2.2}, ${cx + rx} ${cy} Z" fill="url(#nt-g-cuenco)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#8B532F"/>
    <ellipse cx="${cx}" cy="${cy + 1.5}" rx="${rx - 6}" ry="${ry - 4}" fill="#3A1F10"/>
    ${relleno}</g>`;
  const granosPimienta = motas({ n: 60, cx: 268, cy: 64, rx: 44, ry: 10, azar, pinta: (x, y) => `<circle cx="${x}" cy="${y}" r="${r1(1.6 + azar() * 1.6)}" fill="${azar() > .8 ? '#7A3A2A' : '#1A120C'}"/>` });
  return SVG(`
    <rect x="-400" y="-300" width="1600" height="920" fill="url(#nt-g-mesa)"/>
    <g filter="url(#nt-f-mesa)">
      <rect x="-400" y="-300" width="1600" height="920" filter="url(#nt-f-madera)"/>
      <rect x="-400" y="-300" width="1600" height="920" filter="url(#nt-f-veta)" opacity=".35"/>
      <path d="M-400 34 L1200 18 M-400 296 L1200 312 M-400 520 L1200 540" stroke="#1A0C05" stroke-width="2.5" opacity=".7"/>
      <path d="M-400 37 L1200 21 M-400 299 L1200 315" stroke="#A86E42" stroke-width="1" opacity=".35"/>
    </g>
    <rect x="-400" y="-300" width="1600" height="920" fill="url(#nt-g-luz-mesa)"/>
    <g filter="url(#nt-f-lejos)">
      <path d="M-80 -20 C 60 -30, 200 -24, 262 -6 C 300 20, 268 58, 196 70 C 120 84, 30 92, -80 112 Z" fill="url(#nt-g-lino)"/>
      <path d="M-40 30 C 60 18, 160 22, 240 8 M-60 70 C 40 56, 120 60, 200 50" stroke="#E2D8C8" stroke-width="5" opacity=".5" fill="none"/>
      <path d="M-40 44 C 60 32, 160 36, 236 22" stroke="#5E5446" stroke-width="5" opacity=".45" fill="none"/>
      <ellipse cx="146" cy="128" rx="74" ry="14" fill="#000" opacity=".4"/>
      ${cuenco(130, 106, 66, 19, `<path d="M${76} 108 C 100 92, 160 90, ${186} 106 C 160 116, 100 116, 76 108Z" fill="#F6F4F0"/><path d="M90 104 C 110 96, 150 95, 170 102" stroke="#FFFFFF" stroke-width="3" fill="none"/>`)}
      <ellipse cx="282" cy="80" rx="62" ry="12" fill="#000" opacity=".35"/>
      ${cuenco(266, 62, 54, 15, granosPimienta)}
    </g>`, DEFS);
}

/* --- Capa del plato: plato de gres, jugo, filete, loncha y romero --- */
function capaPlato() {
  const azar = semilla(3);
  const cortes = Array.from({ length: GROSOR / 2 }, (_, i) => `<use href="#nt-filete" y="${i * 2 + 2}"/>`).join('');
  const pimientaFilete = motas({ n: 170, cx: 424, cy: 148, rx: 158, ry: 44, azar, pinta: pimienta });
  const salFilete = motas({ n: 70, cx: 430, cy: 146, rx: 150, ry: 40, azar, pinta: sal })
    + motas({ n: 40, cx: 560, cy: 148, rx: 22, ry: 14, azar, pinta: sal }); // donde cae el chorro
  const pimientaPlato = motas({ n: 70, cx: 395, cy: 238, rx: 280, ry: 98, azar, pinta: (x, y, a) => (Math.abs(x - 400) < 190 && y < 230) ? '' : pimienta(x, y, a) });
  const salPlato = motas({ n: 26, cx: 470, cy: 250, rx: 230, ry: 60, azar, pinta: (x, y, a) => (y < 240 && x < 600) ? '' : sal(x, y, a) });
  return SVG(`
    <path id="nt-filete" d="${FILETE}" fill="none"/>
    <clipPath id="nt-c-cuerpo">${cortes}</clipPath>
    <clipPath id="nt-c-filete"><path d="${FILETE}"/></clipPath>
    <clipPath id="nt-c-loncha"><path d="${LONCHA_CARA}"/></clipPath>
    <clipPath id="nt-c-plato"><ellipse cx="395" cy="238" rx="306" ry="106"/></clipPath>

    <!-- Plato de gres mate con su sombra -->
    <ellipse cx="420" cy="262" rx="318" ry="112" fill="#120703" opacity=".55" filter="url(#nt-f-sombra-suave)"/>
    <ellipse cx="395" cy="240" rx="315" ry="112" fill="url(#nt-g-canto)"/>
    <ellipse cx="395" cy="237" rx="306" ry="106" fill="url(#nt-g-plato)"/>
    <ellipse cx="398" cy="242" rx="246" ry="80" fill="url(#nt-g-pozo)"/>
    <path d="M152 242 C 160 196, 260 164, 398 162" stroke="#B9AB95" stroke-width="3" opacity=".45" fill="none" filter="url(#nt-f-suave)"/>
    <path d="M644 242 C 636 290, 540 320, 398 322" stroke="#FFFFFF" stroke-width="3" opacity=".35" fill="none" filter="url(#nt-f-suave)"/>
    <g clip-path="url(#nt-c-plato)">
      <rect x="80" y="120" width="640" height="240" filter="url(#nt-f-grano-plato)" opacity=".18"/>
      <rect x="80" y="120" width="640" height="240" filter="url(#nt-f-moteado)" opacity=".9"/>
    </g>
    <path d="M92 214 C 110 170, 230 128, 395 125" stroke="#FFF8EE" stroke-width="2" opacity=".55" fill="none"/>
    ${pimientaPlato}${salPlato}

    <!-- Jugo brillante del filete -->
    <path d="M300 262 C 330 250, 420 252, 520 240 C 570 234, 600 226, 628 230 C 648 234, 644 250, 622 254 C 600 258, 610 268, 580 272 C 540 277, 470 272, 430 280 C 380 288, 330 282, 312 276 C 298 272, 292 268, 300 262 Z" fill="url(#nt-g-jugo)" opacity=".78"/>
    <path d="M566 248 C 600 244, 630 234, 642 240" stroke="#FFE0B0" stroke-width="1.6" opacity=".75" fill="none" stroke-linecap="round"/>
    <path d="M400 272 C 450 274, 500 272, 550 266" stroke="#FFD49A" stroke-width="1.2" opacity=".5" fill="none" stroke-linecap="round"/>
    <g fill="#FFF3E0" opacity=".8"><ellipse cx="592" cy="246" rx="2.4" ry="1.1"/><ellipse cx="470" cy="261" rx="1.6" ry=".8"/><ellipse cx="604" cy="238" rx="1.2" ry=".6"/></g>
    <g fill="#6A320F" opacity=".85"><ellipse cx="636" cy="250" rx="3" ry="1.3"/><ellipse cx="612" cy="262" rx="2" ry="1"/><ellipse cx="322" cy="266" rx="2.4" ry="1"/></g>

    <!-- Sombra del filete y del salero sobre el plato -->
    <ellipse cx="440" cy="244" rx="178" ry="22" fill="#1A0904" opacity=".6" filter="url(#nt-f-sombra)"/>

    <!-- Filete: el canto (extruido) y la costra encima -->
    <g clip-path="url(#nt-c-cuerpo)">
      <rect x="240" y="96" width="360" height="160" fill="url(#nt-g-lado)"/>
      <g transform="rotate(-8 420 210)"><rect x="220" y="150" width="400" height="110" filter="url(#nt-f-fibra)" opacity=".8"/></g>
      <g transform="rotate(-8 420 210)"><rect x="220" y="150" width="400" height="110" filter="url(#nt-f-fibra-clara)" opacity=".35"/></g>
      <rect x="240" y="96" width="360" height="160" fill="url(#nt-g-lado-luz)"/>
    </g>
    <g filter="url(#nt-f-costra)"><path d="${FILETE}" fill="url(#nt-g-costra)"/></g>
    <g clip-path="url(#nt-c-filete)">
      <rect x="250" y="96" width="350" height="110" filter="url(#nt-f-tostado)" opacity=".85"/>
      <path d="${FILETE}" fill="none" stroke="#1A0A04" stroke-width="6" opacity=".35" filter="url(#nt-f-suave)"/>
      <ellipse cx="560" cy="176" rx="50" ry="20" fill="#000" opacity=".25" filter="url(#nt-f-sombra)"/>
      ${pimientaFilete}${salFilete}
    </g>
    <path d="M260 140 C 264 120, 300 110, 360 106 C 420 101, 470 108, 520 104" stroke="#D29466" stroke-width="1.6" opacity=".5" fill="none" stroke-linecap="round" filter="url(#nt-f-suave)"/>
    <path d="M266 186 C 286 198, 330 199, 370 194 C 430 186, 500 192, 552 178" stroke="#A65A38" stroke-width="1.4" opacity=".55" fill="none"/>

    <!-- Loncha cortada: interior rosado con la fibra de la carne -->
    <ellipse cx="256" cy="282" rx="110" ry="10" fill="#1A0904" opacity=".55" filter="url(#nt-f-sombra)"/>
    <g filter="url(#nt-f-costra)"><path d="${LONCHA_LADO}" fill="url(#nt-g-loncha-lado)"/></g>
    <path d="${LONCHA_CARA}" fill="url(#nt-g-rosa)"/>
    <g clip-path="url(#nt-c-loncha)">
      <g transform="rotate(14 250 228)"><rect x="120" y="170" width="260" height="120" filter="url(#nt-f-fibra)" opacity=".6"/></g>
      <g transform="rotate(14 250 228)"><rect x="120" y="170" width="260" height="120" filter="url(#nt-f-fibra-clara)" opacity=".4"/></g>
      <path d="M180 214 C 220 210, 262 222, 300 220 M196 236 C 236 238, 270 232, 320 240" stroke="#F7C6BE" stroke-width="1" opacity=".45" fill="none"/>
      <path d="${LONCHA_CARA}" fill="none" stroke="#9A5747" stroke-width="16" opacity=".55" filter="url(#nt-f-suave)"/>
      <path d="${LONCHA_CARA}" fill="none" stroke="#2A1209" stroke-width="5"/>
      <ellipse cx="226" cy="214" rx="34" ry="3" fill="#FFFFFF" opacity=".08" filter="url(#nt-f-suave)"/>
      <ellipse cx="290" cy="226" rx="16" ry="2.2" fill="#FFFFFF" opacity=".2" filter="url(#nt-f-suave)"/>
    </g>
    ${romero()}`);
}

/* --- Capa del salero: cristal con sal dentro, tapa de acero perforada y la sal cayendo --- */
function capaSalero() {
  const azar = semilla(11);
  const agujeros = AGUJEROS.map(([x, y, rx, ry], i) => `
    <ellipse cx="${x}" cy="${y + .5}" rx="${rx + .35}" ry="${ry + .35}" fill="#E8EBEE" opacity=".55"/>
    <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#15171B" ${i === AGUJERO_HEROE ? 'class="nt-agujero"' : ''}/>
`).join('');
  // Granos cayendo desde los agujeros hasta la carne (se repiten en bucle)
  const chorro = Array.from({ length: 18 }, (_, i) => {
    const [x, y] = aMundo(...AGUJEROS[(i * 4) % AGUJEROS.length].slice(0, 2));
    const t = r1(.45 + azar() * .25), d = r1(-azar() * .8);
    return `<g class="nt-cae" style="--dx:${r1(azar() * 10 - 5)}px; --dy:${r1(70 + azar() * 18)}px; --g:${Math.floor(azar() * 300)}deg; --t:${t}s; --d:${d}s"
      transform="translate(${x} ${y})">${cubo(1 + azar() * .5)}</g>`;
  }).join('');
  const [hx, hy] = aMundo(AGUJEROS[AGUJERO_HEROE][0], AGUJEROS[AGUJERO_HEROE][1]);
  return SVG(`
    <g transform="translate(${SALERO.x} ${SALERO.y}) rotate(${SALERO.giro})">
      <g class="nt-sacude">
        <!-- Cuerpo de cristal: sal blanca dentro y reflejos encima -->
        <rect x="-32" y="-176" width="64" height="152" rx="13" fill="#FFFFFF" opacity=".08"/>
        <path d="M-31 -26 L31 -26 L31 -114 L22 -110 L10 -106 L-2 -101 L-14 -96 L-24 -90 L-31 -86 Z" fill="url(#nt-g-sal)"/>
        <path d="M-31 -26 L31 -26 L31 -114 L-31 -86 Z" filter="url(#nt-f-sal-dentro)" opacity=".7"/>
        <path d="M31 -114 L22 -110 L10 -106 L-2 -101 L-14 -96 L-24 -90 L-31 -86" stroke="#FFFFFF" stroke-width="2" fill="none"/>
        <rect x="-33" y="-176" width="66" height="152" rx="13" fill="url(#nt-g-cristal)"/>
        <rect x="-33" y="-176" width="66" height="152" rx="13" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.4"/>
        <rect x="-22" y="-168" width="5" height="136" rx="2.5" fill="#FFFFFF" opacity=".55" filter="url(#nt-f-suave)"/>
        <rect x="21" y="-160" width="2" height="120" rx="1" fill="#FFFFFF" opacity=".45"/>
        <!-- Tapa de acero: rosca y cúpula perforada -->
        <rect x="-35" y="-28" width="70" height="29" rx="3" fill="url(#nt-g-acero)"/>
        <rect x="-35" y="-28" width="70" height="29" rx="3" filter="url(#nt-f-cepillado)" opacity=".25"/>
        <g stroke-width=".9"><path d="M-35 -22 H35 M-35 -15 H35 M-35 -8 H35" stroke="#2E3237" opacity=".35"/><path d="M-35 -21 H35 M-35 -14 H35 M-35 -7 H35" stroke="#FFFFFF" opacity=".35"/></g>
        <path d="M-35 -27 H35" stroke="#FFFFFF" stroke-width="1" opacity=".7"/>
        <path d="M-34 0 C -34 13, -18 19, 0 19 C 18 19, 34 13, 34 0 Z" fill="url(#nt-g-cupula)"/>
        <path d="M-34 0 C -34 13, -18 19, 0 19 C 18 19, 34 13, 34 0" fill="none" stroke="#1E1A18" stroke-width=".8" opacity=".6"/>
        <path d="M-30 3 C -26 10, -16 13, -6 13.5" stroke="#FFFFFF" stroke-width="1.6" opacity=".55" fill="none" stroke-linecap="round"/>
        ${agujeros}
      </g>
    </g>
    <g class="nt-chorro">${chorro}</g>
    <g transform="translate(${hx} ${hy})"><g class="nt-heroe">${cubo(3)}</g></g>`);
}

/* --- Capa delantera: borde de una servilleta de lino, muy desenfocada --- */
function capaFrente() {
  return SVG(`<g filter="url(#nt-f-cerca)">
    <path d="M520 360 C 556 316, 640 292, 840 268 L 840 380 Z" fill="url(#nt-g-lino)"/>
    <path d="M520 360 C 556 316, 640 292, 840 268 L 840 380 Z" filter="url(#nt-f-lino)" opacity=".5"/>
    <path d="M560 340 C 600 312, 680 298, 840 284" stroke="#D9CEBC" stroke-width="6" opacity=".55" fill="none"/>
    <path d="M590 352 C 640 326, 720 316, 840 304" stroke="#5E5446" stroke-width="7" opacity=".4" fill="none"/></g>`);
}

const ESCENA = () => `
  <div class="nt-camara">
    <div class="nt-capa nt-fondo">${capaFondo()}</div>
    <div class="nt-capa nt-plato">${capaPlato()}</div>
    <div class="nt-capa nt-salero">${capaSalero()}</div>
    <div class="nt-capa nt-frente">${capaFrente()}</div>
  </div>
  <div class="nt-luz" aria-hidden="true"></div>
  <div class="nt-vineta" aria-hidden="true"></div>
  <div class="nt-destello" aria-hidden="true"></div>`;

const CSS = `
  .nt-intro { background: #3A1F10; }
  .nt-camara, .nt-capa, .nt-luz, .nt-vineta { position: absolute; inset: 0; pointer-events: none; }
  .nt-capa { will-change: transform, filter; }
  .nt-capa svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .nt-luz { background: radial-gradient(ellipse at 18% 0%, rgba(255, 214, 165, .32), rgba(255, 214, 165, 0) 60%); mix-blend-mode: screen; }
  .nt-vineta { background: radial-gradient(ellipse at 50% 45%, rgba(20, 8, 2, 0) 55%, rgba(20, 8, 2, .55) 100%); }
  .nt-destello {
    position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%;
    background: radial-gradient(circle, #FBF9F5 0 42%, rgba(244, 240, 232, .85) 56%, rgba(244, 240, 232, 0) 72%);
    opacity: 0; pointer-events: none; z-index: 4;
  }
  .nt-heroe { opacity: 0; transform-box: fill-box; transform-origin: center; }
  .nt-cae { animation: nt-cae var(--t) cubic-bezier(.45, 0, .9, .6) var(--d) infinite; }
  .nt-cae > g { transform-box: fill-box; transform-origin: center; animation: nt-gira var(--t) linear var(--d) infinite; }
  @keyframes nt-cae {
    0% { translate: 0 0; opacity: 0; }
    12%, 85% { opacity: 1; }
    100% { translate: var(--dx) var(--dy); opacity: 0; }
  }
  @keyframes nt-gira { to { rotate: var(--g); } }`;

/* ============================== ANIMACIÓN ============================== */
export async function introNutricion(cont) {
  if (sinMovimiento()) return;
  estilos('intro-nutricion', CSS);
  const { intro, saltada } = montar(cont, 'nt-intro', ESCENA());
  intro.setAttribute('aria-label', 'Un salero espolvorea sal sobre un filete y la cámara se acerca a su tapa');
  const $ = s => intro.querySelector(s);
  const capas = ['.nt-fondo', '.nt-plato', '.nt-salero', '.nt-frente'].map($);
  const camara = $('.nt-camara'), heroe = $('.nt-heroe'), destello = $('.nt-destello');
  const anim = (el, frames, ops) => el.animate(frames, { fill: 'forwards', easing: 'cubic-bezier(.5, 0, .2, 1)', ...ops }).finished;

  // El salero se sacude mientras cae la sal
  const sacudida = $('.nt-sacude').animate([
    { transform: 'translate(0, -40px) rotate(0deg) translate(0, 40px)' },
    { transform: 'translate(0, -40px) rotate(-5deg) translate(0, 34px)' },
    { transform: 'translate(0, -40px) rotate(3deg) translate(0, 42px)' },
    { transform: 'translate(0, -40px) rotate(0deg) translate(0, 40px)' },
  ], { duration: 260, iterations: Infinity });

  // Dónde está el agujero del que saldrá el grano (posición de reposo, antes de moverse nada)
  const caja = intro.getBoundingClientRect();
  const ag = $('.nt-agujero').getBoundingClientRect();
  const P = { x: ag.left + ag.width / 2 - caja.left, y: ag.top + ag.height / 2 - caja.top };
  const meta = { x: caja.width * .5, y: caja.height * .46 };
  // Profundidad de cada capa: escala final, cuánto se desplaza y cuánto se desenfoca
  const PROFUNDIDAD = [[1.6, .85, 6], [2.4, .95, 5], [4.2, 1, 0], [6, 1.2, 12]];

  await reproducir([
    // 1. Plano general: el salero espolvorea la carne
    () => espera(1050),
    // 2. Travelling hacia la tapa del salero, con paralaje entre capas y profundidad de campo
    () => {
      sacudida.effect.updateTiming({ iterations: Math.floor(sacudida.effect.getComputedTiming().currentIteration) + 1 });
      anim($('.nt-chorro'), [{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' });
      return Promise.all(capas.map((capa, i) => {
        const [s, k, b] = PROFUNDIDAD[i];
        capa.style.transformOrigin = `${P.x}px ${P.y}px`;
        return anim(capa, [
          { transform: 'translate(0, 0) scale(1)', filter: 'blur(0px)' },
          { transform: `translate(${(meta.x - P.x) * k}px, ${(meta.y - P.y) * k}px) scale(${s})`, filter: `blur(${b}px)` },
        ], { duration: 1450 });
      }));
    },
    // 3. Un grano asoma por el agujero
    () => anim(heroe, [
      { opacity: 0, transform: 'translate(0, -1.5px) scale(.4)' },
      { opacity: 1, transform: 'translate(0, 2.5px) scale(1)' },
    ], { duration: 340, easing: 'cubic-bezier(.2, .7, .3, 1)' }),
    // 4. Cae y la cámara lo sigue un poco hacia abajo
    () => Promise.all([
      anim(heroe, [
        { opacity: 1, transform: 'translate(0, 2.5px) rotate(0deg)' },
        { opacity: 1, transform: 'translate(0, 40px) rotate(80deg)' },
      ], { duration: 720, easing: 'cubic-bezier(.5, 0, .9, .55)' }),
      anim(camara, [{ transform: 'translateY(0)' }, { transform: `translateY(${-caja.height * .18}px)` }], { duration: 720, easing: 'cubic-bezier(.45, 0, .7, 1)' }),
    ]),
    // 5. Justo donde cae, un destello blanco crema se abre y da paso a la sección
    () => {
      const g = heroe.getBoundingClientRect();
      destello.style.left = `${g.left + g.width / 2 - caja.left}px`;
      destello.style.top = `${g.top + g.height / 2 - caja.top}px`;
      anim(heroe, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 150 });
      return anim(destello, [
        { opacity: 0, transform: 'scale(.4)' },
        { opacity: 1, transform: 'scale(1.6)', offset: .2 },
        { opacity: 1, transform: `scale(${Math.ceil(caja.width / 12)})` },
      ], { duration: 560, easing: 'cubic-bezier(.55, 0, .75, .35)' });
    },
    () => espera(120),
  ], saltada);

  sacudida.cancel();
  await cerrar(cont, intro);
}
