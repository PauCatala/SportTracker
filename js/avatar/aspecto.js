// Aspecto editable de un avatar de Avaturn (los de SYNCO o el tuyo escaneado):
// - Altura: escala del cuerpo entero (en cm, sobre una base de 175 cm).
// - Complexión: de más delgada a más fuerte. Cada vértice se separa (o se acerca) de su hueso
//   (columna, brazos, piernas), así engorda o adelgaza el cuerpo y la ropa a la vez, y la
//   animación sigue funcionando igual porque el esqueleto no cambia.
// - Camiseta, pantalón y zapatillas: se recolorean conservando pliegues, costuras y sombras.
// - Gorro: de lana o gorra, a medida de tu cabeza y tu pelo, colgado del hueso de la cabeza.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ALTURA = { min: 160, max: 195, base: 175 };
export const COLORES_ROPA = [['', 'Original'], ['#F2F1EC', 'Blanco'], ['#24272E', 'Negro'], ['#8C919A', 'Gris'], ['#2E4668', 'Azul marino'], ['#7096C2', 'Azul'],
  ['#4E6B52', 'Verde'], ['#A8262B', 'Rojo'], ['#D8C3A0', 'Arena'], ['#D993A6', 'Rosa']];
export const GORROS = [['', 'Sin gorro'], ['lana', 'Gorro'], ['gorra', 'Gorra']];
// Peinados: el suyo, o el de los avatares de SYNCO pasado a tu cabeza
export const PEINADOS = [['', 'El suyo'], ['corto', 'Corto'], ['coleta', 'Coleta'], ['rapado', 'Rapado']];

// Cuerpo: cada vértice se separa de la línea de su hueso. Por zona, cuánto (fracción del grosor) con:
//  g = peso al máximo (con sobrepeso), d = peso al mínimo (delgado), m = musculatura al máximo
const ZONAS = {
  Hips: { fin: 'Spine', g: 0.13, d: 0.08, m: 0 },
  Spine: { fin: 'Spine1', g: 0.28, d: 0.14, m: 0 }, Spine1: { fin: 'Spine2', g: 0.26, d: 0.13, m: 0.05 },
  Spine2: { fin: 'Neck', g: 0.15, d: 0.09, m: 0.18 }, Neck: { fin: 'Head', g: 0.18, d: 0.07, m: 0.14 },
  Shoulder: { fin: 'Arm', g: 0.08, d: 0.04, m: 0.2 },
  Arm: { fin: 'ForeArm', g: 0.24, d: 0.14, m: 0.3 }, ForeArm: { fin: 'Hand', g: 0.12, d: 0.1, m: 0.2 },
  UpLeg: { fin: 'Leg', g: 0.2, d: 0.12, m: 0.12 }, Leg: { fin: 'Foot', g: 0.12, d: 0.1, m: 0.14 },
};
const zona = n => { const m = n.replace(/^mixamorig:?/, '').match(/^(Left|Right)?(.*)$/); return ZONAS[m[2]] ? { ...ZONAS[m[2]], lado: m[1] || '' } : null; };

const v = new THREE.Vector3(), w = new THREE.Vector3();
const lineal = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// Se llama una vez al cargar el modelo, en su postura de reposo
export function prepararAspecto({ modelo, objeto, giro, fuentesPelo = {} }) {
  objeto.updateMatrixWorld(true);
  const mallas = []; modelo.traverse(o => { if (o.isSkinnedMesh) mallas.push(o); });
  const cuerpos = mallas.map(prepararComplexion).filter(Boolean);
  const ropa = mallas.map(prepararRopa).filter(Boolean);
  const cabeza = medirCabeza(mallas, objeto);
  let gorro = null, claveGorro = '';
  const recorte = { uOn: { value: 0 }, uInv: { value: new THREE.Matrix4() } };

  const propios = mallas.filter(m => /hair/i.test(m.name + m.material.name));
  let peinado = '', pedido = '', postizo = [];
  const api = {
    alCambiar: null,      // se llama cuando termina de cargar un peinado (para volver a aplicar el color, etc.)
    aplicar(a = {}, alturaPerfil = 0) {
      // Peinado (puede tardar: se carga el pelo del otro avatar)
      const quiere = a.peinado || '';
      if (quiere !== pedido) {
        pedido = quiere;
        ponerPeinado(quiere).then(() => api.alCambiar?.()).catch(e => console.warn('Peinado', e));
      }
      const cm = THREE.MathUtils.clamp(Number(a.altura) || alturaPerfil || ALTURA.base, ALTURA.min, ALTURA.max);
      giro.scale.setScalar(cm / ALTURA.base);
      // Peso (−1 delgado … 0 normal … 1 con sobrepeso) y musculatura (0 … 1).
      // Compatibilidad: la "complexión" antigua iba de delgada (−1) a fuerte (1)
      const viejo = Number(a.complexion) || 0;
      const peso = THREE.MathUtils.clamp(a.peso !== undefined && a.peso !== '' ? Number(a.peso) : Math.min(0, viejo), -1, 1);
      const musc = THREE.MathUtils.clamp(a.musculo !== undefined && a.musculo !== '' ? Number(a.musculo) : Math.max(0, viejo), 0, 1);
      for (const k of cuerpos) k.poner(peso, musc);
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

  // Cambia el pelo: el propio, ninguno o el de otro avatar de Avaturn adaptado a esta cabeza y esqueleto
  async function ponerPeinado(tipo) {
    if (tipo === peinado) return;
    const fuente = fuentesPelo[tipo];
    let nuevas = [];
    if (fuente && cabeza) nuevas = await peloDe(fuente, mallas[0], cabeza.medidas);
    if (pedido !== tipo) { nuevas.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); return; }
    for (const m of postizo) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); }
    postizo = nuevas;
    const padre = propios[0]?.parent || mallas[0].parent;
    for (const m of postizo) padre.add(m);
    // El pelo propio (y su segunda pasada de bordes suaves) se oculta si hay otro peinado o rapado
    modelo.traverse(o => { if (o.isMesh && /hair/i.test(o.name + o.material.name) && !postizo.includes(o)) o.visible = !tipo; });
    peinado = tipo;
  }
  return api;
}

// ---------- Pelo de otro avatar ----------
const cargadorPelo = new GLTFLoader();
const fuentes = new Map();
function cargarFuente(url) {
  if (!fuentes.has(url)) {
    const p = cargadorPelo.loadAsync(url).then(g => {
      g.scene.updateMatrixWorld(true);
      const mallas = []; g.scene.traverse(o => { if (o.isSkinnedMesh) mallas.push(o); });
      return { mallas, medidas: medirCabeza(mallas, g.scene, false)?.medidas };
    });
    p.catch(() => fuentes.delete(url));
    fuentes.set(url, p);
  }
  return fuentes.get(url);
}
// Pasa cada vértice del pelo al espacio de su hueso en el avatar de origen y lo vuelve a colocar
// respecto al mismo hueso del avatar de destino (la cabeza, además, se ajusta a su tamaño)
async function peloDe(url, destino, medidasDestino) {
  const src = await cargarFuente(url);
  const pelos = src.mallas.filter(m => /hair/i.test(m.name + m.material.name));
  const huesosD = destino.skeleton.bones, nombre = b => b.name.replace(/^mixamorig:?/, '');
  const porNombreD = new Map(huesosD.map((b, i) => [nombre(b), i]));
  const cabezaD = porNombreD.get('Head');
  const escalaCabeza = src.medidas && medidasDestino
    ? new THREE.Vector3(medidasDestino.rx / src.medidas.rx, (medidasDestino.rx / src.medidas.rx + medidasDestino.rz / src.medidas.rz) / 2, medidasDestino.rz / src.medidas.rz)
    : new THREE.Vector3(1, 1, 1);
  const bindD = destino.skeleton.boneInverses.map(m => m.clone().invert());
  const resultado = [];
  for (const pelo of pelos) {
    const geo = pelo.geometry.clone();
    const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.attributes.skinIndex, pes = geo.attributes.skinWeight;
    const huesosS = pelo.skeleton.bones;
    const mapa = huesosS.map(b => porNombreD.get(nombre(b)) ?? cabezaD);
    const nuevaP = new Float32Array(pos.count * 3), nuevaN = nor ? new Float32Array(nor.count * 3) : null;
    const nuevoI = new Uint16Array(idx.count * 4);
    const p = new THREE.Vector3(), q = new THREE.Vector3(), suma = new THREE.Vector3(), n = new THREE.Vector3(), sumaN = new THREE.Vector3();
    const m3 = new THREE.Matrix3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(pelo.bindMatrix);
      if (nor) n.fromBufferAttribute(nor, i).transformDirection(pelo.bindMatrix);
      suma.set(0, 0, 0); sumaN.set(0, 0, 0);
      let total = 0;
      for (let j = 0; j < 4; j++) {
        const w0 = pes.getComponent(i, j), bi = idx.getComponent(i, j);
        nuevoI[i * 4 + j] = mapa[bi] ?? 0;
        if (w0 < 1e-4 || mapa[bi] === undefined) continue;
        q.copy(p).applyMatrix4(pelo.skeleton.boneInverses[bi]);             // en el espacio del hueso (origen)
        if (mapa[bi] === cabezaD) q.multiply(escalaCabeza);
        q.applyMatrix4(bindD[mapa[bi]]);                                     // mismo hueso, en el destino
        suma.addScaledVector(q, w0); total += w0;
        if (nor) {
          m3.setFromMatrix4(bindD[mapa[bi]]).multiply(new THREE.Matrix3().setFromMatrix4(pelo.skeleton.boneInverses[bi]));
          sumaN.addScaledVector(n.clone().applyMatrix3(m3), w0);
        }
      }
      if (total > 0) suma.divideScalar(total);
      suma.applyMatrix4(destino.bindMatrixInverse).toArray(nuevaP, i * 3);
      if (nor) sumaN.transformDirection(destino.bindMatrixInverse).toArray(nuevaN, i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(nuevaP, 3));
    if (nor) geo.setAttribute('normal', new THREE.BufferAttribute(nuevaN, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(nuevoI, 4));
    const mat = pelo.material.clone();
    if ('envMapIntensity' in mat) mat.envMapIntensity = 0.85;
    const crear = material => {
      const m = new THREE.SkinnedMesh(geo, material);
      m.name = pelo.name; m.bind(destino.skeleton, destino.bindMatrix);
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
      return m;
    };
    // Igual que el pelo de Avaturn: núcleo sólido y, si es semitransparente, bordes suaves encima
    if (mat.transparent) {
      const borde = mat.clone(); borde.alphaTest = 0; borde.depthWrite = false; borde.transparent = true;
      mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true;
      const b2 = crear(borde); b2.renderOrder = 2; b2.castShadow = false;
      resultado.push(crear(mat), b2);
    } else resultado.push(crear(mat));
  }
  return resultado;
}
// ---------- Cuerpo: peso y musculatura ----------
function prepararComplexion(malla) {
  const geo = malla.geometry, pos = geo.attributes.position;
  const idx = geo.attributes.skinIndex, pes = geo.attributes.skinWeight;
  if (!idx || !pes) return null;
  const huesos = malla.skeleton.bones;
  const nombre = b => b.name.replace(/^mixamorig:?/, '');
  // Posición de cada hueso en el espacio de enlace (el mismo en que se definen los vértices)
  const puntos = malla.skeleton.boneInverses.map(m => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  const porNombre = Object.fromEntries(huesos.map((b, i) => [nombre(b), i]));
  const P = n => puntos[porNombre[n]];
  if (!P('Hips') || !P('Head') || !P('Spine1')) return null;
  const segs = huesos.map(b => {
    const z = zona(b.name); if (!z) return null;
    const fin = porNombre[z.lado + z.fin] ?? porNombre[z.fin];
    if (fin === undefined) return null;
    const a = puntos[huesos.indexOf(b)], dir = puntos[fin].clone().sub(a);
    if (dir.lengthSq() < 1e-10) return null;
    return { a, u: dir.normalize(), ...z, tronco: /^(Hips|Spine1?)$/.test(nombre(b)) };
  });
  // Escala del cuerpo y hacia dónde mira (los dedos de los pies van delante)
  const alto = P('Head').y - Math.min(P('LeftFoot')?.y ?? 0, P('RightFoot')?.y ?? 0);
  const k = alto / 1.6;
  const pie = P('LeftFoot'), dedo = P('LeftToeBase');
  const frente = new THREE.Vector3(0, 0, pie && dedo && dedo.z < pie.z ? -1 : 1);
  const yTripa = P('Spine').y + 0.07 * k;
  const ejeTronco = { a: P('Hips'), u: P('Spine1').clone().sub(P('Hips')).normalize() };

  const base = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) base.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  const gordo = new Float32Array(pos.count * 3), delgado = new Float32Array(pos.count * 3), musculo = new Float32Array(pos.count * 3);
  const lin = new THREE.Matrix3().setFromMatrix4(malla.bindMatrixInverse);
  const dG = new THREE.Vector3(), dD = new THREE.Vector3(), dM = new THREE.Vector3(), r = new THREE.Vector3();
  let algo = false;
  for (let i = 0; i < pos.count; i++) {
    v.fromArray(base, i * 3).applyMatrix4(malla.bindMatrix);
    dG.set(0, 0, 0); dD.set(0, 0, 0); dM.set(0, 0, 0);
    let tronco = 0;
    for (let j = 0; j < 4; j++) {
      const p = pes.getComponent(i, j); if (p < 0.01) continue;
      const s = segs[idx.getComponent(i, j)]; if (!s) continue;
      w.copy(v).sub(s.a);
      w.sub(r.copy(s.u).multiplyScalar(w.dot(s.u)));   // lo que se aparta de la línea del hueso
      dG.addScaledVector(w, p * s.g); dD.addScaledVector(w, p * s.d); dM.addScaledVector(w, p * s.m);
      if (s.tronco) tronco += p;
    }
    // Con sobrepeso, la tripa sale hacia delante
    if (tronco > 0.05) {
      w.copy(v).sub(ejeTronco.a); w.sub(r.copy(ejeTronco.u).multiplyScalar(w.dot(ejeTronco.u)));
      const delante = Math.max(0, w.clone().normalize().dot(frente));
      const tripa = Math.exp(-(((v.y - yTripa) / (0.21 * k)) ** 2));
      dG.addScaledVector(frente, tronco * k * (0.085 * delante ** 1.2 * tripa));
    }
    if (dG.lengthSq() + dD.lengthSq() + dM.lengthSq() > 0) {
      algo = true;
      dG.applyMatrix3(lin).toArray(gordo, i * 3); dD.applyMatrix3(lin).toArray(delgado, i * 3); dM.applyMatrix3(lin).toArray(musculo, i * 3);
    }
  }
  if (!algo) return null;
  const nueva = new THREE.BufferAttribute(base.slice(), 3);
  geo.setAttribute('position', nueva);
  let clave = '0|0';
  return {
    poner(peso, musc) {
      if (`${peso}|${musc}` === clave) return;
      clave = `${peso}|${musc}`;
      const arr = nueva.array, campo = peso >= 0 ? gordo : delgado, f = Math.abs(peso) * (peso >= 0 ? 1 : -1);
      for (let i = 0; i < arr.length; i++) arr[i] = base[i] + campo[i] * f + musculo[i] * musc;
      nueva.needsUpdate = true;
      geo.computeBoundingSphere();
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
function medirCabeza(mallas, objeto, conAncla = true) {
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
  if (!conAncla) return { medidas: { rx, rz, alto: techo - nivel } };
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
      if (uGorroOn > 0.5 && (uGorroInv * vec4(vPosMundo, 1.0)).y > -0.008) discard;`);
  };
  m.needsUpdate = true;
}

// ---------- Texturas de tela, dibujadas una vez ----------
const lienzo = (w, h, pintar) => { const c = document.createElement('canvas'); c.width = w; c.height = h; pintar(c.getContext('2d'), w, h); return c; };
const texturas = {};
// Punto de lana: puntos en V (cuerpo) y canalé 1×1 (vuelta). Sirve de relieve y de sombreado del color.
function texLana() {
  if (texturas.lana) return texturas.lana;
  const c = lienzo(512, 256, (x, W, H) => {
    x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, W, H);
    const cols = 32, filas = 16, cw = W / cols, ch = H / filas;
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
      const cx = i * cw + cw / 2, cy = j * ch;
      for (const s of [-1, 1]) {   // dos "patitas" de cada punto, en V
        const g = x.createLinearGradient(cx, cy, cx + s * cw * 0.45, cy + ch);
        g.addColorStop(0, '#8a8a8a'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#949494');
        x.fillStyle = g; x.beginPath();
        x.ellipse(cx + s * cw * 0.22, cy + ch * 0.55, cw * 0.2, ch * 0.62, s * 0.5, 0, Math.PI * 2); x.fill();
      }
    }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return (texturas.lana = t);
}
function texCanale() {
  if (texturas.canale) return texturas.canale;
  const c = lienzo(256, 64, (x, W, H) => {
    for (let i = 0; i < W; i++) { const sn = Math.sin((i / W) * Math.PI * 2 * 16); const g = 200 + 55 * Math.sign(sn) * Math.abs(sn) ** 0.6; x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(i, 0, 1, H); }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return (texturas.canale = t);
}
// Gorra de seis paños: costuras con pespunte, ojales y un poco de textura de sarga
function texGorra() {
  if (texturas.gorra) return texturas.gorra;
  const W = 1024, H = 512;
  const c = lienzo(W, H, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const g = 235 + Math.random() * 20; x.fillStyle = `rgba(${g},${g},${g},.5)`; x.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
    // Sarga: diagonales finas
    x.strokeStyle = 'rgba(0,0,0,.045)'; x.lineWidth = 1;
    for (let i = -H; i < W; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); }
    // Costuras: delante en el centro (u = 0,25) y cada 60°
    for (let k = 0; k < 6; k++) {
      const u = (k / 6) * W;
      x.strokeStyle = 'rgba(0,0,0,.42)'; x.lineWidth = 3; x.beginPath(); x.moveTo(u, 0); x.lineTo(u, H); x.stroke();
      x.setLineDash([6, 5]); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1.4;
      for (const d of [-7, 7]) { x.beginPath(); x.moveTo(u + d, 6); x.lineTo(u + d, H); x.stroke(); }
      x.setLineDash([]);
      // Ojal de ventilación en mitad de cada paño
      const uo = ((k + 0.5) / 6) * W, vo = H * 0.42;
      x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.ellipse(uo, vo, 5, 4, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 2; x.beginPath(); x.ellipse(uo, vo, 9, 7, 0, 0, Math.PI * 2); x.stroke();
    }
    // Pespunte del borde
    x.setLineDash([6, 5]); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(0, H - 14); x.lineTo(W, H - 14); x.stroke(); x.setLineDash([]);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (texturas.gorra = t);
}
function texVisera2() {
  if (texturas.visera) return texturas.visera;
  const c = lienzo(512, 128, (x, W, H) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(0,0,0,.045)'; for (let i = -H; i < W; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); }
    x.setLineDash([7, 5]); x.strokeStyle = 'rgba(0,0,0,.32)'; x.lineWidth = 1.5;
    for (const f of [0.86, 0.7, 0.54, 0.38]) { x.beginPath(); x.moveTo(0, H * (1 - f)); x.lineTo(W, H * (1 - f)); x.stroke(); }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texturas.visera = t);
}
function texVisera(forma) {
  // Pespuntes paralelos al borde de la visera (se dibujan en el plano de la forma)
  const W = 512, H = 256;
  const c = lienzo(W, H, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(0,0,0,.045)'; for (let i = -H; i < W; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); }
    x.setLineDash([7, 5]); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1.6;
    for (const f of [0.9, 0.78, 0.66, 0.54]) {
      x.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * Math.PI;
        const px = forma.cx + Math.cos(t) * forma.ax, pz = forma.cz + Math.sin(t) * (forma.r0 + (forma.bz - forma.r0) * f);
        const X = ((px - forma.minx) / (forma.maxx - forma.minx)) * W, Y = ((pz - forma.minz) / (forma.maxz - forma.minz)) * H;
        i ? x.lineTo(X, Y) : x.moveTo(X, Y);
      }
      x.stroke();
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crearGorro(tipo, color, { rx, rz, alto }) {
  const g = new THREE.Group(); g.name = 'gorro';
  const sombra = o => { o.castShadow = true; o.receiveShadow = true; return o; };
  if (tipo === 'lana') {
    // Perfil (radio relativo, altura): vuelta doblada abajo y cúpula algo holgada arriba
    const Hc = alto + 0.022, puno = 0.046;
    const perfil = [];
    perfil.push(new THREE.Vector2(1.0, -0.012), new THREE.Vector2(1.065, -0.01), new THREE.Vector2(1.075, 0.0));
    for (let i = 1; i <= 6; i++) perfil.push(new THREE.Vector2(1.075 + 0.004 * Math.sin((i / 6) * Math.PI), (i / 6) * puno));
    perfil.push(new THREE.Vector2(1.06, puno + 0.006), new THREE.Vector2(1.03, puno + 0.006));
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, y = puno + u * (Hc - puno);
      const r = 1.025 * Math.pow(Math.max(0, 1 - Math.pow(u, 1.9)), 0.5) * (1 + 0.03 * Math.sin(u * Math.PI));
      perfil.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    // Cúpula (desde lo alto de la vuelta) con punto en V
    const geo = new THREE.LatheGeometry(perfil.slice(9), 64);
    geo.scale(rx * 1.04, 1, rz * 1.04);
    const lana = texLana().clone(); lana.repeat.set(2.5, 3); lana.needsUpdate = true;
    const mat = new THREE.MeshPhysicalMaterial({
      color: color || '#3A4150', roughness: 1, metalness: 0, sheen: 1, sheenRoughness: 0.75, sheenColor: new THREE.Color(color || '#3A4150').lerp(new THREE.Color('#ffffff'), 0.45),
      bumpMap: lana, bumpScale: 5, map: lana,
    });
    const gorro = new THREE.Mesh(geo, mat);
    // La vuelta, con canalé (encima de la cúpula, un pelín más ancha)
    const vueltaP = perfil.slice(0, 11);
    const geoV = new THREE.LatheGeometry(vueltaP, 64); geoV.scale(rx * 1.045, 1, rz * 1.045);
    const canale = texCanale().clone(); canale.repeat.set(9, 1); canale.needsUpdate = true;
    const matV = new THREE.MeshPhysicalMaterial({ color: mat.color, roughness: 1, sheen: 1, sheenRoughness: 0.75, sheenColor: mat.sheenColor, bumpMap: canale, bumpScale: 4, map: canale });
    const vuelta = new THREE.Mesh(geoV, matV);
    g.add(sombra(gorro), sombra(vuelta));
  } else {
    const col = new THREE.Color(color || '#24272E');
    const mat = new THREE.MeshPhysicalMaterial({ color: col, map: texGorra(), roughness: 0.82, sheen: 0.4, sheenRoughness: 0.8, sheenColor: col.clone().lerp(new THREE.Color('#ffffff'), 0.3) });
    // Copa: perfil "superelipse" (lados rectos y techo algo plano), con el frente algo más alto (gorra estructurada)
    const H = alto + 0.004;
    const perfil = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI / 2;
      const r = Math.pow(Math.cos(t), 0.62), y = Math.pow(Math.sin(t), 0.9);
      perfil.push(new THREE.Vector2(Math.max(0.0005, r), y));
    }
    perfil.unshift(new THREE.Vector2(1.0, -0.12));   // un poco más abajo (y = −0,12·H ≈ 1 cm)
    const geo = new THREE.LatheGeometry(perfil, 72);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const len = Math.hypot(x, z), fr = len < 1e-4 ? 0.5 : Math.max(0, z / len) ** 2;   // 0 detrás … 1 delante (suave)
      p.setXYZ(i, x * rx * 1.04, y * H * (1 + 0.08 * fr * (1 - y * 0.5)), z * rz * 1.04 * (1 + 0.02 * fr));
    }
    geo.computeVertexNormals();
    const copa = new THREE.Mesh(geo, mat);
    // Botón de arriba
    const boton = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    boton.scale.y = 0.6; boton.position.y = H - 0.002;
    // Visera: superficie curva unida al borde delantero de la copa; cae por los lados y un poco hacia delante
    const NS = 48, NT = 10, sale = 0.072;
    const pts = [], uvs = [], ind = [];
    for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
      const t = j / NT;                                         // de la copa a la punta
      const ang = Math.PI * (0.13 + 0.74 * (i / NS));          // solo la parte de delante
      const sx = Math.cos(ang) / Math.cos(Math.PI * 0.13);       // −1 … 1 de un lado a otro
      const rIn = { x: Math.cos(ang) * rx * 1.035, z: Math.sin(ang) * rz * 1.035 };
      const z = rIn.z + t * sale * Math.sin(ang) ** 1.5;
      const y = -0.006 - t * (0.014 + 0.026 * sx ** 4);
      pts.push(rIn.x * (1 + 0.05 * t), y, z);
      uvs.push(i / NS, t);
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) {
      const a0 = j * (NS + 1) + i, a1 = a0 + 1, b0 = a0 + NS + 1, b1 = b0 + 1;
      ind.push(a0, b0, a1, a1, b0, b1);
    }
    const gV = new THREE.BufferGeometry();
    gV.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    gV.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    gV.setIndex(ind); gV.computeVertexNormals();
    const matV = mat.clone(); matV.side = THREE.DoubleSide; matV.map = texVisera2();
    const visera = new THREE.Mesh(gV, matV);
    // Canto de la visera (le da grosor)
    const canto = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
      Array.from({ length: NS + 1 }, (_, i) => new THREE.Vector3().fromArray(pts, (NT * (NS + 1) + i) * 3))), 64, 0.0028, 6, false), mat);
    g.add(sombra(copa), sombra(visera), sombra(canto), boton);
  }
  return g;
}
