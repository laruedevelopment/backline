# Roadmap

Regla: cada fase es usable por sí sola y se prueba con la banda de Javier antes de seguir.

## Fase 0 — Cimientos (hecho / en curso)
- [x] Proyecto Vite + React + TS, PWA, router, estado.
- [x] Documentación de visión, datos y diseño.
- [x] Esqueleto de UI móvil con datos de demo (Inicio, Repertorio, Setlists, Agenda, Perfil).
- [ ] Repo en GitHub (organización laruedevelopment) y deploy gratis.

## Fase 1 — Banda MVP (el dolor real de Javier)
- [ ] Supabase: proyecto, Auth (email + Google), migraciones, RLS por banda. *(migración 0001 escrita en `supabase/migrations/`, sin aplicar; falta proyecto — ver PENDIENTES)*
- [ ] Crear banda, invitar miembros por link/código.
- [x] Repertorio completo (tono, BPM, afinación por instrumento, cambios de tono, links, notas) — local (`src/store/useBand.ts`, localStorage); falta conectarlo a Supabase.
- [x] Importar setlist pegando texto o desde foto/captura (OCR local, $0). Pendiente: desde link de playlist (Spotify/YouTube).
- [x] Setlists con orden (subir/bajar), duración, avisos de cambio de afinación y modo escenario (migración 0002, sin aplicar). Falta: compartir, arrastrar.
- [x] Agenda: ensayos/toques + confirmación de asistencia (migración 0005, sin aplicar).
- [ ] Reproductor embebido YouTube/Spotify.
- [ ] Offline básico (PWA).
- Meta: la banda de Javier la usa 4 semanas en lugar del chat.

## Fase 1b — Aprender (en curso)
- [x] Lecciones por instrumento (guitarra, bajo, batería, piano) con diagramas SVG y metrónomo (Web Audio), progreso local.
- [ ] Más lecciones por nivel, afinador, racha de práctica, progreso en Supabase.

## Fase 2 — Perfiles y rig
- Perfil de músico, rig con pedalboard, fotos (Storage con límites), perfil público de banda (logo, portada, galería, redes) + EPK, **banda verificada**.

## Fase 3 — Salas de ensayo (piloto con el amigo)
- Integración con Slothy (reservas del ensayadero + chatbot de horarios). Perfil de sala, disponibilidad, reservas con confirmación del dueño, mensajes, mapa OSM.
- Piloto real con una sala; medir fricción antes de generalizar.

## Fase 4 — Comunidad
- Feed, seguir, subir demos/videos, buscar/ofrecer miembros, cartelera de la ciudad, notificaciones push (web push).

## Fase 5 — Marketplace
- Clasificados de equipo → reputación → pagos/escrow (revisión legal previa).

## Fase 6 — Escala
- Monitoreo (Sentry), pruebas de carga, plan de pago de Supabase, CDN de medios, moderación, métricas de monetización (premium de banda, destacados, comisión de reservas/ventas).

## Monetización (luego)
Plan Pro para bandas (más almacenamiento, finanzas, EPK avanzado), comisión por reservas y ventas, anuncios destacados de salas/luthiers. Por ahora todo gratis.
