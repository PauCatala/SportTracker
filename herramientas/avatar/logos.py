# Quita el logotipo de MakeHuman de las camisetas (inpainting dentro de zonas marcadas)
import cv2, numpy as np
LOGOS = {
  'male_casualsuit06': [(330, 170, 690, 340), (900, 230, 1420, 560), (1480, 290, 1580, 380)],
  'male_casualsuit04': [(980, 140, 1340, 540)],
  'male_casualsuit02': [(980, 140, 1340, 540)],
  'female_casualsuit01': [(1420, 300, 1810, 700)],
  'female_casualsuit02': [(1420, 300, 1810, 700)],
}
def limpiar(nombre, img):
    """img: array RGB uint8 (2048). Devuelve la imagen sin logo."""
    if nombre not in LOGOS: return img
    out = img.copy()
    mask = np.zeros(img.shape[:2], np.uint8)
    for x0, y0, x1, y1 in LOGOS[nombre]:
        zona = img[y0:y1, x0:x1].astype(np.float32)
        ref = np.median(zona.reshape(-1, 3), 0)
        d = np.abs(zona - ref).sum(2)
        m = (d > 38).astype(np.uint8) * 255
        m = cv2.dilate(m, np.ones((9, 9), np.uint8))
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], m)
    bgr = cv2.cvtColor(out, cv2.COLOR_RGB2BGR)
    res = cv2.inpaint(bgr, mask, 9, cv2.INPAINT_TELEA)
    # recupera el grano de la tela con ruido suave
    ruido = np.random.default_rng(1).normal(0, 3.5, res.shape).astype(np.float32)
    res = np.where(mask[..., None] > 0, np.clip(res.astype(np.float32) + ruido, 0, 255), res).astype(np.uint8)
    return cv2.cvtColor(res, cv2.COLOR_BGR2RGB)
if __name__ == '__main__':
    from PIL import Image
    tiles = []
    for n in LOGOS:
        a = np.asarray(Image.open(f'zip/clothes/{n}/{n}_diffuse.png').convert('RGB'))
        b = limpiar(n, a)
        tiles.append(Image.fromarray(b[0:800, 200:1900]).resize((425, 200)))
    s = Image.new('RGB', (425, 200 * len(tiles)))
    for i, t in enumerate(tiles): s.paste(t, (0, 200 * i))
    s.save('logos_check.png')
