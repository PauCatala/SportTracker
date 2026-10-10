// Avatar del Inicio: el mismo avatar humano del creador (motor de js/avatar),
// con la interfaz que espera la rueda (poner, gesto, velocidad, aplicar...).
import * as THREE from 'three';
import { leer, guardar } from '../almacen.js';
import { crearAvatar } from '../avatar/motor.js';
import { crearAnimador } from '../avatar/animacion.js';
import { normalizar, PERFIL_BASE, VERSION } from '../avatar/parametros.js';

// Perfil guardado en tu cuenta (almacen → Supabase si has entrado; si no, en este navegador)
export const tieneAvatar = () => leer('avatar', null)?.v === VERSION;
export const leerPerfil = () => (tieneAvatar() ? normalizar(leer('avatar', null)) : normalizar(PERFIL_BASE));
export const guardarPerfil = p => guardar('avatar', normalizar(p));

const ALTO_REF = 1.75; // una persona de 1,75 m mide 1 en la escena; el resto, a escala

export async function cargarAvatar(perfil = leerPerfil()) {
  const av = await crearAvatar(perfil);
  const anim = await crearAnimador(av);
  const cuerpo = new THREE.Group();
  av.objeto.scale.setScalar(1 / ALTO_REF);
  cuerpo.add(av.objeto);

  // Zona de toque invisible (más fiable y barata que tocar la malla animada)
  const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1, 12), new THREE.MeshBasicMaterial({ visible: false }));
  toque.position.y = 0.5;
  cuerpo.add(toque);
  const ajustarToque = () => { const h = av.altura() / ALTO_REF; toque.scale.y = h; toque.position.y = h / 2; };
  ajustarToque();

  const ESTADOS = { correr: 'run', quieto: 'idle', andar: 'walk' };
  let estado = 'idle', ultimoGesto = 0;
  return {
    objeto: cuerpo,
    mallas: [toque],
    poner(id) { const n = ESTADOS[id] || id; if (n !== estado) { estado = n; anim.estado(n); } },
    velocidad(v) { anim.estado(estado, v); },
    gesto(id) {
      const ahora = performance.now();
      if (ahora - ultimoGesto < 3000 || estado === 'run') return; // los gestos son de pie
      ultimoGesto = ahora;
      anim.gesto(id === 'like' ? 'megusta' : id);
    },
    async aplicar(p) { await av.aplicar(p); ajustarToque(); },
    actualizar: dt => anim.actualizar(dt),
  };
}
