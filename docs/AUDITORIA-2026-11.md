# Auditoría 2026-11 (seguridad, legal y arquitectura de lo nuevo)

Tres revisiones de lectura sobre lo agregado desde la auditoría de octubre: anotaciones por músico, comentarios y chat, amigos y mensajes directos, «Se busca músico», invitados, equipo por toque, resumen del toque, link público de setlist y avisos push (migraciones 0022–0034).

## Seguridad — corregido en las migraciones 0035 y 0036
| Hallazgo | Estado |
|---|---|
| `share_token` legible y escribible por cualquier integrante (el permiso de tabla anulaba el `revoke` por columna) | Corregido: permisos por columna en `setlists` sin `share_token`; pruebas de `permission denied` |
| Funciones auxiliares (`is_adult`, `are_friends`, `is_blocked_between`, `shares_band`, `can_befriend`, `is_member_of`, `opening_band`) usables como oráculo sobre terceros | Corregido: responden solo sobre quien llama |
| Cliente elige `created_at`, `read_at`, `notified_at` (evade límites y falsea orden) | Corregido: trigger que las fija en el servidor |
| Solicitudes de amistad y respuestas a búsquedas sin tope | Corregido: 20 por día |
| `notify-social` no revalidaba amistad/bloqueo | Corregido (requiere volver a desplegar la función) |
| Endpoint de push arbitrario (SSRF ciego) | Corregido: solo servicios de push conocidos |
| `band_openings` exponía `created_by` | Corregido: columna fuera del `select` |
| Invitado vencido no podía volver con código nuevo | Corregido en `join_band` |
| `shared_setlist` se rompía con ids o etiquetas raras | Corregido |
| `save_venue_hours` sin validar el día | Corregido |

Sin hallazgos críticos. No hay secretos en el código; `service_role` solo vive en las Edge Functions.

## Legal — avances y pendientes
- Hecho: política y términos 0.7 (mensajes, amistades, invitados, link público, push, menores en chat de banda, retención al borrar la cuenta, procedimiento de derechos de autor); pantalla de re-aceptación al cambiar la versión; botón «Denunciar» en perfiles, mensajes, comentarios y mensajes directos (tabla `content_reports`); el destinatario puede borrar un mensaje directo.
- Pendiente: revisión por un abogado (todos los textos son borradores), identificación completa del responsable, aviso al líder cuando hay menores en la banda, botón «Descargar mis datos», plazos de retención de respaldos y denuncias, registro nacional de bases de datos (confirmar si aplica).
- Antes del feed de fotos/videos y del Marketplace: ver las reglas recomendadas (menores fuera del feed público, denuncia con cola de revisión, derechos de autor, permiso de personas que aparecen, URLs firmadas, Marketplace sin pagos hasta revisar la Ley 1480, mensajes dentro de la app en vez de WhatsApp).

## Arquitectura y escala
- Para el piloto (hasta ~100 usuarios) aguanta. Lo primero que se rompe: ancho de banda del chat (cada mensaje volvía a bajar la conversación; corregido: el mensaje nuevo se agrega a la caché), luego conexiones Realtime (~200 simultáneas en el plan gratis; el canal de reservas ya solo se abre a quien lo necesita) y las invocaciones de `notify-social` (~500.000/mes).
- Pendiente antes de abrir a más bandas: Sentry (errores), vigilancia del sitio (UptimeRobot), alertas de uso en Supabase, respaldos semanales a un lugar privado, y una prueba de carga contra un proyecto de prueba.
- Plan de prueba de carga (nunca en producción): proyecto nuevo con las migraciones 0001–0036; 200 bandas × 5 integrantes × 100 canciones × 500 mensajes; escenarios A (chat con 100 clientes), B (subir de 50 a 250 conexiones Realtime), C (100 usuarios abriendo repertorio), D (200 invocaciones/minuto de `notify-social` sin llaves VAPID). Criterios: p95 < 500 ms en lecturas, entrega de chat < 2 s, 0 errores a 100 usuarios, < 40 MB/usuario/mes.
- Otros: paginar `listMemberNotes` y `friends_overview`, índices ya agregados (`friendships.requester`), precargar solo las pantallas frecuentes.
