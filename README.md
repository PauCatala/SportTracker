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
| `js/avisos.js` | Avisos en el móvil: calcula los de los próximos 14 días y activa cada dispositivo |
| `js/salud/reloj.js` | Apartado Reloj (Salud): sueño, pulso, pasos y entrenos de Apple Salud y Strava |
| `js/captura/bandeja.js` | Notas escritas desde el widget del iPhone: se colocan solas al abrir SYNCO |
| `api/nota.js` | Recibe lo que escribes en el Atajo «Apuntar en SYNCO» (widget, Siri, pantalla de bloqueo) |
| `api/salud.js` | Recibe lo que manda el Atajo del iPhone (datos de Apple Salud) |
| `api/strava.js` | Conecta Strava y trae tus entrenos (necesita `STRAVA_CLIENT_ID` y `STRAVA_CLIENT_SECRET` en Vercel) |
| `sql/salud_reloj.sql` | Tablas del apartado Reloj: días de salud, conexiones y actividades |
| `sw.js` | Service worker: permite abrir la app sin internet y muestra los avisos |
| `sql/avisos.sql` | Tablas de avisos y tarea programada que los envía cada minuto |
| `supabase/functions/enviar-avisos` | Función de Supabase que manda las notificaciones |
| `manifest.json` + `icons/` | Nombre e icono al instalarla en el móvil |

## Bloques

- [x] Gimnasio
- [x] Running (manual; Strava cuando haya reloj)
- [x] Flexibilidad
- [x] Reloj: Apple Salud (Atajo de iOS) + Strava
- [ ] Bici
- [ ] Nutrición

## Avisos

Se activan en Calendario → Sincronizar → Avisos, en cada móvil u ordenador por separado.
En iPhone solo funcionan con SYNCO instalada en la pantalla de inicio (iOS 16.4 o posterior).
Las claves que firman las notificaciones están en el Vault de Supabase, no en este repositorio.

## Reloj (Apple Salud + Strava)

Todo gratis. Se configura en Salud → Reloj → Conectar.

- **Apple Salud**: una web no puede leer Salud, así que un Atajo de iOS manda cada día pasos, pulso, reposo,
  VFC y sueño a `/api/salud?t=<tu código>`. El código es secreto (solo permite escribir, no leer).
- **Strava**: crea una app gratis en strava.com/settings/api (Authorization Callback Domain = tu dominio)
  y pon `STRAVA_CLIENT_ID` y `STRAVA_CLIENT_SECRET` en Vercel → Settings → Environment Variables.
  Al abrir SYNCO se traen los entrenos nuevos; las carreras pasan también al bloque de Running.
  Las apps nuevas de Strava admiten 1 atleta: para que otra persona conecte la suya, pide más en Strava.

## Apuntar desde el iPhone sin abrir SYNCO

Un Atajo de iOS («Apuntar en SYNCO») puesto como widget, en el Centro de control o con Siri: escribes
«dentista 26 abril a las 17» o «lista de la compra: leche, huevos y pan» y se manda a `/api/nota?t=<tu código>`.
Queda en la bandeja (`notas_entrada`) y, al abrir SYNCO, se apunta donde toca con el mismo «cerebro»
de la nota rápida (`js/captura/analizar.js`). Guía paso a paso en Nota rápida → En el iPhone.

## Conectar a un toque (para administrar SYNCO, una sola vez)

Los usuarios no ven instrucciones: pulsan **Añadir a mi iPhone** o **Conectar con Strava**, o escanean el QR.
Para que eso funcione, el administrador hace esto una vez:

1. **Strava**: app gratis en strava.com/settings/api (Authorization Callback Domain = el dominio de SYNCO) y
   `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` en Vercel.
2. **Atajo «SYNCO Salud»**: créalo siguiendo la guía de Salud → Reloj → Conectar (desplegable «Montarlo a mano»).
   En el paso «Obtener contenido de URL», pon como URL tu propia dirección y después, en los ajustes del atajo
   (ⓘ) → **Configurar al importar**, añade la pregunta sobre esa URL con el texto «Pega tu dirección de SYNCO».
   Así cada persona pega la suya al instalarlo (SYNCO la copia sola antes de abrir el enlace).
3. **Atajo «Apuntar en SYNCO»**: igual, con la guía de Nota rápida → En el iPhone, y la misma pregunta al importar.
4. Comparte cada atajo (mantenerlo pulsado → Compartir → **Copiar enlace de iCloud**) y pega los dos enlaces
   en `js/config.js` → `ATAJOS`. Desde ese momento, en el iPhone aparece el botón de un toque.

Límites de Apple: una web no puede leer Apple Salud por sí sola ni crear automatizaciones; el envío diario
automático son tres toques del usuario (se explican en la app). Leer Salud directamente requiere una app nativa
(cuenta de desarrollador de Apple, 99 €/año).

## Instalar como app

SYNCO es una PWA: en el iPhone se instala desde Safari (Compartir → Añadir a pantalla de inicio) y en Android/ordenador
con un toque. La hoja «Instalar la app» (menú de tu perfil, `#instalar` o el QR) guía en cada caso, y
`icons/arranque/` tiene las pantallas de arranque del iPhone.
