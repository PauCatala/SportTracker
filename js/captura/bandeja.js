// BANDEJA DEL IPHONE: lo que escribes en el Atajo «Apuntar en SYNCO» (widget, Siri, pantalla de bloqueo…)
// llega aquí sin abrir la app (api/nota.js lo guarda en la tabla notas_entrada).
// Al abrir SYNCO, cada nota pendiente se entiende con el mismo «cerebro» que la nota rápida y se apunta
// donde toca: calendario, tareas, tu lista, lista de la compra, gimnasio o running. Queda en «Mis notas».
import { supabase, state } from '../db.js';
import { analizar, buscarEjercicio } from './analizar.js';
import { aplicar, guardarNota } from './nota.js';
import { aviso, esErrorDeRed } from '../utils.js';
import { escapar } from '../almacen.js';
import { codigoAtajo } from '../salud/reloj.js';

let enCurso = null;
let ultima = 0;

// Fecha y hora (de este dispositivo) de cuando escribiste la nota: «mañana» es mañana respecto a ESE momento
const fechaLocal = d => d.toLocaleDateString('sv-SE');
const horaLocal = d => d.toTimeString().slice(0, 5);

export function procesarBandeja({ forzar = false } = {}) {
  if (enCurso) return enCurso;
  if (!forzar && Date.now() - ultima < 20000) return Promise.resolve(0);
  ultima = Date.now();
  enCurso = (async () => {
    const { data: pendientes, error } = await supabase.from('notas_entrada').select('id, texto, creada').is('procesada', null).order('creada').limit(50);
    if (error || !pendientes?.length) return 0;
    const resumen = [];
    let revisar = 0;
    for (const nota of pendientes) {
      // La marcamos como nuestra antes de nada: si tienes SYNCO abierta en dos sitios, solo uno la apunta
      const { data: mia } = await supabase.from('notas_entrada').update({ procesada: new Date().toISOString() }).eq('id', nota.id).is('procesada', null).select('id');
      if (!mia?.length) continue;
      const cuando = new Date(nota.creada);
      let acciones = analizar(nota.texto, { hoy: fechaLocal(cuando), ahora: horaLocal(cuando), ejercicios: state.ejercicios || [] });
      // Gimnasio: si no se reconoce el ejercicio, se guarda como nota para que lo revises
      acciones = acciones.map(a => {
        if (a.tipo !== 'gym' || a.ejercicio) return a;
        const ej = a.nombreLeido ? buscarEjercicio(a.nombreLeido, state.ejercicios || []) : null;
        return ej ? { ...a, ejercicio: { id: ej.id, nombre: ej.nombre } } : { tipo: 'nota', texto: a.texto };
      });
      const utiles = acciones.filter(a => a.tipo !== 'nota');
      try {
        const hechos = utiles.length ? await aplicar(utiles) : [];
        const dudosa = acciones.some(a => a.tipo === 'nota');
        if (dudosa) revisar++;
        guardarNota(nota.texto, hechos, { desde: 'iphone', creada: nota.creada, ...(dudosa ? { revisar: true } : {}) });
        resumen.push(...hechos);
      } catch (e) {
        if (esErrorDeRed(e)) {            // sin conexión: la devolvemos a la bandeja y seguimos otro rato
          await supabase.from('notas_entrada').update({ procesada: null }).eq('id', nota.id);
          break;
        }
        console.warn('Bandeja', e);
        revisar++;
        guardarNota(nota.texto, [], { desde: 'iphone', creada: nota.creada, revisar: true });
      }
    }
    if (resumen.length || revisar) {
      aviso(`Desde el iPhone: ${resumen.length ? resumen.slice(0, 3).join(' · ') + (resumen.length > 3 ? ` y ${resumen.length - 3} más` : '') : ''}${revisar ? `${resumen.length ? ' · ' : ''}${revisar} ${revisar === 1 ? 'nota' : 'notas'} para revisar en Mis notas` : ''}`);
      dispatchEvent(new Event('synco:datos'));
    }
    return pendientes.length;
  })().catch(e => { console.warn('Bandeja', e); return 0; }).finally(() => { enCurso = null; });
  return enCurso;
}

// Al volver a SYNCO (desbloquear el móvil, cambiar de app…) se mira si ha llegado algo
export function vigilarBandeja() {
  procesarBandeja({ forzar: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') procesarBandeja(); });
  addEventListener('focus', () => procesarBandeja());
}

/* ---------------- Guía: el Atajo «Apuntar en SYNCO» ---------------- */
const PASOS = [
  ['Crea el Atajo', 'App <b>Atajos</b> → pestaña <b>Atajos</b> → <b>+</b>. Llámalo <b>Apuntar en SYNCO</b>.'],
  ['Pide el texto', 'Añade <b>Pedir entrada</b> (tipo <b>Texto</b>). En la pregunta escribe <b>¿Qué apunto?</b>'],
  ['Envíalo a SYNCO', 'Añade <b>Obtener contenido de URL</b>: pega tu dirección, <b>Método: POST</b>, <b>Cuerpo de la solicitud: JSON</b> y un campo <code>texto</code> (tipo Texto) con <b>Entrada proporcionada</b>.'],
  ['Que te confirme', 'Añade <b>Mostrar notificación</b> con <b>Contenido de la URL</b>. Te dirá dónde lo ha apuntado, por ejemplo <i>«📅 Dentista · lun 26 abr, 17:00»</i>.'],
  ['Ponlo a mano', 'Mantén pulsada la pantalla de inicio → <b>Editar</b> → <b>Añadir widget</b> → <b>Atajos</b> → elige <b>Apuntar en SYNCO</b>. Con iOS 18 también puedes ponerlo en el <b>Centro de control</b> y en la <b>pantalla de bloqueo</b>.'],
  ['Más rápido aún', 'Di <b>«Oye Siri, apuntar en SYNCO»</b>, o en Ajustes → Accesibilidad → Tocar → <b>Tocar atrás</b> → doble toque → Apuntar en SYNCO: dos golpecitos en la espalda del móvil y a escribir.'],
];
const FRASES = ['Lista de la compra: leche, huevos y pan', 'Dentista 26 abril a las 17', 'Entregar la práctica el viernes, urgente', 'Mañana a las 9 reunión con David', 'He corrido 8 km en 42 min', 'Llamar al seguro'];

export async function pintarGuiaIphone(cont) {
  const { esIOS, esMovil, qrSVG, atajoListo, anadirAtajo } = await import('../conectar.js');
  cont.innerHTML = '<p class="nr-titulo">Cargando…</p>';
  let token = null;
  try { token = await codigoAtajo(); } catch (e) { console.warn(e); }
  const url = token ? `${location.origin}/api/nota?t=${token}` : null;
  const listo = atajoListo('nota'), iphone = esIOS(), movil = esMovil();
  const guia = `<ol class="nr-ip-pasos">${PASOS.map(([t, x]) => `<li><b>${t}</b><p>${x}</p></li>`).join('')}</ol>`;
  cont.innerHTML = `
    <div class="nr-ip">
      <div class="nr-ip-hero">
        <div class="nr-ip-widget" aria-hidden="true"><span>Apuntar en SYNCO</span><i>¿Qué apunto?</i></div>
        <p>Escribe desde un <b>widget</b> de tu pantalla de inicio, sin abrir SYNCO. <i>«Dentista 26 abril a las 17»</i> se apunta en el calendario y <i>«compra: leche, huevos»</i> va a tu lista.</p>
      </div>
      ${!url ? '<p class="nr-aviso">Entra en tu cuenta para activarlo.</p>'
        : !movil ? `<div class="nr-ip-qr">${qrSVG(`${location.origin}/#nota-iphone`)}<p><b>Escanéalo con el iPhone</b> y pulsa «Añadir a mi iPhone».</p></div>`
        : !iphone ? '<p class="nr-aviso">Los widgets con Atajos son del iPhone. En Android, mantén pulsado el icono de SYNCO y elige «Nota rápida».</p>'
        : listo ? `<button class="btn primario nr-ip-boton" type="button" data-anadir-nota>Añadir a mi iPhone</button>
          <p class="nr-ip-pie">Se abrirá Atajos: pulsa <b>Añadir atajo</b> y, cuando te pida la dirección, <b>pega</b> (ya está copiada). Después, mantén pulsada la pantalla de inicio → <b>Editar</b> → <b>Añadir widget</b> → <b>Atajos</b>.</p>`
        : `<p class="nr-ip-pie">La versión de un toque llega muy pronto. Mientras, puedes montarlo tú:</p>
          <div class="nr-ip-url"><span>Tu dirección (es secreta)</span><code>${escapar(url.replace(/t=(.{6}).+$/, 't=$1••••••••'))}</code><button class="btn primario chico" type="button" data-copiar-nota>Copiar dirección</button></div>
          ${guia}`}
      <p class="nr-titulo">Prueba con frases como</p>
      <div class="nr-ejemplos nr-ip-frases">${FRASES.map(f => `<span>${escapar(f)}</span>`).join('')}</div>
      <p class="nr-ip-pie">También funciona con Siri: <b>«Oye Siri, apuntar en SYNCO»</b>.</p>
    </div>`;
  cont.onclick = async e => {
    if (e.target.closest('[data-anadir-nota]') && url) return anadirAtajo('nota', url);
    if (!e.target.closest('[data-copiar-nota]') || !url) return;
    const ok = await navigator.clipboard.writeText(url).then(() => true, () => false);
    if (ok) aviso('Dirección copiada: pégala en el Atajo');
    else prompt('Copia esta dirección:', url);
  };
}
