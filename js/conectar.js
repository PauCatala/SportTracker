// CONECTAR E INSTALAR: piezas comunes para que todo sea «a un toque».
//  - qrSVG(): QR para pasar del ordenador al móvil (escanear y listo).
//  - Plataforma: ¿iPhone?, ¿instalada?, ¿pantalla táctil?
//  - abrirInstalar(): instala SYNCO como app (Android/ordenador: un toque; iPhone: guía visual de 2 pasos).
import qrcode from '../vendor/qrcode.js';
import { ATAJOS } from './config.js';

/* ---------------- Plataforma ---------------- */
export const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAndroid = () => /Android/i.test(navigator.userAgent);
export const esMovil = () => esIOS() || esAndroid() || matchMedia('(pointer: coarse)').matches;
export const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esSafari = () => esIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent);

/* ---------------- QR ---------------- */
// Devuelve un SVG nítido a cualquier tamaño (sin imágenes, sin internet)
export function qrSVG(texto, { clase = '' } = {}) {
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount(), m = 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg class="qr ${clase}" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#1D2538"/></svg>`;
}

/* ---------------- Atajos del iPhone ya hechos ---------------- */
// Enlaces de iCloud de los Atajos compartidos (los creas una vez y los pegas en js/config.js)
export const atajoListo = clave => /^https:\/\/www\.icloud\.com\/shortcuts\/[A-Za-z0-9]+/.test(ATAJOS?.[clave] || '');
export const NOMBRES_ATAJO = { salud: 'SYNCO Salud', nota: 'Apuntar en SYNCO' };

// Copia tu dirección y abre el Atajo para añadirlo: al instalarse pregunta la dirección y solo hay que pegarla
export async function anadirAtajo(clave, direccion) {
  const copiada = await navigator.clipboard?.writeText(direccion).then(() => true, () => false);
  if (!copiada) prompt('Copia tu dirección: el Atajo te la pedirá al añadirlo', direccion);
  location.href = ATAJOS[clave];
}
// Ejecuta el Atajo ya instalado (abre la app Atajos un momento)
export const ejecutarAtajo = clave => { location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(NOMBRES_ATAJO[clave])}`; };

/* ---------------- Instalar SYNCO como app ---------------- */
let avisoInstalar = null;      // Android / Chrome / Edge: el navegador nos deja lanzar su ventana de instalar
addEventListener('beforeinstallprompt', e => { e.preventDefault(); avisoInstalar = e; dispatchEvent(new Event('synco:instalable')); });
addEventListener('appinstalled', () => { avisoInstalar = null; try { localStorage.setItem('synco-instalada', '1'); } catch { /* nada */ } });
export const puedeInstalarAlToque = () => !!avisoInstalar;

const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8.5 10.5H6.5a1.5 1.5 0 00-1.5 1.5v7a1.5 1.5 0 001.5 1.5h11a1.5 1.5 0 001.5-1.5v-7a1.5 1.5 0 00-1.5-1.5h-2"/></svg>';
const ICONO_MAS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>';

export function abrirInstalar() {
  if (document.querySelector('.ins')) return;
  const capa = document.createElement('div');
  capa.className = 'ins';
  const url = `${location.origin}/#instalar`;
  let cuerpo;
  if (instalada()) {
    cuerpo = `<h2>Ya la tienes instalada</h2><p>Estás usando SYNCO como app. Ábrela siempre desde su icono.</p>`;
  } else if (esIOS() && esSafari()) {
    cuerpo = `
      <h2>SYNCO en tu iPhone</h2>
      <p>Dos toques y la tendrás como una app más: a pantalla completa, con su icono y con avisos.</p>
      <ol class="ins-pasos">
        <li><span class="ins-ico">${ICONO_COMPARTIR}</span><div><b>Pulsa Compartir</b><small>El cuadrado con la flecha, en la barra de Safari</small></div></li>
        <li><span class="ins-ico">${ICONO_MAS}</span><div><b>«Añadir a pantalla de inicio»</b><small>Baja un poco en el menú si no lo ves</small></div></li>
      </ol>
      <div class="ins-flecha" aria-hidden="true"></div>`;
  } else if (esIOS()) {
    cuerpo = `
      <h2>Ábrela en Safari</h2>
      <p>En el iPhone, las apps web se instalan desde Safari. Copia el enlace, pégalo en Safari y pulsa Compartir → «Añadir a pantalla de inicio».</p>
      <button class="btn primario" data-copiar-enlace>Copiar enlace</button>`;
  } else if (avisoInstalar) {
    cuerpo = `
      <h2>Instala SYNCO</h2>
      <p>Tendrás SYNCO como una app más: con su icono, a pantalla completa y funcionando sin internet.</p>
      <button class="btn primario" data-instalar>Instalar</button>
      ${esMovil() ? '' : `<div class="ins-qr">${qrSVG(url)}<p><b>¿La quieres en el móvil?</b> Escanea con la cámara y sigue los pasos.</p></div>`}`;
  } else if (!esMovil()) {
    cuerpo = `
      <h2>SYNCO en tu móvil</h2>
      <p>Escanea este código con la cámara del iPhone o del Android y sigue los pasos: en un minuto la tienes como app.</p>
      <div class="ins-qr grande">${qrSVG(url)}</div>`;
  } else {
    cuerpo = `
      <h2>Instala SYNCO</h2>
      <p>Abre el menú del navegador (⋮) y pulsa <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</p>`;
  }
  capa.innerHTML = `<div class="ins-hoja" role="dialog" aria-modal="true" aria-label="Instalar SYNCO">
    <button class="ins-x" data-cerrar aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>
    <img class="ins-logo" src="icons/icon-180.png" alt="" width="72" height="72">
    ${cuerpo}
  </div>`;
  document.body.append(capa);
  requestAnimationFrame(() => capa.classList.add('ver'));
  const cerrar = () => { capa.classList.remove('ver'); setTimeout(() => capa.remove(), 250); };
  capa.addEventListener('click', async e => {
    if (e.target === capa || e.target.closest('[data-cerrar]')) return cerrar();
    if (e.target.closest('[data-instalar]') && avisoInstalar) {
      avisoInstalar.prompt();
      const { outcome } = await avisoInstalar.userChoice.catch(() => ({}));
      avisoInstalar = null;
      if (outcome === 'accepted') cerrar();
    }
    if (e.target.closest('[data-copiar-enlace]')) {
      await navigator.clipboard?.writeText(location.origin).catch(() => {});
      e.target.textContent = 'Enlace copiado';
    }
  });
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { cerrar(); removeEventListener('keydown', esc); } });
}

// ¿Enseñamos la invitación a instalar? Solo en el móvil, sin instalar y si no la has cerrado antes
export function sugerirInstalar() {
  if (instalada() || !esMovil()) return false;
  try { return !localStorage.getItem('synco-instalar-cerrado'); } catch { return true; }
}
export function noSugerirInstalar() { try { localStorage.setItem('synco-instalar-cerrado', String(Date.now())); } catch { /* nada */ } }

// Píldora discreta encima de la barra: aparece una vez en el móvil si aún no la has instalado
export function invitarInstalar() {
  if (!sugerirInstalar() || document.querySelector('.ins-invita')) return;
  setTimeout(() => {
    if (document.querySelector('.nr, .bv')) return;      // no molestar si hay otra ventana abierta
    const p = document.createElement('div');
    p.className = 'ins-invita';
    p.innerHTML = `<img src="icons/icon-180.png" alt="" width="34" height="34"><span><b>Instala SYNCO</b><small>Como una app, con su icono y avisos</small></span><button class="btn primario chico" data-ins>Instalar</button><button class="ins-invita-x" data-no aria-label="Ahora no">✕</button>`;
    document.body.append(p);
    requestAnimationFrame(() => p.classList.add('ver'));
    const quitar = () => { noSugerirInstalar(); p.classList.remove('ver'); setTimeout(() => p.remove(), 300); };
    p.onclick = e => {
      if (e.target.closest('[data-ins]')) { quitar(); abrirInstalar(); }
      if (e.target.closest('[data-no]')) quitar();
    };
  }, 4000);
}
