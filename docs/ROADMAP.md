# Roadmap

Regla: cada fase es usable por sí sola y se prueba con la banda de Javier antes de seguir.

## Fase 0 — Cimientos (hecho / en curso)
- [x] Proyecto Vite + React + TS, PWA, router, estado.
- [x] Documentación de visión, datos y diseño.
- [x] Esqueleto de UI móvil con datos de demo (Inicio, Repertorio, Setlists, Agenda, Perfil).
- [x] Repo público en GitHub (laruedevelopment/backline) y deploy gratis: https://laruedevelopment.github.io/backline/

## Fase 1 — Banda MVP (el dolor real de Javier)
- [ ] Supabase: proyecto, Auth (email + Google), migraciones, RLS por banda. *(migración 0001 escrita en `supabase/migrations/`, sin aplicar; falta proyecto — ver PENDIENTES)*
- [ ] Crear banda, invitar miembros por link/código.
- [x] Repertorio completo (tono, BPM, afinación por instrumento, cambios de tono, links, notas) — local (`src/store/useBand.ts`, localStorage); falta conectarlo a Supabase.
- [x] Importar setlist pegando texto o desde foto/captura (OCR local, $0). Link de playlist de YouTube (requiere clave, ver PENDIENTES). Spotify: no viable para playlists ajenas; usar captura.
- [x] Setlists con orden (subir/bajar), duración, avisos de cambio de afinación y modo escenario (migración 0002, sin aplicar). Falta: compartir, arrastrar.
- [x] Agenda: ensayos/toques + confirmación de asistencia (migración 0005, sin aplicar).
- [ ] Reproductor embebido YouTube/Spotify.
- [ ] Offline básico (PWA).
- Meta: la banda de Javier la usa 4 semanas en lugar del chat.

## Fase 1b — Aprender (en curso)
- [x] Lecciones por instrumento (guitarra, bajo, batería, piano) con diagramas SVG y metrónomo (Web Audio), progreso local.
- [ ] Más lecciones por nivel, afinador, racha de práctica, progreso en Supabase.

## Fase 2 — Perfiles y rig
- Perfil de músico, rig con pedalboard, perfil público de banda + EPK, **banda verificada**. (Hecho: logo y galería de fotos de banda con Storage, migración 0008; redes y bio en Banda.)

## Fase 3 — Salas de ensayo (piloto con el amigo)
- [x] Perfil de sala (varias salitas, precios, horario semanal, fotos y logo), publicación y administración por su dueño. *(migración 0009)*
- [x] Reservas: la banda pide una franja libre, el dueño confirma o rechaza; sin dobles reservas (restricción en la base); al confirmar, el ensayo aparece solo en la agenda de la banda.
- [x] Pruebas de seguridad de las migraciones y RLS en CI (`npm run test:db`).
- [ ] Piloto real con una sala; medir fricción antes de generalizar.
- [x] Confirmación automática (opcional por sala), reservas anotadas a mano por el dueño, botón Agregar a Google Calendar, actualización en vivo, insignia de pendientes y avisos push (migraciones 0010-0012; función `notify-booking`).
- [ ] Leer el Google Calendar de la sala (iCal), recordatorios automáticos, página pública de disponibilidad.
- [ ] Mapa OSM y mensajes dentro de la app.
- [ ] Integración con Slothy (chatbot de horarios y reservas): cada sala puede apuntar su `booking_url` a su chat de Slothy; la sincronización completa llega cuando Slothy esté desplegado.

## Fase 4 — Comunidad
- Feed, seguir, subir demos/videos, buscar/ofrecer miembros, cartelera de la ciudad, notificaciones push (web push).

## Fase 5 — Marketplace
- Clasificados de equipo → reputación → pagos/escrow (revisión legal previa).

## Fase 6 — Escala
- Monitoreo (Sentry), pruebas de carga, plan de pago de Supabase, CDN de medios, moderación, métricas de monetización (premium de banda, destacados, comisión de reservas/ventas).

## Monetización (luego)
Plan Pro para bandas (más almacenamiento, finanzas, EPK avanzado), comisión por reservas y ventas, anuncios destacados de salas/luthiers. Por ahora todo gratis.
