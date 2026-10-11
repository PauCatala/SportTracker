import subprocess, time, base64
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8790'],cwd='/home/claude/sporttracker',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(); err=[]
    pg.on('pageerror',lambda e: err.append(str(e)))
    pg.goto('http://localhost:8790/herramientas/avatar/lab/exportar.html'); pg.wait_for_function('window.listo')
    for g in ('hombre','mujer'):
        d=pg.evaluate(f"exportar('{g}')"); open(f'/home/claude/sporttracker/_test_{g}.glb','wb').write(base64.b64decode(d)); print(g, len(d))
    print(err[:5]); b.close()
finally: srv.terminate()
