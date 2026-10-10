# Convierte los recursos CC0 de MakeHuman en los archivos que usa Lumen (media/avatar).
#   cuerpo.glb      malla del cuerpo (UV, pesos de piel, índice al vértice soldado)
#   morfos.bin      deformaciones reales (índices uint16 + deltas int16 cuantizados)
#   <recurso>.glb   pelo, cejas, pestañas, ojos, ropa y calzado, ligados al cuerpo como en MakeHuman
#   tex/*.webp      texturas
#   catalogo.json   esqueleto, morfos, recursos y opciones
import sys, os, glob, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *
from logos import limpiar
from scipy.spatial import cKDTree

SAL = '/home/claude/sporttracker/media/avatar'
os.makedirs(f'{SAL}/tex', exist_ok=True)
T = f'{MH}/targets'

V, VT, CARAS = leer_obj(f'{MH}/3dobjs/base.obj')
NV = len(V)
print('vértices', NV)

# ---------------- Esqueleto y pesos ----------------
sk = json.load(open(f'{MH}/rigs/default.mhskel'))
huesos = sk['bones']
orden = []
def poner(n):
    if n in orden: return
    p = huesos[n]['parent']
    if p: poner(p)
    orden.append(n)
for n in huesos: poner(n)
ih = {n: i for i, n in enumerate(orden)}
art_usadas = set()
lista_huesos = []
for n in orden:
    b = huesos[n]
    lista_huesos.append({'n': n, 'p': ih[b['parent']] if b['parent'] else -1, 'h': b['head'], 't': b['tail']})
    art_usadas.update([b['head'], b['tail']])
articulaciones = {k: v for k, v in sk['joints'].items() if k in art_usadas}

pesos = json.load(open(f'{MH}/rigs/default_weights.mhw'))['weights']
por_vert = [[] for _ in range(NV)]
for n, lst in pesos.items():
    for vi, w in lst:
        por_vert[vi].append((w, ih[n]))
J = np.zeros((NV, 4), np.uint16); W = np.zeros((NV, 4), np.float32)
for vi, l in enumerate(por_vert):
    l.sort(reverse=True); l = l[:4]
    s = sum(w for w, _ in l) or 1
    for k, (w, b) in enumerate(l):
        J[vi, k] = b; W[vi, k] = w / s
    if not l:
        W[vi, 0] = 1  # sin peso: a la raíz

# ---------------- Morfos ----------------
morfos, trozos, off = [], [], 0

def anadir(id_, delta):
    """Guarda un morfo comprimible: índices como saltos (uint16) y deltas en planos x|y|z (int16)."""
    global off
    nz = np.where(np.abs(delta).max(1) * DM > 2e-4)[0]  # menos de 0,2 mm no se ve
    d = delta[nz] * DM
    esc = float(np.abs(d).max() / 32767) if len(nz) else 1.0
    q = np.round(d / esc).astype(np.int16)
    saltos = np.diff(np.r_[0, nz]).astype(np.uint16)
    trozos.append(saltos.tobytes()); trozos.append(np.ascontiguousarray(q.T).tobytes())
    morfos.append({'id': id_, 'n': int(len(nz)), 'o': off, 'e': esc})
    off += len(nz) * 8

def tgt(rel):
    return target_denso(f'{T}/{rel}.target', NV)

for g in ('female', 'male'):
    for m in ('minmuscle', 'averagemuscle', 'maxmuscle'):
        for w in ('minweight', 'averageweight', 'maxweight'):
            anadir(f'u-{g}-{m}-{w}', tgt(f'macrodetails/universal-{g}-young-{m}-{w}'))
    for r in ('african', 'asian', 'caucasian'):
        anadir(f'r-{r}-{g}', tgt(f'macrodetails/{r}-{g}-young'))
    for h in ('minheight', 'maxheight'):
        anadir(f'h-{g}-{h}', tgt(f'macrodetails/height/{g}-young-averagemuscle-averageweight-{h}'))
    for p in ('idealproportions', 'uncommonproportions'):
        anadir(f'p-{g}-{p}', tgt(f'macrodetails/proportions/{g}-young-averagemuscle-averageweight-{p}'))
for c in ('mincup', 'maxcup'):
    anadir(f'pecho-{c}', tgt(f'breast/female-young-averagemuscle-averageweight-{c}-averagefirmness'))

# Pares (control de -1 a 1). Cada lado puede sumar varios targets.
PARES = {
    # cuerpo
    'hombros': [('measure/measure-shoulder-dist-{}',)],
    'cintura': [('measure/measure-waist-circ-{}',)],
    'caderas': [('measure/measure-hips-circ-{}',)],
    'brazos': [('measure/measure-upperarm-circ-{}',), ('armslegs/l-lowerarm-scale-horiz-{}',), ('armslegs/r-lowerarm-scale-horiz-{}',)],
    'piernas': [('measure/measure-thigh-circ-{}',), ('measure/measure-calf-circ-{}',)],
    'cuello': [('measure/measure-neck-circ-{}',)],
    'torso': [('torso/torso-scale-horiz-{}',)],
    'espalda': [('torso/torso-vshape-{}',)],
    'gluteos': [('buttocks/buttocks-volume-{}',)],
    'abdomen': [('stomach/stomach-pregnant-{}',)],
    'largo-brazos': [('measure/measure-upperarm-length-{}',), ('measure/measure-lowerarm-length-{}',)],
    'largo-piernas': [('measure/measure-upperleg-height-{}',), ('measure/measure-lowerleg-height-{}',)],
    'largo-torso': [('torso/torso-scale-vert-{}',)],
    # rostro
    'cabeza-ancho': [('head/head-scale-horiz-{}',)],
    'cabeza-alto': [('head/head-scale-vert-{}',)],
    'mandibula': [('chin/chin-width-{}',)],
    'menton': [('chin/chin-prominent-{}',)],
    'menton-alto': [('chin/chin-height-{}',)],
    'pomulos': [('cheek/l-cheek-bones-{}',), ('cheek/r-cheek-bones-{}',)],
    'mejillas': [('cheek/l-cheek-volume-{}',), ('cheek/r-cheek-volume-{}',)],
    'nariz-ancho': [('nose/nose-scale-horiz-{}',)],
    'nariz-largo': [('nose/nose-scale-vert-{}',)],
    'nariz-puente': [('nose/nose-hump-{}',)],
    'nariz-punta': [('nose/nose-point-width-{}',)],
    'ojos-tamano': [('eyes/l-eye-scale-{}',), ('eyes/r-eye-scale-{}',)],
    'ojos-apertura': [('eyes/l-eye-height2-{}',), ('eyes/r-eye-height2-{}',)],
    'labios': [('mouth/mouth-upperlip-volume-{}',), ('mouth/mouth-lowerlip-volume-{}',)],
    'boca-ancho': [('mouth/mouth-scale-horiz-{}',)],
    'orejas': [('ears/l-ear-scale-{}',), ('ears/r-ear-scale-{}',)],
    'frente': [('forehead/forehead-scale-vert-{}',)],
}
# Pares con nombres distintos a incr/decr
PARES_ESP = {
    'ojos-separacion': (['eyes/l-eye-trans-out', 'eyes/r-eye-trans-out'], ['eyes/l-eye-trans-in', 'eyes/r-eye-trans-in']),
    'ojos-angulo': (['eyes/l-eye-corner1-up', 'eyes/r-eye-corner1-up'], ['eyes/l-eye-corner1-down', 'eyes/r-eye-corner1-down']),
    'cejas-angulo': (['eyebrows/eyebrows-angle-up'], ['eyebrows/eyebrows-angle-down']),
    'cejas-altura': (['eyebrows/eyebrows-trans-up'], ['eyebrows/eyebrows-trans-down']),
}
for k, partes in PARES.items():
    for lado, suf in (('+', 'incr'), ('-', 'decr')):
        anadir(f'{k}{lado}', sum(tgt(p[0].format(suf)) for p in partes))
for k, (mas, menos) in PARES_ESP.items():
    anadir(f'{k}+', sum(tgt(p) for p in mas)); anadir(f'{k}-', sum(tgt(p) for p in menos))
for f in ('oval', 'round', 'square', 'triangular'):
    anadir(f'forma-{f}', tgt(f'head/head-{f}'))

(V * DM).astype(np.float32).tofile(f'{SAL}/base.bin')
with open(f'{SAL}/morfos.bin', 'wb') as f:
    for t in trozos: f.write(t)
print('morfos', len(morfos), 'bytes', off)

def pesos8(w):
    """Pesos a uint8 normalizado que suman exactamente 255."""
    q = np.floor(w * 255).astype(np.int32)
    falta = 255 - q.sum(1)
    q[np.arange(len(q)), np.argmax(w, 1)] += falta
    return np.clip(q, 0, 255).astype(np.uint8)

# ---------------- Cuerpo ----------------
caras_cuerpo = [c for c in CARAS if c[0] == 'body']
pares, ind = desoldar(triangular(caras_cuerpo))
vi, ti = pares[:, 0], pares[:, 1]
g = GLB()
g.malla('cuerpo', {
    'POSITION': ((V[vi] * DM).astype(np.float32), 'VEC3'),
    'TEXCOORD_0': (np.c_[VT[ti, 0], 1 - VT[ti, 1]].astype(np.float32), 'VEC2'),
    'JOINTS_0': (J[vi].astype(np.uint8), 'VEC4'),
    'WEIGHTS_0': (pesos8(W[vi]), 'VEC4'),
    '_IDX': (vi.astype(np.float32), 'SCALAR'),
}, ind)
g.guardar(f'{SAL}/cuerpo.glb')
print('cuerpo', len(pares), 'vértices', len(ind) // 3, 'triángulos')

# ---------------- Texturas ----------------
def tex(ruta, nombre, lado=1024, alfa=False, ao=None, gris=False, q=86, sin_logo=None):
    im = Image.open(ruta)
    im = im.convert('RGBA' if alfa else 'RGB')
    if sin_logo:
        im = Image.fromarray(limpiar(sin_logo, np.asarray(im)))
    if ao and os.path.exists(ao):
        a = np.asarray(Image.open(ao).convert('L').resize(im.size), np.float32) / 255
        arr = np.asarray(im, np.float32)
        arr[..., :3] *= (0.35 + 0.65 * a)[..., None]
        im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), im.mode)
    if gris:
        arr = np.asarray(im, np.float32)
        l = arr[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
        # Normaliza a luminancia alta para que el color del usuario mande
        m = np.percentile(l[(arr[..., 3] > 128) if alfa else slice(None)], 92) or 1
        l = np.clip(l / m, 0, 1.15) * 235
        arr[..., 0] = arr[..., 1] = arr[..., 2] = l
        im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), im.mode)
    if im.size[0] > lado:
        im = im.resize((lado, lado), Image.LANCZOS)
    im.save(f'{SAL}/tex/{nombre}.webp', 'WEBP', quality=q, method=6)
    return f'tex/{nombre}.webp'

def luminancia(ruta, alfa=False):
    im = Image.open(ruta)
    a = np.asarray(im.convert('RGBA'), np.float32) / 255
    l = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    l = l[a[..., 3] > 0.5] if alfa else l[l > 0.03]
    return round(float(np.median(l)), 3)

# ---------------- Recursos ligados (proxies) ----------------
def comps(n, caras):
    p = list(range(n))
    def r(a):
        while p[a] != a:
            p[a] = p[p[a]]; a = p[a]
        return a
    for _, c in caras:
        a = r(c[0][0])
        for v_, _ in c[1:]:
            b = r(v_)
            if a != b: p[b] = a
    return np.array([r(i) for i in range(n)])

def rangos(lst):
    lst = sorted(set(int(x) for x in lst)); out = []
    for x in lst:
        if out and x == out[-1][1] + 1: out[-1][1] = x
        else: out.append([x, x])
    return out

def proxy(mhclo, id_, filtro=None, borrar=None):
    m = leer_mhclo(mhclo)
    v, vt, caras = leer_obj(m['obj_file'])
    if filtro is not None:
        caras = [c for c in caras if filtro[c[1][0][0]]]
    pares, ind = desoldar(triangular(caras))
    pv, pt = pares[:, 0], pares[:, 1]
    ref, w, offs = m['ref'][pv], m['w'][pv], m['off'][pv] * DM
    pos = (V[ref] * DM * w[:, :, None]).sum(1)
    sc = {}
    for k in 'xyz':
        a, b, d = m['escala'][k]
        sc[k] = [a, b, d * DM]
        ax = 'xyz'.index(k)
        pos[:, ax] += offs[:, ax] * abs(V[a, ax] - V[b, ax]) * DM / (d * DM)
    # pesos: mezcla de los del cuerpo
    jj = np.zeros((len(pv), 4), np.uint16); ww = np.zeros((len(pv), 4), np.float32)
    for i in range(len(pv)):
        acc = {}
        for k in range(3):
            if w[i, k] == 0: continue
            for b, x in zip(J[ref[i, k]], W[ref[i, k]]):
                if x > 0: acc[b] = acc.get(b, 0) + x * w[i, k]
        l = sorted(((x, b) for b, x in acc.items()), reverse=True)[:4]
        s = sum(x for x, _ in l) or 1
        for k, (x, b) in enumerate(l):
            jj[i, k] = b; ww[i, k] = x / s
    g = GLB()
    g.malla(id_, {
        'POSITION': (pos.astype(np.float32), 'VEC3'),
        'TEXCOORD_0': (np.c_[vt[pt, 0], 1 - vt[pt, 1]].astype(np.float32), 'VEC2'),
        'JOINTS_0': (jj.astype(np.uint8), 'VEC4'), 'WEIGHTS_0': (pesos8(ww), 'VEC4'),
        '_IDX': (pv.astype(np.float32), 'SCALAR'),
        '_REF': (ref.astype(np.float32), 'VEC3'),
        '_RW': (w.astype(np.float32), 'VEC3'),
        '_OFF': (offs.astype(np.float32), 'VEC3'),
    }, ind)
    g.guardar(f'{SAL}/{id_}.glb')
    out = {'glb': f'{id_}.glb', 'escala': sc, 'z': int(m.get('z_depth', 50))}
    dl = m['delete'] if borrar is None else borrar
    if len(dl): out['ocultar'] = rangos(dl)
    mat = leer_mhmat(m['material']) if 'material' in m else {}
    print('  ', id_, len(pv), 'vértices')
    return out, m, mat, v

cat = {'version': 1, 'huesos': lista_huesos, 'articulaciones': articulaciones, 'morfos': morfos,
       'nVertices': NV, 'recursos': {}}
R = cat['recursos']
Z = ZIP

# Ojos
o, m, mat, _ = proxy(f'{Z}/eyes/high-poly/high-poly.mhclo', 'ojos')
o['tipo'] = 'ojos'; R['ojos'] = o
cat['colorOjos'] = {}
for f in sorted(glob.glob(f'{Z}/eyes/materials/*_eye.png')):
    n = os.path.basename(f)[:-8]
    cat['colorOjos'][n] = tex(f, f'ojo-{n}', 512, alfa=True)

# Cejas y pestañas
for n in ['eyebrow001', 'eyebrow002', 'eyebrow006', 'eyebrow009', 'eyebrow010', 'eyebrow012']:
    o, m, mat, _ = proxy(f'{Z}/eyebrows/{n}/{n}.mhclo', f'cejas-{n[-3:]}')
    o.update(tipo='cejas', tex=tex(mat['diffuseTexture'], f'cejas-{n[-3:]}', 512, alfa=True, gris=True))
    o['lum'] = luminancia(f"{SAL}/{o['tex']}", alfa=True)
    R[f'cejas-{n[-3:]}'] = o
for n in ['eyelashes01', 'eyelashes02']:
    o, m, mat, _ = proxy(f'{Z}/eyelashes/{n}/{n}.mhclo', f'pestanas-{n[-2:]}')
    o.update(tipo='pestanas', tex=tex(mat['diffuseTexture'], f'pestanas-{n[-2:]}', 512, alfa=True))
    R[f'pestanas-{n[-2:]}'] = o

# Pelo
for n in sorted(os.listdir(f'{Z}/hair')):
    o, m, mat, _ = proxy(f'{Z}/hair/{n}/{n}.mhclo', f'pelo-{n}')
    o.update(tipo='pelo', tex=tex(mat['diffuseTexture'], f'pelo-{n}', 1024, alfa=True, gris=True))
    o['lum'] = luminancia(f"{SAL}/{o['tex']}", alfa=True)
    if mat.get('normalmapTexture') and os.path.exists(mat['normalmapTexture']):
        o['normal'] = tex(mat['normalmapTexture'], f'pelo-{n}-n', 1024)
    R[f'pelo-{n}'] = o

# Ropa: los conjuntos se separan en parte de arriba y de abajo
for f in sorted(glob.glob(f'{Z}/clothes/*/*.mhclo')):
    n = os.path.basename(f)[:-6]
    m = leer_mhclo(f); v, vt, caras = leer_obj(m['obj_file'])
    mat = leer_mhmat(m['material'])
    t = tex(mat['diffuseTexture'], f'ropa-{n}', 1024, alfa=False, ao=mat.get('aomapTexture'), sin_logo=n)
    lum = luminancia(f'{SAL}/{t}')
    nrm = tex(mat['normalmapTexture'], f'ropa-{n}-n', 1024) if mat.get('normalmapTexture') and os.path.exists(mat['normalmapTexture']) else None
    pos = (V[m['ref']] * m['w'][:, :, None]).sum(1)
    if n.startswith('shoes'):
        # sin calcetines: solo la zapatilla
        c = comps(len(v), caras)
        zap = np.array([pos[c == u, 1].max() < -6.8 for u in c])
        dl = np.array(m['delete'], np.int64)
        dz = cKDTree(pos[zap]).query(V[dl])[0]; dc = cKDTree(pos[~zap]).query(V[dl])[0]
        o, *_ = proxy(f, n, filtro=zap, borrar=dl[dz <= dc])
        o.update(tipo='calzado', tex=t, lum=lum)
        if nrm: o['normal'] = nrm
        R[n] = o; continue
    if n.startswith('fedora'):
        o, *_ = proxy(f, n)
        o.update(tipo='calzado' if n.startswith('shoes') else 'sombrero', tex=t, lum=lum)
        if nrm: o['normal'] = nrm
        R[n] = o; continue
    c = comps(len(v), caras)
    parte = {}
    for u in np.unique(c):
        y = pos[c == u, 1]
        if y.min() < -3: parte[u] = 'abajo'
        elif y.max() > 3: parte[u] = 'arriba'
        else: parte[u] = 'abajo' if y.max() < 2 else 'arriba'
    tipos = set(parte.values())
    if len(tipos) == 1 or n == 'male_worksuit01':
        o, *_ = proxy(f, n); o.update(tipo='conjunto', tex=t, lum=lum)
        if nrm: o['normal'] = nrm
        R[n] = o; continue
    # ocultar del cuerpo: cada vértice borrado va a la parte más cercana
    dl = np.array(m['delete'], np.int64)
    es_arriba = np.array([parte[u] == 'arriba' for u in c])
    pa, pb = pos[es_arriba], pos[~es_arriba]
    da = cKDTree(pa).query(V[dl])[0]
    db = cKDTree(pb).query(V[dl])[0]
    for nombre, filtro, borrar in (('arriba', es_arriba, dl[da <= db]), ('abajo', ~es_arriba, dl[da > db])):
        id_ = f'{n}-{nombre}'
        o, *_ = proxy(f, id_, filtro=filtro, borrar=borrar)
        o.update(tipo=nombre, tex=t, lum=lum)
        if nrm: o['normal'] = nrm
        R[id_] = o

# Pieles (joven; claro, medio y oscuro por género)
cat['pieles'] = {}
for n in ['young_caucasian_female', 'young_caucasian_male', 'young_asian_female', 'young_asian_male',
          'young_african_female', 'young_african_male']:
    mat = leer_mhmat(glob.glob(f'{Z}/skins/{n}/*.mhmat')[0])
    cat['pieles'][n] = tex(mat['diffuseTexture'], f'piel-{n}', 2048, q=84)

json.dump(cat, open(f'{SAL}/catalogo.json', 'w'), separators=(',', ':'))
print('ok', len(R), 'recursos')
