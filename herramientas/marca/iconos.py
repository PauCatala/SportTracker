"""Iconos de la app (PNG) con el isotipo de SYNCO sobre el gris perla de la interfaz."""
import os
from playwright.sync_api import sync_playwright
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
svg = open(os.path.join(RAIZ, 'icons', 'synco-isotipo.svg')).read()
with sync_playwright() as p:
    b = p.chromium.launch()
    for n in (180, 192, 512):
        pg = b.new_page(viewport={'width': n, 'height': n})
        pg.set_content(f'<body style="margin:0;width:{n}px;height:{n}px;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#FAFBFB,#E9ECEE)">'
                       f'<div style="width:{n*0.6}px;aspect-ratio:552/286">{svg.replace("<svg ", "<svg width=100% height=100% ")}</div></body>')
        pg.screenshot(path=os.path.join(RAIZ, 'icons', f'icon-{n}.png'))
        pg.close()
    b.close()
print('ok')
