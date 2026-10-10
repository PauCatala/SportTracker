import subprocess, time, json, base64, os, copy
from playwright.sync_api import sync_playwright
OUT='/home/claude/sporttracker/media/avatar/mini/'; os.makedirs(OUT, exist_ok=True)
srv=subprocess.Popen(['python3','-m','http.server','8784'],cwd='/home/claude/sporttracker',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']); pg=b.new_page(); err=[]
    pg.on('pageerror',lambda e: err.append('PAGEERROR '+str(e)))
    pg.on('console',lambda m: err.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.goto('http://localhost:8784/herramientas/avatar/lab/mini.html'); pg.wait_for_function('window.listo')
    P=pg.evaluate('PERFILES')
    def foto(nombre, perfil, enc, w=240, h=240):
        url=pg.evaluate('([p,e,w,h])=>foto(p,e,w,h)', [perfil, enc, w, h])
        open(OUT+nombre+'.webp','wb').write(base64.b64decode(url.split(',')[1]))
    # bases
    for k in ('hombre','mujer'): foto(f'base-{k}', P[k], 'base', 360, 480)
    # pelo (sobre base femenina sin sombrero, y masculina para cortos)
    pelos=['ninguno','short02','short01','short03','short04','afro01','bob01','bob02','long01','ponytail01','braid01']
    for pe in pelos:
        base=copy.deepcopy(P['mujer'] if pe in ('bob01','bob02','long01','ponytail01','braid01') else P['hombre'])
        base['pelo']={'estilo':pe,'color':'#6a4a32'}; base['barba']={'estilo':'ninguna','color':'#6a4a32'}
        foto(f'pelo-{pe}', base, 'pelo')
    for ba in ['ninguna','sombra','corta','completa','perilla','bigote','candado']:
        base=copy.deepcopy(P['hombre']); base['barba']={'estilo':ba,'color':'#3b2a20'}
        foto(f'barba-{ba}', base, 'barba')
    # ropa
    R=json.load(open('/home/claude/sporttracker/media/avatar/catalogo.json'))['recursos']
    for rid, r in R.items():
        t=r['tipo']
        if t not in ('arriba','abajo','conjunto','calzado','sombrero'): continue
        g='mujer' if rid.startswith('female') else 'hombre'
        base=copy.deepcopy(P[g]); ropa=base['ropa']; ropa['colores']={'arriba':'#dfe3ea','abajo':'#3a4254','conjunto':'#dfe3ea','sombrero':'#c9ccd3','calzado':'#f2f2f0'}
        if t=='calzado': ropa['colores'].pop('calzado')
        if t=='conjunto': ropa['conjunto']=rid
        else:
            ropa['conjunto']=''; ropa[t]=rid
        foto(f'ropa-{rid}', base, t)
    print(len(os.listdir(OUT)),'miniaturas'); print('\n'.join(err[:20]))
    b.close()
finally: srv.terminate()
