// Parámetros del avatar: qué se puede editar, valores por defecto y cómo se
// traducen a pesos de las deformaciones reales de MakeHuman.

export const VERSION = 1;

// Controles de cuerpo (de -1 a 1) y de rostro, con su nombre en la interfaz
export const CONTROLES_CUERPO = [
  ['hombros', 'Hombros'], ['espalda', 'Espalda en V'], ['torso', 'Ancho del torso'], ['largo-torso', 'Largo del torso'],
  ['cintura', 'Cintura'], ['abdomen', 'Abdomen'], ['caderas', 'Caderas'], ['gluteos', 'Glúteos'],
  ['brazos', 'Grosor de brazos'], ['largo-brazos', 'Largo de brazos'], ['piernas', 'Grosor de piernas'],
  ['largo-piernas', 'Largo de piernas'], ['cuello', 'Cuello'],
];

export const CONTROLES_ROSTRO = [
  ['Cabeza', [['cabeza-ancho', 'Ancho'], ['cabeza-alto', 'Alto'], ['frente', 'Frente']]],
  ['Mandíbula', [['mandibula', 'Ancho de mandíbula'], ['menton', 'Mentón'], ['menton-alto', 'Altura del mentón']]],
  ['Mejillas', [['pomulos', 'Pómulos'], ['mejillas', 'Volumen']]],
  ['Nariz', [['nariz-ancho', 'Ancho'], ['nariz-largo', 'Largo'], ['nariz-puente', 'Puente'], ['nariz-punta', 'Punta']]],
  ['Ojos', [['ojos-tamano', 'Tamaño'], ['ojos-apertura', 'Apertura'], ['ojos-separacion', 'Separación'], ['ojos-angulo', 'Ángulo']]],
  ['Cejas', [['cejas-altura', 'Altura'], ['cejas-angulo', 'Ángulo']]],
  ['Boca', [['labios', 'Labios'], ['boca-ancho', 'Ancho']]],
  ['Orejas', [['orejas', 'Tamaño']]],
];

export const FORMAS_CABEZA = [['', 'Natural'], ['oval', 'Ovalada'], ['round', 'Redonda'], ['square', 'Cuadrada'], ['triangular', 'Triangular']];

// Estructura facial de partida: mezclas de los tres modelos de referencia de MakeHuman
export const RASGOS = [
  ['Equilibrada', [1 / 3, 1 / 3, 1 / 3]],
  ['Estructura 1', [0.1, 0.1, 0.8]],
  ['Estructura 2', [0.1, 0.8, 0.1]],
  ['Estructura 3', [0.8, 0.1, 0.1]],
];

// Tonos de piel: textura de base + matiz. Del más claro al más oscuro.
export const TONOS_PIEL = [
  { id: 'porcelana', nombre: 'Porcelana', base: 'caucasian', tinte: '#fff2ec', muestra: '#f6dfd3' },
  { id: 'claro', nombre: 'Claro', base: 'caucasian', tinte: '#ffffff', muestra: '#eccbb6' },
  { id: 'beige', nombre: 'Beige', base: 'asian', tinte: '#ffffff', muestra: '#e2b996' },
  { id: 'miel', nombre: 'Miel', base: 'asian', tinte: '#e9c7a5', muestra: '#cf9f77' },
  { id: 'canela', nombre: 'Canela', base: 'african', tinte: '#ffd9bd', muestra: '#a9764f' },
  { id: 'bronce', nombre: 'Bronce', base: 'african', tinte: '#f1c09c', muestra: '#8c5c3b' },
  { id: 'cacao', nombre: 'Cacao', base: 'african', tinte: '#ffffff', muestra: '#6b4128' },
  { id: 'ebano', nombre: 'Ébano', base: 'african', tinte: '#c9a89a', muestra: '#4a2c1d' },
];

export const COLORES_PELO = [
  ['#1c1714', 'Negro'], ['#3b2a20', 'Castaño oscuro'], ['#6a4a32', 'Castaño'], ['#9a6b43', 'Castaño claro'],
  ['#c79a5e', 'Rubio oscuro'], ['#e3c58f', 'Rubio'], ['#a2462a', 'Pelirrojo'], ['#8d8d8d', 'Gris'], ['#e8e4dc', 'Blanco'],
  ['#c9b7e8', 'Lavanda'], ['#f2b8c6', 'Rosa'], ['#9fc7e8', 'Azul pastel'],
];

export const COLORES_OJOS = [
  ['brown', 'Marrón', '#5a3b22'], ['brownlight', 'Avellana', '#8a6236'], ['green', 'Verde', '#5d7a4a'],
  ['bluegreen', 'Azul verdoso', '#4f7d82'], ['blue', 'Azul', '#5a7fae'], ['deepblue', 'Azul intenso', '#2f4f8a'],
  ['grey', 'Gris', '#7d8790'], ['ice', 'Hielo', '#a9c3d6'],
];

// Paleta pastel de Lumen para la ropa (null = color original de la prenda)
export const PALETA_ROPA = [
  [null, 'Original'], ['#f7f7f5', 'Blanco'], ['#2b3142', 'Tinta'], ['#dce9df', 'Salvia'], ['#a9cbb3', 'Menta'],
  ['#dceaf7', 'Cielo'], ['#9fbfe0', 'Azul'], ['#e7dff7', 'Lavanda'], ['#bfaee6', 'Lila'], ['#f3e1e5', 'Rosa'],
  ['#e8b7c2', 'Rosa palo'], ['#f6e8da', 'Arena'], ['#e5c9a5', 'Camel'], ['#f6efc4', 'Vainilla'], ['#c9ccd3', 'Perla'],
];

export const PELOS = [
  ['ninguno', 'Rapado'], ['short02', 'Corto clásico'], ['short01', 'Corto texturizado'], ['short03', 'Corto con volumen'],
  ['short04', 'Muy corto'], ['afro01', 'Afro'], ['bob01', 'Bob'], ['bob02', 'Bob liso'], ['long01', 'Largo'],
  ['ponytail01', 'Coleta'], ['braid01', 'Trenza'],
];

export const CEJAS = [['001', 'Naturales'], ['002', 'Finas'], ['006', 'Rectas'], ['009', 'Pobladas'], ['010', 'Arqueadas'], ['012', 'Suaves']];

export const BARBAS = [
  ['ninguna', 'Sin barba'], ['sombra', 'Sombra'], ['corta', 'Barba corta'], ['completa', 'Barba completa'],
  ['perilla', 'Perilla'], ['bigote', 'Bigote'], ['candado', 'Bigote y perilla'],
];

// Prendas por ranura. Los conjuntos de MakeHuman se separan en parte de arriba y de abajo.
export const PRENDAS = {
  arriba: [
    ['male_casualsuit06-arriba', 'Camiseta básica'], ['male_casualsuit04-arriba', 'Camiseta'], ['male_casualsuit02-arriba', 'Manga larga'],
    ['male_casualsuit03-arriba', 'Camisa'], ['male_casualsuit05-arriba', 'Chaqueta y camisa'], ['male_elegantsuit01-arriba', 'Americana'],
    ['female_casualsuit01-arriba', 'Camiseta entallada'], ['female_sportsuit01-arriba', 'Top deportivo'], ['female_elegantsuit01-arriba', 'Blusa'],
  ],
  abajo: [
    ['male_casualsuit06-abajo', 'Vaqueros'], ['male_elegantsuit01-abajo', 'Pantalón de traje'], ['female_casualsuit02-abajo', 'Shorts'],
    ['female_sportsuit01-abajo', 'Mallas'], ['female_elegantsuit01-abajo', 'Falda'], ['female_casualsuit01-abajo', 'Vaqueros pitillo'],
  ],
  conjunto: [['male_worksuit01', 'Peto de trabajo'], ['male_casualsuit01', 'Camisa y vaqueros']],
  calzado: [['shoes06', 'Zapatillas'], ['shoes05', 'Zapatillas blancas'], ['shoes02', 'Deportivas'], ['shoes04', 'Zapatos'], ['shoes01', 'Náuticos'], ['shoes03', 'Botas'], ['', 'Descalzo']],
  sombrero: [['', 'Ninguno'], ['fedora01', 'Sombrero'], ['fedora_cocked', 'Sombrero ladeado']],
};

const BASE_COMUN = {
  v: VERSION,
  musculo: 0.5, grasa: 0.5, altura: 0.5, proporciones: 0.5, pecho: 0.5,
  rasgos: [1 / 3, 1 / 3, 1 / 3],
  forma: {}, rostro: { forma: '' },
  tono: 'claro', ojos: 'brown', pestanas: '01',
};

export const PERFILES = {
  hombre: {
    ...BASE_COMUN, genero: 1, nombre: 'Base masculina',
    cejas: '009',
    pelo: { estilo: 'short02', color: '#4a3426' },
    barba: { estilo: 'ninguna', color: '#4a3426' },
    ropa: { arriba: 'male_casualsuit06-arriba', abajo: 'male_casualsuit06-abajo', conjunto: '', calzado: 'shoes06', sombrero: '', colores: { arriba: '#dceaf7', abajo: '#2b3142', calzado: '#f7f7f5' } },
  },
  mujer: {
    ...BASE_COMUN, genero: 0, nombre: 'Base femenina', pecho: 0.5,
    cejas: '010',
    pelo: { estilo: 'ponytail01', color: '#6a4a32' },
    barba: { estilo: 'ninguna', color: '#3b2a20' },
    ropa: { arriba: 'female_casualsuit01-arriba', abajo: 'female_sportsuit01-abajo', conjunto: '', calzado: 'shoes05', sombrero: '', colores: { arriba: '#e7dff7', abajo: '#2b3142', calzado: '#f7f7f5' } },
  },
};

export const PERFIL_BASE = PERFILES.hombre;

const lim = (x, a, b, d) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d);

// Acepta datos guardados (o incompletos) y devuelve un perfil válido
export function normalizar(p = {}) {
  const base = PERFILES[(p.genero ?? 1) < 0.5 ? 'mujer' : 'hombre'];
  const o = structuredClone(base);
  if (!p || typeof p !== 'object') return o;
  for (const k of ['genero', 'musculo', 'grasa', 'altura', 'proporciones', 'pecho']) o[k] = lim(p[k], 0, 1, o[k]);
  if (Array.isArray(p.rasgos) && p.rasgos.length === 3) {
    const s = p.rasgos.reduce((a, b) => a + Math.max(0, +b || 0), 0);
    if (s > 0) o.rasgos = p.rasgos.map(x => Math.max(0, +x || 0) / s);
  }
  for (const [k] of CONTROLES_CUERPO) if (p.forma?.[k] != null) o.forma[k] = lim(p.forma[k], -1, 1, 0);
  for (const [, lista] of CONTROLES_ROSTRO) for (const [k] of lista) if (p.rostro?.[k] != null) o.rostro[k] = lim(p.rostro[k], -1, 1, 0);
  if (FORMAS_CABEZA.some(([k]) => k === p.rostro?.forma)) o.rostro.forma = p.rostro.forma;
  o.rostro.formaPeso = lim(p.rostro?.formaPeso, 0, 1, 0.6);
  if (TONOS_PIEL.some(t => t.id === p.tono)) o.tono = p.tono;
  if (COLORES_OJOS.some(([k]) => k === p.ojos)) o.ojos = p.ojos;
  if (p.cejas === '' || CEJAS.some(([k]) => k === p.cejas)) o.cejas = p.cejas;
  if (p.pelo) {
    if (PELOS.some(([k]) => k === p.pelo.estilo)) o.pelo.estilo = p.pelo.estilo;
    if (/^#[0-9a-f]{6}$/i.test(p.pelo.color || '')) o.pelo.color = p.pelo.color;
  }
  if (p.barba) {
    if (BARBAS.some(([k]) => k === p.barba.estilo)) o.barba.estilo = p.barba.estilo;
    if (/^#[0-9a-f]{6}$/i.test(p.barba.color || '')) o.barba.color = p.barba.color;
  }
  if (p.ropa) {
    for (const r of Object.keys(PRENDAS)) {
      if (p.ropa[r] === '' || PRENDAS[r].some(([k]) => k === p.ropa[r])) o.ropa[r] = p.ropa[r];
    }
    o.ropa.colores = {};
    for (const r of ['arriba', 'abajo', 'conjunto', 'calzado', 'sombrero']) {
      const c = p.ropa.colores?.[r];
      if (/^#[0-9a-f]{6}$/i.test(c || '')) o.ropa.colores[r] = c;
    }
  }
  if (typeof p.nombre === 'string') o.nombre = p.nombre.slice(0, 40);
  return o;
}

// Ranuras de ropa que hay que montar (un conjunto sustituye a arriba y abajo)
export function RECURSOS_ROPA(p) {
  const conj = p.ropa.conjunto || null;
  return {
    conjunto: conj,
    arriba: conj ? null : p.ropa.arriba || null,
    abajo: conj ? null : p.ropa.abajo || null,
    calzado: p.ropa.calzado || null,
    sombrero: p.ropa.sombrero || null,
  };
}

export function tonoPiel(p) {
  const t = TONOS_PIEL.find(x => x.id === p.tono) || TONOS_PIEL[1];
  const g = p.genero >= 0.5 ? 'male' : 'female';
  return { textura: `young_${t.base}_${g}`, tinte: t.tinte };
}

// Reparto en tres (mín/medio/máx) como en MakeHuman
function tres(x) {
  return x < 0.5 ? [1 - 2 * x, 2 * x, 0] : [0, 2 - 2 * x, 2 * x - 1];
}

// Devuelve [[idMorfo, peso], ...]
export function pesosMorfos(p) {
  const out = [];
  const gen = [['female', 1 - p.genero], ['male', p.genero]];
  const mus = tres(p.musculo), gra = tres(p.grasa);
  const M = ['minmuscle', 'averagemuscle', 'maxmuscle'], W = ['minweight', 'averageweight', 'maxweight'];
  for (const [g, wg] of gen) {
    if (!wg) continue;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const w = wg * mus[i] * gra[j];
      if (w) out.push([`u-${g}-${M[i]}-${W[j]}`, w]);
    }
    ['african', 'asian', 'caucasian'].forEach((r, k) => out.push([`r-${r}-${g}`, wg * p.rasgos[k]]));
    // La altura de MakeHuman llega a extremos poco realistas: se acota a ~1,25–2,0 m
    const alt = p.altura < 0.5 ? 0.5 - (0.5 - p.altura) * 0.9 : 0.5 + (p.altura - 0.5) * 0.39;
    const h = tres(alt);
    if (h[0]) out.push([`h-${g}-minheight`, wg * h[0]]);
    if (h[2]) out.push([`h-${g}-maxheight`, wg * h[2]]);
    const pr = tres(p.proporciones);
    if (pr[0]) out.push([`p-${g}-uncommonproportions`, wg * pr[0]]);
    if (pr[2]) out.push([`p-${g}-idealproportions`, wg * pr[2]]);
  }
  const fem = 1 - p.genero, c = tres(p.pecho);
  if (fem && c[0]) out.push(['pecho-mincup', fem * c[0]]);
  if (fem && c[2]) out.push(['pecho-maxcup', fem * c[2]]);
  const par = (k, v) => { if (v > 0) out.push([`${k}+`, v]); else if (v < 0) out.push([`${k}-`, -v]); };
  for (const [k, v] of Object.entries(p.forma)) par(k, v);
  for (const [k, v] of Object.entries(p.rostro)) if (k !== 'forma' && k !== 'formaPeso') par(k, v);
  if (p.rostro.forma) out.push([`forma-${p.rostro.forma}`, p.rostro.formaPeso ?? 0.6]);
  return out;
}
