# Sport Tracker

App personal de seguimiento de entrenamiento (PWA). HTML + CSS + JavaScript puro, datos en Supabase, alojada gratis en GitHub Pages.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html` | El esqueleto: login, cabecera, pestañas y barra inferior |
| `css/styles.css` | El aspecto: colores, tamaños, diseño para móvil |
| `js/config.js` | URL y clave pública de Supabase |
| `js/db.js` | Todo lo que habla con Supabase + guardado sin conexión |
| `js/utils.js` | Funciones pequeñas: fechas, formatos, 1RM estimado |
| `js/consultas.js` | Preguntas a tus datos ("¿qué hice la última vez?") |
| `js/gym.js` | Pestañas Entrenar e Historial |
| `js/progreso.js` | Pestaña Progreso (gráficas) |
| `js/catalogo.js` | Pestañas Ejercicios y Mesociclos |
| `js/plan.js` | Tu plan de 6 meses en datos: mesociclos, running y flexibilidad |
| `js/running.js` | Bloque Running: semana, registrar y progreso |
| `js/flex.js` | Bloque Flexibilidad: checklist diaria y progreso |
| `js/graficos.js` | Estilo común de las gráficas |
| `js/iconos.js` | Iconos SVG propios |
| `js/app.js` | Arranque, login y navegación |
| `sw.js` | Service worker: permite abrir la app sin internet |
| `manifest.json` + `icons/` | Nombre e icono al instalarla en el móvil |

## Bloques

- [x] Gimnasio
- [x] Running (manual; Strava cuando haya reloj)
- [x] Flexibilidad
- [ ] Bici
- [ ] Nutrición
