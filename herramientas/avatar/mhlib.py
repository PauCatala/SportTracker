# Lectura de los formatos de MakeHuman (CC0) y escritura de GLB mínimos.
import json, struct, os, re
import numpy as np

MH = '/home/claude/makehumancommunity/makehuman/makehuman/data'
ZIP = os.environ.get('MH_ZIP', os.path.join(os.path.dirname(__file__), 'zip'))
DM = 0.1  # MakeHuman trabaja en decímetros; la web en metros


def leer_obj(ruta, grupos=None):
    """Devuelve v (N,3), vt (M,2) y caras [(grupo, [(vi, ti), ...])]."""
    v, vt, caras = [], [], []
    grupo = None
    with open(ruta) as f:
        for l in f:
            if l.startswith('v '):
                v.append([float(x) for x in l.split()[1:4]])
            elif l.startswith('vt '):
                vt.append([float(x) for x in l.split()[1:3]])
            elif l.startswith('g '):
                grupo = l.split()[1]
            elif l.startswith('f '):
                if grupos is not None and grupo not in grupos:
                    continue
                c = []
                for p in l.split()[1:]:
                    s = p.split('/')
                    c.append((int(s[0]) - 1, int(s[1]) - 1 if len(s) > 1 and s[1] else -1))
                caras.append((grupo, c))
    return np.array(v, np.float64), np.array(vt, np.float64), caras


def leer_target(ruta):
    idx, d = [], []
    with open(ruta) as f:
        for l in f:
            if not l.strip() or l[0] == '#':
                continue
            s = l.split()
            idx.append(int(s[0])); d.append([float(s[1]), float(s[2]), float(s[3])])
    return np.array(idx, np.int64), np.array(d, np.float64)


def target_denso(ruta, n):
    out = np.zeros((n, 3))
    i, d = leer_target(ruta)
    if len(i): out[i] = d
    return out


def leer_mhclo(ruta):
    info = {'ref': [], 'w': [], 'off': [], 'delete': [], 'escala': {}}
    modo = None
    base = os.path.dirname(ruta)
    with open(ruta) as f:
        for l in f:
            l = l.strip()
            if not l or l.startswith('#'):
                continue
            s = l.split()
            if modo == 'verts' and re.match(r'^[0-9]', l):
                if len(s) == 1:
                    info['ref'].append([int(s[0])] * 3); info['w'].append([1, 0, 0]); info['off'].append([0, 0, 0])
                else:
                    info['ref'].append([int(x) for x in s[:3]])
                    info['w'].append([float(x) for x in s[3:6]])
                    info['off'].append([float(x) for x in s[6:9]])
                continue
            if modo == 'delete' and re.match(r'^[0-9]', l):
                toks = l.replace(' - ', '-').split()
                for t in toks:
                    if '-' in t:
                        a, b = t.split('-'); info['delete'].extend(range(int(a), int(b) + 1))
                    else:
                        info['delete'].append(int(t))
                continue
            k = s[0]
            if k == 'verts':
                modo = 'verts'
            elif k == 'delete_verts':
                modo = 'delete'
            elif k in ('x_scale', 'y_scale', 'z_scale'):
                info['escala'][k[0]] = (int(s[1]), int(s[2]), float(s[3]))
            elif k in ('obj_file', 'material', 'name', 'z_depth'):
                info[k] = os.path.normpath(os.path.join(base, s[1])) if k in ('obj_file', 'material') else s[1]
    for k in ('ref', 'w', 'off'):
        info[k] = np.array(info[k])
    return info


def leer_mhmat(ruta):
    out = {}
    base = os.path.dirname(ruta)
    with open(ruta) as f:
        for l in f:
            l = l.strip()
            if not l or l.startswith('#') or l.startswith('//'):
                continue
            s = l.split(None, 1)
            if len(s) < 2:
                continue
            k, val = s
            if k.endswith('Texture'):
                out[k] = os.path.normpath(os.path.join(base, val))
            else:
                out[k] = val
    return out


def triangular(caras):
    tris = []
    for _, c in caras:
        for i in range(1, len(c) - 1):
            tris.append((c[0], c[i], c[i + 1]))
    return tris


def desoldar(tris):
    """Convierte caras con pares (v, vt) en vértices únicos. Devuelve (pares, indices)."""
    mapa, pares, ind = {}, [], []
    for t in tris:
        for p in t:
            k = mapa.get(p)
            if k is None:
                k = mapa[p] = len(pares); pares.append(p)
            ind.append(k)
    return np.array(pares, np.int64), np.array(ind, np.uint32)


# ---------- GLB ----------
class GLB:
    def __init__(self):
        self.bin = bytearray(); self.views = []; self.acc = []; self.meshes = []; self.nodes = []

    def _vista(self, datos, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin); b = datos.tobytes(); self.bin += b
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(b)}
        if target:
            v['target'] = target
        self.views.append(v)
        return len(self.views) - 1

    def accesor(self, arr, tipo, target=34962, normalizado=False, minmax=False):
        ct = {np.dtype('float32'): 5126, np.dtype('uint16'): 5123, np.dtype('uint32'): 5125,
              np.dtype('uint8'): 5121, np.dtype('int16'): 5122}[arr.dtype]
        a = {'bufferView': self._vista(np.ascontiguousarray(arr), target), 'componentType': ct,
             'count': int(arr.shape[0]), 'type': tipo}
        if normalizado:
            a['normalized'] = True
        if minmax:
            a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
        self.acc.append(a)
        return len(self.acc) - 1

    def malla(self, nombre, attrs, indices):
        prim = {'attributes': {}, 'mode': 4}
        for k, (arr, tipo) in attrs.items():
            prim['attributes'][k] = self.accesor(arr, tipo, minmax=(k == 'POSITION'), normalizado=(k == 'WEIGHTS_0' and arr.dtype == np.uint8))
        ind = indices.astype(np.uint16 if indices.max() < 65535 else np.uint32)
        prim['indices'] = self.accesor(ind, 'SCALAR', target=34963)
        self.meshes.append({'name': nombre, 'primitives': [prim]})
        self.nodes.append({'name': nombre, 'mesh': len(self.meshes) - 1})

    def guardar(self, ruta):
        while len(self.bin) % 4:
            self.bin.append(0)
        j = {'asset': {'version': '2.0', 'generator': 'lumen-mh'}, 'scene': 0,
             'scenes': [{'nodes': list(range(len(self.nodes)))}], 'nodes': self.nodes, 'meshes': self.meshes,
             'accessors': self.acc, 'bufferViews': self.views, 'buffers': [{'byteLength': len(self.bin)}]}
        js = json.dumps(j, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(ruta, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942)); f.write(bytes(self.bin))
