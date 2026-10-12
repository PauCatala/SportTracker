// AGENDA: junta en una sola lista todo lo que tienes que hacer, venga de donde venga.
//  - Tus eventos (clases, horarios de trabajo, cumpleaños, deporte…)      → clave "eventos"
//  - Tareas de Estudios y trabajo con fecha                                 → clave "tareas"
//  - Tareas de casa (lista de Personal) con fecha                           → clave "lista"
//  - Tu plan de entreno: gimnasio, running y flexibilidad                   → Supabase (con cuenta)
//  - La foto de progreso de cada domingo, en ayunas
//  - Calendarios importados (Google, PoliformaT, Outlook…)                  → "calendarios" + "cal-cache:<id>"
import { leer, guardar, hoyISO, nuevoId } from './almacen.js';
import { state } from './db.js';
import { DIAS_PLAN, diaSugerido, flexDelDia, SEMANAS_RUN, faseDeSemana } from './plan.js';
import { semanaPlan } from './consultas.js';
import { lunesDe, sumarDias } from './utils.js';
const domingoDe = iso => sumarDias(lunesDe(iso), 6);

// Tipos de evento y su color (dentro de la familia de azules, con algún matiz para distinguirlos)
export const CATEGORIAS = {
  clase:    { nombre: 'Clases',   color: '#2D3B5C' },
  estudio:  { nombre: 'Estudio',  color: '#4F78A8' },
  trabajo:  { nombre: 'Trabajo',  color: '#7D8DAE' },
  deporte:  { nombre: 'Deporte',  color: '#6FA2CB' },
  hogar:    { nombre: 'Hogar',    color: '#9E9B93' },
  personal: { nombre: 'Personal', color: '#B39A78' },
  imagen:   { nombre: 'Imagen',   color: '#6B7A88' },
};
// Colores a elegir para los calendarios importados
export const COLORES_CAL = ['#2D3B5C', '#4F78A8', '#6FA2CB', '#8DB2D6', '#7D8DAE', '#B39A78', '#9E9B93', '#6B7A88'];
// Paleta para pintar cualquier actividad del color que quieras (además del selector libre)
export const PALETA = [
  ['#2D3B5C', 'Tinta'], ['#4F78A8', 'Azul'], ['#6FA2CB', 'Celeste'], ['#3E8E9B', 'Turquesa'], ['#3F8F6B', 'Verde'], ['#7FA650', 'Lima'],
  ['#C9A227', 'Mostaza'], ['#E08A3C', 'Naranja'], ['#D2574A', 'Coral'], ['#C23B5A', 'Frambuesa'], ['#D46FA0', 'Rosa'], ['#8E5BB8', 'Violeta'],
  ['#5B4B8A', 'Índigo'], ['#8A6A4F', 'Tierra'], ['#B39A78', 'Arena'], ['#6B7A88', 'Pizarra'],
];

export const AJUSTES_CAL = {
  gymHora: '18:00', gymMin: 75,
  flexActiva: true, flexHora: '08:00', flexMin: 20,
  run: { series: { dia: 3, hora: '19:30', min: 60 }, easy: { dia: 6, hora: '10:00', min: 50 }, larga: { dia: 0, hora: '09:30', min: 90 } },
  fotoHora: '09:00', fotoDia: 0, fotoMin: 15,
};
export const guardarAjustesCal = cambio => guardar('cal-ajustes', { ...leer('cal-ajustes', {}), ...cambio });

// Cambios en las actividades de tu plan (gimnasio, running, flexibilidad, foto):
//  - "plan-estilo":  para todas las semanas (título y color de cada tipo; la hora y el día van en cal-ajustes)
//  - "plan-cambios": solo para un día concreto (mover, cambiar hora, título, color o quitarlo ese día)
const estilos = () => leer('plan-estilo', {});
const cambiosPlan = () => leer('plan-cambios', {});
export const ajustesCal = () => {
  const a = leer('cal-ajustes', {});
  return { ...AJUSTES_CAL, ...a, run: { ...AJUSTES_CAL.run, ...(a.run || {}) } };
};

// El plan de entreno solo existe con cuenta y con los datos ya bajados (lo avisa app.js)
let conPlan = false;
export const activarPlan = v => { conPlan = v; };

const diaSemana = iso => new Date(`${iso}T12:00`).getDay();          // 0 = domingo
const sumarMin = (hora, min) => {
  const [h, m] = hora.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + min);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
function* dias(desde, hasta) { for (let d = desde; d <= hasta; d = sumarDias(d, 1)) yield d; }

/* ============================== TODO JUNTO ============================== */
/**
 * Devuelve todos los eventos entre dos fechas (AAAA-MM-DD, incluidas), ordenados.
 * Cada uno: { id, fuente, ref, titulo, cat, color, fecha, inicio, fin, todoElDia,
 *             lugar, nota, hecho (true/false o null si no se marca), editable, repite, ir }
 */
export function eventosEntre(desde, hasta, { conImportados = true } = {}) {
  const salida = [];
  const cfg = ajustesCal();
  const color = cat => CATEGORIAS[cat]?.color || CATEGORIAS.personal.color;

  // 1. Tus eventos
  for (const e of leer('eventos', [])) {
    const base = {
      fuente: 'evento', ref: e.id, titulo: e.titulo, cat: e.cat, color: e.color || color(e.cat), colorPropio: e.color || '',
      inicio: e.todoElDia ? null : e.inicio, fin: e.todoElDia ? null : e.fin, todoElDia: !!e.todoElDia,
      lugar: e.lugar, nota: e.nota, editable: true, repite: e.repetir !== 'no' ? e.repetir : null,
    };
    const hecho = d => (e.hechos || []).includes(d);
    const marcable = ['estudio', 'trabajo', 'hogar', 'personal', 'deporte'].includes(e.cat);
    const anadir = d => salida.push({ ...base, id: `ev:${e.id}:${d}`, fecha: d, hecho: marcable ? hecho(d) : null });
    if (!e.repetir || e.repetir === 'no') {
      if (e.fecha >= desde && e.fecha <= hasta) anadir(e.fecha);
    } else {
      const fuera = new Set(e.excepciones || []);
      for (const d of dias(desde > e.fecha ? desde : e.fecha, e.hasta && e.hasta < hasta ? e.hasta : hasta)) {
        if (fuera.has(d)) continue;
        if (e.repetir === 'semanal' && (e.dias?.length ? e.dias : [diaSemana(e.fecha)]).includes(diaSemana(d))) anadir(d);
        if (e.repetir === 'anual' && d.slice(5) === e.fecha.slice(5)) anadir(d);
      }
    }
  }

  // 2. Tareas de Estudios y trabajo
  for (const t of leer('tareas', [])) {
    if (!t.fecha || t.fecha < desde || t.fecha > hasta) continue;
    const cat = t.tipo === 'trabajo' ? 'trabajo' : 'estudio';
    salida.push({
      id: `ta:${t.id}`, fuente: 'tarea', ref: t.id, titulo: t.titulo, cat, color: t.color || color(cat), colorPropio: t.color || '', fecha: t.fecha,
      inicio: t.hora || null, fin: t.hora ? (t.horaFin || sumarMin(t.hora, 60)) : null, todoElDia: !t.hora,
      lugar: t.area || '', nota: t.nota || '', hecho: t.estado === 'hecho', editable: true, ir: 'estudios|estudios|tablero',
      etiqueta: t.hora ? null : 'Entrega',
    });
  }

  // 3. Tareas de casa
  for (const x of leer('lista', [])) {
    if (!x.fecha || x.fecha < desde || x.fecha > hasta) continue;
    salida.push({
      id: `li:${x.id}`, fuente: 'lista', ref: x.id, titulo: x.texto, cat: 'hogar', color: x.color || color('hogar'), colorPropio: x.color || '', fecha: x.fecha,
      inicio: x.hora || null, fin: x.hora ? (x.horaFin || sumarMin(x.hora, 30)) : null, todoElDia: !x.hora,
      hecho: !!x.hecho, editable: true, ir: 'personal|personal|lista',
    });
  }

  // 4. Tu plan de entreno (y 5. la foto). Se calcula con una semana de margen por si has movido
  //    alguna actividad de un día que cae fuera del rango a uno de dentro.
  const plan = [];
  const pd = sumarDias(desde, -7), ph = sumarDias(hasta, 7);
  if (conPlan) {
    const hoy = hoyISO();
    for (const d of dias(pd, ph)) {
      const dow = diaSemana(d);
      const n = semanaPlan(d);
      const enPlan = n == null || (n >= 1 && n <= SEMANAS_RUN);
      if (!enPlan) continue;
      if (dow >= 1 && dow <= 5) {
        const dia = diaSugerido(d, DIAS_PLAN.map(x => x.nombre));
        plan.push({
          id: `gym:${d}`, clave: 'gym', fuente: 'gym', titulo: `Gimnasio · ${dia.split('·')[1]?.trim() || dia}`, cat: 'deporte', color: color('deporte'),
          fecha: d, inicio: cfg.gymHora, fin: sumarMin(cfg.gymHora, cfg.gymMin), todoElDia: false,
          nota: dia, hecho: d <= hoy ? state.sesiones.some(s => s.fecha === d) : false, editable: false, ir: 'salud|gym|entrenar',
        });
      }
      if (n >= 1 && n <= SEMANAS_RUN) {
        const fase = faseDeSemana(n);
        const lunes = lunesDe(d), domingo = sumarDias(lunes, 6);
        const semana = state.carreras.filter(c => c.fecha >= lunes && c.fecha <= domingo);
        for (const [tipo, nombre, tipos] of [['series', 'Series', ['series']], ['easy', 'Easy', ['easy', 'tempo']], ['larga', 'Tirada larga', ['larga']]]) {
          const r = cfg.run[tipo];
          if (r.dia !== dow) continue;
          plan.push({
            id: `run:${tipo}:${d}`, clave: `run:${tipo}`, fuente: 'run', titulo: `Running · ${nombre}`, cat: 'deporte', color: color('deporte'),
            fecha: d, inicio: r.hora, fin: sumarMin(r.hora, r.min), todoElDia: false,
            nota: `Semana ${n} · ${fase?.nombre || ''}\n${fase?.[tipo] || ''}`, hecho: semana.some(c => tipos.includes(c.tipo)),
            editable: false, ir: 'salud|running|semana',
          });
        }
      }
      if (cfg.flexActiva) {
        const items = flexDelDia(d);
        const hechos = new Set(state.flex_dias.find(f => f.fecha === d)?.completados || []);
        plan.push({
          id: `flex:${d}`, clave: 'flex', fuente: 'flex', titulo: 'Flexibilidad', cat: 'deporte', color: color('deporte'),
          fecha: d, inicio: cfg.flexHora, fin: sumarMin(cfg.flexHora, cfg.flexMin), todoElDia: false,
          nota: items.map(i => i.nombre).join(' · '), hecho: items.every(i => hechos.has(i.id)), editable: false, ir: 'salud|flex|hoy',
        });
      }
    }
  }

  // 5. Foto de progreso: una vez por semana (el domingo, salvo que la cambies) por la mañana, en ayunas
  for (const d of dias(pd, ph)) {
    if (diaSemana(d) !== (cfg.fotoDia ?? 0)) continue;
    plan.push({
      id: `foto:${d}`, clave: 'foto', fuente: 'foto', titulo: 'Foto de progreso', cat: 'imagen', color: color('imagen'),
      fecha: d, inicio: cfg.fotoHora, fin: sumarMin(cfg.fotoHora, cfg.fotoMin || 15), todoElDia: false,
      nota: 'Por la mañana, en ayunas y antes de hacer ejercicio.', hecho: semanasConFoto.has(domingoDe(d)), editable: false, ir: 'imagen|imagen|progreso',
    });
  }
  // Tus cambios: primero los de todas las semanas, luego los de ese día
  const est = estilos(), cam = cambiosPlan();
  for (const x of plan) {
    const e = est[x.clave] || {};
    const c = cam[x.id] || {};
    if (c.borrado) continue;
    const final = { ...x, editable: true, deplan: true, fechaPlan: x.fecha,
      titulo: c.titulo || e.titulo || x.titulo, color: c.color || e.color || x.color, colorPropio: c.color || e.color || '',
      fecha: c.fecha || x.fecha, inicio: c.inicio || x.inicio, fin: c.fin || x.fin, cambiado: !!Object.keys(c).length };
    if (final.fecha >= desde && final.fecha <= hasta) salida.push(final);
  }

  // 6. Calendarios importados
  if (conImportados) {
    for (const cal of leer('calendarios', [])) {
      if (cal.oculto) continue;
      for (const e of leer(`cal-cache:${cal.id}`, [])) {
        if (e.fecha < desde || e.fecha > hasta) continue;
        salida.push({
          ...e, id: `im:${cal.id}:${e.uid}`, fuente: 'importado', ref: cal.id, cat: cal.cat || 'clase', color: cal.color,
          calendario: cal.nombre, hecho: null, editable: false,
        });
      }
    }
  }

  return salida.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.todoElDia ? -1 : b.todoElDia ? 1 : (a.inicio || '').localeCompare(b.inicio || '')));
}

// Domingos con foto de progreso (las fotos están en el dispositivo; se cargan aparte)
let semanasConFoto = new Set();
export const marcarSemanasConFoto = domingos => { semanasConFoto = new Set(domingos); };

/* ============================== GUARDAR ============================== */
// Dónde se guarda lo que creas desde el calendario:
//  - Estudio/trabajo sin repetir → tarea del tablero (así aparece también en Estudios)
//  - Hogar sin repetir           → tu lista de Personal
//  - Todo lo demás               → tus eventos
export function guardarDesdeFormulario(datos, previo) {
  const destino = datos.repetir === 'no' && ['estudio', 'trabajo'].includes(datos.cat) ? 'tarea'
    : datos.repetir === 'no' && datos.cat === 'hogar' ? 'lista' : 'evento';
  // Si cambia de sitio (p. ej. una tarea que pasa a repetirse cada semana), se borra del sitio antiguo
  if (previo && previo.fuente !== destino) borrar(previo);
  const id = previo && previo.fuente === destino ? previo.ref : nuevoId();
  const hora = datos.todoElDia ? null : datos.inicio;
  const horaFin = datos.todoElDia ? null : datos.fin;

  if (destino === 'tarea') {
    const tareas = leer('tareas', []);
    const vieja = tareas.find(t => t.id === id);
    const nueva = { ...(vieja || { estado: 'todo', creada: hoyISO() }), id, titulo: datos.titulo, tipo: datos.cat, area: datos.lugar || '', fecha: datos.fecha, hora, horaFin, nota: datos.nota, color: datos.color || undefined };
    guardar('tareas', vieja ? tareas.map(t => (t.id === id ? nueva : t)) : [...tareas, nueva]);
  } else if (destino === 'lista') {
    const lista = leer('lista', []);
    const vieja = lista.find(x => x.id === id);
    const nueva = { ...(vieja || { hecho: false }), id, texto: datos.titulo, fecha: datos.fecha, hora, horaFin, color: datos.color || undefined };
    guardar('lista', vieja ? lista.map(x => (x.id === id ? nueva : x)) : [...lista, nueva]);
  } else {
    const eventos = leer('eventos', []);
    const viejo = eventos.find(e => e.id === id);
    const nuevo = {
      ...(viejo || {}), id, titulo: datos.titulo, cat: datos.cat, fecha: datos.fecha, todoElDia: datos.todoElDia,
      inicio: hora, fin: horaFin, repetir: datos.repetir, dias: datos.dias, hasta: datos.hasta || null,
      lugar: datos.lugar, nota: datos.nota, color: datos.color || undefined,
    };
    guardar('eventos', viejo ? eventos.map(e => (e.id === id ? nuevo : e)) : [...eventos, nuevo]);
  }
  return destino;
}

// Datos de un evento tal y como se editan en el formulario
export function datosDe(ev) {
  if (ev.fuente === 'evento') {
    const e = leer('eventos', []).find(x => x.id === ev.ref);
    if (e) return { ...e, repetir: e.repetir || 'no', dias: e.dias || [] };
  }
  if (ev.fuente === 'tarea') {
    const t = leer('tareas', []).find(x => x.id === ev.ref);
    if (t) return { titulo: t.titulo, cat: t.tipo === 'trabajo' ? 'trabajo' : 'estudio', fecha: t.fecha, todoElDia: !t.hora, inicio: t.hora, fin: t.horaFin, repetir: 'no', dias: [], lugar: t.area, nota: t.nota, color: t.color || '' };
  }
  if (ev.fuente === 'lista') {
    const x = leer('lista', []).find(y => y.id === ev.ref);
    if (x) return { titulo: x.texto, cat: 'hogar', fecha: x.fecha, todoElDia: !x.hora, inicio: x.hora, fin: x.horaFin, repetir: 'no', dias: [], color: x.color || '' };
  }
  return null;
}

// Marca o desmarca como hecho
export function alternarHecho(ev) {
  if (ev.fuente === 'tarea') {
    guardar('tareas', leer('tareas', []).map(t => (t.id === ev.ref ? { ...t, estado: t.estado === 'hecho' ? 'todo' : 'hecho' } : t)));
  } else if (ev.fuente === 'lista') {
    guardar('lista', leer('lista', []).map(x => (x.id === ev.ref ? { ...x, hecho: !x.hecho } : x)));
  } else if (ev.fuente === 'evento') {
    guardar('eventos', leer('eventos', []).map(e => {
      if (e.id !== ev.ref) return e;
      const hechos = new Set(e.hechos || []);
      hechos.has(ev.fecha) ? hechos.delete(ev.fecha) : hechos.add(ev.fecha);
      return { ...e, hechos: [...hechos] };
    }));
  }
}

// Borra un evento. En los que se repiten: solo = ese día, o toda la serie
export function borrar(ev, solo = false) {
  if (ev.fuente === 'tarea') guardar('tareas', leer('tareas', []).filter(t => t.id !== ev.ref));
  if (ev.fuente === 'lista') guardar('lista', leer('lista', []).filter(x => x.id !== ev.ref));
  if (ev.fuente === 'evento') {
    const eventos = leer('eventos', []);
    guardar('eventos', solo
      ? eventos.map(e => (e.id === ev.ref ? { ...e, excepciones: [...(e.excepciones || []), ev.fecha] } : e))
      : eventos.filter(e => e.id !== ev.ref));
  }
}

// Cambia una actividad (título, color, día y horas). todas = para todas las semanas (si se repite o es de tu plan);
// si no, solo ese día. Sirve para tus eventos, tus tareas y las actividades de tu plan de entreno.
export function cambiarActividad(ev, datos, { todas = false } = {}) {
  const d = { titulo: ev.titulo, color: ev.colorPropio || '', fecha: ev.fecha, inicio: ev.inicio, fin: ev.fin, ...datos };
  const dur = Math.max(15, minutos(d.fin || sumarMin(d.inicio, 60)) - minutos(d.inicio));
  const cambioTitulo = d.titulo !== ev.titulo;

  if (ev.deplan) {
    const cam = cambiosPlan();
    if (todas) {
      // Título y color para todas las semanas
      const est = estilos();
      est[ev.clave] = { ...(est[ev.clave] || {}), ...(cambioTitulo ? { titulo: d.titulo } : {}), color: d.color || '' };
      guardar('plan-estilo', est);
      // Día y hora en los ajustes del calendario
      const cfg = ajustesCal();
      const dow = diaSemana(d.fecha);
      if (ev.fuente === 'run') {
        const tipo = ev.clave.split(':')[1];
        guardarAjustesCal({ run: { ...cfg.run, [tipo]: { dia: dow, hora: d.inicio, min: dur } } });
      } else if (ev.fuente === 'gym') guardarAjustesCal({ gymHora: d.inicio, gymMin: dur });
      else if (ev.fuente === 'flex') guardarAjustesCal({ flexHora: d.inicio, flexMin: dur });
      else if (ev.fuente === 'foto') guardarAjustesCal({ fotoDia: dow, fotoHora: d.inicio, fotoMin: dur });
      // Los cambios sueltos de ese tipo dejan de tener sentido
      for (const k of Object.keys(cam)) if (k.startsWith(`${ev.clave}:`)) delete cam[k];
      guardar('plan-cambios', cam);
    } else {
      cam[ev.id] = { ...(cam[ev.id] || {}), fecha: d.fecha, inicio: d.inicio, fin: d.fin, ...(cambioTitulo ? { titulo: d.titulo } : {}), ...(d.color ? { color: d.color } : {}) };
      guardar('plan-cambios', cam);
    }
    return;
  }
  if (ev.fuente === 'tarea') {
    guardar('tareas', leer('tareas', []).map(t => (t.id === ev.ref ? { ...t, titulo: d.titulo, color: d.color || undefined, fecha: d.fecha, hora: d.inicio, horaFin: d.fin } : t)));
    return;
  }
  if (ev.fuente === 'lista') {
    guardar('lista', leer('lista', []).map(x => (x.id === ev.ref ? { ...x, texto: d.titulo, color: d.color || undefined, fecha: d.fecha, hora: d.inicio, horaFin: d.fin } : x)));
    return;
  }
  if (ev.fuente !== 'evento') return;
  const eventos = leer('eventos', []);
  const e = eventos.find(x => x.id === ev.ref);
  if (!e) return;
  const comun = { titulo: d.titulo, color: d.color || undefined, inicio: d.todoElDia ? null : d.inicio, fin: d.todoElDia ? null : d.fin, todoElDia: !!d.todoElDia || (!d.inicio && e.todoElDia) };
  if (!e.repetir || e.repetir === 'no') {
    guardar('eventos', eventos.map(x => (x.id === e.id ? { ...x, ...comun, fecha: d.fecha } : x)));
  } else if (todas) {
    // Toda la serie: misma hora y, si lo cambias de día, todos los días de la serie se desplazan igual
    const salto = diaSemana(d.fecha) - diaSemana(ev.fecha);
    const nuevo = { ...e, ...comun };
    if (salto) {
      if (e.repetir === 'semanal') nuevo.dias = (e.dias?.length ? e.dias : [diaSemana(e.fecha)]).map(x => (x + salto + 7) % 7);
      nuevo.fecha = sumarDias(e.fecha, salto);
    }
    if (e.repetir === 'anual') nuevo.fecha = `${e.fecha.slice(0, 4)}${d.fecha.slice(4)}`;
    guardar('eventos', eventos.map(x => (x.id === e.id ? nuevo : x)));
  } else {
    // Solo ese día: se quita de la serie y se crea uno suelto con los cambios
    const suelto = { ...e, ...comun, id: nuevoId(), fecha: d.fecha, repetir: 'no', dias: [], hasta: null, excepciones: [], hechos: [] };
    guardar('eventos', [...eventos.map(x => (x.id === e.id ? { ...x, excepciones: [...(x.excepciones || []), ev.fecha] } : x)), suelto]);
  }
}

// Mueve una actividad a otro día/hora (al arrastrarla). Mantiene su duración.
export function mover(ev, fecha, inicio, { todas = false, fin = null } = {}) {
  const dur = ev.inicio && ev.fin ? minutos(ev.fin) - minutos(ev.inicio) : 60;
  cambiarActividad(ev, { fecha, inicio, fin: fin || (inicio ? sumarMin(inicio, Math.max(15, dur)) : null) }, { todas });
}
// ¿Se puede cambiar "para todas las semanas"?
export const seRepite = ev => !!(ev.deplan || ev.repite);
// Quitar una actividad del plan solo ese día (o volver a dejarla como estaba)
export function quitarDelPlan(ev) { const cam = cambiosPlan(); cam[ev.id] = { borrado: true }; guardar('plan-cambios', cam); }
export function restaurarPlan(ev) { const cam = cambiosPlan(); delete cam[ev.id]; guardar('plan-cambios', cam); }
export const minutos = h => { const [a, b] = (h || '0:0').split(':').map(Number); return a * 60 + b; };
export { sumarMin };
