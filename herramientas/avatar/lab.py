import sys, subprocess, time, json
from playwright.sync_api import sync_playwright
import os
D=os.path.dirname(os.path.abspath(__file__))+"/"
srv=subprocess.Popen(['python3','-m','http.server','8781'],cwd='/home/claude/sporttracker',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
guion=json.loads(sys.argv[1])
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':guion.get('w',1000),'height':guion.get('h',900)})
    err=[]
    pg.on('console',lambda m: err.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror',lambda e: err.append('PAGEERROR '+str(e)))
    pg.goto('http://localhost:8781/herramientas/avatar/lab/avatar.html'); pg.wait_for_function('window.listo')
    t=time.time()
    print('alturas', pg.evaluate(f"montar({json.dumps(guion['perfiles'])})"), 'en', round(time.time()-t,1),'s')
    for i,v in enumerate(guion['vistas']):
        if 'js' in v: print(pg.evaluate(v['js']))
        if 'giro' in v: pg.evaluate(f"girar({v['giro']})")
        pg.evaluate(f"vista(...{json.dumps(v['cam'])})")
        pg.screenshot(path=D+f"{guion.get('nombre','lab')}_{i}.png")
    print('\n'.join(err[:20]) or 'sin errores')
    b.close()
finally: srv.terminate()
