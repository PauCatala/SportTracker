# Rellena el fondo de las texturas de ropa con el color de los bordes (evita líneas en las costuras)
import sys, os, glob, json, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *
from PIL import Image
SAL = '/home/claude/sporttracker/media/avatar'
for f in sorted(glob.glob(f'{ZIP}/clothes/*/*.mhclo')):
    n = os.path.basename(f)[:-6]
    ruta = f'{SAL}/tex/ropa-{n}.webp'
    if not os.path.exists(ruta): continue
    m = leer_mhclo(f); v, vt, caras = leer_obj(m['obj_file'])
    im = np.asarray(Image.open(ruta).convert('RGB')).copy()
    L = im.shape[0]
    mask = np.zeros((L, L), np.uint8)
    for _, c in caras:
        pts = np.array([[vt[t, 0] * L, (1 - vt[t, 1]) * L] for _, t in c], np.int32)
        cv2.fillPoly(mask, [pts], 255)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    # empuja-tira: se rellena de fuera hacia dentro con versiones reducidas
    img = im.astype(np.float32); w = (mask > 0).astype(np.float32)
    pir = []
    a, b = img * w[..., None], w
    while a.shape[0] > 4:
        pir.append((a, b))
        a = cv2.resize(a, (a.shape[1] // 2, a.shape[0] // 2), interpolation=cv2.INTER_AREA)
        b = cv2.resize(b, (b.shape[1] // 2, b.shape[0] // 2), interpolation=cv2.INTER_AREA)
    rel = a / np.maximum(b[..., None], 1e-6)
    for a, b in reversed(pir):
        up = cv2.resize(rel, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_LINEAR)
        rel = np.where(b[..., None] > 0.999, a / np.maximum(b[..., None], 1e-6), a + up * (1 - b[..., None]))
    out = np.where(mask[..., None] > 0, img, rel)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(ruta, 'WEBP', quality=86, method=6)
    print(n)
