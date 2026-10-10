# Cabeza de perfil rellena con una huella dactilar (publicación de Personal)
import sys, os, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *
from PIL import Image
V, VT, CARAS = leer_obj(f'{MH}/3dobjs/base.obj')
W, H = 1440, 1200
mask = np.zeros((H, W), np.uint8)
# perfil: z (adelante) en horizontal, y en vertical; solo cabeza y cuello
z0, y0, esc = 0.15, 7.1, 345
for g, c in CARAS:
    if g != 'body': continue
    vs = [v for v, _ in c]
    if min(V[vs, 1]) < 5.75: continue
    pts = np.array([[W * 0.42 + (V[v, 2] - z0) * esc, H * 0.5 - (V[v, 1] - y0) * esc] for v in vs], np.int32)
    cv2.fillPoly(mask, [pts], 255)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
# base del cuello recta y algo inclinada
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
mask[yy > H * 0.5 + (y0 - 5.95) * esc - (xx - W * 0.42) * 0.08] = 0
mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
rng = np.random.default_rng(3)
def ruido(s):
    n = rng.random((H // s + 2, W // s + 2)).astype(np.float32)
    return cv2.resize(n, (W, H), interpolation=cv2.INTER_CUBIC)
# campo de la huella: espiral alrededor de un núcleo, deformado suavemente
cx, cy = W * 0.44, H * 0.42
dx, dy = (xx - cx) / 1.0, (yy - cy) / 1.25
d = np.sqrt(dx * dx + dy * dy)
ang = np.arctan2(dy, dx)
campo = d + 9 * np.sin(ang * 2 + d / 140) + 14 * (ruido(80) - 0.5) + 2.5 * (ruido(24) - 0.5)
periodo = 14
cresta = 0.5 + 0.5 * np.cos(2 * np.pi * campo / periodo)
linea = np.clip((cresta - 0.42) / 0.16, 0, 1)
# cortes e islas como en una huella real
cortes = (ruido(7) > 0.88).astype(np.float32)
linea *= 1 - cortes * 0.9
tinta = linea * (mask / 255.0)
# grano de tinta y papel
tinta *= np.clip(0.75 + 0.5 * ruido(2), 0, 1)
fondo = np.full((H, W, 3), (236, 236, 233), np.float32)
motas = (rng.random((H, W)) > 0.998).astype(np.float32)
motas = cv2.GaussianBlur(motas, (0, 0), 0.8) * 3
color = np.array([42, 46, 54], np.float32)
a = np.clip(tinta * 0.95 + motas * 0.5, 0, 1)[..., None]
img = fondo * (1 - a) + color * a
Image.fromarray(img.clip(0, 255).astype(np.uint8)).resize((720, 600), Image.LANCZOS).save('/home/claude/sporttracker/media/posts/personal.webp', 'WEBP', quality=88)
print('ok')
