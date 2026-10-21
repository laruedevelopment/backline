# Roadmap

Regla: cada fase es usable por sí sola y se prueba con la banda de Javier antes de seguir.

## Fase 0 — Cimientos (hecho / en curso)
- [x] Proyecto Vite + React + TS, PWA, router, estado.
- [x] Documentación de visión, datos y diseño.
- [x] Esqueleto de UI móvil con datos de demo (Inicio, Repertorio, Setlists, Agenda, Perfil).
- [x] Repo público en GitHub (laruedevelopment/backline) y deploy gratis: https://laruedevelopment.github.io/backline/

## Fase 1 — Banda MVP (el dolor real de Javier) — hecha; falta probarla en un ensayo real
- [x] Supabase: proyecto, Auth por correo, migraciones 0001–0022 aplicadas en producción, RLS por banda, pruebas de base de datos en CI (`npm run test:db`).
- [x] Crear banda, invitar por código o por link (`/unirse/<código>`: quien no tiene cuenta la crea y entra sola a la banda). Varias bandas por persona y cambio rápido.
- [x] Repertorio completo: tono, BPM, afinación por instrumento, cambios de tono, links, notas, **letra y acordes**, **notas por instrumento** y **anotaciones personales por músico** (migraciones 0016, 0017, 0022).
- [x] Importar setlist pegando texto o desde foto/captura (OCR local, $0); la lectura reconstruye filas, afinación y notas de listas diseñadas. Link de playlist de YouTube (requiere clave, ver PENDIENTES). Spotify no permite leer listas ajenas.
- [x] Setlists: reordenar arrastrando, **etiquetas sueltas entre canciones y etiquetas por canción** (migración 0021), nombre editable, link de Spotify (migración 0018), duración y avisos de cambio de afinación.
- [x] **Modo escenario**: vista personal por instrumento, letra grande y centrada, transponer acordes, ajustar a la pantalla, dos páginas en horizontal, desplazamiento automático, pedal/teclado, pantalla encendida, girar pantalla, deslizar entre canciones.
- [x] Agenda: ensayos/toques + confirmación de asistencia (migración 0005).
- [x] Reproductor embebido YouTube/Spotify en las canciones.
- [x] Offline básico (PWA con caché local de lo útil sin señal).
- Meta: la banda de Javier la usa 4 semanas en lugar del chat.

## Fase 1b — Aprender (en curso)
- [x] Lecciones por instrumento (guitarra, bajo, batería, piano) con diagramas SVG y metrónomo (Web Audio), progreso local.
- [ ] Más lecciones por nivel, afinador, racha de práctica, progreso en Supabase.

## Fase 2 — Perfiles y rig
- [x] Perfil de músico con foto, instrumentos, ciudad y descripción; perfil público opcional y solo para mayores de edad (migraciones 0015, 0019, 0020).
- Perfil de músico, rig con pedalboard, perfil público de banda + EPK, **banda verificada**. (Hecho: logo y galería de fotos de banda con Storage, migración 0008; redes y bio en Banda.)

## Fase 3 — Salas de ensayo (piloto con el amigo)
- [x] Perfil de sala (varias salitas, precios, horario semanal, fotos y logo), publicación y administración por su dueño. *(migración 0009)*
- [x] Reservas: la banda pide una franja libre, el dueño confirma o rechaza; sin dobles reservas (restricción en la base); al confirmar, el ensayo aparece solo en la agenda de la banda.
- [x] Pruebas de seguridad de las migraciones y RLS en CI (`npm run test:db`).
- [ ] Piloto real con una sala; medir fricción antes de generalizar.
- [x] Confirmación automática (opcional por sala), reservas anotadas a mano por el dueño, botón Agregar a Google Calendar, actualización en vivo, insignia de pendientes y avisos push (migraciones 0010-0012; función `notify-booking`).
- [x] Leer el Google Calendar de cada sala por su dirección iCal (migración 0013, función `sync-calendars`).
- [x] Ficha técnica: medidas de cada sala, equipo incluido o de alquiler aparte (marca/referencia opcional) y ubicación en el mapa (migración 0014).
- [x] Área «Mi negocio» con dos sombreros (Hoy, Reservas, Salas, Perfil).
- [ ] Recordatorios automáticos, página pública de disponibilidad, plano y fotos por sala, mapa con todas las salas de ensayos («cerca de mí») y filtros por equipo.
- [ ] Más tipos de negocio: estudio de grabación, luthier, tienda, profes.
- [ ] Mapa OSM y mensajes dentro de la app.
- [ ] Integración con Slothy (chatbot de horarios y reservas): cada sala puede apuntar su `booking_url` a su chat de Slothy; la sincronización completa llega cuando Slothy esté desplegado.

## Fase 4 — Comunidad
- [x] Directorio de bandas y músicos con perfil público opcional (migración 0015): explorar, filtrar por ciudad/género/instrumento, WhatsApp opcional, solo para personas con cuenta.
- Feed, seguir, subir demos/videos, buscar/ofrecer miembros, cartelera de la ciudad, notificaciones push (web push).

## App móvil (después de validar la PWA)
- La PWA ya se instala en el celular y recibe avisos push. Luego: envolver la misma web con Capacitor y publicar en Play Store y App Store, sin reescribir.
- Regla desde ya: la lógica va en `src/lib`, separada de las pantallas, y sin depender de cosas solo web (enlaces de reserva, `window`, etc.). El backend (Supabase) ya sirve igual a web y app.

## Fase 5 — Marketplace (cualquier usuario puede publicar instrumentos y productos; con revisión legal previa)
- Clasificados de equipo → reputación → pagos/escrow (revisión legal previa).

## Fase 6 — Escala
- [x] Auditorías de seguridad y arquitectura sobre lo construido (ver `docs/AUDITORIA-2026-10.md`).
- [x] Rendimiento básico: carga de pantallas bajo demanda, caché persistente solo de lo útil sin señal.
- Monitoreo (Sentry), pruebas de carga, plan de pago de Supabase, CDN de medios, moderación, métricas de monetización (premium de banda, destacados, comisión de reservas/ventas).

## Monetización (luego)
Plan Pro para bandas (más almacenamiento, finanzas, EPK avanzado), comisión por reservas y ventas, anuncios destacados de salas/luthiers. Por ahora todo gratis.
