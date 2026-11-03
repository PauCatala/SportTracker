// AVISOS: notificaciones en el móvil u ordenador aunque SYNCO esté cerrada.
//  - La app calcula los avisos de los próximos 14 días a partir de tu agenda y los sube a Supabase (tabla "avisos").
//  - Cada dispositivo donde los activas se guarda en "avisos_dispositivos".
//  - Cada minuto, la función "enviar-avisos" de Supabase manda los que ya tocan (ver sql/avisos.sql).
// Se recalculan solos cada vez que cambias algo de la agenda.
import { supabase } from './db.js';
import { leer, guardar, hoyISO, escuchar } from './almacen.js';
import { eventosEntre } from './agenda.js';
import { sumarDias } from './utils.js';

const DIAS = 14;

// Ajustes por defecto (clave "avisos-ajustes"). Minutos antes; null = no avisar.
export const AVISOS_DEF = {
  activo: false,        // ¿tienes los avisos encendidos en algún dispositivo?
  eventos: 15,          // clases y eventos con hora
  entregas: 'ambas',    // tareas y entregas sin hora: 'vispera' (20:00), 'dia' (09:00), 'ambas' o null
  entreno: 30,          // gimnasio, running y flexibilidad
  foto: 0,              // foto de progreso: a su hora
  importados: true,     // también lo de PoliformaT, Google…
};
export const ajustesAvisos = () => ({ ...AVISOS_DEF, ...leer('avisos-ajustes', {}) });
export const guardarAjustesAvisos = cambio => guardar('avisos-ajustes', { ...ajustesAvisos(), ...cambio });

// Opciones para el formulario de cada evento
export const OPCIONES_EVENTO = [['', 'Como en tus ajustes'], ['no', 'No avisar'], ['0', 'A la hora'], ['10', '10 min antes'], ['30', '30 min antes'], ['60', '1 h antes'], ['1440', '1 día antes']];
export const OPCIONES_ANTES = [['', 'No avisar'], ['0', 'A la hora'], ['5', '5 min antes'], ['10', '10 min antes'], ['15', '15 min antes'], ['30', '30 min antes'], ['60', '1 h antes']];

/* ============================== CALCULAR ============================== */
const momento = (fecha, hora, minAntes = 0) => new Date(new Date(`${fecha}T${hora}`).getTime() - minAntes * 60000);
const diaTxt = (fecha, cuando) => {
  const hoy = cuando.toLocaleDateString('sv-SE');
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  return new Date(`${fecha}T12:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
};

// Lista de avisos de los próximos días: [{ clave, cuando (Date), titulo, cuerpo, url }]
export function calcularAvisos(ahora = new Date()) {
  const cfg = ajustesAvisos();
  const desde = hoyISO(), hasta = sumarDias(desde, DIAS);
  const salida = [];
  for (const e of eventosEntre(desde, sumarDias(hasta, 1), { conImportados: cfg.importados })) {
    if (e.hecho) continue;
    const propio = e.aviso;                                  // lo que elegiste en ese evento
    if (propio === 'no') continue;
    const url = `./#${e.ir ? e.ir.split('|')[0] : 'calendario'}`;
    const extra = [e.lugar, e.calendario].filter(Boolean).join(' · ');
    const anadir = (cuando, cuerpo) => {
      if (cuando > ahora && cuando < new Date(`${hasta}T23:59`)) {
        salida.push({ clave: `${e.id}@${cuando.toISOString().slice(0, 16)}`, cuando, titulo: e.titulo, cuerpo, url });
      }
    };

    if (e.todoElDia || !e.inicio) {
      // Entregas, tareas sin hora y eventos de todo el día
      if (propio !== undefined && propio !== '') { anadir(momento(e.fecha, '09:00', Number(propio)), `${diaTxt(e.fecha, momento(e.fecha, '09:00', Number(propio)))}${extra ? ` · ${extra}` : ''}`); continue; }
      const modo = cfg.entregas;
      if (!modo) continue;
      const etiqueta = e.etiqueta || (e.fuente === 'importado' ? 'Todo el día' : 'Pendiente');
      if (modo === 'vispera' || modo === 'ambas') anadir(momento(sumarDias(e.fecha, -1), '20:00'), `Mañana · ${etiqueta}${extra ? ` · ${extra}` : ''}`);
      if (modo === 'dia' || modo === 'ambas') anadir(momento(e.fecha, '09:00'), `Hoy · ${etiqueta}${extra ? ` · ${extra}` : ''}`);
      continue;
    }

    // Con hora
    let antes;
    if (propio !== undefined && propio !== '') antes = Number(propio);
    else if (['gym', 'run', 'flex'].includes(e.fuente)) antes = cfg.entreno;
    else if (e.fuente === 'foto') antes = cfg.foto;
    else antes = cfg.eventos;
    if (antes === null || antes === undefined || antes === '') continue;
    const cuando = momento(e.fecha, e.inicio, Number(antes));
    const cuerpo = `${diaTxt(e.fecha, cuando)} a las ${e.inicio}${e.fin ? `–${e.fin}` : ''}${extra ? ` · ${extra}` : ''}`;
    anadir(cuando, cuerpo);
  }
  return salida.sort((a, b) => a.cuando - b.cuando);
}

/* ============================== SUBIR ============================== */
let usuario = null;
let temporizador = null;
let ultimaFirma = '';

async function subir() {
  if (!usuario) return;
  const cfg = ajustesAvisos();
  const lista = cfg.activo ? calcularAvisos() : [];
  const firma = JSON.stringify(lista.map(a => [a.clave, a.titulo, a.cuerpo]));
  if (firma === ultimaFirma) return;
  const ahora = new Date().toISOString();
  try {
    if (lista.length) {
      const filas = lista.map(a => ({ user_id: usuario, clave: a.clave, cuando: a.cuando.toISOString(), titulo: a.titulo, cuerpo: a.cuerpo, url: a.url }));
      const { error } = await supabase.from('avisos').upsert(filas, { onConflict: 'user_id,clave' });
      if (error) throw error;
    }
    // Quita los que ya no toca (borraste el evento, lo marcaste hecho, cambiaste la hora…)
    const { data, error } = await supabase.from('avisos').select('clave').eq('enviado', false).gt('cuando', ahora);
    if (error) throw error;
    const vigentes = new Set(lista.map(a => a.clave));
    const sobran = data.map(f => f.clave).filter(c => !vigentes.has(c) && !c.startsWith('prueba:'));
    for (let i = 0; i < sobran.length; i += 100) {
      await supabase.from('avisos').delete().eq('enviado', false).in('clave', sobran.slice(i, i + 100));
    }
    ultimaFirma = firma;
  } catch (e) {
    console.warn('No se pudieron actualizar los avisos:', e.message);
  }
}

// Recalcula y sube (con un pequeño retraso para juntar varios cambios seguidos)
export function actualizarAvisos() {
  clearTimeout(temporizador);
  temporizador = setTimeout(subir, 1500);
}

// Lo llama app.js al entrar con tu cuenta
export function iniciarAvisos(uid) {
  usuario = uid;
  ultimaFirma = '';
  escuchar(clave => { if (!['cal-exportar', 'cal-ultima-cat'].includes(clave)) actualizarAvisos(); });
  actualizarAvisos();
  // Al volver a la app (p. ej. al día siguiente) se recalcula la ventana de 14 días
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') actualizarAvisos(); });
}

/* ============================== ESTE DISPOSITIVO ============================== */
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'activo' | 'inactivo' | 'denegado' | 'ios-instalar' | 'no-soportado'
export async function estadoDispositivo() {
  if (esIOS() && !instalada()) return 'ios-instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado';
  if (Notification.permission === 'denied') return 'denegado';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo';
}

const aBytes = b64 => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
const nombreDispositivo = () => {
  const ua = navigator.userAgent;
  const so = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Navegador';
  return `${so} · ${new Date().toLocaleDateString('es-ES')}`;
};

export async function activarEnEsteDispositivo() {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No has dado permiso para las notificaciones. Puedes darlo en los ajustes del navegador.');
  const reg = await navigator.serviceWorker.ready;
  const { data: clave, error } = await supabase.rpc('avisos_clave_publica');
  if (error || !clave) throw new Error('No se pudo preparar el aviso. Inténtalo con internet.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
  const j = sub.toJSON();
  const { error: e2 } = await supabase.from('avisos_dispositivos')
    .upsert({ endpoint: j.endpoint, user_id: usuario, p256dh: j.keys.p256dh, auth: j.keys.auth, nombre: nombreDispositivo() });
  if (e2) throw new Error('No se pudo guardar este dispositivo.');
  guardarAjustesAvisos({ activo: true });
  ultimaFirma = '';
  await subir();
}

export async function desactivarEnEsteDispositivo() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('avisos_dispositivos').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  // Si ya no queda ningún dispositivo, se dejan de calcular
  const { count } = await supabase.from('avisos_dispositivos').select('endpoint', { count: 'exact', head: true });
  if (!count) { guardarAjustesAvisos({ activo: false }); ultimaFirma = ''; await subir(); }
}

// Manda un aviso de prueba (llega en menos de un minuto)
export async function avisoDePrueba() {
  const { error } = await supabase.from('avisos').insert({
    user_id: usuario, clave: `prueba:${Date.now()}`, cuando: new Date().toISOString(),
    titulo: 'SYNCO', cuerpo: 'Así te llegarán los avisos.', url: './#calendario',
  });
  if (error) throw new Error('No se pudo enviar la prueba.');
}

export const proximosAvisos = (n = 3) => calcularAvisos().slice(0, n);
