// Publicaciones de la rueda: cada área de Lumen es un "post" minimalista
// (tu usuario, una imagen de la sección, interacciones y el nombre del área como pie).
// Se dibujan en un <canvas> que la escena 3D usa como textura.

export const ANCHO = 720, ALTO = 880;

// Las cinco áreas: color suave (fondos) y fuerte (acentos mínimos)
export const AREAS = [
  { id: 'salud', titulo: 'Salud', icono: 'salud', suave: '#DDE9DF', fuerte: '#3F6B51', ir: 'salud', frase: 'Moverse, comer bien, descansar.' },
  { id: 'calendario', titulo: 'Calendario', icono: 'calendario', suave: '#DCEAF7', fuerte: '#2F5D8A', ir: 'calendario', frase: 'Tu tiempo, en orden.' },
  { id: 'estudios', titulo: 'Estudios y trabajo', icono: 'estudios', suave: '#E7DFF7', fuerte: '#5B4B8A', ir: 'estudios', frase: 'Concentración sin ruido.' },
  { id: 'personal', titulo: 'Personal', icono: 'organizacion', suave: '#F3E1E5', fuerte: '#8A4B5C', ir: 'personal', frase: 'Conócete. Crece.' },
  { id: 'imagen', titulo: 'Imagen', icono: 'imagen', suave: '#F6E8DA', fuerte: '#85603A', ir: 'imagen', frase: 'Cómo te ves, cómo te muestras.' },
];

const IMAGENES = { salud: 'salud', estudios: 'estudios', personal: 'personal', imagen: 'imagen' };
const RUTA = new URL('../../media/posts/', import.meta.url).href;
const TINTA = '#222B3D', GRIS = '#8E95A3', FONDO = '#F4F5F5';

const redondo = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function encaja(ctx, texto, max) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const cache = new Map();
function cargar(nombre) {
  if (!cache.has(nombre)) {
    const img = new Image();
    img.src = `${RUTA}${nombre}.webp`;
    cache.set(nombre, img.decode().then(() => img).catch(() => null));
  }
  return cache.get(nombre);
}

// ---------- Iconos de línea fina, dibujados a mano ----------
function trazo(ctx, fn) { ctx.save(); ctx.strokeStyle = TINTA; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); fn(); ctx.stroke(); ctx.restore(); }
const ICONOS = {
  corazon: (ctx, x, y) => trazo(ctx, () => {
    ctx.moveTo(x, y + 12);
    ctx.bezierCurveTo(x - 22, y - 2, x - 13, y - 20, x, y - 9);
    ctx.bezierCurveTo(x + 13, y - 20, x + 22, y - 2, x, y + 12);
  }),
  comentario: (ctx, x, y) => trazo(ctx, () => {
    ctx.arc(x, y, 14, Math.PI * 0.72, Math.PI * 2.62);
    ctx.lineTo(x - 15, y + 15); ctx.closePath();
  }),
  enviar: (ctx, x, y) => trazo(ctx, () => {
    ctx.moveTo(x - 15, y - 12); ctx.lineTo(x + 15, y - 12); ctx.lineTo(x, y + 15); ctx.lineTo(x - 3, y - 1); ctx.closePath();
    ctx.moveTo(x - 3, y - 1); ctx.lineTo(x + 15, y - 12);
  }),
  guardar: (ctx, x, y) => trazo(ctx, () => {
    ctx.moveTo(x - 11, y - 14); ctx.lineTo(x + 11, y - 14); ctx.lineTo(x + 11, y + 14); ctx.lineTo(x, y + 5); ctx.lineTo(x - 11, y + 14); ctx.closePath();
  }),
};

// ---------- Imagen de Calendario: widget dibujado con la fecha real ----------
function calendario(ctx, x, y, w, h) {
  ctx.fillStyle = '#F1F1EF'; ctx.fillRect(x, y, w, h);
  const cw = w * 0.76, ch = h * 0.78, cx = x + (w - cw) / 2, cy = y + (h - ch) / 2;
  // sombra suave del widget
  ctx.save(); ctx.shadowColor = 'rgba(34,43,61,.14)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  g.addColorStop(0, '#D3D4D7'); g.addColorStop(1, '#AEB0B4');
  ctx.fillStyle = g; redondo(ctx, cx, cy, cw, ch, 48); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; redondo(ctx, cx + .75, cy + .75, cw - 1.5, ch - 1.5, 48); ctx.stroke();
  const p = cw * 0.075;
  // pestañas Semana / Mes
  ctx.fillStyle = 'rgba(255,255,255,.18)'; redondo(ctx, cx + p, cy + p, cw * 0.62, 50, 25); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; redondo(ctx, cx + p + 4, cy + p + 4, cw * 0.31 - 4, 42, 21); ctx.fill();
  ctx.font = '500 21px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3D4A3C'; ctx.fillText('Semana', cx + p + cw * 0.155, cy + p + 25);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('Mes', cx + p + cw * 0.465, cy + p + 25);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(cx + cw - p - 25, cy + p + 25, 25, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + cw - p - 25, cy + p + 25, 7, 0, Math.PI * 2); ctx.stroke();
  // mes y día
  const hoy = new Date();
  const mes = hoy.toLocaleDateString('es-ES', { month: 'long' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#FFFFFF';
  ctx.font = '300 74px Sora, Inter, sans-serif';
  ctx.fillText(mes[0].toUpperCase() + mes.slice(1), cx + p, cy + ch * 0.47);
  ctx.textAlign = 'right'; ctx.fillText(String(hoy.getDate()), cx + cw - p, cy + ch * 0.47);
  // semana
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const paso = (cw - p * 2) / 7;
  ctx.textAlign = 'center';
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((l, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i);
    const mx = cx + p + paso * (i + 0.5);
    ctx.font = '400 19px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(l, mx, cy + ch * 0.62);
    const esHoy = d.toDateString() === hoy.toDateString();
    if (esHoy) {
      ctx.save(); ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFFFFF'; redondo(ctx, mx - 27, cy + ch * 0.665, 54, 58, 14); ctx.fill(); ctx.restore();
    }
    ctx.font = '400 30px Inter, sans-serif'; ctx.fillStyle = esHoy ? '#3D4A3C' : '#FFFFFF';
    ctx.fillText(String(d.getDate()), mx, cy + ch * 0.665 + 40);
  });
  // pie
  ctx.textAlign = 'left'; ctx.font = '400 19px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText('Añadir recordatorio', cx + p, cy + ch - p * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; redondo(ctx, cx + cw - p - 168, cy + ch - p * 0.9 - 30, 168, 46, 23); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText('+  Nuevo evento', cx + cw - p - 84, cy + ch - p * 0.9 - 7);
  ctx.textAlign = 'left';
}

// Dibuja una publicación. pub = { area, dato, detalle, usuario }
export async function pintarPublicacion(pub, lienzo = document.createElement('canvas')) {
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  const { area } = pub;
  const usuario = (pub.usuario || 'tú').toLowerCase().replace(/\s+/g, '');
  await Promise.all([
    document.fonts?.load('600 28px Sora').catch(() => {}),
    document.fonts?.load('300 74px Sora').catch(() => {}),
  ]);
  const img = IMAGENES[area.id] ? await cargar(IMAGENES[area.id]) : null;

  // Fondo de la publicación
  ctx.fillStyle = FONDO; ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = '#FFFFFF'; redondo(ctx, 14, 14, ANCHO - 28, ALTO - 28, 30); ctx.fill();

  // Cabecera: tu perfil y el menú
  const g = ctx.createLinearGradient(42, 40, 98, 96);
  g.addColorStop(0, area.suave); g.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(70, 66, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(34,43,61,.08)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = TINTA; ctx.font = '600 24px Sora, Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(usuario[0].toUpperCase(), 70, 67);
  ctx.textAlign = 'left'; ctx.font = '600 26px Inter, sans-serif';
  ctx.fillText(encaja(ctx, usuario, 460), 112, 66);
  ctx.fillStyle = TINTA;
  for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.arc(658 + dx, 66, 3.2, 0, Math.PI * 2); ctx.fill(); }

  // Imagen principal
  const ix = 30, iy = 110, iw = ANCHO - 60, ih = 552;
  ctx.save(); redondo(ctx, ix, iy, iw, ih, 22); ctx.clip();
  if (area.id === 'calendario') calendario(ctx, ix, iy, iw, ih);
  else if (img) {
    const k = Math.max(iw / img.width, ih / img.height);
    ctx.drawImage(img, ix + (iw - img.width * k) / 2, iy + (ih - img.height * k) / 2, img.width * k, img.height * k);
  } else { ctx.fillStyle = area.suave; ctx.fillRect(ix, iy, iw, ih); }
  ctx.restore();

  // Interacciones
  ICONOS.corazon(ctx, 60, 706);
  ICONOS.comentario(ctx, 118, 704);
  ICONOS.enviar(ctx, 176, 704);
  ICONOS.guardar(ctx, 660, 704);
  // puntos del carrusel, discretos
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 1 ? area.fuerte : 'rgba(34,43,61,.18)'; ctx.beginPath(); ctx.arc(342 + i * 18, 704, 4, 0, Math.PI * 2); ctx.fill(); }

  // Dato del día (en el lugar de los "me gusta"), usuario + sección y una frase
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = TINTA;
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText(encaja(ctx, pub.dato || area.titulo, ANCHO - 90), 44, 768);
  ctx.font = '600 25px Inter, sans-serif';
  ctx.fillText(usuario, 44, 808);
  const ancho = ctx.measureText(`${usuario} `).width;
  ctx.font = '400 25px Inter, sans-serif';
  ctx.fillText(area.titulo, 44 + ancho, 808);
  ctx.fillStyle = GRIS; ctx.font = '400 21px Inter, sans-serif';
  ctx.fillText(encaja(ctx, pub.detalle || area.frase, ANCHO - 90), 44, 842);
  return lienzo;
}
