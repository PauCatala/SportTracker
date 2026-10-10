// IMAGEN · COMUNIDAD: publicaciones en tu cuenta, privadas por defecto, y gente a la que sigues.
// - Las fotos van a un almacén PRIVADO de Supabase: solo se ven con un enlace firmado y caducable,
//   y solo si eres el dueño o un seguidor aceptado y la foto está compartida (lo exige la base de datos).
// - Seguir a alguien es una petición: no ves nada hasta que te acepta.
import { supabase } from './db.js';
import { escapar } from './almacen.js';
import { comprimir } from './fotos.js';
import { icono } from './iconos.js';
import { aviso } from './utils.js';

const CARPETAS = { dia: 'Tu día', progreso: 'Progreso físico', comidas: 'Comidas', entreno: 'Entreno', otro: 'Otro' };
let pestana = 'siguiendo';
let yo = null;
let urlsTemp = [];

const fecha = iso => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const error = (e, texto = 'No se pudo completar') => { console.warn(e); aviso(`${texto}. Revisa tu conexión e inténtalo de nuevo.`, 'error'); };

async function urlsFirmadas(rutas) {
  if (!rutas.length) return {};
  const { data, error: e } = await supabase.storage.from('publicaciones').createSignedUrls(rutas, 3600);
  if (e) throw e;
  return Object.fromEntries(data.filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
}
async function perfilesDe(ids) {
  if (!ids.length) return {};
  const { data, error: e } = await supabase.from('perfiles_publicos').select('user_id, usuario, nombre').in('user_id', [...new Set(ids)]);
  if (e) throw e;
  return Object.fromEntries(data.map(p => [p.user_id, p]));
}

// ---------- Pintar ----------
export async function renderSocial(cont, { sesionIniciada, abrirLogin }) {
  if (!sesionIniciada) {
    cont.innerHTML = `<div class="vacio"><h3>Tu comunidad, cuando tú quieras</h3>
      <p>Entra en tu cuenta para guardar fotos en la nube, compartir las que elijas y seguir a otras personas. Todo es privado hasta que decidas lo contrario.</p>
      <button class="btn primario" data-entrar>Entrar</button></div>`;
    cont.onclick = ev => { if (ev.target.closest('[data-entrar]')) abrirLogin(); };
    return;
  }
  cont.innerHTML = '<p class="tenue" style="text-align:center;padding:40px 0">Cargando tu comunidad…</p>';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    yo = user.id;
    const { data: perfil } = await supabase.from('perfiles_publicos').select('usuario, nombre').eq('user_id', yo).maybeSingle();
    const { data: relaciones } = await supabase.from('seguidores').select('seguidor, seguido, estado');
    const siguiendo = (relaciones || []).filter(r => r.seguidor === yo && r.estado === 'aceptado').length;
    const seguidores = (relaciones || []).filter(r => r.seguido === yo && r.estado === 'aceptado').length;
    const solicitudes = (relaciones || []).filter(r => r.seguido === yo && r.estado === 'pendiente').length;

    cont.innerHTML = `
      <section class="panel social-cab">
        <div>
          <h3>${perfil ? `@${escapar(perfil.usuario)}` : 'Tu perfil público'}</h3>
          <p class="tenue">${perfil ? `${seguidores} seguidores · ${siguiendo} siguiendo` : 'Elige un nombre de usuario para que otras personas puedan encontrarte. Tus fotos siguen siendo privadas.'}</p>
        </div>
        <form class="social-usuario" data-form-usuario>
          <input name="usuario" placeholder="nombre_de_usuario" value="${escapar(perfil?.usuario || '')}" pattern="[a-z0-9_.]{3,24}" title="De 3 a 24 caracteres: minúsculas, números, punto o guion bajo" required aria-label="Nombre de usuario">
          <button class="btn chico">${perfil ? 'Cambiar' : 'Crear perfil'}</button>
        </form>
      </section>

      <section class="panel social-nueva">
        <div class="panel-cab"><h3>Nueva publicación</h3><span class="tenue">Privada por defecto</span></div>
        <form data-form-pub class="social-form">
          <label class="social-foto" data-vista-previa>
            ${icono('imagen')}<span>Elegir foto</span>
            <input type="file" accept="image/*" name="foto" hidden required>
          </label>
          <div class="social-campos">
            <label class="campo">Descripción <textarea name="descripcion" maxlength="1000" rows="3" placeholder="¿Qué quieres recordar de esta foto?"></textarea></label>
            <label class="campo">Carpeta <select name="carpeta">${Object.entries(CARPETAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
            <label class="interruptor">
              <input type="checkbox" name="compartir">
              <span class="pista" aria-hidden="true"></span>
              <span><b>Compartir con mis seguidores</b><small>Si no lo marcas, solo la verás tú.</small></span>
            </label>
            <button class="btn primario" data-publicar>Guardar en privado</button>
          </div>
        </form>
      </section>

      <nav class="segmento social-tabs" aria-label="Comunidad">
        <button data-pestana="siguiendo" class="${pestana === 'siguiendo' ? 'activo' : ''}">Siguiendo</button>
        <button data-pestana="mias" class="${pestana === 'mias' ? 'activo' : ''}">Mis fotos</button>
        <button data-pestana="personas" class="${pestana === 'personas' ? 'activo' : ''}">Personas${solicitudes ? ` <span class="globo">${solicitudes}</span>` : ''}</button>
      </nav>
      <div id="social-lista"></div>`;
    pintarPestana(cont.querySelector('#social-lista'), perfil);
  } catch (e) {
    cont.innerHTML = '<div class="vacio"><h3>No se pudo cargar tu comunidad</h3><p>Comprueba tu conexión y vuelve a intentarlo.</p></div>';
    console.warn(e);
    return;
  }

  // ---------- Eventos ----------
  cont.onchange = ev => {
    const archivo = ev.target.closest('input[name="foto"]')?.files?.[0];
    if (archivo) {
      urlsTemp.forEach(u => URL.revokeObjectURL(u));
      const u = URL.createObjectURL(archivo); urlsTemp = [u];
      const caja = cont.querySelector('[data-vista-previa]');
      caja.style.backgroundImage = `url("${u}")`;
      caja.classList.add('con-foto');
    }
    const c = ev.target.closest('input[name="compartir"]');
    if (c) cont.querySelector('[data-publicar]').textContent = c.checked ? 'Publicar para mis seguidores' : 'Guardar en privado';
  };

  cont.onsubmit = async ev => {
    ev.preventDefault();
    const f = ev.target;
    if (f.matches('[data-form-usuario]')) {
      const usuario = f.usuario.value.trim().toLowerCase();
      const { error: e } = await supabase.from('perfiles_publicos').upsert({ user_id: yo, usuario });
      if (e) return aviso(e.code === '23505' ? 'Ese nombre de usuario ya existe. Prueba con otro.' : 'No se pudo guardar el nombre de usuario', 'error');
      aviso('Perfil guardado');
      return renderSocial(cont, { sesionIniciada, abrirLogin });
    }
    if (f.matches('[data-form-pub]')) {
      const archivo = f.foto.files[0];
      if (!archivo) return aviso('Elige una foto', 'error');
      const boton = f.querySelector('[data-publicar]');
      boton.disabled = true;
      const ruta = `${yo}/${crypto.randomUUID()}.jpg`;
      try {
        const blob = await comprimir(archivo, 1600, 0.85);
        const { error: e1 } = await supabase.storage.from('publicaciones').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
        if (e1) throw e1;
        const { error: e2 } = await supabase.from('publicaciones').insert({
          ruta, descripcion: f.descripcion.value.trim() || null, carpeta: f.carpeta.value,
          visibilidad: f.compartir.checked ? 'compartida' : 'privada',
        });
        if (e2) { await supabase.storage.from('publicaciones').remove([ruta]); throw e2; }
        aviso(f.compartir.checked ? 'Publicada para tus seguidores' : 'Guardada en privado');
        pestana = 'mias';
        renderSocial(cont, { sesionIniciada, abrirLogin });
      } catch (e) {
        error(e, 'No se pudo subir la foto');
        boton.disabled = false;
      }
    }
  };

  cont.onclick = async ev => {
    const t = ev.target.closest('[data-pestana]');
    if (t) {
      pestana = t.dataset.pestana;
      cont.querySelectorAll('[data-pestana]').forEach(b => b.classList.toggle('activo', b === t));
      const { data: perfil } = await supabase.from('perfiles_publicos').select('usuario').eq('user_id', yo).maybeSingle();
      return pintarPestana(cont.querySelector('#social-lista'), perfil);
    }
    const vis = ev.target.closest('[data-visibilidad]');
    if (vis) {
      const nueva = vis.dataset.visibilidad === 'privada' ? 'compartida' : 'privada';
      if (nueva === 'compartida' && !confirm('¿Compartir esta foto con tus seguidores aceptados?')) return;
      const { error: e } = await supabase.from('publicaciones').update({ visibilidad: nueva, actualizado: new Date().toISOString() }).eq('id', vis.dataset.id);
      if (e) return error(e);
      aviso(nueva === 'compartida' ? 'Ahora la ven tus seguidores' : 'Ahora solo la ves tú');
      return pintarPestana(cont.querySelector('#social-lista'));
    }
    const ed = ev.target.closest('[data-editar]');
    if (ed) {
      const actual = ed.closest('.pub').querySelector('.pub-texto')?.textContent || '';
      const texto = prompt('Descripción de la foto', actual);
      if (texto === null) return;
      const { error: e } = await supabase.from('publicaciones').update({ descripcion: texto.trim().slice(0, 1000) || null, actualizado: new Date().toISOString() }).eq('id', ed.dataset.editar);
      if (e) return error(e);
      return pintarPestana(cont.querySelector('#social-lista'));
    }
    const del = ev.target.closest('[data-borrar]');
    if (del) {
      if (!confirm('¿Borrar esta foto para siempre? No se puede deshacer.')) return;
      const { error: e } = await supabase.from('publicaciones').delete().eq('id', del.dataset.borrar);
      if (e) return error(e);
      await supabase.storage.from('publicaciones').remove([del.dataset.ruta]);
      aviso('Foto borrada');
      return pintarPestana(cont.querySelector('#social-lista'));
    }
    const seg = ev.target.closest('[data-seguir]');
    if (seg) {
      const { error: e } = await supabase.from('seguidores').insert({ seguidor: yo, seguido: seg.dataset.seguir });
      if (e && e.code !== '23505') return error(e);
      aviso('Petición enviada. Verás sus fotos compartidas cuando te acepte.');
      seg.outerHTML = '<span class="tenue">Pendiente</span>';
      return;
    }
    const ac = ev.target.closest('[data-aceptar]');
    if (ac) {
      const { error: e } = await supabase.from('seguidores').update({ estado: 'aceptado' }).eq('seguidor', ac.dataset.aceptar).eq('seguido', yo);
      if (e) return error(e);
      aviso('Aceptado');
      return pintarPestana(cont.querySelector('#social-lista'));
    }
    const qu = ev.target.closest('[data-quitar]');
    if (qu) {
      const [seguidor, seguido] = qu.dataset.quitar.split('|');
      const { error: e } = await supabase.from('seguidores').delete().eq('seguidor', seguidor).eq('seguido', seguido);
      if (e) return error(e);
      return pintarPestana(cont.querySelector('#social-lista'));
    }
  };
  cont.oninput = ev => {
    const b = ev.target.closest('[data-buscar]');
    if (!b) return;
    clearTimeout(b._t);
    b._t = setTimeout(() => buscar(cont, b.value.trim().toLowerCase()), 300);
  };
}

async function pintarPestana(caja) {
  caja.innerHTML = '<p class="tenue" style="padding:20px 0">Cargando…</p>';
  try {
    if (pestana === 'siguiendo') return await pintarFeed(caja);
    if (pestana === 'mias') return await pintarMias(caja);
    return await pintarPersonas(caja);
  } catch (e) {
    caja.innerHTML = '<p class="tenue">No se pudo cargar. Comprueba tu conexión.</p>';
    console.warn(e);
  }
}

async function pintarFeed(caja) {
  const { data, error: e } = await supabase.from('publicaciones').select('id, user_id, ruta, descripcion, creado')
    .neq('user_id', yo).eq('visibilidad', 'compartida').order('creado', { ascending: false }).limit(30);
  if (e) throw e;
  if (!data.length) {
    caja.innerHTML = '<div class="vacio"><h3>Aún no hay nada por aquí</h3><p>Busca a gente en Personas. Cuando te acepten, verás aquí las fotos que compartan.</p></div>';
    return;
  }
  const [urls, perfiles] = await Promise.all([urlsFirmadas(data.map(p => p.ruta)), perfilesDe(data.map(p => p.user_id))]);
  caja.innerHTML = `<div class="feed">${data.map(p => `
    <article class="pub pub-feed">
      <header><span class="pub-avatar">${escapar((perfiles[p.user_id]?.usuario || '?')[0].toUpperCase())}</span><b>@${escapar(perfiles[p.user_id]?.usuario || 'usuario')}</b><small>${fecha(p.creado)}</small></header>
      ${urls[p.ruta] ? `<img src="${urls[p.ruta]}" alt="${escapar(p.descripcion || 'Foto')}" loading="lazy">` : ''}
      ${p.descripcion ? `<p class="pub-texto">${escapar(p.descripcion)}</p>` : ''}
    </article>`).join('')}</div>`;
}

async function pintarMias(caja) {
  const { data, error: e } = await supabase.from('publicaciones').select('id, ruta, descripcion, carpeta, visibilidad, creado')
    .eq('user_id', yo).order('creado', { ascending: false }).limit(60);
  if (e) throw e;
  if (!data.length) {
    caja.innerHTML = '<div class="vacio"><h3>Tu galería en la nube está vacía</h3><p>Sube tu primera foto arriba. Se guardará en privado salvo que decidas compartirla.</p></div>';
    return;
  }
  const urls = await urlsFirmadas(data.map(p => p.ruta));
  caja.innerHTML = `<div class="galeria-nube">${data.map(p => `
    <article class="pub">
      ${urls[p.ruta] ? `<img src="${urls[p.ruta]}" alt="${escapar(p.descripcion || 'Foto')}" loading="lazy">` : ''}
      <div class="pub-pie">
        <button class="vis ${p.visibilidad}" data-visibilidad="${p.visibilidad}" data-id="${p.id}" aria-label="Cambiar visibilidad">${p.visibilidad === 'compartida' ? 'Compartida' : 'Privada'}</button>
        <small>${CARPETAS[p.carpeta] || ''} · ${fecha(p.creado)}</small>
        ${p.descripcion ? `<p class="pub-texto">${escapar(p.descripcion)}</p>` : ''}
        <div class="pub-acciones">
          <button class="btn-texto" data-editar="${p.id}">Editar</button>
          <button class="btn-texto texto-error" data-borrar="${p.id}" data-ruta="${escapar(p.ruta)}">Borrar</button>
        </div>
      </div>
    </article>`).join('')}</div>`;
}

async function pintarPersonas(caja) {
  const { data: rel, error: e } = await supabase.from('seguidores').select('seguidor, seguido, estado');
  if (e) throw e;
  const perfiles = await perfilesDe(rel.flatMap(r => [r.seguidor, r.seguido]).filter(id => id !== yo));
  const nombre = id => `@${escapar(perfiles[id]?.usuario || 'usuario')}`;
  const pendientes = rel.filter(r => r.seguido === yo && r.estado === 'pendiente');
  const seguidores = rel.filter(r => r.seguido === yo && r.estado === 'aceptado');
  const sigo = rel.filter(r => r.seguidor === yo);
  const fila = (id, acciones) => `<li><span class="pub-avatar">${escapar((perfiles[id]?.usuario || '?')[0].toUpperCase())}</span><b>${nombre(id)}</b><span class="acciones">${acciones}</span></li>`;
  caja.innerHTML = `
    <section class="panel">
      <div class="panel-cab"><h3>Buscar personas</h3></div>
      <input type="search" data-buscar placeholder="Escribe un nombre de usuario" aria-label="Buscar por nombre de usuario">
      <ul class="personas" id="resultados"></ul>
    </section>
    ${pendientes.length ? `<section class="panel"><div class="panel-cab"><h3>Quieren seguirte</h3></div><ul class="personas">
      ${pendientes.map(r => fila(r.seguidor, `<button class="btn primario chico" data-aceptar="${r.seguidor}">Aceptar</button><button class="btn chico" data-quitar="${r.seguidor}|${yo}">Rechazar</button>`)).join('')}</ul></section>` : ''}
    <section class="panel"><div class="panel-cab"><h3>Sigues a</h3><span class="tenue">${sigo.length}</span></div>
      ${sigo.length ? `<ul class="personas">${sigo.map(r => fila(r.seguido, `${r.estado === 'pendiente' ? '<span class="tenue">Pendiente</span>' : ''}<button class="btn chico" data-quitar="${yo}|${r.seguido}">${r.estado === 'pendiente' ? 'Cancelar' : 'Dejar de seguir'}</button>`)).join('')}</ul>` : '<p class="tenue">Todavía no sigues a nadie.</p>'}</section>
    <section class="panel"><div class="panel-cab"><h3>Te siguen</h3><span class="tenue">${seguidores.length}</span></div>
      ${seguidores.length ? `<ul class="personas">${seguidores.map(r => fila(r.seguidor, `<button class="btn chico" data-quitar="${r.seguidor}|${yo}">Quitar</button>`)).join('')}</ul>` : '<p class="tenue">Nadie todavía.</p>'}</section>`;
}

async function buscar(cont, texto) {
  const lista = cont.querySelector('#resultados');
  if (!lista) return;
  if (texto.length < 2) { lista.innerHTML = ''; return; }
  const limpio = texto.replace(/[^a-z0-9_.]/g, '');
  const [{ data }, { data: rel }] = await Promise.all([
    supabase.from('perfiles_publicos').select('user_id, usuario').ilike('usuario', `${limpio}%`).neq('user_id', yo).limit(10),
    supabase.from('seguidores').select('seguido, estado').eq('seguidor', yo),
  ]);
  const estado = Object.fromEntries((rel || []).map(r => [r.seguido, r.estado]));
  lista.innerHTML = (data || []).map(p => `<li><span class="pub-avatar">${escapar(p.usuario[0].toUpperCase())}</span><b>@${escapar(p.usuario)}</b><span class="acciones">
    ${estado[p.user_id] === 'aceptado' ? '<span class="tenue">Siguiendo</span>' : estado[p.user_id] === 'pendiente' ? '<span class="tenue">Pendiente</span>' : `<button class="btn primario chico" data-seguir="${p.user_id}">Seguir</button>`}
  </span></li>`).join('') || '<li class="tenue">Nadie con ese nombre.</li>';
}
