"""Construye el wordmark «lumen» con trazos geométricos y uniones líquidas (estilo metaball) y lo exporta a SVG.
Uso: python3 wordmark.py salida.svg [variante]
Unidades: altura de x = 100, línea base en y = 0 (hacia arriba). El SVG final se voltea.
"""
import sys, math
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

S = 18.0          # grosor del trazo
H = 100.0         # altura de x
A = 150.0         # altura de la l
G = 21.0          # espacio entre letras (borde a borde)
OV = 2.0          # compensación óptica de curvas
RES = 64

def trazo(puntos, ancho=S, cap='flat'):
    return LineString(puntos).buffer(ancho / 2, cap_style=cap, join_style='round', quad_segs=RES)

def arco(cx, cy, r, a0, a1, n=120):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def puente(p0, p1, ancho=S, cintura=0.4, comba=0.0, n=80):
    """Cuello líquido de p0 a p1: grosor completo en los extremos y más fino en el centro (como una gota que se estira)."""
    circ = []
    for i in range(n + 1):
        t = i / n
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t + comba * math.sin(math.pi * t)
        rr = ancho / 2 * (1 - cintura * math.sin(math.pi * t) ** 1.5)
        circ.append(Point(x, y).buffer(rr, quad_segs=24))
    return unary_union(circ)

def cierre_local(forma, zona, k):
    """Unión líquida: cierre morfológico solo dentro de 'zona'."""
    trozo = forma.intersection(zona)
    cerrado = trozo.buffer(k, quad_segs=RES).buffer(-k, quad_segs=RES)
    return unary_union([forma, cerrado.intersection(zona)])

def construir(var='j', S=21.0, G=19.0):
    """Variantes: g = m y e unidas en la base; h = u y m comparten trazo + m-e en la base;
    i = u-m unidas en la base + e-n unidas arriba."""
    piezas, x = [], 0.0
    xl = x + S / 2
    piezas.append(trazo([(xl, 0), (xl, A)], S))
    x = xl + S / 2 + G
    # u
    wu = 62.0
    x0 = x + S / 2; r = wu / 2; cy = r + S / 2 - OV
    xu_der = x0 + wu
    if var == 'h':
        xc = xu_der
        piezas.append(trazo([(x0, H)] + arco(x0 + r, cy, r, 180, 360) + [(xc, H)], S))
    else:
        piezas.append(trazo([(x0, H)] + arco(x0 + r, cy, r, 180, 360) + [(xu_der, H)], S))
        piezas.append(trazo([(xu_der, cy), (xu_der, 0)], S))
        xc = xu_der + S + G
    # m
    ra = 26.0
    cya = H - S / 2 - ra + OV
    piezas.append(trazo([(xc, 0), (xc, H)], S))
    piezas.append(trazo(arco(xc + ra, cya, ra, 180, 0) + [(xc + 2 * ra, 0)], S))
    piezas.append(trazo([(xc + 2 * ra, cya)] + arco(xc + 3 * ra, cya, ra, 180, 0) + [(xc + 4 * ra, 0)], S))
    xm_der = xc + 4 * ra
    x = xm_der + S / 2 + G
    # e
    re = (H - S) / 2 + OV
    ce = (x + S / 2 + re, H / 2)
    piezas.append(trazo([(ce[0] - re, H / 2), (ce[0] + re, H / 2)], S))
    piezas.append(trazo(arco(ce[0], ce[1], re, 0, 322, 200), S))
    xe_der = ce[0] + re
    x = xe_der + S / 2 + G - 3
    # n
    rn = 29.0
    n0 = x + S / 2
    cyn = H - S / 2 - rn + OV
    piezas.append(trazo([(n0, 0), (n0, H)], S))
    piezas.append(trazo(arco(n0 + rn, cyn, rn, 180, 0) + [(n0 + 2 * rn, 0)], S))
    forma = unary_union(piezas)
    k = 9 if S < 26 else 12
    if var == 'z':
        # Peso alto y dos uniones líquidas: u → m en la base y el pie de la m fluyendo hasta la e
        forma = forma.union(puente((xu_der, S * 0.5), (xc, S * 0.5), S * 1.0, 0.38, -5))
        forma = cierre_local(forma, box(xu_der - S / 2 - 1, -12, xc + S / 2 + 1, 40), 14)
        ang = math.radians(222); ex, ey = ce[0] + re * math.cos(ang), ce[1] + re * math.sin(ang)
        forma = forma.union(puente((xm_der, S * 0.5), (ex, ey), S * 1.0, 0.4, -6))
        forma = cierre_local(forma, box(xm_der - S / 2 - 1, -14, ex + S, ey + S), 14)
    if var in ('g', 'h', 'j'):
        # pie de la m → cuenco inferior de la e
        ang = math.radians(215); ex, ey = ce[0] + re * math.cos(ang), ce[1] + re * math.sin(ang)
        forma = forma.union(puente((xm_der, S / 2), (ex, ey), S, 0.42, -3))
        forma = cierre_local(forma, box(xm_der - S / 2 - 1, -3, ex + S, ey + S), k)
    if var in ('i', 'k'):
        forma = forma.union(puente((xu_der, S / 2), (xc, S / 2), S, 0.45, -4))
        forma = cierre_local(forma, box(xu_der - S / 2 - 1, -6, xc + S / 2 + 1, 34), k)
    if var in ('i', 'l'):
        ang = math.radians(28); ex, ey = ce[0] + re * math.cos(ang), ce[1] + re * math.sin(ang)
        forma = forma.union(puente((ex, ey), (n0, H - S / 2), S, 0.45, 3))
        forma = cierre_local(forma, box(ex - S, H - 40, n0 + S / 2 + 1, H + 6), k)
    return forma

def construir_ref(S=24.0, G=7.0, A_=146.0, corte=3.4):
    """«lumen» pesado: la u y la m comparten trazo con la tinta acumulada en la base,
    y la e se monta sobre la última pata de la m separada por un hilo blanco curvo."""
    from shapely.geometry import Polygon
    piezas, x = [], 0.0
    xl = x + S / 2
    piezas.append(trazo([(xl, 0), (xl, A_)], S))
    x = xl + S / 2 + G
    # u (cuenco) + trazo compartido con la m
    wu = 58.0
    x0 = x + S / 2; r = wu / 2; cy = r + S / 2 - OV
    xc = x0 + wu
    piezas.append(trazo([(x0, H)] + arco(x0 + r, cy, r, 180, 360) + [(xc, H)], S))
    piezas.append(trazo([(xc, 0), (xc, H)], S))
    # m: dos arcos
    ra = 25.0
    cya = H - S / 2 - ra + OV
    piezas.append(trazo(arco(xc + ra, cya, ra, 180, 0) + [(xc + 2 * ra, 0)], S))
    piezas.append(trazo([(xc + 2 * ra, cya)] + arco(xc + 3 * ra, cya, ra, 180, 0) + [(xc + 4 * ra, 0)], S))
    xm = xc + 4 * ra
    base = unary_union(piezas)
    # Tinta acumulada en la base entre el cuenco de la u y el trazo compartido
    base = cierre_local(base, box(x0, -2, xc + S / 2 + 0.5, 34), 16)
    # e: se monta sobre la última pata de la m
    re = (H - S) / 2 + OV
    ce = (xm + S * 0.35 + re, H / 2)
    e = unary_union([trazo([(ce[0] - re, H / 2), (ce[0] + re, H / 2)], S), trazo(arco(ce[0], ce[1], re, 0, 318, 220), S)])
    # Hilo blanco: la silueta exterior de la e, solo donde toca la m
    exterior = Point(ce).buffer(re + S / 2 + corte, quad_segs=96).difference(Point(ce).buffer(re + S / 2, quad_segs=96))
    hilo = exterior.intersection(box(xm - S, -10, ce[0] - re * 0.15, H + 10))
    forma = unary_union([base.difference(hilo), e])
    x = ce[0] + re + S / 2 + G
    # n
    rn = 27.0
    n0 = x + S / 2
    cyn = H - S / 2 - rn + OV
    forma = unary_union([forma, trazo([(n0, 0), (n0, H)], S), trazo(arco(n0 + rn, cyn, rn, 180, 0) + [(n0 + 2 * rn, 0)], S)])
    return forma

def a_svg(forma, ruta, color='#1E2533'):
    minx, miny, maxx, maxy = forma.bounds
    pad = 4
    ancho, alto = maxx - minx + 2 * pad, maxy - miny + 2 * pad
    def anillo(c):
        pts = [(px - minx + pad, maxy - py + pad) for px, py in c.coords]
        return 'M' + ' L'.join(f'{px:.2f} {py:.2f}' for px, py in pts) + 'Z'
    geoms = forma.geoms if forma.geom_type == 'MultiPolygon' else [forma]
    d = ''.join(anillo(g.exterior) + ''.join(anillo(i) for i in g.interiors) for g in geoms)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho:.1f} {alto:.1f}" role="img" aria-label="Lumen"><path fill="{color}" fill-rule="evenodd" d="{d}"/></svg>'
    open(ruta, 'w').write(svg)
    return ancho, alto, len(svg)

if __name__ == '__main__':
    var = sys.argv[2] if len(sys.argv) > 2 else 'g'
    f = construir(var).simplify(0.08)
    print(a_svg(f, sys.argv[1]))
