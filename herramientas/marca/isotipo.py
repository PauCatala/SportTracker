"""Isotipo de Lumen: una bombilla de un solo trazo con el mismo grosor que el wordmark y un cuello líquido.
Uso: python3 isotipo.py salida.svg [variante]"""
import sys, math
from shapely.geometry import Point, box
from shapely.ops import unary_union
from wordmark import trazo, arco, puente, cierre_local, a_svg

def construir(var='b', S=19.0):
    R = 60.0
    cx, cy = 0.0, 128.0
    a0, a1 = -58, 238
    piezas = [trazo(arco(cx, cy, R, a0, a1, 240), S)]
    ix = R * math.cos(math.radians(a0)); iy = cy + R * math.sin(math.radians(a0))
    yb = 50.0                                   # altura del casquillo (línea media de la barra superior)
    nx = 17.0                                   # medio ancho del cuello
    piezas.append(trazo([(ix, iy), (nx, yb + S / 2)], S, 'round'))
    piezas.append(trazo([(-ix, iy), (-nx, yb + S / 2)], S, 'round'))
    piezas.append(trazo([(-nx - 4, yb), (nx + 4, yb)], S))
    piezas.append(trazo([(-nx + 4, yb - S - 6), (nx - 4, yb - S - 6)], S))
    forma = unary_union(piezas)
    forma = cierre_local(forma, box(-60, yb - 2, 60, iy + 6), 7)
    if var == 'a':
        # Filamento: una gota de luz que se desprende del casquillo
        forma = forma.union(Point(0, cy - 4).buffer(S * 0.78, quad_segs=40))
    if var == 'b':
        forma = forma.union(puente((0, yb + 4), (0, cy - 8), S * 0.85, 0.6, 0)).union(Point(0, cy - 8).buffer(S * 0.62, quad_segs=40))
        forma = cierre_local(forma, box(-26, yb - 2, 26, cy + 18), 7)
    return forma

if __name__ == '__main__':
    print(a_svg(construir(sys.argv[2] if len(sys.argv) > 2 else 'b').simplify(0.08), sys.argv[1]))
