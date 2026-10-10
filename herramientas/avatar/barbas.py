# Máscaras de barba y bigote en el espacio UV de la piel (generadas desde la geometría)
import sys, os, json, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *
from PIL import Image
SAL = '/home/claude/sporttracker/media/avatar'
V, VT, CARAS = leer_obj(f'{MH}/3dobjs/base.obj')
x, y, z = np.abs(V[:, 0]), V[:, 1], V[:, 2]
def ss(a, b, t):  # smoothstep
    k = np.clip((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k)
cabeza = (y > 5.7) & (y < 7.5) & (x < 0.95)
# mejilla: borde superior que baja de la patilla al labio
yup = 6.8 + 0.24 * np.clip(x / 0.6, 0, 1) ** 1.2
sup = 1 - ss(yup - 0.05, yup + 0.05, y)
# patillas: franja delante de la oreja hasta el pelo
patilla = ss(0.5, 0.56, x) * (1 - ss(0.7, 0.76, x)) * (1 - ss(7.15, 7.25, y)) * ss(0.42, 0.5, z) * (1 - ss(0.95, 1.05, z))
sup = np.maximum(sup, patilla)
# atrás: delante de la oreja arriba, hasta el cuello debajo
zback = np.where(y > 6.6, 0.55, 0.25)
atras = ss(zback - 0.08, zback + 0.08, z)
# abajo: bajo la mandíbula hasta la mitad del cuello
ylow = 5.98 + 0.35 * np.clip((1.0 - z) / 0.8, 0, 1)
inf = ss(ylow - 0.06, ylow + 0.08, y)
labios = np.exp(-(((x) / 0.25) ** 2 + ((y - 6.665) / 0.12) ** 2 * 1.0)) * ss(1.25, 1.4, z)
completa = np.clip(sup * atras * inf * (1 - ss(0.35, 0.75, labios)), 0, 1) * cabeza
ytop = 6.9 - 0.09 * np.clip(x / 0.3, 0, 1) ** 2
ybot = 6.77 - 0.06 * np.clip((x - 0.15) / 0.15, 0, 1)
bigote = (1 - ss(0.27, 0.33, x)) * ss(ybot - 0.01, ybot + 0.02, y) * (1 - ss(ytop - 0.03, ytop + 0.01, y)) * ss(1.25, 1.35, z) * cabeza
perilla = (1 - ss(0.17, 0.27, x)) * ss(6.0, 6.08, y) * (1 - ss(6.5, 6.56, y)) * ss(0.95, 1.1, z) * cabeza
perilla = np.maximum(perilla, (1 - ss(0.05, 0.09, x)) * ss(6.45, 6.5, y) * (1 - ss(6.56, 6.6, y)) * ss(1.3, 1.4, z))
esquinas = (1 - ss(0.3, 0.36, x)) * ss(0.2, 0.24, x) * ss(6.4, 6.45, y) * (1 - ss(6.8, 6.85, y)) * ss(1.1, 1.25, z) * cabeza
candado = np.clip(np.maximum.reduce([bigote, perilla, esquinas * 0.9]), 0, 1)
ESTILOS = {
    'sombra': (completa, 0.5, 'sombra'), 'corta': (np.maximum(completa, bigote), 0.85, 'corta'),
    'completa': (np.maximum(completa, bigote), 0.97, 'densa'), 'bigote': (bigote, 0.95, 'densa'),
    'perilla': (perilla, 0.95, 'densa'), 'candado': (candado, 0.95, 'densa'),
}
L = 1024
tris = triangular([c for c in CARAS if c[0] == 'body'])
out = {}
for nombre, (val, alfa, dens) in ESTILOS.items():
    m = np.zeros((L, L), np.float32)
    for t in tris:
        vs = [p[0] for p in t]
        a = val[vs].mean()
        if a < 0.01: continue
        pts = np.array([[VT[p[1], 0] * L, (1 - VT[p[1], 1]) * L] for p in t], np.int32)
        cv2.fillConvexPoly(m, pts, float(a), lineType=cv2.LINE_AA)
    m = cv2.GaussianBlur(m, (0, 0), 2.5)
    a8 = np.clip(m * 255, 0, 255).astype(np.uint8)
    Image.fromarray(a8).resize((512, 512), Image.LANCZOS).save(f'{SAL}/tex/barba-{nombre}.png', optimize=True)
    out[nombre] = {'mascara': f'tex/barba-{nombre}.png', 'alfa': alfa, 'tipo': dens}
    print(nombre, int((a8 > 10).sum()))
cat = json.load(open(f'{SAL}/catalogo.json')); cat['barbas'] = out
json.dump(cat, open(f'{SAL}/catalogo.json', 'w'), separators=(',', ':'))
