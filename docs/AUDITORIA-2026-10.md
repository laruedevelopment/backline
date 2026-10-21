# Auditorías de seguridad y arquitectura — octubre 2026

Alcance: la app web (Vite + React + Supabase en plan gratis, publicada en GitHub Pages) con todo lo construido hasta la migración 0022.
Resultado: **sin hallazgos críticos ni altos para el piloto actual**. Lo que falta es operar con visibilidad (errores, respaldos, límites).
Las revisiones fueron de lectura del código y las migraciones; no se probó contra producción ni se corrió una prueba de carga.

## Seguridad
**Bien:** todas las tablas con RLS, sin vistas, funciones `security definer` con `search_path` vacío, permisos por columna en `profiles`,
anotaciones por músico con clave compuesta (no se puede anotar en canciones de otra banda), `confirm_adult`/`set_profile_public` solo en el
servidor, subidas con lista blanca de tipo y tamaño y recodificadas sin EXIF, sin SQL por interpolación, sin `innerHTML`, claves públicas
únicamente en el cliente, funciones con JWT verificado.

| # | Hallazgo | Gravedad | Estado |
|---|----------|----------|--------|
| 1 | El WhatsApp de perfiles públicos lo puede listar cualquier cuenta (registro abierto → raspable) | Media | **Decisión pendiente**: dejarlo y declararlo en la política, o exponerlo solo con una función por perfil (y límite de uso) |
| 2 | Las fotos de perfil están en un bucket público (también las de menores, que solo se muestran a su banda) | Media | **Decisión pendiente**: aceptar y documentar, o bucket privado con enlaces firmados |
| 3 | Sin cabeceras de seguridad (GitHub Pages no las permite) y sin Dependabot | Media | **Hecho**: política de contenido (CSP) como `<meta>` solo en el build, `referrer`, y `.github/dependabot.yml` |
| 4 | `join_band` sin límite de intentos y el código no es de un solo uso | Baja | Aceptado (código de 96 bits, vence a los 7 días) |
| 5 | `bands_public_read` devuelve la fila completa (incluye `created_by`) | Baja | Pendiente |
| 6 | `sync-calendars` lo puede disparar cualquier cuenta para cualquier sala publicada | Baja | Contenido (5 min por sala, URL fija, 5 MB, 10 s) |
| 7 | CORS `*` en `notify-booking`; no hay `supabase/config.toml` para confirmar `verify_jwt` | Baja | Verificar en el panel |
| 8 | Clave de YouTube visible en el bundle | Baja | **Verificar en Google Cloud**: restringirla por dominio (`laruedevelopment.github.io`) y por API |

**No verificable desde el código (revisar en el panel de Supabase):** CAPTCHA y límites de intentos en Auth, confirmación de correo obligatoria,
secretos de las funciones, `npm audit`.

## Arquitectura y operación
| Área | Estado |
|------|--------|
| Monitoreo de errores | **No hay.** Conviene Sentry (plan gratis) + monitor de disponibilidad antes de abrir a más bandas |
| Respaldos | **No hay.** El plan gratis no da respaldos descargables. Ojo: el repo es público, así que no guardar volcados como artefactos de GitHub (serían descargables). Opciones: volcado semanal a un almacenamiento privado, o plan Pro cuando haya bandas de pago |
| Pausa por inactividad (7 días) | **Hecho**: workflow `salud-supabase.yml` consulta la API cada 3 días y avisa por correo si falla |
| Pruebas de carga | No hay. Hacerlas contra un proyecto de pruebas (50 usuarios simultáneos; 20 reservas a la misma franja; 100 con Realtime) antes de abrir a más bandas |
| Índices y RLS | Bien cubiertos. Mejora menor: envolver `is_band_member(...)` en `(select …)` dentro de las políticas |
| Listados | `songs` trae `select('*')` con letras completas, y eventos sin límite: acotar cuando los repertorios crezcan |
| Realtime | Un canal por sesión con invalidación amplia: techo práctico de ~200 usuarios con la app abierta |
| OCR | Descarga el modelo de idioma de un CDN externo en cada uso (declarado en la política de privacidad) |
| Límites del plan gratis | 500 MB de base, 1 GB de storage, 5 GB de egreso/mes, 200 conexiones Realtime. Revisar el panel una vez al mes |

Capacidad estimada hoy (sin medir): decenas de bandas y ~200 usuarios con la app abierta a la vez; los primeros límites serían los 500 MB de base y 1 GB de fotos.

## Hecho en esta revisión
- Política de contenido (CSP) y `referrer` en el build; probada contra el lector de fotos, el mapa y las fuentes sin violaciones.
- Dependabot (npm semanal, Actions mensual).
- Workflow de salud de Supabase (mantiene el proyecto activo y avisa si cae).
