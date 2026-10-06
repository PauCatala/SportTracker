// iCAL (.ics): el formato estándar de calendarios.
//  - leerICS: convierte un .ics (Google Calendar, PoliformaT, Outlook, Apple…) en eventos de Lumen,
//    con sus repeticiones ya expandidas entre dos fechas.
//  - crearICS: convierte eventos de Lumen en un .ics (para Google Calendar o para descargar).

const dos = n => String(n).padStart(2, '0');
const isoDe = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const horaDe = d => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
const DIAS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/* ============================== LEER ============================== */

// Desfase (en ms) de una zona horaria en un instante: lo que hay que restar a la hora "de reloj"
function desfase(zona, instante) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instante)).map(p => [p.type, p.value]));
  const comoUTC = Date.UTC(+partes.year, partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
  return comoUTC - instante;
}

// "20261014T160000Z" / "20261014T160000" (+ zona) / "20261014" → { fecha: Date local, todoElDia }
function leerFecha(valor, params = {}) {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, a, me, d, h, mi, s, z] = m;
  if (h === undefined || params.VALUE === 'DATE') return { fecha: new Date(+a, me - 1, +d), todoElDia: true };
  if (z) return { fecha: new Date(Date.UTC(+a, me - 1, +d, +h, +mi, +(s || 0))), todoElDia: false };
  const zona = params.TZID?.replace(/^"|"$/g, '');
  if (zona) {
    try {
      const reloj = Date.UTC(+a, me - 1, +d, +h, +mi, +(s || 0));
      let t = reloj - desfase(zona, reloj);
      t = reloj - desfase(zona, t);   // segunda pasada por si cae en un cambio de hora
      return { fecha: new Date(t), todoElDia: false };
    } catch { /* zona desconocida (p. ej. nombres de Windows): se toma como hora local */ }
  }
  return { fecha: new Date(+a, me - 1, +d, +h, +mi, +(s || 0)), todoElDia: false };
}

// "PT1H30M", "P1D", "P1W" → milisegundos
function leerDuracion(txt) {
  const m = txt?.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, signo, w, d, h, mi, s] = m.map(x => (x && /^\d+$/.test(x) ? +x : x));
  const ms = ((((w || 0) * 7 + (d || 0)) * 24 + (h || 0)) * 60 + (mi || 0)) * 60000 + (s || 0) * 1000;
  return signo === '-' ? -ms : ms;
}

const desescapar = t => (t || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

// Separa el .ics en eventos con sus propiedades
function trocear(texto) {
  const lineas = texto.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const eventos = [];
  let actual = null, profundidad = 0;
  for (const linea of lineas) {
    if (linea === 'BEGIN:VEVENT') { actual = { props: {}, exdates: [] }; profundidad = 0; continue; }
    if (!actual) continue;
    if (linea.startsWith('BEGIN:')) { profundidad++; continue; }      // VALARM dentro del evento
    if (linea.startsWith('END:') && profundidad) { profundidad--; continue; }
    if (linea === 'END:VEVENT') { eventos.push(actual); actual = null; continue; }
    if (profundidad) continue;
    const i = linea.search(/[:]/);
    if (i < 0) continue;
    const [nombre, ...ps] = linea.slice(0, i).split(';');
    const params = Object.fromEntries(ps.map(p => { const [k, v = ''] = p.split('='); return [k.toUpperCase(), v]; }));
    const valor = linea.slice(i + 1);
    const clave = nombre.toUpperCase();
    if (clave === 'EXDATE') actual.exdates.push(...valor.split(',').map(v => leerFecha(v.trim(), params)).filter(Boolean));
    else actual.props[clave] = { valor, params };
  }
  return eventos;
}

// Fechas de inicio de cada repetición (RRULE) dentro de [desde, hasta]
function repeticiones(inicio, regla, desde, hasta) {
  const r = Object.fromEntries(regla.split(';').map(p => p.split('=')));
  const intervalo = +(r.INTERVAL || 1);
  const limite = r.COUNT ? +r.COUNT : Infinity;
  const hastaRegla = r.UNTIL ? leerFecha(r.UNTIL)?.fecha : null;
  const fin = hastaRegla && hastaRegla < hasta ? hastaRegla : hasta;
  const byDay = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: m[1] ? +m[1] : null, d: DIAS_ICS.indexOf(m[2]) } : null; }).filter(Boolean) : null;
  const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const conHora = d => { const x = new Date(d); x.setHours(inicio.getHours(), inicio.getMinutes(), inicio.getSeconds(), 0); return x; };
  const salida = [];
  let contadas = 0, vueltas = 0;
  const anotar = d => {
    if (d < inicio || d > fin || contadas >= limite) return;
    contadas++;
    if (d >= desde) salida.push(d);
  };
  const base = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());

  if (r.FREQ === 'DAILY') {
    for (let d = new Date(base); conHora(d) <= fin && contadas < limite && vueltas++ < 5000; d.setDate(d.getDate() + intervalo)) {
      if (!byDay || byDay.some(b => b.d === d.getDay())) anotar(conHora(d));
    }
  } else if (r.FREQ === 'WEEKLY') {
    const dias = byDay ? byDay.map(b => b.d) : [inicio.getDay()];
    const lunes = new Date(base); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    for (let s = new Date(lunes); conHora(s) <= fin && contadas < limite && vueltas++ < 3000; s.setDate(s.getDate() + 7 * intervalo)) {
      for (const dia of [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = new Date(s); d.setDate(d.getDate() + ((dia + 6) % 7));
        anotar(conHora(d));
      }
    }
  } else if (r.FREQ === 'MONTHLY') {
    for (let m = new Date(base.getFullYear(), base.getMonth(), 1); m <= fin && contadas < limite && vueltas++ < 600; m.setMonth(m.getMonth() + intervalo)) {
      const delMes = [];
      const ultimo = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      if (byDay) {
        for (const b of byDay) {
          const coinciden = [];
          for (let d = 1; d <= ultimo; d++) if (new Date(m.getFullYear(), m.getMonth(), d).getDay() === b.d) coinciden.push(d);
          if (b.n == null) delMes.push(...coinciden);
          else { const d = b.n > 0 ? coinciden[b.n - 1] : coinciden[coinciden.length + b.n]; if (d) delMes.push(d); }
        }
      } else {
        for (const d of byMonthDay || [inicio.getDate()]) { const dd = d < 0 ? ultimo + d + 1 : d; if (dd <= ultimo) delMes.push(dd); }
      }
      delMes.sort((a, b) => a - b).forEach(d => anotar(conHora(new Date(m.getFullYear(), m.getMonth(), d))));
    }
  } else if (r.FREQ === 'YEARLY') {
    for (let a = inicio.getFullYear(); a <= fin.getFullYear() && contadas < limite && vueltas++ < 200; a += intervalo) {
      const d = new Date(a, inicio.getMonth(), inicio.getDate());
      if (d.getMonth() === inicio.getMonth()) anotar(conHora(d));
    }
  } else {
    anotar(inicio);
  }
  return salida;
}

/**
 * Lee un .ics y devuelve los eventos entre "desde" y "hasta" (AAAA-MM-DD), ya repetidos.
 * Cada evento: { uid, titulo, fecha, inicio, fin, todoElDia, lugar, nota }
 */
export function leerICS(texto, desdeISO, hastaISO) {
  if (!/BEGIN:VCALENDAR/.test(texto)) throw new Error('Ese archivo no es un calendario (.ics).');
  const desde = new Date(`${desdeISO}T00:00`), hasta = new Date(`${hastaISO}T23:59:59`);
  const crudos = trocear(texto);
  const nombreCal = texto.match(/^X-WR-CALNAME:(.*)$/m)?.[1]?.trim();

  // Repeticiones modificadas a mano (RECURRENCE-ID): sustituyen a la original de ese día
  const cambiadas = new Map();
  for (const e of crudos) {
    const rid = e.props['RECURRENCE-ID'];
    if (!rid) continue;
    const f = leerFecha(rid.valor, rid.params);
    const uid = e.props.UID?.valor;
    if (f && uid) { if (!cambiadas.has(uid)) cambiadas.set(uid, []); cambiadas.get(uid).push(f.fecha.getTime()); }
  }

  const salida = [];
  for (const e of crudos) {
    const p = e.props;
    if (p.STATUS?.valor === 'CANCELLED' || !p.DTSTART) continue;
    const ini = leerFecha(p.DTSTART.valor, p.DTSTART.params);
    if (!ini) continue;
    let duracion;
    if (p.DTEND) { const f = leerFecha(p.DTEND.valor, p.DTEND.params); duracion = f ? f.fecha - ini.fecha : null; }
    if (duracion == null && p.DURATION) duracion = leerDuracion(p.DURATION.valor);
    if (duracion == null || duracion < 0) duracion = ini.todoElDia ? 86400000 : 0;

    const uid = p.UID?.valor || `${p.SUMMARY?.valor}-${p.DTSTART.valor}`;
    const fuera = new Set([...e.exdates.map(x => x.fecha.getTime()), ...(p['RECURRENCE-ID'] ? [] : (cambiadas.get(uid) || []))]);
    // Un evento que dura N días se busca desde N días antes para no perder los que empezaron antes
    const margen = new Date(desde.getTime() - Math.max(0, duracion));
    const inicios = p.RRULE ? repeticiones(ini.fecha, p.RRULE.valor, margen, hasta) : (ini.fecha <= hasta && ini.fecha.getTime() + duracion >= desde.getTime() ? [ini.fecha] : []);

    for (const comienzo of inicios) {
      if (fuera.has(comienzo.getTime())) continue;
      const base = {
        uid: `${uid}|${comienzo.getTime()}`,
        titulo: desescapar(p.SUMMARY?.valor) || '(Sin título)',
        lugar: desescapar(p.LOCATION?.valor),
        nota: desescapar(p.DESCRIPTION?.valor).slice(0, 600),
      };
      const final = new Date(comienzo.getTime() + duracion);
      if (ini.todoElDia) {
        // Uno por cada día que ocupa (la fecha de fin del .ics no se incluye)
        const dias = Math.max(1, Math.round(duracion / 86400000));
        for (let k = 0; k < Math.min(dias, 31); k++) {
          const d = new Date(comienzo); d.setDate(d.getDate() + k);
          if (d >= desde && d <= hasta) salida.push({ ...base, uid: `${base.uid}|${k}`, fecha: isoDe(d), todoElDia: true, inicio: null, fin: null });
        }
      } else {
        // Si cruza la medianoche, se parte en un trozo por día
        for (let d = new Date(comienzo.getFullYear(), comienzo.getMonth(), comienzo.getDate()), k = 0; d < final || k === 0; d.setDate(d.getDate() + 1), k++) {
          if (k > 14) break;
          const empieza = k === 0 ? comienzo : d;
          const finDia = new Date(d); finDia.setHours(23, 59, 0, 0);
          const acaba = final < finDia ? final : finDia;
          if (d >= new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()) && d <= hasta) {
            salida.push({ ...base, uid: `${base.uid}|${k}`, fecha: isoDe(d), todoElDia: false, inicio: horaDe(empieza), fin: horaDe(acaba) });
          }
        }
      }
    }
  }
  salida.nombre = nombreCal;
  return salida;
}

/* ============================== CREAR ============================== */

const escaparICS = t => String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
// Las líneas de un .ics no deben pasar de 75 caracteres: se parten con un espacio delante
const plegar = l => l.length <= 74 ? l : l.match(/.{1,73}/gu).map((t, i) => (i ? ' ' : '') + t).join('\r\n');
const utc = d => `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}00Z`;
const soloFecha = iso => iso.replaceAll('-', '');
const masUnDia = iso => { const d = new Date(`${iso}T12:00`); d.setDate(d.getDate() + 1); return isoDe(d); };

/** eventos: [{ uid, titulo, fecha, inicio, fin, todoElDia, lugar, nota }] */
export function crearICS(eventos, nombre = 'Lumen') {
  const ahora = utc(new Date());
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lumen//Calendario//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparICS(nombre)}`, 'X-WR-TIMEZONE:Europe/Madrid', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of eventos) {
    lineas.push('BEGIN:VEVENT', `UID:${escaparICS(e.uid)}@lumen`, `DTSTAMP:${ahora}`);
    if (e.todoElDia || !e.inicio) {
      lineas.push(`DTSTART;VALUE=DATE:${soloFecha(e.fecha)}`, `DTEND;VALUE=DATE:${soloFecha(masUnDia(e.fecha))}`);
    } else {
      const ini = new Date(`${e.fecha}T${e.inicio}`);
      const fin = e.fin && e.fin > e.inicio ? new Date(`${e.fecha}T${e.fin}`) : new Date(ini.getTime() + 3600000);
      lineas.push(`DTSTART:${utc(ini)}`, `DTEND:${utc(fin)}`);
    }
    lineas.push(`SUMMARY:${escaparICS(e.titulo)}`);
    if (e.lugar) lineas.push(`LOCATION:${escaparICS(e.lugar)}`);
    if (e.nota) lineas.push(`DESCRIPTION:${escaparICS(e.nota)}`);
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n');
}
