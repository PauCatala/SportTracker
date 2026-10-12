// IMAGEN · COMUNIDAD — red social visual de SYNCO.
// Pestañas: Para ti (publicaciones públicas de otras personas), Siguiendo, Explorar, Mi perfil y Actividad.
// Privacidad (la impone la base de datos con RLS, no la interfaz):
// - Todo lo que subes es PRIVADO por defecto. Solo tú decides compartirlo con tus seguidores o hacerlo público.
// - Las fotos viven en un almacén privado y se ven con enlaces firmados que caducan; nunca hay enlaces públicos.
// - Seguir es una petición que la otra persona acepta. Puedes bloquear y denunciar.
import { supabase } from './db.js';
import { cargador } from './marca-anim.js';
import { escapar, leer, guardar } from './almacen.js';
import { comprimir } from './fotos.js';
import { aviso } from './utils.js';

const CARPETAS = { dia: 'Tu día', progreso: 'Progreso físico', comidas: 'Comidas', entreno: 'Entreno', otro: 'Otro' };
const VIS = { privada: 'Solo yo', compartida: 'Seguidores', publica: 'Pública' };
const PESTANAS = [['parati', 'Para ti'], ['siguiendo', 'Siguiendo'], ['explorar', 'Explorar'], ['perfil', 'Mi perfil'], ['actividad', 'Actividad']];
let pestana = 'parati';
let yo = null, miPerfil = null, v2 = true, perfilAbierto = null;
const urlsTemp = [];

const SVG = {
  corazon: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  comentario: '<path d="M20.5 11.6a8.4 8.4 0 01-12.6 7.3L3.5 20.5l1.6-4.2A8.4 8.4 0 1120.5 11.6z"/>',
  enviar: '<path d="M21.5 3.5L10.6 13.4M21.5 3.5l-6.9 17-4-7.1-7.1-4 18-5.9z"/>',
  guardar: '<path d="M6 3.5h12v17l-6-4.6-6 4.6z"/>',
  mas: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  candado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 017 0v2.7"/>',
  personas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0111 0M16 5.5a3 3 0 010 5.6M17.5 14.2a5 5 0 013 5.3"/>',
  mundo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5S9.6 6.1 12 3.5z"/>',
};
const ico = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${SVG[n]}</svg>`;
const hace = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
const inicial = p => escapar((p?.usuario || '?')[0].toUpperCase());
const fallo = (e, texto = 'No se pudo completar') => { console.warn(e); aviso(`${texto}. Revisa tu conexión e inténtalo de nuevo.`, 'error'); };
const faltaTabla = e => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));
const guardadas = () => new Set(leer('social-guardadas', []));

// ---------- Datos ----------
async function urlsFirmadas(rutas) {
  if (!rutas.length) return {};
  const { data, error } = await supabase.storage.from('publicaciones').createSignedUrls(rutas, 3600);
  if (error) throw error;
  return Object.fromEntries(data.filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
}
async function perfilesDe(ids) {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!unicos.length) return {};
  const campos = v2 ? 'user_id, usuario, nombre, bio' : 'user_id, usuario, nombre';
  const { data, error } = await supabase.from('perfiles_publicos').select(campos).in('user_id', unicos);
  if (error) throw error;
  return Object.fromEntries(data.map(p => [p.user_id, p]));
}
// Completa publicaciones con autor, foto firmada, me gusta y comentarios
async function completar(pubs) {
  const ids = pubs.map(p => p.id);
  const [urls, perfiles, megusta, coms] = await Promise.all([
    urlsFirmadas(pubs.map(p => p.ruta)),
    perfilesDe(pubs.map(p => p.user_id)),
    v2 && ids.length ? supabase.from('me_gusta').select('publicacion_id, user_id').in('publicacion_id', ids) : { data: [] },
    v2 && ids.length ? supabase.from('comentarios').select('publicacion_id').in('publicacion_id', ids) : { data: [] },
  ]);
  return pubs.map(p => ({
    ...p, url: urls[p.ruta], autor: perfiles[p.user_id],
    likes: (megusta.data || []).filter(m => m.publicacion_id === p.id).length,
    meGusta: (megusta.data || []).some(m => m.publicacion_id === p.id && m.user_id === yo),
    comentarios: (coms.data || []).filter(c => c.publicacion_id === p.id).length,
  }));
}
async function relaciones() {
  const { data, error } = await supabase.from('seguidores').select('seguidor, seguido, estado');
  if (error) throw error;
  return data || [];
}

// ---------- Piezas ----------
function tarjeta(p) {
  const mia = p.user_id === yo;
  const guard = guardadas().has(p.id);
  return `
    <article class="sp" data-pub="${p.id}">
      <header class="sp-cab">
        <button class="sp-autor" data-perfil="${p.user_id}"><span class="sp-foto">${inicial(p.autor)}</span><b>${escapar(p.autor?.usuario || 'usuario')}</b></button>
        ${mia ? `<span class="sp-vis" title="Visibilidad">${ico(p.visibilidad === 'privada' ? 'candado' : p.visibilidad === 'publica' ? 'mundo' : 'personas')}${VIS[p.visibilidad]}</span>` : ''}
        <button class="sp-icono" data-menu-pub="${p.id}" aria-label="Más opciones">${ico('mas', 'fill="currentColor" stroke="none"')}</button>
        <div class="sp-menu" hidden>${mia ? `
          ${Object.entries(VIS).filter(([k]) => k !== p.visibilidad && (v2 || k !== 'publica')).map(([k, n]) => `<button data-cambiar-vis="${k}" data-id="${p.id}">Cambiar a «${n}»</button>`).join('')}
          <button data-editar="${p.id}">Editar descripción</button>
          <button class="peligro" data-borrar="${p.id}" data-ruta="${escapar(p.ruta)}">Borrar</button>` : `
          <button data-denunciar="${p.id}" data-usuario="${p.user_id}">Denunciar</button>
          <button class="peligro" data-bloquear="${p.user_id}">Bloquear a @${escapar(p.autor?.usuario || '')}</button>`}
        </div>
      </header>
      ${p.url ? `<img class="sp-img" src="${p.url}" alt="${escapar(p.descripcion || 'Foto')}" loading="lazy">` : '<div class="sp-img sp-sin"></div>'}
      ${v2 ? `<div class="sp-barra">
        <button class="sp-icono sp-like${p.meGusta ? ' activo' : ''}" data-like="${p.id}" aria-pressed="${p.meGusta}" aria-label="Me gusta">${ico('corazon')}</button>
        <button class="sp-icono" data-comentar="${p.id}" aria-label="Comentar">${ico('comentario')}</button>
        ${p.visibilidad === 'publica' ? `<button class="sp-icono" data-compartir="${p.id}" aria-label="Compartir">${ico('enviar')}</button>` : '<span></span>'}
        <span></span>
        <button class="sp-icono sp-guardar${guard ? ' activo' : ''}" data-guardar-pub="${p.id}" aria-pressed="${guard}" aria-label="Guardar">${ico('guardar')}</button>
      </div>` : ''}
      <div class="sp-texto">
        ${v2 ? `<p class="sp-likes" data-likes="${p.id}">${p.likes} Me gusta</p>` : ''}
        ${p.descripcion ? `<p><b>${escapar(p.autor?.usuario || '')}</b> ${escapar(p.descripcion)}</p>` : ''}
        ${v2 && p.comentarios ? `<button class="sp-vercom" data-comentar="${p.id}">Ver ${p.comentarios === 1 ? 'el comentario' : `los ${p.comentarios} comentarios`}</button>` : ''}
        <div class="sp-coms" data-coms="${p.id}" hidden></div>
        <small>${hace(p.creado)}</small>
      </div>
    </article>`;
}
const feedHtml = (pubs, vacio) => (pubs.length ? `<div class="sp-feed">${pubs.map(tarjeta).join('')}</div>` : vacio);
const vacio = (titulo, texto, boton = '') => `<div class="sp-vacio"><div class="sp-vacio-ico">${ico('personas')}</div><h3>${titulo}</h3><p>${texto}</p>${boton}</div>`;
function fila(id, p, acciones) {
  return `<li class="sp-persona"><button class="sp-autor" data-perfil="${id}"><span class="sp-foto">${inicial(p)}</span><span><b>${escapar(p?.usuario || 'usuario')}</b>${p?.nombre ? `<small>${escapar(p.nombre)}</small>` : ''}</span></button><span class="acciones">${acciones}</span></li>`;
}
function botonSeguir(id, rel) {
  const r = rel.find(x => x.seguidor === yo && x.seguido === id);
  if (!r) return `<button class="btn primario chico" data-seguir="${id}">Seguir</button>`;
  return `<button class="btn chico" data-quitar="${yo}|${id}">${r.estado === 'pendiente' ? 'Solicitado' : 'Siguiendo'}</button>`;
}

// ---------- Pantalla ----------
export async function renderSocial(cont, ctx) {
  const { sesionIniciada, abrirLogin } = ctx;
  if (!sesionIniciada) {
    cont.innerHTML = vacio('Tu comunidad, cuando tú quieras',
      'Entra en tu cuenta para guardar fotos en la nube, compartir las que elijas y seguir a otras personas. Todo es privado hasta que decidas lo contrario.',
      '<button class="btn primario" data-entrar>Entrar</button>');
    cont.onclick = ev => { if (ev.target.closest('[data-entrar]')) abrirLogin(); };
    return;
  }
  cont.innerHTML = cargador('Cargando tu comunidad…');
  try {
    yo = (await supabase.auth.getUser()).data.user.id;
    let r = await supabase.from('perfiles_publicos').select('usuario, nombre, bio').eq('user_id', yo).maybeSingle();
    if (r.error && /bio/.test(r.error.message || '')) { v2 = false; r = await supabase.from('perfiles_publicos').select('usuario, nombre').eq('user_id', yo).maybeSingle(); }
    miPerfil = r.data;
    if (v2) { const t = await supabase.from('me_gusta').select('user_id').limit(1); if (faltaTabla(t.error)) v2 = false; }
  } catch (e) { cont.innerHTML = vacio('No se pudo cargar tu comunidad', 'Comprueba tu conexión y vuelve a intentarlo.'); console.warn(e); return; }

  cont.innerHTML = `
    <div class="sp-top">
      <nav class="segmento-suave sp-tabs" role="tablist" aria-label="Comunidad">${PESTANAS.map(([k, n]) => `<button role="tab" data-pestana="${k}">${n}<span class="sp-globo" data-globo="${k}" hidden></span></button>`).join('')}</nav>
      <button class="btn primario sp-nueva" data-nueva>Publicar</button>
    </div>
    ${v2 ? '' : '<p class="sp-aviso-v2">Me gusta, comentarios, publicaciones públicas y bloqueos se activan al aplicar <code>sql/comunidad_v2.sql</code> en Supabase.</p>'}
    <div class="sp-caja" id="sp-caja"></div>`;
  const caja = cont.querySelector('#sp-caja');
  const ir = async k => {
    pestana = k; perfilAbierto = null;
    cont.querySelectorAll('[data-pestana]').forEach(b => { b.classList.toggle('activo', b.dataset.pestana === k); b.setAttribute('aria-selected', String(b.dataset.pestana === k)); });
    await pintar(caja);
  };
  // Aviso de solicitudes pendientes
  relaciones().then(rel => {
    const n = rel.filter(x => x.seguido === yo && x.estado === 'pendiente').length;
    const g = cont.querySelector('[data-globo="actividad"]'); if (g && n) { g.hidden = false; g.textContent = n; }
  }).catch(() => {});
  await ir(pestana);

  // ---------- Eventos ----------
  cont.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.pestana) return ir(b.dataset.pestana);
    if (b.matches('[data-nueva]')) return abrirNueva(cont, () => ir('perfil'));
    if (b.dataset.perfil) { perfilAbierto = b.dataset.perfil === yo ? null : b.dataset.perfil; if (!perfilAbierto) return ir('perfil'); return pintarPerfil(caja, perfilAbierto); }
    if (b.dataset.menuPub) { const m = b.parentElement.querySelector('.sp-menu'); m.hidden = !m.hidden; return; }
    try {
      if (b.dataset.like) return await alternarLike(b);
      if (b.dataset.comentar) return await abrirComentarios(cont, b.dataset.comentar);
      if (b.dataset.guardarPub) {
        const s = guardadas(), id = b.dataset.guardarPub;
        s.has(id) ? s.delete(id) : s.add(id); guardar('social-guardadas', [...s]);
        b.classList.toggle('activo', s.has(id)); b.setAttribute('aria-pressed', String(s.has(id)));
        return aviso(s.has(id) ? 'Guardada' : 'Quitada de guardadas');
      }
      if (b.dataset.compartir) {
        const autor = b.closest('.sp').querySelector('.sp-autor b').textContent;
        const texto = `Mira la publicación de @${autor} en SYNCO`;
        if (navigator.share) await navigator.share({ title: 'SYNCO', text: texto }).catch(() => {});
        else { await navigator.clipboard.writeText(texto); aviso('Copiado'); }
        return;
      }
      if (b.dataset.cambiarVis) {
        const k = b.dataset.cambiarVis;
        const msg = { compartida: '¿Compartir esta foto con tus seguidores aceptados?', publica: '¿Hacerla pública? Cualquier persona con cuenta en SYNCO podrá verla en Para ti y Explorar.' }[k];
        if (msg && !confirm(msg)) return;
        const { error } = await supabase.from('publicaciones').update({ visibilidad: k, actualizado: new Date().toISOString() }).eq('id', b.dataset.id);
        if (error) return fallo(error);
        aviso(k === 'privada' ? 'Ahora solo la ves tú' : k === 'publica' ? 'Ahora es pública' : 'Ahora la ven tus seguidores');
        return perfilAbierto ? pintarPerfil(caja, perfilAbierto) : pintar(caja);
      }
      if (b.dataset.editar) {
        const actual = b.closest('.sp').querySelector('.sp-texto p:not(.sp-likes)')?.textContent.replace(/^\S+\s/, '') || '';
        const texto = prompt('Descripción de la foto', actual);
        if (texto === null) return;
        const { error } = await supabase.from('publicaciones').update({ descripcion: texto.trim().slice(0, 1000) || null, actualizado: new Date().toISOString() }).eq('id', b.dataset.editar);
        if (error) return fallo(error);
        return pintar(caja);
      }
      if (b.dataset.borrar) {
        if (!confirm('¿Borrar esta foto para siempre? No se puede deshacer.')) return;
        const { error } = await supabase.from('publicaciones').delete().eq('id', b.dataset.borrar);
        if (error) return fallo(error);
        await supabase.storage.from('publicaciones').remove([b.dataset.ruta]);
        aviso('Foto borrada'); return pintar(caja);
      }
      if (b.dataset.seguir) {
        const { error } = await supabase.from('seguidores').insert({ seguidor: yo, seguido: b.dataset.seguir });
        if (error && error.code !== '23505') return fallo(error);
        aviso('Solicitud enviada. Verás lo que comparta cuando te acepte.');
        b.outerHTML = `<button class="btn chico" data-quitar="${yo}|${b.dataset.seguir}">Solicitado</button>`;
        return;
      }
      if (b.dataset.quitar) {
        const [seguidor, seguido] = b.dataset.quitar.split('|');
        if (seguidor === yo && !confirm('¿Dejar de seguir?')) return;
        const { error } = await supabase.from('seguidores').delete().eq('seguidor', seguidor).eq('seguido', seguido);
        if (error) return fallo(error);
        return perfilAbierto ? pintarPerfil(caja, perfilAbierto) : pintar(caja);
      }
      if (b.dataset.aceptar) {
        const { error } = await supabase.from('seguidores').update({ estado: 'aceptado' }).eq('seguidor', b.dataset.aceptar).eq('seguido', yo);
        if (error) return fallo(error);
        aviso('Aceptado'); return pintar(caja);
      }
      if (b.dataset.bloquear) {
        if (!confirm('¿Bloquear a esta persona? Dejaréis de ver vuestras publicaciones y se eliminará el seguimiento.')) return;
        const otro = b.dataset.bloquear;
        const { error } = await supabase.from('bloqueos').insert({ bloqueador: yo, bloqueado: otro });
        if (error && error.code !== '23505') return fallo(error);
        await supabase.from('seguidores').delete().eq('seguidor', yo).eq('seguido', otro);
        await supabase.from('seguidores').delete().eq('seguidor', otro).eq('seguido', yo);
        aviso('Bloqueado'); perfilAbierto = null; return pintar(caja);
      }
      if (b.dataset.desbloquear) {
        const { error } = await supabase.from('bloqueos').delete().eq('bloqueador', yo).eq('bloqueado', b.dataset.desbloquear);
        if (error) return fallo(error);
        return pintar(caja);
      }
      if (b.dataset.denunciar || b.dataset.denunciarUsuario) {
        const motivo = prompt('Cuéntanos qué ocurre (lo revisará el equipo de SYNCO):');
        if (!motivo?.trim()) return;
        const { error } = await supabase.from('denuncias').insert({ publicacion_id: b.dataset.denunciar || null, usuario_id: b.dataset.usuario || b.dataset.denunciarUsuario, motivo: motivo.trim().slice(0, 500) });
        if (error) return fallo(error);
        return aviso('Denuncia enviada. Gracias.');
      }
      if (b.dataset.editarPerfil !== undefined) return editarPerfil(cont, () => ir('perfil'));
      if (b.dataset.subpestana) { cont.dataset.sub = b.dataset.subpestana; return pintar(caja); }
    } catch (e) { fallo(e); }
  };
  cont.oninput = ev => {
    const i = ev.target.closest('[data-buscar]');
    if (!i) return;
    clearTimeout(i._t);
    i._t = setTimeout(() => buscar(cont, i.value), 250);
  };
}

async function pintar(caja) {
  caja.innerHTML = cargador();
  try {
    if (pestana === 'parati') return await pintarParaTi(caja);
    if (pestana === 'siguiendo') return await pintarSiguiendo(caja);
    if (pestana === 'explorar') return await pintarExplorar(caja);
    if (pestana === 'perfil') return await pintarPerfil(caja, yo);
    return await pintarActividad(caja);
  } catch (e) { caja.innerHTML = vacio('No se pudo cargar', 'Comprueba tu conexión.'); console.warn(e); }
}

async function pintarParaTi(caja) {
  if (!v2) { caja.innerHTML = vacio('Para ti estará disponible pronto', 'Aquí verás las publicaciones que otras personas hayan hecho públicas.'); return; }
  const { data, error } = await supabase.from('publicaciones').select('id, user_id, ruta, descripcion, visibilidad, creado')
    .eq('visibilidad', 'publica').neq('user_id', yo).order('creado', { ascending: false }).limit(30);
  if (error) throw error;
  caja.innerHTML = feedHtml(await completar(data), vacio('Todavía no hay publicaciones públicas',
    'Cuando alguien haga pública una foto, aparecerá aquí. Puedes ser la primera persona: tus fotos son privadas salvo que elijas «Pública».',
    '<button class="btn primario" data-nueva>Publicar</button>'));
}

async function pintarSiguiendo(caja) {
  const rel = await relaciones();
  const sigo = rel.filter(r => r.seguidor === yo && r.estado === 'aceptado').map(r => r.seguido);
  if (!sigo.length) { caja.innerHTML = vacio('Aún no sigues a nadie', 'Busca personas en Explorar. Cuando te acepten, verás aquí lo que compartan.', '<button class="btn" data-pestana="explorar">Ir a Explorar</button>'); return; }
  const { data, error } = await supabase.from('publicaciones').select('id, user_id, ruta, descripcion, visibilidad, creado')
    .in('user_id', sigo).in('visibilidad', v2 ? ['compartida', 'publica'] : ['compartida']).order('creado', { ascending: false }).limit(30);
  if (error) throw error;
  caja.innerHTML = feedHtml(await completar(data), vacio('Nada nuevo por aquí', 'Las personas que sigues aún no han compartido fotos.'));
}

async function pintarExplorar(caja) {
  const rel = await relaciones();
  const sigo = new Set(rel.filter(r => r.seguidor === yo).map(r => r.seguido));
  const { data: sugeridos } = await supabase.from('perfiles_publicos').select(v2 ? 'user_id, usuario, nombre, bio' : 'user_id, usuario, nombre')
    .neq('user_id', yo).order('creado', { ascending: false }).limit(12);
  const sug = (sugeridos || []).filter(p => !sigo.has(p.user_id)).slice(0, 8);
  let rejilla = '';
  if (v2) {
    const { data } = await supabase.from('publicaciones').select('id, user_id, ruta, descripcion, visibilidad, creado').eq('visibilidad', 'publica').neq('user_id', yo).order('creado', { ascending: false }).limit(24);
    const urls = await urlsFirmadas((data || []).map(p => p.ruta));
    rejilla = (data || []).length ? `<h3 class="sp-h">Publicaciones públicas</h3><div class="sp-rejilla">${data.map(p => `<button class="sp-celda" data-perfil="${p.user_id}" aria-label="Ver perfil">${urls[p.ruta] ? `<img src="${urls[p.ruta]}" alt="" loading="lazy">` : ''}</button>`).join('')}</div>` : '';
  }
  caja.innerHTML = `
    <div class="sp-busca"><input type="search" data-buscar placeholder="Buscar personas por nombre o usuario" aria-label="Buscar personas"></div>
    <ul class="sp-personas" id="sp-resultados"></ul>
    <div id="sp-sugerencias">${sug.length ? `<h3 class="sp-h">Personas en SYNCO</h3><ul class="sp-personas">${sug.map(p => fila(p.user_id, p, botonSeguir(p.user_id, rel))).join('')}</ul>`
      : vacio('Aún no hay más personas', 'Cuando otras personas creen su perfil en SYNCO, podrás encontrarlas aquí.')}</div>
    ${rejilla}`;
}

async function buscar(cont, texto) {
  const lista = cont.querySelector('#sp-resultados');
  const sugerencias = cont.querySelector('#sp-sugerencias');
  if (!lista) return;
  const t = texto.trim().toLowerCase().replace(/[%_,()]/g, '');
  if (t.length < 1) { lista.innerHTML = ''; if (sugerencias) sugerencias.hidden = false; return; }
  if (sugerencias) sugerencias.hidden = true;
  const [{ data }, rel] = await Promise.all([
    supabase.from('perfiles_publicos').select('user_id, usuario, nombre').or(`usuario.ilike.%${t}%,nombre.ilike.%${t}%`).neq('user_id', yo).limit(15),
    relaciones(),
  ]);
  lista.innerHTML = (data || []).map(p => fila(p.user_id, p, botonSeguir(p.user_id, rel))).join('') || '<li class="tenue sp-nadie">Nadie coincide con esa búsqueda.</li>';
}

async function pintarPerfil(caja, id) {
  const mio = id === yo;
  const rel = await relaciones();
  const [perfiles, cont] = await Promise.all([
    perfilesDe([id]),
    v2 ? supabase.rpc('lumen_contadores', { perfil: id }) : { data: null },
  ]);
  const p = perfiles[id];
  const c = cont.data?.[0] || {
    seguidores: rel.filter(r => r.seguido === id && r.estado === 'aceptado').length,
    seguidos: rel.filter(r => r.seguidor === id && r.estado === 'aceptado').length, publicaciones: null,
  };
  const sub = mio ? (caja.closest('[data-sub]')?.dataset.sub || caja.parentElement.dataset.sub || 'publicaciones') : 'publicaciones';
  let pubs = [];
  if (sub === 'guardadas' && mio) {
    const ids = [...guardadas()];
    if (ids.length) { const { data } = await supabase.from('publicaciones').select('id, user_id, ruta, descripcion, visibilidad, creado').in('id', ids); pubs = data || []; }
  } else {
    const { data } = await supabase.from('publicaciones').select('id, user_id, ruta, descripcion, carpeta, visibilidad, creado').eq('user_id', id).order('creado', { ascending: false }).limit(60);
    pubs = data || [];
  }
  const llenas = await completar(pubs);
  const bloqueados = mio && v2 ? (await supabase.from('bloqueos').select('bloqueado')).data || [] : [];
  const perfBloq = bloqueados.length ? await perfilesDe(bloqueados.map(b => b.bloqueado)) : {};
  caja.innerHTML = `
    <section class="sp-perfil">
      <div class="sp-perfil-foto">${inicial(p)}</div>
      <div class="sp-perfil-datos">
        <h2>${escapar(p?.nombre || p?.usuario || (mio ? 'Tu perfil' : 'Perfil'))}</h2>
        ${p ? `<p class="sp-usuario">@${escapar(p.usuario)}</p>` : ''}
        ${p?.bio ? `<p class="sp-bio">${escapar(p.bio)}</p>` : ''}
        <div class="sp-contadores">
          ${c.publicaciones !== null && c.publicaciones !== undefined ? `<span><b>${c.publicaciones}</b> públicas</span>` : ''}
          <span><b>${c.seguidores}</b> seguidores</span><span><b>${c.seguidos}</b> seguidos</span>
        </div>
        <div class="sp-perfil-acciones">
          ${mio ? `<button class="btn chico" data-editar-perfil>${p ? 'Editar perfil' : 'Crear perfil público'}</button>`
            : `${botonSeguir(id, rel)}${v2 ? `<button class="btn chico" data-denunciar-usuario="${id}">Denunciar</button><button class="btn chico" data-bloquear="${id}">Bloquear</button>` : ''}`}
        </div>
      </div>
    </section>
    ${mio ? `<nav class="segmento-suave sp-sub">${[['publicaciones', 'Mis publicaciones'], ['guardadas', 'Guardadas']].map(([k, n]) => `<button data-subpestana="${k}" class="${sub === k ? 'activo' : ''}">${n}</button>`).join('')}</nav>` : ''}
    ${mio && sub === 'publicaciones' ? '<p class="sp-nota">Tus fotos son privadas salvo que elijas compartirlas. El candado indica las que solo ves tú.</p>' : ''}
    ${feedHtml(llenas, mio ? vacio(sub === 'guardadas' ? 'Sin guardadas' : 'Aún no has publicado', sub === 'guardadas' ? 'Guarda publicaciones con el marcador para verlas aquí.' : 'Sube tu primera foto. Se guardará en privado salvo que decidas lo contrario.', sub === 'guardadas' ? '' : '<button class="btn primario" data-nueva>Publicar</button>')
      : vacio('Nada que ver todavía', 'Esta persona no ha compartido publicaciones contigo.'))}
    ${bloqueados.length ? `<h3 class="sp-h">Personas bloqueadas</h3><ul class="sp-personas">${bloqueados.map(b => fila(b.bloqueado, perfBloq[b.bloqueado], `<button class="btn chico" data-desbloquear="${b.bloqueado}">Desbloquear</button>`)).join('')}</ul>` : ''}`;
}

async function pintarActividad(caja) {
  const rel = await relaciones();
  const pendientes = rel.filter(r => r.seguido === yo && r.estado === 'pendiente');
  const seguidores = rel.filter(r => r.seguido === yo && r.estado === 'aceptado');
  const eventos = [];
  if (v2) {
    const { data: mias } = await supabase.from('publicaciones').select('id').eq('user_id', yo).limit(200);
    const ids = (mias || []).map(p => p.id);
    if (ids.length) {
      const [lk, cm] = await Promise.all([
        supabase.from('me_gusta').select('publicacion_id, user_id, creado').in('publicacion_id', ids).neq('user_id', yo).order('creado', { ascending: false }).limit(40),
        supabase.from('comentarios').select('publicacion_id, user_id, texto, creado').in('publicacion_id', ids).neq('user_id', yo).order('creado', { ascending: false }).limit(40),
      ]);
      (lk.data || []).forEach(x => eventos.push({ tipo: 'like', ...x }));
      (cm.data || []).forEach(x => eventos.push({ tipo: 'comentario', ...x }));
    }
  }
  const perfiles = await perfilesDe([...pendientes.map(r => r.seguidor), ...seguidores.map(r => r.seguidor), ...eventos.map(e => e.user_id)]);
  eventos.sort((a, b) => b.creado.localeCompare(a.creado));
  caja.innerHTML = `
    ${pendientes.length ? `<h3 class="sp-h">Solicitudes</h3><ul class="sp-personas">${pendientes.map(r => fila(r.seguidor, perfiles[r.seguidor],
      `<button class="btn primario chico" data-aceptar="${r.seguidor}">Aceptar</button><button class="btn chico" data-quitar="${r.seguidor}|${yo}">Rechazar</button>`)).join('')}</ul>` : ''}
    ${eventos.length ? `<h3 class="sp-h">Interacciones</h3><ul class="sp-eventos">${eventos.map(e => `
      <li><span class="sp-foto">${inicial(perfiles[e.user_id])}</span><p><b>${escapar(perfiles[e.user_id]?.usuario || 'Alguien')}</b> ${e.tipo === 'like' ? 'ha indicado que le gusta tu publicación.' : `ha comentado: «${escapar(e.texto)}»`}<small>${hace(e.creado)}</small></p></li>`).join('')}</ul>` : ''}
    ${seguidores.length ? `<h3 class="sp-h">Te siguen</h3><ul class="sp-personas">${seguidores.map(r => fila(r.seguidor, perfiles[r.seguidor], `<button class="btn chico" data-quitar="${r.seguidor}|${yo}">Quitar</button>`)).join('')}</ul>` : ''}
    ${!pendientes.length && !eventos.length && !seguidores.length ? vacio('Sin actividad todavía', 'Aquí verás solicitudes de seguimiento, me gusta y comentarios en tus publicaciones.') : ''}`;
}

// ---------- Me gusta y comentarios ----------
async function alternarLike(b) {
  const id = b.dataset.like, activo = b.classList.contains('activo');
  b.classList.toggle('activo', !activo); b.setAttribute('aria-pressed', String(!activo));
  if (!activo) { b.classList.remove('late'); void b.offsetWidth; b.classList.add('late'); }
  const linea = document.querySelector(`[data-likes="${id}"]`);
  const n = parseInt(linea?.textContent, 10) || 0;
  if (linea) linea.textContent = `${n + (activo ? -1 : 1)} Me gusta`;
  const { error } = activo
    ? await supabase.from('me_gusta').delete().eq('publicacion_id', id).eq('user_id', yo)
    : await supabase.from('me_gusta').insert({ publicacion_id: id, user_id: yo });
  if (error && error.code !== '23505') {
    b.classList.toggle('activo', activo); if (linea) linea.textContent = `${n} Me gusta`;
    fallo(error);
  }
}
async function abrirComentarios(cont, id) {
  const caja = cont.querySelector(`[data-coms="${id}"]`);
  if (!caja) return;
  if (!caja.hidden && caja.dataset.cargado) { caja.querySelector('input')?.focus(); return; }
  caja.hidden = false;
  caja.innerHTML = cargador('Cargando comentarios…');
  const { data, error } = await supabase.from('comentarios').select('id, user_id, texto, creado').eq('publicacion_id', id).order('creado').limit(100);
  if (error) { caja.innerHTML = ''; return fallo(error); }
  const perfiles = await perfilesDe(data.map(c => c.user_id));
  const autor = cont.querySelector(`[data-pub="${id}"]`)?.querySelector('[data-perfil]')?.dataset.perfil;
  caja.dataset.cargado = '1';
  caja.innerHTML = `
    <ul>${data.map(c => `<li><p><b>${escapar(perfiles[c.user_id]?.usuario || 'usuario')}</b> ${escapar(c.texto)}</p><small>${hace(c.creado)}</small>${c.user_id === yo || autor === yo ? `<button class="sp-borrar-com" data-borrar-com="${c.id}" data-pub-com="${id}">Borrar</button>` : ''}</li>`).join('')}</ul>
    <form class="sp-form" data-form-com="${id}"><input name="c" maxlength="500" placeholder="Añade un comentario…" autocomplete="off" aria-label="Comentario"><button disabled>Publicar</button></form>`;
  const form = caja.querySelector('form');
  form.c.oninput = () => { form.querySelector('button').disabled = !form.c.value.trim(); };
  form.onsubmit = async ev => {
    ev.preventDefault();
    const texto = form.c.value.trim();
    if (!texto) return;
    const { error: e } = await supabase.from('comentarios').insert({ publicacion_id: id, user_id: yo, texto });
    if (e) return fallo(e);
    delete caja.dataset.cargado; caja.hidden = true;
    abrirComentarios(cont, id);
  };
  caja.onclick = async ev => {
    const b = ev.target.closest('[data-borrar-com]');
    if (!b) return;
    ev.stopPropagation();
    const { error: e } = await supabase.from('comentarios').delete().eq('id', b.dataset.borrarCom);
    if (e) return fallo(e);
    delete caja.dataset.cargado; caja.hidden = true; abrirComentarios(cont, id);
  };
  form.c.focus();
}

// ---------- Hojas: nueva publicación y editar perfil ----------
function hoja(html) {
  const h = document.createElement('div');
  h.className = 'sp-hoja-fondo';
  h.innerHTML = `<div class="sp-hoja" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(h);
  requestAnimationFrame(() => h.classList.add('ver'));
  const cerrar = () => { h.classList.remove('ver'); setTimeout(() => h.remove(), 250); };
  h.addEventListener('click', ev => { if (ev.target === h || ev.target.closest('[data-cerrar-hoja]')) cerrar(); });
  return { h, cerrar };
}

function abrirNueva(cont, alTerminar) {
  const { h, cerrar } = hoja(`
    <header><h3>Nueva publicación</h3><button class="sp-icono" data-cerrar-hoja aria-label="Cerrar">×</button></header>
    <form class="sp-nueva-form">
      <label class="social-foto" data-vista-previa><span>Elegir foto</span><input type="file" accept="image/*" name="foto" hidden required></label>
      <label class="campo">Descripción <textarea name="descripcion" maxlength="1000" rows="3" placeholder="¿Qué quieres contar?"></textarea></label>
      <label class="campo">Carpeta <select name="carpeta">${Object.entries(CARPETAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <fieldset class="sp-visibilidad"><legend>Quién la ve</legend>
        ${Object.entries(VIS).filter(([k]) => v2 || k !== 'publica').map(([k, n]) => `
          <label><input type="radio" name="vis" value="${k}" ${k === 'privada' ? 'checked' : ''}><span>${ico(k === 'privada' ? 'candado' : k === 'publica' ? 'mundo' : 'personas')}<b>${n}</b><small>${k === 'privada' ? 'Por defecto. Nadie más puede verla.' : k === 'compartida' ? 'Solo las personas que has aceptado.' : 'Cualquiera con cuenta en SYNCO, en Para ti y Explorar.'}</small></span></label>`).join('')}
      </fieldset>
      <button class="btn primario" data-publicar>Guardar en privado</button>
    </form>`);
  const f = h.querySelector('form');
  f.addEventListener('change', ev => {
    const archivo = ev.target.closest('input[name="foto"]')?.files?.[0];
    if (archivo) {
      urlsTemp.forEach(u => URL.revokeObjectURL(u));
      const u = URL.createObjectURL(archivo); urlsTemp.push(u);
      const c = f.querySelector('[data-vista-previa]'); c.style.backgroundImage = `url("${u}")`; c.classList.add('con-foto');
    }
    if (ev.target.name === 'vis') f.querySelector('[data-publicar]').textContent = { privada: 'Guardar en privado', compartida: 'Publicar para mis seguidores', publica: 'Publicar' }[ev.target.value];
  });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const archivo = f.foto.files[0];
    if (!archivo) return aviso('Elige una foto', 'error');
    const vis = f.vis.value;
    if (vis === 'publica' && !confirm('Esta foto será visible para cualquier persona con cuenta en SYNCO. ¿Continuar?')) return;
    const boton = f.querySelector('[data-publicar]'); boton.disabled = true;
    const ruta = `${yo}/${crypto.randomUUID()}.jpg`;
    try {
      const blob = await comprimir(archivo, 1600, 0.85);
      const { error: e1 } = await supabase.storage.from('publicaciones').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('publicaciones').insert({ ruta, descripcion: f.descripcion.value.trim() || null, carpeta: f.carpeta.value, visibilidad: vis });
      if (e2) { await supabase.storage.from('publicaciones').remove([ruta]); throw e2; }
      aviso(vis === 'privada' ? 'Guardada en privado' : 'Publicada');
      cerrar(); alTerminar();
    } catch (e) { fallo(e, 'No se pudo subir la foto'); boton.disabled = false; }
  });
}

function editarPerfil(cont, alTerminar) {
  const p = miPerfil || {};
  const { h, cerrar } = hoja(`
    <header><h3>${miPerfil ? 'Editar perfil' : 'Crear perfil público'}</h3><button class="sp-icono" data-cerrar-hoja aria-label="Cerrar">×</button></header>
    <form class="sp-nueva-form">
      <label class="campo">Nombre de usuario <input name="usuario" value="${escapar(p.usuario || '')}" pattern="[a-z0-9_.]{3,24}" title="De 3 a 24 caracteres: minúsculas, números, punto o guion bajo" required></label>
      <label class="campo">Nombre <input name="nombre" maxlength="60" value="${escapar(p.nombre || '')}"></label>
      ${v2 ? `<label class="campo">Biografía <textarea name="bio" maxlength="160" rows="2">${escapar(p.bio || '')}</textarea></label>` : ''}
      <p class="sp-nota">Tu perfil lo pueden encontrar otras personas con cuenta. Tus fotos siguen siendo privadas salvo que las compartas.</p>
      <button class="btn primario">Guardar</button>
    </form>`);
  h.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const datos = { user_id: yo, usuario: f.usuario.value.trim().toLowerCase(), nombre: f.nombre.value.trim() || null };
    if (v2) datos.bio = f.bio.value.trim() || null;
    const { error } = await supabase.from('perfiles_publicos').upsert(datos);
    if (error) return aviso(error.code === '23505' ? 'Ese nombre de usuario ya existe. Prueba con otro.' : 'No se pudo guardar el perfil', 'error');
    miPerfil = datos; aviso('Perfil guardado'); cerrar(); alTerminar();
  });
}
