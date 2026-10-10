# Avatar de Lumen · herramientas

Convierten los recursos **CC0 de MakeHuman** en los archivos de `media/avatar/`.
No se ejecutan en la web; solo hacen falta para regenerar los recursos.

Requisitos: Python 3 con numpy, scipy, Pillow, opencv-python y playwright (Chromium).

1. `MH_ZIP=<carpeta del zip makehuman_system_assets_cc0 descomprimido>` y el repositorio
   `makehumancommunity/makehuman` clonado en la ruta de `MH` (ver `mhlib.py`).
2. `python3 construir.py` → cuerpo, morfos reales, esqueleto, ropa, pelo, ojos, pieles y `catalogo.json`.
3. `python3 barbas.py` → máscaras de barba (se añaden al catálogo; ejecutar después de construir).
4. `python3 retarget.py` → `animaciones.json` (adapta las animaciones del maniquí y crea saludar / me gusta).
5. `python3 minis.py` → miniaturas del creador.

Si cambian los recursos, sube `CACHE_AVATAR` en `sw.js`.
