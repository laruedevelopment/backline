# Diseño

Lenguaje: **"equipo de tarima"**. La interfaz toma prestado de lo que ya existe en un ensayo y en un toque: la etiqueta de un amplificador, la hoja de setlist pegada en el piso, la boleta del concierto. Sigue la skill `diseno-humano`: un solo acento, nada de gradientes ni plantillas, textos en español natural.

La fuente de verdad son los tokens de `src/index.css` (`:root`). Si este documento y el CSS se contradicen, manda el CSS.

## Color
Base cálida de noche y **un solo acento** (ámbar de luz de escenario). Verde y rojo existen solo como estado.

| Token | Valor | Uso |
|---|---|---|
| `--bg` | #0D0C0A | fondo |
| `--raise` | #171512 | superficies elevadas |
| `--sunk` | #11100E | campos, zonas hundidas |
| `--line` / `--line-2` | #2A2620 / #3B352B | líneas y bordes |
| `--text` / `--muted` | #F1ECE2 / #A1998B | texto (muted ≈ 6.9:1 sobre el fondo) |
| `--amber` | #F2A33A | acción principal, tono, acento |
| `--sage` | #72C59C | confirmado / lista |
| `--ember` | #F2706A | alerta / cambio de afinación |
| `--paper` / `--paper-ink` | #ECE4D2 / #1C1915 | hoja de setlist |

## Tipografía (alojada en la app; funciona sin conexión)
- **Archivo Variable**, condensada (`font-stretch: 75%`), mayúsculas, peso 800–900: títulos y carteles.
- **Instrument Sans Variable**: texto corrido y controles.
- **IBM Plex Mono**: lecturas de equipo (tono, BPM, horas, etiquetas pequeñas en mayúsculas).

## Piezas con identidad
- **Fila de lista** (`.li`): línea fina en vez de tarjetas. El tono y el BPM van a la derecha como lectura de equipo.
- **Hoja de setlist** (`.paper`): papel crema, números grandes, tira oscura para avisos de afinación.
- **Boleta** (`.ticket`): fecha en grande sobre ámbar, con muesca perforada. Se usa para ensayos y toques.
- **Monograma** (`.mono-mark`): iniciales de la banda en cuadrado (las personas son círculo). Se reemplaza por el logo cuando exista.
- **Etiquetas** (`.tag`, `.eyebrow`): mono, mayúsculas, bordes finos.

## Estructura
- Móvil primero (390 px). Barra superior con selector de banda y avatar; navegación inferior de **5 pestañas**: Inicio · Música (canciones y setlists) · Agenda · Aprender · Banda. Lateral desde 960 px.
- El perfil personal se abre desde el avatar.
- Acción principal flotante (`.fab`) en pantallas de lista; espacio inferior reservado para que no tape contenido.

## Principios UX
- Zonas de toque ≥ 44 px (incluido el avatar y los filtros).
- Estados siempre diseñados: **carga** (skeleton), **vacío** (qué es esto y qué hacer) y **error** (con reintento).
- Hojas modales con el componente `Sheet`: foco atrapado, Escape, retorno de foco. Confirmaciones con `ask()` (nunca `confirm()` del navegador).
- Los filtros son botones con `aria-pressed`, no tabs ARIA.
- **Modo escenario**: contraste máximo, texto grande, aviso de afinación arriba, pantalla siempre encendida.
- Movimiento solo con propósito (respuesta de botones, hoja que sube) y respetando `prefers-reduced-motion`.
- Microcopy en español colombiano neutro: "Agregar canción", no "Añadir elemento".

## Dispositivos y ancho (regla para toda pantalla nueva)
Se diseña para tres clases de pantalla, no solo celular:
- **Celular (< 640 px):** una columna a lo ancho, navegación inferior.
- **Tableta (640–959 px):** columna de hasta 720 px, navegación inferior.
- **Escritorio (≥ 960 px):** menú lateral y el contenido usa el espacio restante (hasta 1040 px; 1240 desde 1500 px; 1440 desde 1900 px). Listas y tarjetas pasan a 2 columnas desde 1100 px y a 3 desde 1700 px (`.list.cols`, `.explore-grid`).
- El ancho y el gutter salen de `.main` (`--gutter`); no fijar anchos máximos pequeños en cada página. El texto largo se limita con `ch`, no con el contenedor.
- Al revisar una pantalla, mirar 390, 768, 1366 y 1920 px (y celular de lado si tiene modo horizontal).
