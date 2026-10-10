// Motor del avatar de Lumen.
// Cuerpo humano real (malla base de MakeHuman, CC0) con deformaciones de geometría,
// esqueleto que se reajusta a cada forma y recursos (pelo, ropa, calzado...) ligados
// a la superficie del cuerpo igual que en MakeHuman: siguen cada cambio de forma.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PERFIL_BASE, normalizar, pesosMorfos, tonoPiel, RECURSOS_ROPA } from './parametros.js';

const RUTA = new URL('../../media/avatar/', import.meta.url).href;
const cargador = new GLTFLoader();
const texturas = new THREE.TextureLoader();

// ---------- Datos compartidos (se descargan una vez) ----------
let datosP = null;
export function datos() {
  if (datosP) return datosP;
  datosP = (async () => {
    const [cat, base, morfos] = await Promise.all([
      fetch(`${RUTA}catalogo.json`).then(r => r.json()),
      fetch(`${RUTA}base.bin`).then(r => r.arrayBuffer()),
      fetch(`${RUTA}morfos.bin`).then(r => r.arrayBuffer()),
    ]);
    const M = new Map();
    // Cada morfo: saltos entre índices (uint16) y deltas en planos x|y|z (int16)
    for (const m of cat.morfos) {
      const saltos = new Uint16Array(morfos, m.o, m.n);
      const idx = new Uint32Array(m.n);
      for (let i = 0, a = 0; i < m.n; i++) { a += saltos[i]; idx[i] = a; }
      M.set(m.id, { idx, q: new Int16Array(morfos, m.o + m.n * 2, m.n * 3), e: m.e });
    }
    const art = {};
    for (const [k, v] of Object.entries(cat.articulaciones)) art[k] = Uint16Array.from(v);
    return { cat, base: new Float32Array(base), morfos: M, art };
  })();
  datosP.catch(() => { datosP = null; });
  return datosP;
}

const cacheGeo = new Map();
function geometria(nombre) {
  if (!cacheGeo.has(nombre)) {
    const p = cargador.loadAsync(`${RUTA}${nombre}`).then(g => {
      let geo = null;
      g.scene.traverse(o => { if (o.isMesh && !geo) geo = o.geometry; });
      return geo;
    });
    p.catch(() => cacheGeo.delete(nombre));
    cacheGeo.set(nombre, p);
  }
  return cacheGeo.get(nombre);
}

const cacheTex = new Map();
function textura(ruta, color = true) {
  if (!ruta) return Promise.resolve(null);
  if (!cacheTex.has(ruta)) {
    const p = texturas.loadAsync(`${RUTA}${ruta}`).then(t => {
      t.flipY = false;
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 4;
      t.needsUpdate = true;
      return t;
    });
    p.catch(() => cacheTex.delete(ruta));
    cacheTex.set(ruta, p);
  }
  return cacheTex.get(ruta);
}

// Nombres de huesos sin puntos (three los usa como separador en las animaciones)
export const nombreHueso = n => n.replace(/\./g, '_');

// Las prendas vienen en piezas con costuras (vértices repetidos en el mismo sitio):
// se unen por posición para que las normales sean continuas y no se abran grietas
function soldarPorPosicion(geo) {
  if (geo.userData.soldada) return;
  const p = geo.attributes.position.array, idx = geo.attributes._idx.array;
  const canon = new Map(), mapa = new Map();
  for (let i = 0; i < idx.length; i++) {
    const k = `${Math.round(p[i * 3] * 5000)},${Math.round(p[i * 3 + 1] * 5000)},${Math.round(p[i * 3 + 2] * 5000)}`;
    if (!canon.has(k)) canon.set(k, idx[i]);
    mapa.set(idx[i], canon.get(k));
  }
  for (let i = 0; i < idx.length; i++) idx[i] = mapa.get(idx[i]);
  geo.userData.soldada = true;
}

// ---------- Normales suaves sobre la malla soldada ----------
function preparaNormales(geo, nSoldados) {
  const idx = geo.attributes._idx.array;
  const ind = geo.index.array;
  const tri = new Uint32Array(ind.length);
  for (let i = 0; i < ind.length; i++) tri[i] = idx[ind[i]];
  return { tri, acc: new Float32Array(nSoldados * 3), idx };
}

function calculaNormales(geo, prep, posSoldada) {
  const { tri, acc, idx } = prep;
  acc.fill(0);
  const P = posSoldada;
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i] * 3, b = tri[i + 1] * 3, c = tri[i + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    acc[a] += nx; acc[a + 1] += ny; acc[a + 2] += nz;
    acc[b] += nx; acc[b + 1] += ny; acc[b + 2] += nz;
    acc[c] += nx; acc[c + 1] += ny; acc[c + 2] += nz;
  }
  const N = geo.attributes.normal.array;
  for (let i = 0; i < idx.length; i++) {
    const s = idx[i] * 3;
    const x = acc[s], y = acc[s + 1], z = acc[s + 2];
    const l = Math.hypot(x, y, z) || 1;
    N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
  }
  geo.attributes.normal.needsUpdate = true;
}

// ---------- Materiales ----------
// Tinte de prendas: mezcla la textura original con su luminancia teñida del color elegido
function materialTenible(opts) {
  const mat = new THREE.MeshStandardMaterial(opts);
  mat.userData.tinte = { value: new THREE.Color(1, 1, 1) };
  mat.userData.mezcla = { value: 0 };
  mat.userData.lum = { value: 0.4 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTinte = mat.userData.tinte;
    sh.uniforms.uMezcla = mat.userData.mezcla;
    sh.uniforms.uLum = mat.userData.lum;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTinte; uniform float uMezcla; uniform float uLum;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          float k = clamp(l / max(uLum * uLum, 0.02), 0.0, 1.6);
          vec3 t = uTinte * mix(0.55, 1.0, smoothstep(0.0, 1.0, k)) * min(k, 1.15);
          diffuseColor.rgb = mix(diffuseColor.rgb, t, uMezcla);
        }`);
  };
  mat.customProgramCacheKey = () => 'tenible';
  return mat;
}

// Microtextura de piel (poros muy sutiles) generada aquí: un mapa de normales que se repite
let microPiel = null;
function texturaPoros() {
  if (microPiel) return microPiel;
  const L = 256, c = document.createElement('canvas'); c.width = c.height = L;
  const x = c.getContext('2d'), img = x.createImageData(L, L);
  const h = new Float32Array(L * L);
  for (let i = 0; i < h.length; i++) h[i] = Math.random();
  // suaviza un poco (poros, no ruido de televisor)
  const g = new Float32Array(L * L);
  for (let y = 0; y < L; y++) for (let xx = 0; xx < L; xx++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += h[((y + dy + L) % L) * L + ((xx + dx + L) % L)];
    g[y * L + xx] = s / 9;
  }
  for (let y = 0; y < L; y++) for (let xx = 0; xx < L; xx++) {
    const dx = g[y * L + (xx + 1) % L] - g[y * L + (xx - 1 + L) % L];
    const dy = g[((y + 1) % L) * L + xx] - g[((y - 1 + L) % L) * L + xx];
    const nx = -dx * 2.2, ny = -dy * 2.2, l = Math.hypot(nx, ny, 1);
    const o = (y * L + xx) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  microPiel = new THREE.CanvasTexture(c);
  microPiel.wrapS = microPiel.wrapT = THREE.RepeatWrapping;
  microPiel.repeat.set(36, 36);
  microPiel.colorSpace = THREE.NoColorSpace;
  return microPiel;
}

// Piel: algo de terciopelo (sheen) para que la luz no la deje plastificada,
// microtextura muy suave y un punto menos de saturación que la textura original
function materialPiel() {
  const m = new THREE.MeshPhysicalMaterial({
    roughness: 0.56, metalness: 0, sheen: 0.4, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffd8c8'),
    normalMap: texturaPoros(), normalScale: new THREE.Vector2(0.09, 0.09), specularIntensity: 0.55,
  });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.86);`);
  };
  m.customProgramCacheKey = () => 'piel';
  return m;
}

function hex(c) { return new THREE.Color(c); } // three ya convierte el hex sRGB a lineal

// ---------- Avatar ----------
export async function crearAvatar(perfilInicial = PERFIL_BASE, { sombras = true } = {}) {
  const D = await datos();
  const { cat } = D;
  const NV = cat.nVertices;
  const P = new Float32Array(NV * 3);

  const raiz = new THREE.Group(); raiz.name = 'avatar';
  const cont = new THREE.Group(); raiz.add(cont);

  // Esqueleto: rotaciones de reposo nulas, solo posiciones (se recalculan con cada forma)
  const huesos = cat.huesos.map(h => { const b = new THREE.Bone(); b.name = nombreHueso(h.n); return b; });
  cat.huesos.forEach((h, i) => { (h.p >= 0 ? huesos[h.p] : cont).add(huesos[i]); });
  const inversas = huesos.map(() => new THREE.Matrix4());
  const esqueleto = new THREE.Skeleton(huesos, inversas);
  const cabezas = new Float32Array(huesos.length * 3);
  const colas = new Float32Array(huesos.length * 3);

  // Cuerpo
  const geoCuerpo = (await geometria('cuerpo.glb')).clone();
  geoCuerpo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geoCuerpo.attributes.position.count * 3), 3));
  const indiceCompleto = geoCuerpo.index.array.slice();
  const prepCuerpo = preparaNormales(geoCuerpo, NV);
  const matPiel = materialPiel();
  const cuerpo = new THREE.SkinnedMesh(geoCuerpo, matPiel);
  cuerpo.name = 'cuerpo';
  cuerpo.frustumCulled = false;
  cuerpo.castShadow = sombras; cuerpo.receiveShadow = sombras;
  cont.add(cuerpo);
  cuerpo.bind(esqueleto, new THREE.Matrix4());

  // Recursos montados: ranura -> { id, malla, prep, def }
  const montados = new Map();
  let perfil = normalizar(perfilInicial);
  let pesoActual = null;
  let pieY = 0;

  function calculaForma() {
    P.set(D.base);
    const w = pesosMorfos(perfil);
    pesoActual = w;
    for (const [id, peso] of w) {
      if (!peso) continue;
      const m = D.morfos.get(id);
      if (!m) continue;
      const k = m.e * peso, { idx, q } = m, n = idx.length, n2 = n * 2;
      for (let i = 0; i < n; i++) {
        const o = idx[i] * 3;
        P[o] += q[i] * k; P[o + 1] += q[n + i] * k; P[o + 2] += q[n2 + i] * k;
      }
    }
    // Pies en el suelo
    const idxC = prepCuerpo.idx;
    let min = Infinity;
    for (let i = 0; i < idxC.length; i++) { const y = P[idxC[i] * 3 + 1]; if (y < min) min = y; }
    pieY = min;
  }

  function aplicaCuerpo() {
    const pos = geoCuerpo.attributes.position.array, idx = prepCuerpo.idx;
    for (let i = 0; i < idx.length; i++) {
      const s = idx[i] * 3;
      pos[i * 3] = P[s]; pos[i * 3 + 1] = P[s + 1]; pos[i * 3 + 2] = P[s + 2];
    }
    geoCuerpo.attributes.position.needsUpdate = true;
    calculaNormales(geoCuerpo, prepCuerpo, P);
    geoCuerpo.computeBoundingSphere();
  }

  function media(lista, out, o) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < lista.length; i++) { const s = lista[i] * 3; x += P[s]; y += P[s + 1]; z += P[s + 2]; }
    const n = lista.length || 1;
    out[o] = x / n; out[o + 1] = y / n; out[o + 2] = z / n;
  }

  function aplicaEsqueleto() {
    cat.huesos.forEach((h, i) => {
      media(D.art[h.h], cabezas, i * 3);
      media(D.art[h.t], colas, i * 3);
    });
    cat.huesos.forEach((h, i) => {
      const b = huesos[i], o = i * 3;
      if (h.p >= 0) {
        const p = h.p * 3;
        b.position.set(cabezas[o] - cabezas[p], cabezas[o + 1] - cabezas[p + 1], cabezas[o + 2] - cabezas[p + 2]);
      } else {
        b.position.set(cabezas[o], cabezas[o + 1], cabezas[o + 2]);
      }
      inversas[i].makeTranslation(-cabezas[o], -cabezas[o + 1], -cabezas[o + 2]);
    });
    raiz.userData.posReposo = huesos.map(b => b.position.clone());
  }

  function escalaProxy(def) {
    const s = [1, 1, 1];
    ['x', 'y', 'z'].forEach((k, ax) => {
      const [a, b, d] = def.escala[k];
      s[ax] = Math.abs(P[a * 3 + ax] - P[b * 3 + ax]) / d;
    });
    return s;
  }

  function aplicaProxy(m) {
    const g = m.malla.geometry, A = g.attributes;
    const ref = A._ref.array, rw = A._rw.array, off = A._off.array, pos = A.position.array;
    const s = escalaProxy(m.def);
    const n = A.position.count;
    const sold = m.sold;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const a = ref[j] * 3, b = ref[j + 1] * 3, c = ref[j + 2] * 3;
      const wa = rw[j], wb = rw[j + 1], wc = rw[j + 2];
      for (let ax = 0; ax < 3; ax++) {
        pos[j + ax] = wa * P[a + ax] + wb * P[b + ax] + wc * P[c + ax] + off[j + ax] * s[ax];
      }
      const k = A._idx.array[i] * 3;
      sold[k] = pos[j]; sold[k + 1] = pos[j + 1]; sold[k + 2] = pos[j + 2];
    }
    A.position.needsUpdate = true;
    calculaNormales(g, m.prep, sold);
    // La ropa se separa un pelo de la piel para que no la atraviese al animarse
    const holgura = { arriba: 0.003, conjunto: 0.003, abajo: 0.002 }[m.malla.name];
    if (holgura) {
      const N = A.normal.array;
      for (let i = 0; i < pos.length; i++) pos[i] += N[i] * holgura;
    }
    g.computeBoundingSphere();
  }

  // Vecinos de cada vértice del cuerpo (para recortar el borde de lo que tapa la ropa)
  let vecinos = null;
  function prepararVecinos() {
    const tri = prepCuerpo.tri, cuenta = new Uint32Array(NV + 1);
    for (let i = 0; i < tri.length; i++) cuenta[tri[i] + 1] += 2;
    for (let i = 0; i < NV; i++) cuenta[i + 1] += cuenta[i];
    const lista = new Uint32Array(cuenta[NV]), pos = cuenta.slice(0, NV);
    for (let i = 0; i < tri.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const a = tri[i + k];
        lista[pos[a]++] = tri[i + (k + 1) % 3]; lista[pos[a]++] = tri[i + (k + 2) % 3];
      }
    }
    vecinos = { cuenta, lista };
  }

  function aplicaOcultos() {
    let oculto = new Uint8Array(NV);
    for (const m of montados.values()) {
      for (const [a, b] of m.def.ocultar || []) oculto.fill(1, a, b + 1);
    }
    // Se deja visible una franja junto a los bordes de la ropa (mangas, bajo, cuello):
    // así se ve el brazo por dentro de la manga en vez de un hueco
    if (!vecinos) prepararVecinos();
    const { cuenta, lista } = vecinos;
    for (let paso = 0; paso < 2; paso++) {
      const sig = oculto.slice();
      for (let v = 0; v < NV; v++) {
        if (!oculto[v]) continue;
        for (let j = cuenta[v]; j < cuenta[v + 1]; j++) if (!oculto[lista[j]]) { sig[v] = 0; break; }
      }
      oculto = sig;
    }
    const tri = prepCuerpo.tri;
    const out = new Uint32Array(indiceCompleto.length);
    let n = 0;
    for (let i = 0; i < tri.length; i += 3) {
      // Basta un vértice cubierto para ocultar la cara: la piel no asoma por la ropa al moverse
      if (oculto[tri[i]] || oculto[tri[i + 1]] || oculto[tri[i + 2]]) continue;
      out[n++] = indiceCompleto[i]; out[n++] = indiceCompleto[i + 1]; out[n++] = indiceCompleto[i + 2];
    }
    geoCuerpo.setIndex(new THREE.BufferAttribute(out.slice(0, n), 1));
  }

  // Capas: lo que queda bajo la prenda de arriba se mete un poco hacia dentro para que no asome
  function ajustaCapas() {
    const arriba = montados.get('arriba'), abajo = montados.get('abajo');
    if (!arriba || !abajo) return;
    aplicaProxy(abajo);
    const pa = arriba.malla.geometry.attributes.position.array;
    let bajo = Infinity;
    for (let i = 1; i < pa.length; i += 3) if (pa[i] < bajo) bajo = pa[i];
    const g = abajo.malla.geometry, p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      const d = p[i + 1] - bajo;
      if (d < -0.01) continue;
      const k = 0.007 * Math.min(1, (d + 0.01) / 0.02);
      p[i] -= n[i] * k; p[i + 1] -= n[i + 1] * k; p[i + 2] -= n[i + 2] * k;
    }
    g.attributes.position.needsUpdate = true;
  }

  // Con sombrero, el pelo que quedaría dentro de la copa se oculta
  let peloRecortado = false;
  function ajustaSombrero() {
    const pelo = montados.get('pelo'), som = montados.get('sombrero');
    if (!pelo) return;
    const g = pelo.malla.geometry;
    if (!som) {
      if (peloRecortado) { g.setIndex(new THREE.BufferAttribute(pelo.indice.slice(), 1)); peloRecortado = false; }
      return;
    }
    const ps = som.malla.geometry.attributes.position.array;
    let ala = Infinity;
    for (let i = 1; i < ps.length; i += 3) if (ps[i] < ala) ala = ps[i];
    const pp = g.attributes.position.array, ind = pelo.indice, out = new Uint32Array(ind.length);
    let n = 0;
    for (let i = 0; i < ind.length; i += 3) {
      const a = ind[i], b = ind[i + 1], c = ind[i + 2];
      if (pp[a * 3 + 1] > ala + 0.012 && pp[b * 3 + 1] > ala + 0.012 && pp[c * 3 + 1] > ala + 0.012) continue;
      out[n++] = a; out[n++] = b; out[n++] = c;
    }
    g.setIndex(new THREE.BufferAttribute(out.slice(0, n), 1));
    peloRecortado = true;
  }

  function suelo() {
    let min = pieY;
    const cal = montados.get('calzado');
    if (cal) {
      const p = cal.malla.geometry.attributes.position.array;
      for (let i = 1; i < p.length; i += 3) if (p[i] < min) min = p[i];
    }
    cont.position.y = -min;
  }

  // ---------- Materiales de cada recurso ----------
  async function materialPara(def, ranura) {
    const [map, normalMap] = await Promise.all([textura(def.tex), textura(def.normal, false)]);
    if (def.tipo === 'pelo') {
      return new THREE.MeshStandardMaterial({
        map, normalMap, side: THREE.DoubleSide, alphaTest: 0.38, alphaToCoverage: true, roughness: 0.5, metalness: 0,
      });
    }
    if (def.tipo === 'cejas' || def.tipo === 'pestanas') {
      // Semitransparentes: bordes suaves, sin dientes de sierra
      return new THREE.MeshStandardMaterial({
        map, side: THREE.DoubleSide, transparent: true, depthWrite: false, alphaTest: 0.02, roughness: 0.85, metalness: 0,
        color: def.tipo === 'pestanas' ? 0x1a1512 : 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      });
    }
    if (def.tipo === 'ojos') {
      return new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0, alphaTest: 0.5 });
    }
    const mat = materialTenible({ map, normalMap, roughness: ranura === 'calzado' ? 0.55 : 0.88, metalness: 0, side: ranura === 'calzado' ? THREE.FrontSide : THREE.DoubleSide });
    mat.userData.lum.value = def.lum ?? 0.4;
    if (normalMap) mat.normalScale.set(0.8, 0.8);
    return mat;
  }

  async function montar(ranura, id) {
    const prev = montados.get(ranura);
    if (prev?.id === id) return false;
    if (!id) {
      if (prev) { prev.malla.removeFromParent(); prev.malla.geometry.dispose(); montados.delete(ranura); }
      return !!prev;
    }
    const def = cat.recursos[id];
    if (!def) return false;
    const [geoBase, mat] = await Promise.all([geometria(def.glb), materialPara(def, ranura)]);
    if (montados.get(ranura) !== prev) return false; // otro cambio llegó antes
    const geo = geoBase.clone();
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    soldarPorPosicion(geo);
    let maxIdx = 0;
    for (const v of geo.attributes._idx.array) if (v > maxIdx) maxIdx = v;
    const malla = new THREE.SkinnedMesh(geo, mat);
    malla.name = ranura;
    malla.frustumCulled = false;
    malla.castShadow = sombras && ranura !== 'cejas' && ranura !== 'pestanas';
    malla.receiveShadow = sombras;
    malla.renderOrder = { abajo: 1, calzado: 1, arriba: 2, conjunto: 2, pelo: 4, sombrero: 5, cejas: 3, pestanas: 3 }[ranura] || 0;
    if (ranura === 'arriba' || ranura === 'conjunto') { mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2; }
    cont.add(malla);
    malla.bind(esqueleto, new THREE.Matrix4());
    const m = { id, def, malla, prep: preparaNormales(geo, maxIdx + 1), sold: new Float32Array((maxIdx + 1) * 3), indice: geo.index.array.slice() };
    if (prev) { prev.malla.removeFromParent(); prev.malla.geometry.dispose(); }
    montados.set(ranura, m);
    aplicaProxy(m);
    return true;
  }

  // ---------- Color ----------
  async function aplicaPiel() {
    const t = tonoPiel(perfil);
    const tex = await textura(cat.pieles[t.textura]);
    const barba = perfil.barba?.estilo && perfil.barba.estilo !== 'ninguna' ? perfil.barba : null;
    const map = barba && D.cat.barbas?.[barba.estilo] ? await pielConBarba(tex, barba) : tex;
    if (matPiel.map !== map) { const habia = !!matPiel.map; matPiel.map = map; if (!habia) matPiel.needsUpdate = true; }
    matPiel.color.copy(hex(t.tinte));
  }

  // Barba sobre la piel: máscara suave en el espacio UV de la cara + grano de vello hecho aquí
  const cacheMascara = new Map();
  function mascara(ruta, L) {
    const k = `${ruta}|${L}`;
    if (!cacheMascara.has(k)) {
      cacheMascara.set(k, (async () => {
        const img = new Image(); img.src = `${RUTA}${ruta}`; await img.decode();
        const c = document.createElement('canvas'); c.width = c.height = L;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, L, L);
        const d = x.getImageData(0, 0, L, L).data;
        const idx = [], val = [];
        for (let i = 0, j = 0; i < d.length; i += 4, j++) if (d[i] > 2) { idx.push(j); val.push(d[i] / 255); }
        return { idx: Uint32Array.from(idx), val: Float32Array.from(val) };
      })());
    }
    return cacheMascara.get(k);
  }
  const ruido = (x, y) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  let pielClave = '', pielBarba = null;
  async function pielConBarba(tex, barba) {
    const info = D.cat.barbas[barba.estilo];
    const clave = `${tex.uuid}|${barba.estilo}|${barba.color}`;
    if (clave === pielClave && pielBarba) return pielBarba;
    const img = tex.image;
    const L = Math.min(img.width, matchMedia('(pointer: coarse)').matches ? 1024 : 2048);
    const m = await mascara(info.mascara, L);
    const c = document.createElement('canvas'); c.width = c.height = L;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, L, L);
    const datos = ctx.getImageData(0, 0, L, L), px = datos.data;
    const col = new THREE.Color(barba.color || '#2b2018');
    const cr = col.r * 255, cg = col.g * 255, cb = col.b * 255;
    const { idx, val } = m;
    const tipo = info.tipo, alfa = info.alfa;
    for (let i = 0; i < idx.length; i++) {
      const j = idx[i], x = j % L, y = (j / L) | 0;
      // Pelo: puntos finos, algo alargados hacia abajo
      const n = 0.6 * ruido(x, y) + 0.4 * ruido(x, (y / 3) | 0);
      let a;
      if (tipo === 'sombra') a = val[i] * (0.35 + 0.65 * n);
      else if (tipo === 'corta') a = val[i] * (0.45 + 0.55 * n);
      else a = val[i] * (0.72 + 0.28 * n);
      a *= alfa;
      const o = j * 4;
      px[o] += (cr - px[o]) * a; px[o + 1] += (cg - px[o + 1]) * a; px[o + 2] += (cb - px[o + 2]) * a;
    }
    ctx.putImageData(datos, 0, 0);
    pielBarba?.dispose();
    const t = new THREE.CanvasTexture(c);
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    pielClave = clave; pielBarba = t;
    return t;
  }

  // El pelo viene en gris normalizado: se compensa su luminancia para que el color elegido sea el que se ve
  function colorPelo(m, c) {
    const lum = Math.max(0.12, Math.pow(m.def.lum ?? 0.5, 2.2));
    const col = hex(c).multiplyScalar(Math.min(3.2, 0.62 / lum));
    m.malla.material.color.copy(col);
  }
  function aplicaColores() {
    const pelo = montados.get('pelo');
    if (pelo) colorPelo(pelo, perfil.pelo.color);
    const cejas = montados.get('cejas');
    if (cejas) colorPelo(cejas, perfil.pelo.cejas || perfil.pelo.color);
    for (const r of ['arriba', 'abajo', 'conjunto', 'calzado', 'sombrero']) {
      const m = montados.get(r);
      if (!m) continue;
      const c = perfil.ropa.colores?.[r];
      m.malla.material.userData.tinte.value.copy(hex(c || '#ffffff'));
      m.malla.material.userData.mezcla.value = c ? 1 : 0;
    }
  }

  let ojosColor = null;
  async function aplicaOjos() {
    const m = montados.get('ojos');
    if (!m || ojosColor === perfil.ojos) return;
    ojosColor = perfil.ojos;
    m.malla.material.map = await textura(cat.colorOjos[perfil.ojos] || cat.colorOjos.brown);
    m.malla.material.needsUpdate = true;
  }

  // ---------- API ----------
  let cola = Promise.resolve();
  let ultimaForma = '';
  async function aplicar(nuevo) {
    perfil = normalizar(nuevo);
    const trabajo = cola.then(async () => {
      const p = perfil;
      const r = RECURSOS_ROPA(p);
      const cambios = await Promise.all([
        montar('ojos', 'ojos'),
        montar('cejas', p.cejas ? `cejas-${p.cejas}` : null),
        montar('pestanas', `pestanas-${p.pestanas || '01'}`),
        montar('pelo', p.pelo.estilo && p.pelo.estilo !== 'ninguno' ? `pelo-${p.pelo.estilo}` : null),
        montar('arriba', r.arriba), montar('abajo', r.abajo), montar('conjunto', r.conjunto),
        montar('calzado', r.calzado), montar('sombrero', r.sombrero),
      ]);
      const forma = JSON.stringify([p.genero, p.musculo, p.grasa, p.altura, p.proporciones, p.pecho, p.rasgos, p.forma, p.rostro]);
      if (forma !== ultimaForma) {
        ultimaForma = forma;
        calculaForma();
        aplicaCuerpo();
        aplicaEsqueleto();
        for (const m of montados.values()) aplicaProxy(m);
      }
      if (cambios.some(Boolean)) aplicaOcultos();
      ajustaCapas();
      ajustaSombrero();
      suelo();
      await Promise.all([aplicaPiel(), aplicaOjos()]);
      aplicaColores();
    });
    cola = trabajo.catch(() => {});
    return trabajo;
  }

  await aplicar(perfil);

  // Puntos útiles para la cámara
  function punto(nombre, out = new THREE.Vector3()) {
    const i = cat.huesos.findIndex(h => h.n === nombre);
    return huesos[i].getWorldPosition(out);
  }
  function altura() {
    const i = cat.huesos.findIndex(h => h.n === 'head');
    return colas[i * 3 + 1] - pieY;
  }

  return {
    objeto: raiz,
    huesos,
    esqueleto,
    aplicar,
    perfil: () => perfil,
    punto,
    altura,
    cabezas, colas,
    hueso: n => huesos[cat.huesos.findIndex(h => h.n === n)],
    destruir() {
      raiz.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
      raiz.removeFromParent();
    },
  };
}
