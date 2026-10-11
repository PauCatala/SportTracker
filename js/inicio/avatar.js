// Avatar del Inicio, con la interfaz que espera la rueda (poner, gesto, velocidad, aplicar...).
// - Si has creado tu avatar con Avaturn, se usa ese modelo realista.
// - Si aún no, se muestra el avatar provisional hasta que crees el tuyo.
import * as THREE from 'three';
import { leer, guardar } from '../almacen.js';
import { crearAvatar } from '../avatar/motor.js';
import { crearAnimador } from '../avatar/animacion.js';
import { normalizar, PERFIL_BASE, VERSION } from '../avatar/parametros.js';
import { tieneAvaturn, modeloGuardado, cargarAvatarRealista } from '../avatar/avaturn.js';

// Perfil del avatar provisional (se mantiene mientras no haya avatar de Avaturn)
export const tieneAvatar = () => leer('avatar', null)?.v === VERSION;
export const leerPerfil = () => (tieneAvatar() ? normalizar(leer('avatar', null)) : normalizar(PERFIL_BASE));
export const guardarPerfil = p => guardar('avatar', normalizar(p));

const ALTO_REF = 1.75; // una persona de 1,75 m mide 1 en la escena; el resto, a escala
const ESTADOS = { correr: 'run', quieto: 'idle', andar: 'walk' };

// Carga el avatar que toque y lo envuelve con una interfaz común
async function cargarInterior() {
  if (tieneAvaturn()) {
    try {
      const blob = await modeloGuardado();
      if (blob) {
        const av = await cargarAvatarRealista(blob);
        av.objeto.scale.setScalar(1 / ALTO_REF);
        return {
          objeto: av.objeto, altura: () => av.altura,
          estado: (n, v) => av.estado(n, v), gesto: n => av.gesto(n === 'megusta' ? 'agree' : n),
          actualizar: dt => av.actualizar(dt), destruir: () => av.destruir(),
        };
      }
    } catch (e) { console.warn('Avatar realista', e); }
  }
  const av = await crearAvatar(leerPerfil());
  const anim = await crearAnimador(av);
  av.objeto.scale.setScalar(1 / ALTO_REF);
  return {
    objeto: av.objeto, altura: () => av.altura(),
    estado: (n, v) => anim.estado(n, v), gesto: n => anim.gesto(n),
    actualizar: dt => anim.actualizar(dt), destruir: () => { anim.destruir(); av.destruir(); },
  };
}

export async function cargarAvatar() {
  const cuerpo = new THREE.Group();
  let av = await cargarInterior();
  cuerpo.add(av.objeto);

  // Zona de toque invisible (más fiable y barata que tocar la malla animada)
  const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1, 12), new THREE.MeshBasicMaterial({ visible: false }));
  cuerpo.add(toque);
  const ajustarToque = () => { const h = av.altura() / ALTO_REF; toque.scale.y = h; toque.position.y = h / 2; };
  ajustarToque();

  let estado = 'idle', vel = 1, ultimoGesto = 0;
  return {
    objeto: cuerpo,
    mallas: [toque],
    poner(id) { const n = ESTADOS[id] || id; if (n !== estado) { estado = n; av.estado(n, vel); } },
    velocidad(v) { vel = v; av.estado(estado, v); },
    gesto(id) {
      const ahora = performance.now();
      if (ahora - ultimoGesto < 3000 || estado === 'run') return; // los gestos son de pie
      ultimoGesto = ahora;
      av.gesto(id === 'like' ? 'megusta' : id);
    },
    // Al guardar un avatar nuevo, se sustituye el de la escena
    async aplicar() {
      const nuevo = await cargarInterior();
      av.destruir();
      av = nuevo;
      cuerpo.add(av.objeto);
      av.estado(estado, vel);
      ajustarToque();
    },
    actualizar: dt => av.actualizar(dt),
  };
}
