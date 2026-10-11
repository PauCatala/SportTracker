# Extrae media/avatar/movimientos.json (animaciones independientes del esqueleto)
import subprocess, time, json
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8788'],cwd='/home/claude/sporttracker',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); err=[]
    pg.on('pageerror',lambda e: err.append(str(e)))
    pg.goto('http://localhost:8788/herramientas/avatar/lab/movimientos.html'); pg.wait_for_function('window.listo2')
    r=pg.evaluate('extraer()'); s=json.dumps(r,separators=(',',':'))
    open('/home/claude/sporttracker/media/avatar/movimientos.json','w').write(s)
    print({k:(v['d'],v['n']) for k,v in r['clips'].items()}, len(r['dir']), len(s), err[:5])
    b.close()
finally: srv.terminate()
