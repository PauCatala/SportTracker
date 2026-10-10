# Renderiza las imágenes de las publicaciones de la rueda (media/posts)
import subprocess, time, base64, sys
from playwright.sync_api import sync_playwright
OUT='/home/claude/sporttracker/media/posts/'
srv=subprocess.Popen(['python3','-m','http.server','8787'],cwd='/home/claude/sporttracker',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']); pg=b.new_page(); err=[]
    pg.on('pageerror',lambda e: err.append('PAGEERROR '+str(e)))
    pg.on('console',lambda m: err.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.goto('http://localhost:8787/herramientas/avatar/lab/posts.html'); pg.wait_for_function('window.listo')
    for n in (sys.argv[1:] or ['imagen','estudios','salud']):
        url=pg.evaluate(f'{n}()'); open(OUT+n+'.webp','wb').write(base64.b64decode(url.split(',')[1])); print(n)
    print('\n'.join(err[:10])); b.close()
finally: srv.terminate()
