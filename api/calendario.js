// Función de Vercel "calendario" (se publica sola en /api/calendario). Hace dos cosas:
//  1. ?url=<enlace .ics>  → descarga un calendario (Google, PoliformaT, Outlook…) y se lo pasa a la app.
//     Hace falta porque esos servidores no dejan que una web lo descargue directamente (CORS).
//  2. ?feed=<código>      → devuelve tu calendario de Lumen en formato .ics para suscribirte desde
//     Google Calendar. El código es secreto y solo lo conoce tu cuenta (se crea en la app).
//     Lo lee de Supabase con la función lumen_calendario_feed (solo devuelve el calendario de ese código).
const SUPABASE_URL = 'https://lqbqlgkuubyukqbhckck.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4KJkWRlKFHDTvA6-w5UisA_qFN_r68T';
const PRIVADA = /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;
const MAX = 8000000;

const texto = (res, status, cuerpo) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(cuerpo);
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return texto(res, 204, '');
  const params = new URL(req.url, 'http://x').searchParams;

  // ---------- 2. Tu calendario de Lumen para Google Calendar ----------
  const feed = params.get('feed');
  if (feed) {
    if (!/^[A-Za-z0-9]{24,64}$/.test(feed)) return texto(res, 404, 'No encontrado');
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lumen_calendario_feed`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: feed }),
      });
      const ics = r.ok ? await r.json() : null;
      if (!ics) return texto(res, 404, 'No encontrado');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900');
      return res.end(ics);
    } catch {
      return texto(res, 502, 'No se pudo leer el calendario');
    }
  }

  // ---------- 1. Descargar un calendario externo ----------
  const url = params.get('url');
  if (!url) return texto(res, 400, 'Falta el parámetro url o feed');
  let destino;
  try { destino = new URL(url.trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return texto(res, 400, 'Ese enlace no es válido'); }
  if (!/^https?:$/.test(destino.protocol) || PRIVADA.test(destino.hostname) || destino.hostname.endsWith('.internal')) {
    return texto(res, 400, 'Ese enlace no está permitido');
  }
  let r;
  try {
    r = await fetch(destino, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Lumen Calendario)', Accept: 'text/calendar, text/plain, */*' },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return texto(res, 502, 'No se pudo conectar con ese calendario');
  }
  if (!r.ok) return texto(res, 502, `El calendario respondió con un error (${r.status}). Revisa que el enlace sea el privado o secreto.`);
  if (Number(r.headers.get('content-length') || 0) > MAX) return texto(res, 413, 'El calendario es demasiado grande');
  const cuerpo = await r.text();
  if (cuerpo.length > MAX) return texto(res, 413, 'El calendario es demasiado grande');
  if (!cuerpo.includes('BEGIN:VCALENDAR')) return texto(res, 422, 'Ese enlace no es un calendario iCal (.ics). Puede que pida iniciar sesión.');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(cuerpo);
};
