// Función de Vercel "nota" (se publica sola en /api/nota).
// La usa el Atajo «Apuntar en SYNCO» del iPhone (widget, Siri, pantalla de bloqueo…): escribes una frase
// sin abrir la app y aquí se guarda en tu bandeja (tabla notas_entrada). Al abrir SYNCO se coloca en su sitio.
// Responde con un texto corto que el Atajo enseña como notificación: dónde se va a apuntar.
// Para ese mensaje usa el mismo «cerebro» que la nota rápida (js/captura/analizar.js), que no depende de nada.
const fs = require('fs');
const path = require('path');
const SUPABASE_URL = 'https://lqbqlgkuubyukqbhckck.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4KJkWRlKFHDTvA6-w5UisA_qFN_r68T';
const ZONA = 'Europe/Madrid';
const MAX = 2000;

// analizar.js es un módulo de la web (import/export): se carga tal cual desde su archivo
let cerebro = null;
async function analizar(texto, opciones) {
  if (!cerebro) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'captura', 'analizar.js'), 'utf8');
    cerebro = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  }
  return cerebro.analizar(texto, opciones);
}

// Fecha y hora de España (el servidor está en otra zona horaria)
function ahoraEnEspana() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { hoy: `${p.year}-${p.month}-${p.day}`, ahora: `${p.hour}:${p.minute}` };
}
const diaBonito = f => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// Lo que se enseña en la notificación del iPhone
function resumen(acciones) {
  const lineas = [];
  const compra = acciones.filter(a => a.tipo === 'compra').map(a => a.texto);
  if (compra.length) lineas.push(`🛒 Compra: ${compra.join(', ')}`);
  for (const a of acciones) {
    if (a.tipo === 'evento') lineas.push(`📅 ${a.titulo} · ${diaBonito(a.fecha)}${a.todoElDia ? '' : `, ${a.inicio}`}`);
    else if (a.tipo === 'tarea') lineas.push(`✅ Tarea: ${a.titulo}${a.fecha ? ` · ${diaBonito(a.fecha)}` : ''}${a.prioridad === 'alta' ? ' · urgente' : ''}`);
    else if (a.tipo === 'lista') lineas.push(`📝 Tu lista: ${a.texto}`);
    else if (a.tipo === 'gym') {
      const ss = a.series || [], iguales = ss.length && ss.every(x => x.reps === ss[0].reps && x.kg === ss[0].kg);
      lineas.push(`🏋️ Gimnasio: ${a.nombreLeido || 'series'} ${iguales ? `${ss.length}×${ss[0].reps}${ss[0].kg ? ` · ${String(ss[0].kg).replace('.', ',')} kg` : ''}` : ss.map(x => `${x.reps}×${x.kg}`).join(', ')}`);
    }
    else if (a.tipo === 'run') lineas.push(`🏃 Running${a.distancia_km ? `: ${String(a.distancia_km).replace('.', ',')} km` : ''}`);
  }
  if (acciones.some(a => a.tipo === 'nota')) lineas.push(lineas.length ? '🗒️ Y una parte como nota' : '🗒️ Guardado como nota (no he sabido dónde ponerlo)');
  return lineas.join('\n');
}

async function leerTexto(req) {
  let cuerpo;
  try { cuerpo = req.body; } catch { cuerpo = undefined; }     // JSON mal formado
  if (cuerpo && typeof cuerpo === 'object' && !Buffer.isBuffer(cuerpo)) return cuerpo.texto ?? cuerpo.text ?? cuerpo.nota ?? '';
  let t = typeof cuerpo === 'string' ? cuerpo : Buffer.isBuffer(cuerpo) ? cuerpo.toString('utf8') : '';
  if (!t) t = await new Promise(ok => { let s = ''; req.on('data', c => { s += c; if (s.length > 20000) req.destroy(); }); req.on('end', () => ok(s)); req.on('error', () => ok('')); });
  try { const j = JSON.parse(t); if (j && typeof j === 'object') return j.texto ?? j.text ?? j.nota ?? ''; } catch { /* texto plano */ }
  if (/^texto=/.test(t)) return new URLSearchParams(t).get('texto') || '';
  return t;
}

const responder = (res, status, texto) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(texto);
};
const rpc = (nombre, cuerpo) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
  method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
}).then(r => (r.ok ? r.json() : null)).catch(() => null);

async function manejador(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); return responder(res, 204, ''); }
  const token = (new URL(req.url, 'http://x').searchParams.get('t') || req.headers['x-synco-codigo'] || '').trim();
  if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return responder(res, 401, '⚠️ Falta tu dirección de SYNCO. Cópiala en SYNCO → Nota rápida → En el iPhone.');

  if (req.method === 'GET') {
    const valido = await rpc('salud_codigo_valido', { p_token: token });
    return valido ? responder(res, 200, '✓ Dirección correcta. El Atajo debe enviar el texto con el método POST.') : responder(res, 401, '⚠️ Esta dirección ya no es válida: cópiala de nuevo en SYNCO.');
  }
  if (req.method !== 'POST') return responder(res, 405, 'Usa POST.');

  const texto = String(await leerTexto(req) || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX);
  if (!texto) return responder(res, 400, '⚠️ No ha llegado ningún texto. Revisa el campo «texto» del Atajo.');

  const r = await rpc('nota_entrada', { p_token: token, p_texto: texto });
  if (r === 'codigo') return responder(res, 401, '⚠️ Esta dirección ya no es válida: cópiala de nuevo en SYNCO.');
  if (r === 'lleno') return responder(res, 429, '⚠️ Tienes muchas notas sin colocar. Abre SYNCO para que se apunten.');
  if (r !== 'ok') return responder(res, 502, '⚠️ No se ha podido guardar. Inténtalo en un momento.');

  let mensaje = '';
  try { mensaje = resumen(await analizar(texto, ahoraEnEspana())); } catch (e) { console.error('nota', e.message); }
  return responder(res, 200, `${mensaje || '🗒️ Guardado'}\nSe colocará al abrir SYNCO.`);
}

module.exports = manejador;
module.exports.resumen = resumen;
module.exports.analizar = analizar;
module.exports.ahoraEnEspana = ahoraEnEspana;
