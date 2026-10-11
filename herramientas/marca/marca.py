"""Genera los archivos de marca de Lumen en icons/: wordmark, isotipo y la combinación de ambos."""
import os
from shapely import affinity
from shapely.ops import unary_union
import wordmark, isotipo

TINTA = '#222B3D'
DEST = os.path.join(os.path.dirname(__file__), '..', '..', 'icons')

w = wordmark.construir('j').simplify(0.06)
i = isotipo.construir('b').simplify(0.06)
print('wordmark', wordmark.a_svg(w, os.path.join(DEST, 'lumen-wordmark.svg'), TINTA))
print('isotipo', wordmark.a_svg(i, os.path.join(DEST, 'lumen-isotipo.svg'), TINTA))
# Combinación: la bombilla mide lo mismo que la l (ascendente) y se apoya en la línea base
_, iy0, _, iy1 = i.bounds
esc = (wordmark.A + 6) / (iy1 - iy0)
i2 = affinity.scale(i, esc, esc, origin=(0, iy0))
i2 = affinity.translate(i2, 0, -iy0 - 3)
ix0, _, ix1, _ = i2.bounds
w2 = affinity.translate(w, ix1 + 30 - w.bounds[0], 0)
print('marca', wordmark.a_svg(unary_union([i2, w2]), os.path.join(DEST, 'lumen-marca.svg'), TINTA))
