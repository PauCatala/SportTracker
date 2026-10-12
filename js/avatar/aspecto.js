// Aspecto editable de un avatar de Avaturn (los de SYNCO o el tuyo escaneado):
// - Altura: escala del cuerpo entero (en cm, sobre una base de 175 cm).
// - Complexión: de más delgada a más fuerte. Cada vértice se separa (o se acerca) de su hueso
//   (columna, brazos, piernas), así engorda o adelgaza el cuerpo y la ropa a la vez, y la
//   animación sigue funcionando igual porque el esqueleto no cambia.
// - Camiseta, pantalón y zapatillas: se recolorean conservando pliegues, costuras y sombras.
// - Gorro: de lana o gorra, a medida de tu cabeza y tu pelo, colgado del hueso de la cabeza.
import * as THREE from 'three';

export const ALTURA = { min: 160, max: 195, base: 175 };
export const COLORES_ROPA = [['', 'Original'], ['#F2F1EC', 'Blanco'], ['#24272E', 'Negro'], ['#8C919A', 'Gris'], ['#2E4668', 'Azul marino'], ['#7096C2', 'Azul'],
  ['#4E6B52', 'Verde'], ['#A8262B', 'Rojo'], ['#D8C3A0', 'Arena'], ['#D993A6', 'Rosa']];
export const GORROS = [['', 'Sin gorro'], ['lana', 'Gorro'], ['gorra', 'Gorra']];

// Cuánto engorda cada zona con la complexión al máximo (fracción del grosor)
const ZONAS = {
  Hips: ['Spine', 0.07], Spine: ['Spine1', 0.12], Spine1: ['Spine2', 0.13], Spine2: ['Neck', 0.11], Neck: ['Head', 0.05],
  LeftShoulder: ['LeftArm', 0.06], RightShoulder: ['RightArm', 0.06],
  LeftArm: ['LeftForeArm', 0.15], RightArm: ['RightForeArm', 0.15], LeftForeArm: ['LeftHand', 0.10], RightForeArm: ['RightHand', 0.10],
  LeftUpLeg: ['LeftLeg', 0.11], RightUpLeg: ['RightLeg', 0.11], LeftLeg: ['LeftFoot', 0.08], RightLeg: ['RightFoot', 0.08],
};

const v = new THREE.Vector3(), w = new THREE.Vector3();
const lineal = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// Se llama una vez al cargar el modelo, en su postura de reposo
export function prepararAspecto({ modelo, objeto, giro }) {
  objeto.updateMatrixWorld(true);
  const mallas = []; modelo.traverse(o => { if (o.isSkinnedMesh) mallas.push(o); });
  const cuerpos = mallas.map(prepararComplexion).filter(Boolean);
  const ropa = mallas.map(prepararRopa).filter(Boolean);
  const cabeza = medirCabeza(mallas, objeto);
  let gorro = null, claveGorro = '';
  const recorte = { uOn: { value: 0 }, uInv: { value: new THREE.Matrix4() } };

  return {
    aplicar(a = {}, alturaPerfil = 0) {
      const cm = THREE.MathUtils.clamp(Number(a.altura) || alturaPerfil || ALTURA.base, ALTURA.min, ALTURA.max);
      giro.scale.setScalar(cm / ALTURA.base);
      const c = THREE.MathUtils.clamp(Number(a.complexion) || 0, -1, 1);
      for (const k of cuerpos) k.poner(c);
      for (const r of ropa) r.poner(a);
      // Gorro: se rehace solo si cambia el tipo o el color
      const clave = a.gorro ? `${a.gorro}|${a.gorroColor || ''}` : '';
      // Con gorro, el pelo que quedaría por encima del borde no se pinta (si no, lo atravesaría)
      if (cabeza) {
        modelo.traverse(o => { if (o.isMesh && /hair/i.test(o.name + o.material.name)) recortarPelo(o, cabeza.ancla, recorte); });
        recorte.uOn.value = a.gorro ? 1 : 0;
      }
      if (clave !== claveGorro && cabeza) {
        claveGorro = clave;
        if (gorro) { gorro.removeFromParent(); gorro.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); gorro = null; }
        if (a.gorro) { gorro = crearGorro(a.gorro, a.gorroColor, cabeza.medidas); cabeza.ancla.add(gorro); }
      }
    },
  };
}

// ---------- Complexión ----------
function prepararComplexion(malla) {
  const geo = malla.geometry, pos = geo.attributes.position;
  const idx = geo.attributes.skinIndex, pes = geo.attributes.skinWeight;
  if (!idx || !pes) return null;
  const huesos = malla.skeleton.bones;
  // Posición de cada hueso en el espacio de enlace (el mismo en que se definen los vértices)
  const puntos = malla.skeleton.boneInverses.map(m => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  const porNombre = Object.fromEntries(huesos.map((b, i) => [b.name.replace(/^mixamorig:?/, ''), i]));
  const segs = huesos.map(b => {
    const z = ZONAS[b.name.replace(/^mixamorig:?/, '')];
    if (!z || porNombre[z[0]] === undefined) return null;
    const a = puntos[huesos.indexOf(b)], fin = puntos[porNombre[z[0]]];
    const dir = fin.clone().sub(a); if (dir.lengthSq() < 1e-10) return null;
    return { a, u: dir.normalize(), k: z[1] };
  });
  // Posiciones en coma flotante (los GLB de Avaturn vienen cuantizados) y copia de las originales
  const base = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) base.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  const desp = new Float32Array(pos.count * 3);
  const enlace = malla.bindMatrix, desEnlace = malla.bindMatrixInverse;
  const lin = new THREE.Matrix3().setFromMatrix4(desEnlace);
  let algo = false;
  for (let i = 0; i < pos.count; i++) {
    v.fromArray(base, i * 3).applyMatrix4(enlace);
    const d = new THREE.Vector3();
    for (let j = 0; j < 4; j++) {
      const p = pes.getComponent(i, j); if (p < 0.01) continue;
      const s = segs[idx.getComponent(i, j)]; if (!s) continue;
      w.copy(v).sub(s.a);
      w.sub(s.u.clone().multiplyScalar(w.dot(s.u)));   // lo que se aparta de la línea del hueso
      d.addScaledVector(w, p * s.k);
    }
    if (d.lengthSq() > 0) { algo = true; d.applyMatrix3(lin); desp.set([d.x, d.y, d.z], i * 3); }
  }
  if (!algo) return null;
  const nueva = new THREE.BufferAttribute(base.slice(), 3);
  geo.setAttribute('position', nueva);
  let actual = 0;
  return {
    poner(c) {
      if (c === actual) return;
      actual = c;
      const arr = nueva.array;
      for (let i = 0; i < arr.length; i++) arr[i] = base[i] + desp[i] * c;
      nueva.needsUpdate = true;
    },
  };
}

// ---------- Ropa: camiseta (0), pantalón (1) y zapatillas (2) ----------
function prepararRopa(malla) {
  const m = malla.material;
  const esZapato = /shoe|foot/i.test(malla.name + m.name), esRopa = /look|outfit|cloth/i.test(malla.name + m.name);
  if (!esZapato && !esRopa) return null;
  const geo = malla.geometry, n = geo.attributes.position.count;
  const zona = new Float32Array(n).fill(esZapato ? 2 : 0);
  if (esRopa) clasificarPrendas(malla, zona);
  geo.setAttribute('zona', new THREE.BufferAttribute(zona, 1));
  const medias = luminanciaMedia(malla, zona);

  const u = { uTinte: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] }, uOn: { value: [0, 0, 0] }, uMedia: { value: medias } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute float zona;\nvarying float vZona;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vZona = zona;');
    sh.fragmentShader = 'uniform vec3 uTinte[3];\nuniform float uOn[3];\nuniform float uMedia[3];\nvarying float vZona;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        int z = int(vZona + 0.5);
        vec3 t = z == 0 ? uTinte[0] : z == 1 ? uTinte[1] : uTinte[2];
        float on = z == 0 ? uOn[0] : z == 1 ? uOn[1] : uOn[2];
        float media = z == 0 ? uMedia[0] : z == 1 ? uMedia[1] : uMedia[2];
        float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        // El color nuevo con la luz y los pliegues de la prenda original
        vec3 nuevo = t * clamp(pow(l / max(media, 0.004), 0.75), 0.0, 1.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, nuevo, on);
      }`);
  };
  m.customProgramCacheKey = () => 'ropa-tinte';
  m.needsUpdate = true;
  return {
    poner(a) {
      [a.camiseta, a.pantalon, a.zapatos].forEach((c, i) => {
        u.uOn.value[i] = c ? 1 : 0;
        if (c) u.uTinte.value[i].set(c);
      });
    },
  };
}

// Separa la parte de arriba de la de abajo: cada pieza suelta de la malla (camiseta, pantalón,
// cinturón...) se clasifica por su altura respecto a la cadera
function clasificarPrendas(malla, zona) {
  const geo = malla.geometry, pos = geo.attributes.position, n = pos.count;
  const ind = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
  const padre = new Int32Array(n).map((_, i) => i);
  const raiz = i => { while (padre[i] !== i) i = padre[i] = padre[padre[i]]; return i; };
  const unir = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) padre[a] = b; };
  for (let t = 0; t < ind.length; t += 3) { unir(ind[t], ind[t + 1]); unir(ind[t], ind[t + 2]); }
  // Vértices repetidos en las costuras de la textura: misma posición, misma pieza
  const vistos = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    if (vistos.has(k)) unir(i, vistos.get(k)); else vistos.set(k, i);
  }
  const huesos = malla.skeleton.bones;
  const cadera = huesos.findIndex(b => /Hips$/.test(b.name));
  if (cadera < 0) return;
  const enlace = malla.bindMatrix;
  const yCadera = new THREE.Vector3().setFromMatrixPosition(malla.skeleton.boneInverses[cadera].clone().invert()).y;
  const alto = (() => { let mx = -Infinity, mn = Infinity; for (let i = 0; i < n; i++) { const y = v.fromBufferAttribute(pos, i).applyMatrix4(enlace).y; mx = Math.max(mx, y); mn = Math.min(mn, y); } return mx - mn; })();
  const suma = new Map();
  for (let i = 0; i < n; i++) {
    const r = raiz(i), y = v.fromBufferAttribute(pos, i).applyMatrix4(enlace).y;
    const s = suma.get(r) || [0, 0]; s[0] += y; s[1]++; suma.set(r, s);
  }
  const piezas = suma.size;
  for (let i = 0; i < n; i++) {
    const y = v.fromBufferAttribute(pos, i).applyMatrix4(enlace).y;
    // Una sola pieza (mono, vestido): se corta por la cintura
    if (piezas === 1) { zona[i] = y > yCadera + alto * 0.04 ? 0 : 1; continue; }
    const [sy, c] = suma.get(raiz(i));
    zona[i] = sy / c > yCadera + alto * 0.05 ? 0 : 1;
  }
}

// Luminancia media de cada prenda en su textura, para que el color elegido salga con su tono real
function luminanciaMedia(malla, zona) {
  const medias = [0.5, 0.5, 0.5];
  const img = malla.material.map?.image, uv = malla.geometry.attributes.uv;
  if (!img || !uv) return medias;
  try {
    const T = 128, c = document.createElement('canvas'); c.width = c.height = T;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, T, T);
    const px = ctx.getImageData(0, 0, T, T).data;
    const s = [0, 0, 0], k = [0, 0, 0];
    const flip = malla.material.map.flipY;
    for (let i = 0; i < uv.count; i += 2) {
      let x = uv.getX(i), y = uv.getY(i);
      x = ((x % 1) + 1) % 1; y = ((y % 1) + 1) % 1; if (flip) y = 1 - y;
      const o = (Math.min(T - 1, Math.floor(y * T)) * T + Math.min(T - 1, Math.floor(x * T))) * 4;
      const l = 0.2126 * lineal(px[o] / 255) + 0.7152 * lineal(px[o + 1] / 255) + 0.0722 * lineal(px[o + 2] / 255);
      const z = zona[i]; s[z] += l; k[z]++;
    }
    for (let z = 0; z < 3; z++) if (k[z]) medias[z] = Math.max(0.01, s[z] / k[z]);
  } catch (e) { console.warn('Ropa: no se pudo medir la textura', e); }
  return medias;
}

// ---------- Gorro ----------
// Mide la cabeza en reposo (el cuero cabelludo y el volumen del pelo) y deja un ancla a la altura
// donde apoya el gorro, unida al hueso de la cabeza: así sigue a la cabeza al correr
const percentil = (xs, p) => { const o = [...xs].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(o.length * p))]; };
function medirCabeza(mallas, objeto) {
  let hueso = null;
  for (const m of mallas) { hueso = m.skeleton.bones.find(b => /Head$/.test(b.name)); if (hueso) break; }
  if (!hueso) return null;
  const piel = [], pelo = [];
  for (const m of mallas) {
    const nombre = m.name + m.material.name;
    const lista = /hair/i.test(nombre) ? pelo : /body/i.test(nombre) ? piel : null;
    if (!lista) continue;
    const i0 = m.skeleton.bones.indexOf(hueso), idx = m.geometry.attributes.skinIndex, pes = m.geometry.attributes.skinWeight;
    if (i0 < 0 || !idx) continue;
    for (let i = 0; i < idx.count; i++) {
      let p = 0; for (let j = 0; j < 4; j++) if (idx.getComponent(i, j) === i0) p += pes.getComponent(i, j);
      if (p < 0.6) continue;
      m.getVertexPosition(i, v);
      lista.push(objeto.worldToLocal(m.localToWorld(v.clone())));
    }
  }
  if (piel.length < 50) return null;
  const arriba = Math.max(...piel.map(p => p.y));          // coronilla (sin pelo)
  const nivel = arriba - 0.078;                             // donde apoya el gorro: por encima de las cejas
  const aro = piel.filter(p => Math.abs(p.y - nivel) < 0.012);
  const xs = aro.map(p => p.x), zs = aro.map(p => p.z);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
  let rx = (Math.max(...xs) - Math.min(...xs)) / 2, rz = (Math.max(...zs) - Math.min(...zs)) / 2, techo = arriba;
  // El pelo de encima abulta: el gorro lo cubre, sin hacer caso a mechones sueltos ni a la coleta
  const encima = pelo.filter(p => p.y > nivel - 0.005 && Math.hypot((p.x - cx) / (rx + 0.06), (p.z - cz) / (rz + 0.06)) < 1);
  if (encima.length > 30) {
    rx = THREE.MathUtils.clamp(percentil(encima.map(p => Math.abs(p.x - cx)), 0.9), rx + 0.006, rx + 0.03);
    rz = THREE.MathUtils.clamp(percentil(encima.map(p => Math.abs(p.z - cz)), 0.9), rz + 0.006, rz + 0.03);
    techo = THREE.MathUtils.clamp(percentil(encima.map(p => p.y), 0.95), arriba + 0.006, arriba + 0.035);
  } else { rx += 0.006; rz += 0.006; techo += 0.006; }
  const ancla = new THREE.Group(); ancla.name = 'ancla-gorro';
  ancla.position.set(cx, nivel, cz);
  objeto.add(ancla); objeto.updateMatrixWorld(true);
  hueso.attach(ancla);
  return { ancla, medidas: { rx, rz, alto: techo - nivel } };
}

function recortarPelo(malla, ancla, u) {
  const m = malla.material;
  if (m.userData.recorte) return;
  m.userData.recorte = true;
  malla.onBeforeRender = () => { u.uInv.value.copy(ancla.matrixWorld).invert(); };
  const previo = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    previo?.call(m, sh, r);
    sh.uniforms.uGorroOn = u.uOn; sh.uniforms.uGorroInv = u.uInv;
    sh.vertexShader = 'varying vec3 vPosMundo;\n' + sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uGorroOn;\nuniform mat4 uGorroInv;\nvarying vec3 vPosMundo;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      if (uGorroOn > 0.5 && (uGorroInv * vec4(vPosMundo, 1.0)).y > 0.002) discard;`);
  };
  m.needsUpdate = true;
}

let texPunto = null;
function punto() {   // relieve de punto de lana (canalé vertical)
  if (texPunto) return texPunto;
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 64; x++) { const g = 128 + 110 * Math.sin((x / 64) * Math.PI * 2 * 4); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(x, 0, 1, 8); }
  texPunto = new THREE.CanvasTexture(c); texPunto.wrapS = texPunto.wrapT = THREE.RepeatWrapping; texPunto.repeat.set(9, 1);
  return texPunto;
}

function crearGorro(tipo, color, { rx, rz, alto }) {
  const g = new THREE.Group(); g.name = 'gorro';
  const sombra = o => { o.castShadow = true; o.receiveShadow = true; return o; };
  if (tipo === 'lana') {
    // Gorro de punto: cúpula algo holgada arriba y vuelta doblada en el borde
    const mat = new THREE.MeshStandardMaterial({ color: color || '#3A4150', roughness: 0.95, bumpMap: punto(), bumpScale: 1.2 });
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    cupula.scale.set(rx * 1.06, alto + 0.03, rz * 1.06);
    const vuelta = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.03, 0.052, 48, 1, true), mat.clone());
    vuelta.material.bumpScale = 0.7; vuelta.material.side = THREE.DoubleSide;
    vuelta.scale.set(rx * 1.1, 1, rz * 1.1); vuelta.position.y = 0.012;
    g.add(sombra(cupula), sombra(vuelta));
  } else {
    // Gorra: cúpula baja de seis paños y visera curva hacia delante
    const mat = new THREE.MeshStandardMaterial({ color: color || '#24272E', roughness: 0.78 });
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    cupula.scale.set(rx * 1.05, alto + 0.012, rz * 1.05);
    const forma = new THREE.Shape();
    const N = 24, sale = 0.072;
    for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI; const x = Math.cos(t) * rx * 0.94, z = Math.sin(t) * rz * 0.98; i ? forma.lineTo(x, z) : forma.moveTo(x, z); }
    for (let i = N; i >= 0; i--) { const t = (i / N) * Math.PI; forma.lineTo(Math.cos(t) * rx * 0.9, Math.sin(t) * (rz + sale)); }
    const visera = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 4 }), mat);
    visera.rotation.x = Math.PI / 2 + 0.2;   // tumbada y un poco caída
    visera.position.y = 0.008;
    const boton = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), mat);
    boton.position.y = alto + 0.012;
    g.add(sombra(cupula), sombra(visera), boton);
  }
  return g;
}
