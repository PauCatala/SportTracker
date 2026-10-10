import subprocess, time, json
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['python3','-m','http.server','8782'],cwd='/home/claude/sporttracker',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); err=[]
    pg.on('console',lambda m: err.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror',lambda e: err.append('PAGEERROR '+str(e)))
    pg.goto('http://localhost:8782/herramientas/avatar/lab/retarget.html'); pg.wait_for_function('window.listo')
    r=pg.evaluate('retarget()')
    s=json.dumps(r,separators=(',',':'))
    open('/home/claude/sporttracker/media/avatar/animaciones.json','w').write(s)
    print({k:(v['d'],v['n'],len(v['q'])) for k,v in r.items()}, len(s))
    print('\n'.join(err[:20]))
    b.close()
finally: srv.terminate()
