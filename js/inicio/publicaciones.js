// Publicaciones de la rueda: cada área de Lumen se pinta como una publicación
// (cabecera con su icono, una imagen o ilustración y tu dato real del día).
// Se dibujan en un <canvas> que luego la escena 3D usa como textura.
import { icono } from '../iconos.js';

export const ANCHO = 720, ALTO = 880;

// Las cinco áreas, con su color suave y su color de texto (de css/v2.css)
export const AREAS = [
  { id: 'salud', titulo: 'Salud', icono: 'salud', suave: '#DDE9DF', fuerte: '#3F6B51', ir: 'salud' },
  { id: 'calendario', titulo: 'Calendario', icono: 'calendario', suave: '#DCEAF7', fuerte: '#2F5D8A', ir: 'calendario' },
  { id: 'estudios', titulo: 'Estudios y trabajo', icono: 'estudios', suave: '#E7DFF7', fuerte: '#5B4B8A', ir: 'estudios' },
  { id: 'personal', titulo: 'Personal', icono: 'organizacion', suave: '#F3E1E5', fuerte: '#8A4B5C', ir: 'personal' },
  { id: 'imagen', titulo: 'Imagen', icono: 'imagen', suave: '#F6E8DA', fuerte: '#85603A', ir: 'imagen' },
];

const cacheIconos = new Map();
async function imagenIcono(nombre, color, grosor = 1.7) {
  const clave = `${nombre}|${color}|${grosor}`;
  if (cacheIconos.has(clave)) return cacheIconos.get(clave);
  const svg = icono(nombre)
    .replace('class="ico "', 'width="256" height="256"')
    .replace('stroke="currentColor"', `stroke="${color}"`)
    .replace('stroke-width="1.7"', `stroke-width="${grosor}"`);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const p = img.decode().then(() => img).catch(() => null);
  cacheIconos.set(clave, p);
  return p;
}

const redondo = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// Recorta el texto con "…" si no cabe
function encaja(ctx, texto, max) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Ilustración propia de cada área: formas suaves y el icono en grande
function ilustracion(ctx, area, x, y, w, h, ico) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, area.suave);
  ctx.fillStyle = g;
  redondo(ctx, x, y, w, h, 34); ctx.fill();
  ctx.save();
  redondo(ctx, x, y, w, h, 34); ctx.clip();
  // Círculos concéntricos, como ondas de luz: la "rueda" dentro de cada publicación
  ctx.strokeStyle = area.fuerte; ctx.globalAlpha = .08; ctx.lineWidth = 3;
  for (let r = 60; r < w; r += 46) { ctx.beginPath(); ctx.arc(x + w * .78, y + h * .2, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(x + w * .5, y + h * .5, h * .3, 0, Math.PI * 2); ctx.fill();
  if (ico) ctx.drawImage(ico, x + w * .5 - h * .2, y + h * .5 - h * .2, h * .4, h * .4);
  ctx.restore();
}

async function foto(blobUrl) {
  if (!blobUrl) return null;
  const img = new Image();
  img.src = blobUrl;
  try { await img.decode(); return img; } catch { return null; }
}

// Dibuja una publicación. "pub" = { area, dato, detalle, foto? }
export async function pintarPublicacion(pub, lienzo = document.createElement('canvas')) {
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  const { area } = pub;
  await document.fonts?.load('600 40px Sora').catch(() => {});
  const [ico, icoPeq, corazon, bocadillo, img] = await Promise.all([
    imagenIcono(area.icono, area.fuerte, 1.4),
    imagenIcono(area.icono, area.fuerte, 2),
    imagenIcono('salud', '#8E95A3', 2),
    imagenIcono('mas', '#8E95A3', 2),
    foto(pub.foto),
  ]);

  // Fondo del color del área y la publicación blanca encima
  ctx.fillStyle = area.suave; ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = '#FFFFFF'; redondo(ctx, 26, 26, ANCHO - 52, ALTO - 52, 44); ctx.fill();

  // Cabecera: avatar del área + nombre
  ctx.fillStyle = area.suave; ctx.beginPath(); ctx.arc(96, 100, 38, 0, Math.PI * 2); ctx.fill();
  if (icoPeq) ctx.drawImage(icoPeq, 71, 75, 50, 50);
  ctx.fillStyle = '#222B3D'; ctx.font = '600 38px Sora, sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText(encaja(ctx, area.titulo, ANCHO - 230), 152, 86);
  ctx.fillStyle = '#8E95A3'; ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText('Lumen · hoy', 152, 122);

  // Imagen: tu última foto (Imagen) o la ilustración del área
  const ix = 56, iy = 168, iw = ANCHO - 112, ih = 430;
  if (img) {
    ctx.save(); redondo(ctx, ix, iy, iw, ih, 34); ctx.clip();
    const k = Math.max(iw / img.width, ih / img.height);
    ctx.drawImage(img, ix + (iw - img.width * k) / 2, iy + (ih - img.height * k) / 2, img.width * k, img.height * k);
    ctx.restore();
  } else {
    ilustracion(ctx, area, ix, iy, iw, ih, ico);
  }

  // Tu dato real
  ctx.fillStyle = '#222B3D'; ctx.font = '600 44px Sora, sans-serif'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(encaja(ctx, pub.dato || area.titulo, ANCHO - 124), 60, 672);
  ctx.fillStyle = '#5B6475'; ctx.font = '400 30px Inter, sans-serif';
  ctx.fillText(encaja(ctx, pub.detalle || '', ANCHO - 124), 60, 716);

  // Pie: "me gusta", comentar y la píldora para entrar
  if (corazon) ctx.drawImage(corazon, 56, 760, 50, 50);
  if (bocadillo) ctx.drawImage(bocadillo, 120, 760, 50, 50);
  ctx.fillStyle = area.fuerte; redondo(ctx, ANCHO - 226, 756, 170, 58, 29); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.font = '600 26px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Entrar', ANCHO - 141, 786);
  ctx.textAlign = 'left';
  return lienzo;
}
