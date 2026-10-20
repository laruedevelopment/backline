@AGENTS.md

## Específico de Claude Code
- Nombre de trabajo: **Backline** (fácil de cambiar; ver docs/VISION.md §Nombre).
- Antes de cualquier tarea, leer `docs/VISION.md` (qué y por qué) y `docs/ROADMAP.md` (en qué fase estamos).
- Modelo: Opus solo para planear; Sonnet para implementar; `camila-qa` con model haiku para verificar (`npx tsc -b`, `npm run lint`, `npm run build`).
- Agentes útiles aquí: `valentina-ux-ui` (revisar pantallas/flujos), `mateo-ui-tester` (que corra y se vea bien en móvil), `tomas-arquitectura` (diseño de datos/escala antes de construir), `daniela-seguridad` (RLS, subidas, auth), `lucia-cumplimiento` (Ley 1581, menores, derechos de autor de música/video, compraventa), `investigador-docs` (Supabase, APIs de Spotify/YouTube).
- Skills obligatorias: `diseno-humano` al tocar interfaz; `seguridad-app` al tocar auth/RLS/subidas; `supabase-cambio-seguro` para esquema; `lanzamiento-web` antes de publicar; `cumplimiento-legal` antes de abrir marketplace o reservas con pago.
