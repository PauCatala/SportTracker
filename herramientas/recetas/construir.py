# Construye media/recetas/recetas.json: recetas originales + familias de variaciones,
# con macros calculados ingrediente a ingrediente y etiquetas derivadas de los ingredientes.
import json, re, sys, os, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingredientes import I, SUSTITUCIONES
from recetas_a import R as RA
from recetas_b import R as RB

SAL = '/home/claude/sporttracker/media/recetas'
os.makedirs(SAL, exist_ok=True)

def slug(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def ings(texto):
    out = []
    for t in texto.split():
        k, g = t.split(':')
        g = float(g)
        if g <= 0: continue
        if k not in I: raise KeyError(f'Ingrediente desconocido: {k}')
        out.append((k, g))
    return out

recetas = []
def anadir(n, tipo, minutos, dif, rac, ingr, pasos, desc, extras=''):
    recetas.append(dict(n=n, t=tipo, min=minutos, dif=dif, rac=rac, ing=ingr if isinstance(ingr, list) else ings(ingr),
                        pasos=[p.strip() for p in (pasos.split('|') if isinstance(pasos, str) else pasos)], d=desc, x=extras.split()))

for r in RA + RB:
    anadir(*r)

# ---------------- Familias: combinaciones pensadas (no simples renombres) ----------------
BASES = [('arroz_int', 70, 'arroz integral', 'Cuece el arroz integral 25 minutos y escúrrelo'),
         ('quinoa', 65, 'quinoa', 'Lava la quinoa y cuécela 15 minutos'),
         ('cuscus', 70, 'cuscús', 'Hidrata el cuscús con el mismo volumen de agua hirviendo 5 minutos'),
         ('boniato', 250, 'boniato asado', 'Asa el boniato en dados a 200 °C 25 minutos'),
         ('fideos_arroz', 70, 'fideos de arroz', 'Hidrata los fideos en agua caliente 5 minutos')]
PROTES = [('pollo', 'pollo_pechuga:150 brocoli:120 zanahoria:60 yogur:60 aceite_oliva:8 especias:2', 'pollo, brócoli y salsa de yogur', 'Haz el pollo a la plancha y córtalo en tiras; cuece el brócoli al vapor 5 minutos'),
          ('tofu', 'tofu:150 edamame:60 pepino:80 aguacate:50 tamari:10 sesamo:5 aceite_oliva:5', 'tofu, edamame y aguacate', 'Dora el tofu en dados y cuece el edamame 4 minutos'),
          ('salmón', 'salmon:130 espinacas:50 mango:80 aguacate:40 lima:5 aceite_oliva:5', 'salmón, mango y aguacate', 'Haz el salmón a la plancha 3 minutos por lado y desmígalo'),
          ('garbanzos', 'garbanzos_coc:150 kale:50 tomate_cherry:100 tahini:15 limon:5 aceite_oliva:5 especias:2', 'garbanzos, kale y tahini', 'Tuesta los garbanzos con comino y masajea el kale con limón'),
          ('gambas', 'gambas:150 pimiento_rojo:80 maiz:60 aguacate:40 lima:5 aceite_oliva:8 especias:2', 'gambas, maíz y pimiento', 'Saltea las gambas con pimentón 2 minutos'),
          ('ternera', 'ternera_magra:140 brocoli:100 cebolla_morada:40 tamari:10 aceite_sesamo:8', 'ternera y brócoli', 'Saltea la ternera en tiras a fuego fuerte y el brócoli 3 minutos')]
for i, (b, gb, nb, pb) in enumerate(BASES):
    for j, (_, txt, np_, pp) in enumerate(PROTES):
        anadir(f'Bowl de {nb} con {np_}', 'comida' if (i + j) % 2 == 0 else 'cena', 25 if b != 'arroz_int' else 30, 'f', 1,
               [(b, gb)] + ings(txt), [pb, pp, 'Monta el bol con la base, la proteína y las verduras, y aliña al gusto'],
               f'Bol completo de {nb} con {np_}.', 'llevar prep')

PANES = [('pan_int', 'pan integral'), ('pan_centeno', 'pan de centeno'), ('pan_sg', 'pan sin gluten')]
TOPPINGS = [('aguacate:50 tomate:60 huevo:60 aceite_oliva:3', 'aguacate, tomate y huevo', 'desayuno', 'Escalfa o haz a la plancha el huevo'),
            ('queso_fresco:60 salmon:50 rucula:15', 'queso fresco, salmón y rúcula', 'cena', 'Corta el salmón en láminas finas'),
            ('hummus:50 pimiento_asado:60 sesamo:3', 'hummus y pimiento asado', 'snack', 'Corta el pimiento asado en tiras'),
            ('requeson:70 pera:80 nueces:10', 'requesón, pera y nueces', 'desayuno', 'Corta la pera en láminas finas'),
            ('tomate:80 sardinas_lata:60 cebolla_morada:15 aceite_oliva:3', 'tomate y sardinas', 'cena', 'Ralla el tomate y escurre las sardinas'),
            ('pavo_fiambre:50 queso_burgos:50 tomate:50', 'pavo y queso de Burgos', 'desayuno', 'Corta el queso y el tomate en rodajas')]
for pan, npan in PANES:
    for txt, nt, tipo, prep in TOPPINGS:
        anadir(f'Tosta de {npan} con {nt}', tipo, 8, 'f', 1, [(pan, 70)] + ings(txt),
               [f'Tuesta el {npan}', prep, 'Monta la tosta y sirve al momento'], f'Tosta rápida de {nt}.', 'med' if 'sardinas' in txt or 'hummus' in txt else '')

HOJAS = [('lechuga', 100, 'lechuga'), ('rucula', 60, 'rúcula'), ('espinacas', 70, 'espinacas'), ('canonigos', 60, 'canónigos')]
COMBOS = [('pollo_pechuga:130 tomate_cherry:100 maiz:50 aceite_oliva:10 vinagre:5', 'pollo, cherry y maíz', 'Haz el pollo a la plancha y córtalo'),
          ('atun_lata:100 huevo:60 aceitunas:20 tomate:100 aceite_oliva:10', 'atún, huevo y aceitunas', 'Cuece el huevo 10 minutos y pártelo'),
          ('queso_cabra:50 manzana:100 nueces:15 aceite_oliva:10 vinagre:5', 'queso de cabra, manzana y nueces', 'Corta la manzana en láminas'),
          ('lentejas_coc:150 pimiento_rojo:60 cebolla_morada:20 aceite_oliva:10 vinagre:5', 'lentejas y pimiento', 'Enjuaga las lentejas cocidas'),
          ('salmon:120 aguacate:50 pepino:80 lima:5 aceite_oliva:5', 'salmón, aguacate y pepino', 'Haz el salmón a la plancha y desmígalo')]
for h, gh, nh in HOJAS:
    for k, (txt, nc, prep) in enumerate(COMBOS):
        anadir(f'Ensalada de {nh} con {nc}', 'comida' if k % 2 == 0 else 'cena', 15, 'f', 1, [(h, gh)] + ings(txt),
               [f'Lava y escurre la {nh}' if nh in ('lechuga', 'rúcula') else f'Lava y escurre las {nh}', prep, 'Mezcla todo y aliña justo antes de comer'],
               f'Ensalada completa de {nc}.', 'med llevar')

BATIDOS = [('leche:250 platano:100 avena:30 proteina_suero:25', 'plátano, avena y proteína'),
           ('leche:250 cacao_puro:10 platano:100 crema_cacahuete:15', 'cacao, plátano y cacahuete'), ('yogur:150 mango:120 pina:80', 'mango y piña'),
           ('bebida_almendra:250 espinacas:40 manzana:120 kiwi:80', 'verde de manzana y kiwi'), ('skyr:150 arandanos:100 leche:150', 'arándanos y skyr'),
           ('leche:300 avena:40 datiles:25 especias:2', 'avena, dátil y canela'), ('bebida_soja:250 frutos_rojos:120 chia:10', 'frutos rojos y chía'),
           ('bebida_avena:250 platano:100 cacao_puro:8 almendras:15', 'chocolate y almendra'),
           ('leche_sl:300 proteina_suero:30 frutos_rojos:100 avena:40', 'proteico sin lactosa'), ('yogur_soja:150 mango:100 leche_coco:50 lima:5', 'tropical vegano')]
for txt, nb in BATIDOS:
    anadir(f'Batido de {nb}', 'batido', 4, 'f', 1, txt, ['Pon todo en la batidora con unos cubitos de hielo', 'Tritura hasta que quede cremoso'], f'Batido de {nb}.', 'llevar')

LIQ = [('leche', 'leche'), ('bebida_soja', 'bebida de soja')]
FRUTAS = [('manzana:120 especias:2 nueces:15', 'manzana, canela y nueces'), ('platano:100 cacao_puro:6 crema_cacahuete:12', 'plátano, cacao y cacahuete'),
          ('frutos_rojos:100 almendras:15', 'frutos rojos y almendras'), ('pera:120 especias:2 pipas_calabaza:10', 'pera y pipas de calabaza'),
          ('mango:100 coco_rallado:6 chia:8', 'mango y coco'), ('datiles:20 platano:60 nueces:10', 'dátil, plátano y nueces')]
for lq, nl in LIQ:
    for txt, nf in FRUTAS:
        anadir(f'Porridge de {nf} ({nl})', 'desayuno', 10, 'f', 1, [('avena', 55), (lq, 250)] + ings(txt),
               [f'Cuece la avena en la {nl} a fuego medio 5 minutos removiendo', 'Añade la fruta y los toppings'], f'Porridge cremoso de {nf}.', '')

CREMAS = [('calabacin', 'calabacín', 'queso_fresco:40'), ('brocoli', 'brócoli', 'almendras:10'), ('coliflor', 'coliflor', 'especias:2 aceite_oliva:5'),
          ('puerro', 'puerro', 'huevo:60'), ('zanahoria', 'zanahoria', 'jengibre:5 yogur:60'), ('champinones', 'champiñones', 'parmesano:10'),
          ('guisantes', 'guisantes', 'especias:1 jamon_serrano:20'), ('esparragos', 'espárragos', 'huevo:60'), ('calabaza', 'calabaza asada', 'pipas_calabaza:15')]
for v, nv, top in CREMAS:
    anadir(f'Crema de {nv}', 'cena', 30, 'f', 2, [(v, 450), ('patata', 150), ('cebolla', 80), ('aceite_oliva', 10), ('caldo_verduras', 500)] + ings(top),
           ['Sofríe la cebolla con el aceite', f'Añade el {nv} y la patata troceados y cubre con el caldo', 'Cuece 20 minutos y tritura', 'Sirve con el topping'],
           f'Crema suave de {nv}.', 'prep')

WOK = [('pollo_pechuga', 'pollo'), ('ternera_magra', 'ternera'), ('gambas', 'gambas'), ('tofu', 'tofu'), ('tempeh', 'tempeh'), ('pavo', 'pavo')]
for p, np_ in WOK:
    for base, gb, nb in [('arroz', 70, 'arroz'), ('fideos_arroz', 70, 'fideos de arroz')]:
        anadir(f'Salteado de {np_} con verduras y {nb}', 'cena', 20, 'f', 1, [(p, 140), ('verduras_wok', 200), (base, gb), ('tamari', 12), ('jengibre', 5), ('aceite_sesamo', 8)],
               [f'Cuece el {nb}' if base == 'arroz' else 'Hidrata los fideos de arroz', f'Saltea el {np_} a fuego fuerte', 'Añade las verduras y el jengibre 4 minutos', f'Incorpora el {nb} y el tamari'],
               f'Salteado rápido sin gluten de {np_}.', '')

REV = [('espinacas:100', 'espinacas'), ('champinones:120', 'champiñones'), ('calabacin:150', 'calabacín'), ('esparragos:120', 'espárragos trigueros'),
       ('gambas:100', 'gambas'), ('jamon_serrano:30 cebolla:40', 'jamón y cebolla'), ('atun_lata:60 tomate:80', 'atún y tomate'), ('pimiento_rojo:80 pimiento_verde:60', 'pimientos')]
for txt, nr in REV:
    anadir(f'Revuelto de huevo con {nr}', 'cena', 12, 'f', 1, [('huevo', 120), ('aceite_oliva', 6), ('pan_int', 40)] + ings(txt),
           [f'Saltea {nr} con el aceite', 'Añade los huevos batidos y remueve a fuego suave', 'Retira jugoso y sirve con el pan tostado'], f'Revuelto rápido de {nr}.', 'med')

PAP = [('merluza', 'merluza'), ('salmon', 'salmón'), ('bacalao', 'bacalao'), ('dorada', 'dorada'), ('lubina', 'lubina')]
VPAP = [('calabacin:120 zanahoria:80', 'calabacín y zanahoria'), ('esparragos:120 tomate_cherry:80', 'espárragos y cherry')]
for p, np_ in PAP:
    for txt, nv in VPAP:
        anadir(f'Papillote de {np_} con {nv}', 'cena', 25, 'f', 1, [(p, 170), ('aceite_oliva', 8), ('limon', 5), ('patata', 150)] + ings(txt),
               ['Corta las verduras en tiras finas', f'Coloca el {np_} sobre las verduras en papel de horno con aceite y limón y cierra', 'Hornea a 200 °C 15 minutos', 'Sirve con la patata cocida'],
               f'{np_.capitalize()} al vapor en su jugo.', 'med')

# ---------------- Cálculo y etiquetas ----------------
def etiquetas(r, tot, peso):
    marcas = set(''.join(I[k][7] for k, _ in r['ing']))
    et = []
    veg = not (marcas & set('CPM'))
    if veg: et.append('vegetariana')
    if veg and not (marcas & set('HLN')): et.append('vegana')
    if 'G' not in marcas: et.append('sin-gluten')
    if 'L' not in marcas: et.append('sin-lactosa')
    if 'A' not in marcas: et.append('sin-azucares-anadidos')
    if 'U' not in marcas: et.append('comida-real')
    if 'med' in r['x']: et.append('mediterranea')   # solo cuando la receta lo es de verdad
    k = tot['kcal'] / r['rac']; prot = tot['p'] / r['rac']
    if k and prot * 4 / k >= 0.20: et.append('alta-proteina')
    if peso and tot['g'] / peso * 100 <= 3: et.append('baja-grasa')
    if peso and tot['az'] / peso * 100 <= 5: et.append('baja-azucar')
    if tot['kcal'] and tot['f'] / tot['kcal'] * 100 >= 3: et.append('alta-fibra')
    if k <= 400: et.append('ligera')
    # objetivo
    principal = r['t'] in ('comida', 'cena')
    if (principal and k <= 520 or not principal and k <= 320) and prot * 4 / max(k, 1) >= 0.18: et.append('deficit')
    if principal and 380 <= k <= 750 or not principal and 200 <= k <= 500: et.append('mantenimiento')
    if principal and k >= 650 or not principal and k >= 480: et.append('volumen')
    if r['min'] <= 15: et.append('rapida')
    if r['min'] >= 45 or r['dif'] == 'd': et.append('elaborada')
    if 'prep' in r['x']: et.append('meal-prep')
    if 'llevar' in r['x']: et.append('para-llevar')
    for x in r['x']:
        if x.startswith('temporada:'): et.append(x.replace(':', '-'))
    return et

vistos, salida = set(), []
for r in recetas:
    tot = dict(kcal=0, p=0, c=0, g=0, f=0, az=0)
    peso = 0
    for k, g in r['ing']:
        _, kc, p, c, gr, fi, az, *_ = I[k]
        tot['kcal'] += kc * g / 100; tot['p'] += p * g / 100; tot['c'] += c * g / 100
        tot['g'] += gr * g / 100; tot['f'] += fi * g / 100; tot['az'] += az * g / 100
        peso += g
    id_ = slug(r['n'])
    if id_ in vistos: raise ValueError(f'Receta repetida: {r["n"]}')
    vistos.add(id_)
    sus = []
    for k, _ in r['ing']:
        for alt, motivo in SUSTITUCIONES.get(k, []):
            sus.append([k, alt, motivo])
    salida.append(dict(id=id_, n=r['n'], t=r['t'], min=r['min'], dif=r['dif'], rac=r['rac'], d=r['d'],
        ing=[[k, round(g)] for k, g in r['ing']], pasos=r['pasos'],
        kcal=round(tot['kcal'] / r['rac']), p=round(tot['p'] / r['rac'], 1), c=round(tot['c'] / r['rac'], 1),
        g=round(tot['g'] / r['rac'], 1), f=round(tot['f'] / r['rac'], 1), az=round(tot['az'] / r['rac'], 1),
        et=etiquetas(r, tot, peso), sus=sus))

ingred = {k: [v[0], v[8], v[7]] for k, v in I.items()}
json.dump({'v': 1, 'fuente': 'Valores estimados a partir de tablas de composición (USDA FoodData Central y BEDCA), sumando ingredientes.',
           'ingredientes': ingred, 'recetas': salida}, open(f'{SAL}/recetas.json', 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(salida), 'recetas ·', Counter(r['t'] for r in salida))
c = Counter(e for r in salida for e in r['et'])
print(dict(c))
print(os.path.getsize(f'{SAL}/recetas.json') // 1024, 'KB')
