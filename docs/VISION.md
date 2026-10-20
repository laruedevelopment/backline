# Visión

## En una frase
**El lugar donde vive tu banda**: repertorio, setlists, ensayos, toques, equipo y gente — y, alrededor, la escena musical de tu ciudad (salas, músicos, equipo usado, conciertos).

## El problema (de Javier, real)
Cuadrar canciones con la banda es un caos: toca buscar en el chat de WhatsApp dónde está el setlist, qué versión de la canción, en qué tono, con qué afinación, quién toca qué. Todo está regado (chat, Drive, Spotify, notas).

## Usuarios
1. **Miembro de banda** (núcleo, se arranca por él): ve qué se toca, cuándo y cómo.
2. **Líder / manager de banda**: arma repertorio, setlists, ensayos y toques; invita gente.
3. **Músico independiente**: perfil, rig, busca banda; se ofrece como invitado/sesión.
4. **Sala de ensayo / venue**: perfil, horarios, reservas, mensajes (piloto: el ensayadero del amigo de Javier).
5. **Fan / público**: sigue bandas, ve fechas de toques, escucha.
6. **Comprador/vendedor de equipo** (fase tardía).

## Módulos

### A. Banda (el corazón — Fase 1)
- Perfil de banda: nombre, géneros, ciudad, foto, miembros y roles, invitados recurrentes, links.
- Miembros con instrumento y rol; invitados por canción (ej. "trompeta en la 4").
- **Repertorio**: canción con título, artista original, tono, BPM, compás, duración, **afinación por instrumento** (guitarra 1: Drop D, bajo: E estándar, guitarra con capo 2…), **cambios de tonalidad** (marcas por sección), estructura (intro/verso/coro…), notas, letra/acordes, links (Spotify/YouTube), archivos (PDF de partitura/tab, audio de referencia), quién toca qué, estado (aprendiendo / lista / en pausa).
- **Setlists**: ordenados por arrastrar, duración total, cambios de afinación entre canciones (avisa "cambiar a Drop D aquí" para minimizar), versión para impresión/modo escenario (letra grande, oscuro), compartir por link.
- **Calendario**: ensayos y toques (lugar, hora, pago, setlist asignado, cargas/montaje, quién confirma). Confirmación de asistencia (voy / no voy / tal vez) y recordatorios.
- **Chat/tablero de banda** minimalista y anclado a canciones/eventos (para que nada se pierda en WhatsApp). Comentarios por canción.
- **Modo ensayo / modo escenario**: pantalla limpia con la canción actual, tono, afinación, siguiente canción, metrónomo/BPM.
- Finanzas simples de banda (caja común, pagos por toque) — fase posterior.

### B. Escuchar y conectar música
- Gratis y sin claves: pegar link de **YouTube / Spotify** → reproductor embebido (iframe oficial) y metadatos por oEmbed.
- Spotify: búsqueda por la Web API (client credentials) para autocompletar título/artista/portada y, si hay datos, BPM/tono. **Aviso:** Spotify retiró audio-features/audio-analysis para apps nuevas (nov 2024); verificar con `investigador-docs` antes de depender de ello. Alternativas: ingreso manual, o servicios gratis como GetSongBPM (requiere atribución).
- Subir demos propios (audio/video) a Supabase Storage con límites.

### C. Perfil de músico y "rig"
- Perfil: instrumentos, géneros, influencias, ciudad, disponibilidad, videos.
- **Rig**: lista visual de instrumentos y equipo (guitarra, cuerdas/calibre, afinación habitual, pedalboard con orden de la cadena de señal, amplificador, interfaz…), con fotos. Se puede mostrar público o no.

### D. Red social / descubrimiento
- Feed de publicaciones (audio, video, fotos), seguir bandas/músicos/salas.
- **Buscar miembros**: anuncios "banda busca bajista" / "bajista busca banda" con filtros (instrumento, género, ciudad, nivel, influencias).
- Directorio de bandas, salas, estudios, luthiers, técnicos, profes.
- Cartelera de conciertos de la ciudad.

### E. Salas de ensayo y venues (piloto con el amigo de Javier)
- Perfil de la sala: fotos, equipo disponible (backline), precios, horarios, ubicación (mapa gratis con OpenStreetMap/Leaflet).
- **Reservas** por franja horaria; el dueño confirma/rechaza; disponibilidad en calendario; mensajes directos.
- Primera versión: reserva sin pago en línea (pago en sitio). Pagos (Wompi/Mercado Pago/Stripe) después.
- Para venues: solicitudes de toque (la banda propone fecha y setlist/EPK).

### E2. Negocios musicales (ensayaderos, estudios, luthiers, tiendas)
- Un usuario puede tener **dos sombreros**: sus bandas y su negocio. Se cambia desde la barra superior; cada uno tiene su navegación.
- **Ensayadero** (hecho): salas con medidas, equipo (incluido o de alquiler aparte, con marca/referencia opcional), horario, precios, fotos y ubicación; reservas con confirmación manual o automática; lectura de su Google Calendar.
- Mismo molde para otros negocios: **estudio de grabación** (salas de grabación, consola, microfonía), **luthier/taller** (servicios con precio y cita), **tienda** (productos), **profes**. Cada tipo define qué «artículos» lo componen.
- Directorio con mapa en vivo de todos los negocios, «cerca de mí» y filtros por equipo.

### F. Marketplace (Fase tardía, pagos y legal)
- Compra/venta de instrumentos, pedales, accesorios (guitarras, bajos, baterías, vientos…), con fotos, estado, ciudad, precio, chat.
- Cualquier usuario puede publicar instrumentos, equipo y productos. Empezar como **clasificados** (contacto directo, sin pagos ni envíos) → luego escrow/pagos con comisión.
- Antes de abrirlo: política de contenido y de artículos prohibidos, reportes, moderación y revisión de `lucia-cumplimiento` (Estatuto del Consumidor, garantías, retracto).
- Requiere términos, reputación, reportes y revisión legal (Estatuto del Consumidor).

### G. Aprender (Fase 1b)
- Lecciones paso a paso por instrumento (guitarra, bajo, batería, piano; luego voz, ukulele, etc.) y por nivel.
- Cada lección: objetivo, pasos, **diagrama gráfico** (diapasón, patrón de batería, teclado) y **metrónomo** con BPM de partida y meta.
- Progreso por usuario (lecciones completadas, racha de práctica, minutos practicados).
- Ideas: afinador (micrófono), entrenamiento de oído, "practicar con mi repertorio" (desde una canción, abrir ejercicios del tono/afinación), retos semanales de la banda, tablero de práctica compartido.

### H. Perfil público de banda y verificación
- Logo, foto de portada, galería de fotos, bio, géneros, ciudad.
- Redes: Instagram, Facebook, YouTube, Spotify, TikTok, web (enlaces validados).
- **Banda verificada** (insignia): se verifica con un proceso manual simple (enlace a una red oficial + código en la bio, o confirmación de un venue). Evita suplantación.
- Storage con límites de tamaño/tipo; fotos solo propias.

## Ideas extra (para decidir juntos)
- **EPK automático** (kit de prensa) generado desde el perfil de la banda: link público único para mandar a venues.
- **Mapa de afinaciones**: el setlist optimiza el orden para minimizar cambios de afinación.
- **Transpositor** de tono y capo sugerido.
- **Stage plot / input list** generador (plano de escenario para el sonidista) exportable a PDF.
- **Carga de equipo**: lista de quién lleva qué a cada toque (evita "nadie trajo el cable").
- **Votaciones** en la banda (qué canción añadir) y backlog de canciones propuestas.
- **Compositor**: ideas/riffs grabados rápido (nota de voz) asociados a la banda.
- **Colaboraciones**: invitar a un músico de sesión a una sola canción/evento con acceso limitado.
- **Cartelera + calendario sincronizable** (.ics) con Google Calendar.
- **Insignias/reputación** para vendedores y salas.
- Importar setlist desde texto pegado (lo del chat de WhatsApp) — gran gancho de adopción.
- **Integración con Slothy** (recepcionista/reservas): las salas de ensayo reservan y sincronizan horarios con Slothy; chatbot dentro de la app que responde horarios disponibles. Decidir si es la misma base o una API entre ambos.
- **Retos y rachas** de práctica (gamificación suave), tablas de la banda.
- **Setlist a PDF/imagen** para compartir; **tablero de ideas** (riffs en nota de voz).
- **Directorio de técnicos/luthiers/profes** y **clases particulares** (profes publican y reciben solicitudes).
- **Cartelera de la ciudad + .ics**; **perfil público compartible** (link corto + QR para el cartel del toque).
- **Estadísticas de banda** (canciones más tocadas, horas de ensayo, asistencia).
- Modo offline para escenario (PWA con caché) — crítico: en los toques no hay buena señal.

## Principios
1. **Útil el primer día aunque sea una sola banda** (utilidad antes que red). La red social llega después sobre una base que ya se usa.
2. Rápido de capturar: agregar una canción en 10 segundos.
3. Móvil primero y legible en escenarios oscuros.
4. Gratis hasta que haya usuarios; sin backend propio.
5. Cada módulo se puede lanzar y probar solo.

## Nombre
Nombre de trabajo: **Backline** (término de escena: el equipo de amplificación/batería en tarima; funciona en español e inglés). Alternativas: Tarima, Setlist, Ensayo, Sonora, Ruido Bueno, Patchbay. Antes de fijar: revisar dominio, usuario de Instagram y marcas (SIC en Colombia).

## Riesgos
- Derechos de autor: no alojar música de terceros; solo enlazar/embeber lo oficial. Subidas solo de contenido propio, con aviso y mecanismo de reporte.
- Menores de edad (muchos músicos jóvenes): edad mínima/consentimiento (Ley 1581).
- Moderación de red social y marketplace.
- Límites de planes gratis de Supabase (500 MB DB, 1 GB storage, pausa por inactividad): ver `docs/ROADMAP.md`.
