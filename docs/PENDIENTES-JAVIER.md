# Lo que solo Javier puede hacer (para el final)

1. **Decidir el nombre** (Backline es provisional) y reservar dominio / @ en Instagram.
2. **Crear proyecto Supabase** gratis (cuenta propia o de la organización) y pasar `URL` y `anon key` → `.env.local` (ver `.env.example`). Nunca la `service_role` en el frontend.
3. **Repo en GitHub** dentro de la organización `laruedevelopment` (crear vacío `backline`).
4. **Spotify Developer** (gratis): crear app para obtener Client ID/Secret si se quiere búsqueda de canciones. (YouTube/Spotify embebidos no requieren claves.)
5. **Google OAuth** (login con Google): crear credenciales en Google Cloud Console.
6. **Su banda** como primera prueba: 2–3 compañeros para probar Fase 1.
7. **Amigo de la sala de ensayos**: horarios, precios, equipo, fotos y cómo gestiona hoy las reservas (para la Fase 3).
8. Costos: por ahora $0. Anotar aquí cualquier costo nuevo (dominio ≈ USD 12/año).

## Crear el proyecto Supabase (paso a paso, $0)
1. Entra a https://supabase.com → Sign in (con GitHub).
2. New project: organización personal o `laruedevelopment`, nombre `backline`, región más cercana (South America – São Paulo), plan **Free**, genera una contraseña de base de datos y guárdala en tu gestor (no me la pases).
3. Cuando termine: Project Settings → API → copia **Project URL** y la clave **anon / publishable**.
4. Pégalas en `.env.local` (copia de `.env.example`) como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Nunca la `service_role`.
5. Authentication → Providers: deja Email activo. (Google se agrega después.) Authentication → URL Configuration: pon `http://localhost:5173` como Site URL.
6. Avísame y aplico la migración `supabase/migrations/20261020000001_banda_base.sql` (te la muestro antes).

## Importar playlists de YouTube (opcional, $0)
1. https://console.cloud.google.com → proyecto nuevo `backline` → "APIs y servicios" → habilitar **YouTube Data API v3**.
2. Credenciales → Crear credencial → **Clave de API**. Restringirla: *Referentes HTTP* (`localhost:5173/*` y el dominio final) y *Restricción de API* = solo YouTube Data API v3.
3. Pegarla en `.env.local` como `VITE_YOUTUBE_API_KEY`. Cuota gratis: 10.000 unidades/día (1 unidad por 50 canciones).
- Spotify no permite leer playlists ajenas con claves de app (restricciones 2026): se usa captura de pantalla + lector de imagen.

## Legal antes de abrir la app a gente fuera de tu banda (auditoría `lucia-cumplimiento`)
Ya están en la app: páginas `/privacidad` y `/terminos` (borrador), casillas de autorización y edad al registrarse, enlaces en login y perfil, borrado de cuenta que limpia el dispositivo. Falta lo que solo tú puedes hacer:
1. **Completar tus datos como responsable**: nombre completo, cédula y ciudad (hoy dice solo "Javier Rueda" y tu correo). Cambiarlos en `src/content/legal.ts`.
2. **Que un abogado revise** política, términos, edades mínimas (14–17 con autorización del representante, 18+) y el régimen de transferencia internacional (Supabase está fuera de Colombia).
3. **Consultar si debes inscribir la base de datos en el Registro Nacional de Bases de Datos (SIC).**
4. Región de Supabase y hosting: confirmarlos para declararlos en la política.
5. Revisar las plantillas de correo de Supabase Auth (Authentication → Emails): remitente y texto claros, en español.
6. Antes de subir logos y fotos: política de contenido, reporte de abuso y borrado de archivos al borrar la cuenta.

## Salas de ensayo: piloto con tu amigo
1. **Migraciones** en el SQL Editor, en orden: `…0010`, `…0011` y `…0012` (ya aplicadas) y, nuevas, **`…0013_calendario_google.sql`** y **`…0014_equipo_y_ubicacion.sql`**. No publicar la app antes de aplicarlas.
2. Pedirle a tu amigo lo que necesita cargar: nombre, dirección, WhatsApp, cuántas salitas tiene y qué equipo hay en cada una, precio por hora, horario de atención y 3-5 fotos.
3. Que cree su cuenta, entre a **Agenda → Salas de ensayo → Publicar mi sala** y la deje lista. Tú reservas con tu banda para probar el flujo completo (pedir, confirmar, ver el ensayo en la agenda).
4. Ver cómo reserva hoy (WhatsApp, cuaderno, llamadas) para medir si Backline le quita trabajo. Esa fricción decide qué sigue (avisos, pagos, Slothy).
5. Cuando Slothy esté desplegado: poner el enlace de su chat en el campo "Enlace para reservar en otro sistema" de la sala.

### Cómo reserva hoy el amigo (dato del piloto)
Las bandas le escriben por WhatsApp y él anota a mano en su Google Calendar. Por eso Backline le ofrece: (1) **Anotar una reserva** que le llegó por WhatsApp o llamada, para que las bandas vean la disponibilidad real; (2) botón **Agregar a Google Calendar** en cada reserva confirmada (un toque, sin escribir); (3) el aviso por WhatsApp que manda la banda al pedir una franja, con el enlace para confirmarla. Pendiente si el piloto lo pide: aviso automático al dueño (correo/WhatsApp), página pública sin cuenta para compartir su disponibilidad, y feed `.ics` para suscribir su Google Calendar.

## Avisos automáticos (notificaciones push, $0)
La app avisa sola al dueño cuando llega una solicitud y a la banda cuando la confirman o cancelan, sin depender de WhatsApp. Se hace una vez:
1. **Generar las llaves** (en esta carpeta): `npx web-push generate-vapid-keys`. Imprime una llave pública y una privada. **La privada no se comparte ni se sube a git.**
2. **Llave pública en la app:** `gh variable set VITE_VAPID_PUBLIC_KEY --repo laruedevelopment/backline --body "<pública>"` y, para probar en tu computador, agrégala a `.env.local` como `VITE_VAPID_PUBLIC_KEY=<pública>`.
3. **Subir la función a Supabase** (una sola vez; la primera vez abre el navegador para iniciar sesión):
   - `npx supabase login`
   - `npx supabase functions deploy notify-booking --project-ref xmhwgdqcjvpsfezxnjuz` (si pide Docker, agrega `--use-api`).
4. **Guardar las llaves como secretos de la función:**
   `npx supabase secrets set VAPID_PUBLIC_KEY="<pública>" VAPID_PRIVATE_KEY="<privada>" VAPID_SUBJECT="mailto:javieruedase@gmail.com" --project-ref xmhwgdqcjvpsfezxnjuz`
5. Publicar la app (push a `main`). Cada persona activa los avisos una vez en **Perfil → Avisos en este dispositivo** (el dueño también ve una invitación en «Mi sala»). En iPhone hay que instalar la app primero (Compartir → Agregar a pantalla de inicio).
Sin los pasos 1–4 la app funciona igual, solo sin avisos.

## Siguiente nivel de automatización (cuando el piloto lo pida)
- **Leer su Google Calendar** (dirección secreta iCal por salita) para bloquear solo la disponibilidad con lo que él ya escribe. Misma infraestructura de funciones de Supabase.
- **Recordatorios** el día anterior al ensayo (tarea programada + push).
- **Página pública sin cuenta** para compartir la disponibilidad por WhatsApp.
- **Bot de WhatsApp** con Slothy (tiene costo de WhatsApp Business).

## App en tiendas (cuando la PWA esté validada)
- **Google Play:** cuenta de desarrollador, pago único (~US$25).
- **App Store:** Apple Developer Program, pago anual (~US$99) y un Mac o servicio de compilación para iOS.
- Se publica la misma web envuelta con Capacitor; no hace falta reescribirla. Hasta entonces la PWA instalable cubre el celular sin costo.

## Avisos push del chat, mensajes directos y amistades
1. En el editor SQL del proyecto **backline** corre `supabase/migrations/20261020000033_avisos_sociales.sql`.
2. Publica la función (la clave de la CLI da 403 desde el agente; hazlo tú): `npx supabase login` y luego
   `npx supabase functions deploy notify-social --project-ref xmhwgdqcjvpsfezxnjuz --use-api`.
   Usa las mismas llaves VAPID que `notify-booking` (ya configuradas).
3. En la app, cada persona activa los avisos en su perfil (Avisos en este dispositivo).

## Denuncias, términos 0.7 y endurecimiento (2026-11)
1. SQL: en el editor SQL del proyecto **backline** corre `supabase/migrations/20261020000035_denuncias_y_terminos.sql` y luego `20261020000036_endurecimiento.sql` (o `supabase/pendiente.sql`, que las trae juntas).
2. Vuelve a publicar la función (cambió: revalida amistad y bloqueo): `npx supabase functions deploy notify-social --project-ref xmhwgdqcjvpsfezxnjuz --use-api`.
3. Las denuncias llegan a la tabla `content_reports` (Supabase → Table Editor). Revísalas con frecuencia y cambia su `status` a `revisada` o `descartada`.
4. Revisión legal: los textos son borradores. Llevar a un abogado la política y los términos 0.7 (mensajes entre menores y adultos en una banda, retención, procedimiento de derechos de autor, registro de bases de datos, identificación del responsable con documento y dirección).
5. Antes de abrir a más bandas: Sentry, vigilancia del sitio (UptimeRobot), respaldos semanales y una prueba de carga (ver `docs/AUDITORIA-2026-11.md`).

## Pagos de reservas (migración 0040)
- Correr `supabase/pendiente.sql` completo (0037 a 0040) en el proyecto «backline».
- Desplegar de nuevo `notify-social` (y `notify-booking` si quieres avisos de comprobante).
- El workflow `vencer-reservas.yml` usa las mismas variables del repo que `salud-supabase.yml`; sin costo.
- Backline no recibe dinero: el pago va directo a la cuenta del dueño. Aun así, Lucía debe revisar los términos antes de abrir reservas con cobro.
- Bloqueos de horario y «Ignorar» eventos del calendario (migración 0041): también va en `supabase/pendiente.sql` (ahora 0037 a 0041).

## Monitoreo y respaldos (migración 0043 y workflows)
- **Vigilancia del sitio** (`vigilancia.yml`, cada 15 min): ya funciona sola con las variables del repo. Si la web o Supabase caen, GitHub te manda un correo de «workflow failed». Revisa que las notificaciones de Actions estén activas en GitHub → Settings → Notifications.
- **Registro de errores propio** (migración 0043): correr `supabase/pendiente.sql`. Para leerlo, en el SQL Editor: `select created_at, message, url, left(agent, 60) as dispositivo, user_id from public.client_errors order by created_at desc limit 50;` (se borra solo a los 30 días).
- **Respaldo cifrado semanal** (`respaldo.yml`), pasos tuyos:
  1. Supabase → Connect → «Session pooler» → copia la cadena `postgresql://…` y pon tu contraseña de base de datos (Settings → Database; se puede restablecer ahí mismo).
  2. GitHub → repo → Settings → Secrets and variables → Actions → New repository secret: `SUPABASE_DB_URL` con esa cadena.
  3. Otro secreto `BACKUP_PASSPHRASE` con una frase larga que solo tú guardes (en tu gestor de contraseñas). Sin ella el respaldo no se puede abrir.
  4. Actions → «Respaldo cifrado de la base» → Run workflow para probarlo; baja el artefacto y guárdalo en un lugar privado (Drive).
  - Nota: el repositorio es público; el artefacto va cifrado pero es descargable. No cubre las fotos (Storage). Para restaurar: `gpg -d archivo.gpg | gunzip | psql <cadena>`.
- **Sentry** (opcional, ya tienes cuenta `jrdev-cg`): mandaría datos de errores a un tercero; si lo quieres, hay que actualizar la política de privacidad y subir la versión de términos. Dime y lo dejo conectado.
- El texto de privacidad (9. Seguridad) ya menciona el registro técnico de errores; Lucía debe revisarlo junto con el resto antes de abrir.

## Protección al consumidor en reservas con pago (migración 0044) — informes de Lucía y Daniela
Antes de publicar este cambio:
1. Correr `supabase/pendiente.sql` (0043 + 0044) en el proyecto «backline».
2. Desplegar la función de limpieza: `npx supabase functions deploy housekeeping --project-ref xmhwgdqcjvpsfezxnjuz --use-api` (borra comprobantes viejos con la API de Storage y errores de más de 30 días; la llama el workflow cada hora).
3. Avisarme para publicar (el cliente nuevo necesita las columnas y funciones nuevas).

Qué cambió: la sala que cobra debe poner nombre legal, documento y política de cancelación; el cliente los ve y marca una casilla antes de reservar (queda registro); reservas con cobro solo para mayores de edad; una reserva pagada que se cancela queda en «devolución pendiente» y la sala la marca; los comprobantes se suben solo a una reserva propia que espera pago, se verifican y se borran (30/90 días); términos y política en versión 0.9 (todos deberán aceptarlos de nuevo).

**Requiere abogado (no resuelto en código):**
- Si Backline es «portal de contacto» o proveedor frente a la Ley 1480 (art. 53) dado que opera el vencimiento y la regla de culpa del dueño.
- Texto exacto del retracto (art. 47), reversión del pago (art. 51) y plazos de reembolso: el borrador usa la excepción de servicios con fecha determinada.
- Si un menor de 14 a 17 años puede contratar; hoy se bloquea para pagos, y el consentimiento del representante solo se declara (no se verifica).
- Constitución de la entidad (NIT, dirección), registro de bases de datos en la SIC, plazo legal de conservación de comprobantes, y Ley 2300 para mensajes sin amistad.
- Revisar la política de privacidad completa (mencionar DM sin amistad, mercado, finalidades) antes de abrir al público.

## Integrantes sin cuenta y reasignar (migración 0045)
- Correr `supabase/pendiente.sql` (solo la 0045) en el proyecto «backline»; después avisarme para publicar.
- Qué hace: Banda → Integrantes → «Agregar integrante sin cuenta» (nombre e instrumento). Se asignan en «Quién toca», anotaciones y equipo. Cuando crea su cuenta: tocar su nombre → «Enlazar con su cuenta» pasa todo. Para cambiar de bajista: tocar al integrante → «¿Cambió la persona de este puesto?» → «Pasar todo a otra persona».
- Límite: 12 integrantes sin cuenta por banda. Quienes no tienen cuenta no responden asistencia (eso solo lo hace quien tiene cuenta).

## Compás de cada canción (migración 0046)
- Correr `supabase/pendiente.sql` (solo la 0046) **antes** de publicar: el cliente nuevo pide la columna `meter` de las canciones.
- Cada canción tiene «Compás» (4/4, 3/4, 2/4, 5/4, 6/8, 7/8, 9/8, 12/8). El pre-conteo del escenario cuenta según ese compás (en 6/8: seis clics con acento en el 1 y el 4; el BPM de las canciones en 6/8, 9/8 y 12/8 se toma como negra con puntillo, y en 7/8 como negra). Las canciones ya existentes quedan en 4/4: hay que cambiar el compás de las que no sean 4/4.

## Formación de la banda («Quién toca» por defecto) — migración 0047
1. Supabase › SQL Editor › pega `supabase/pendiente.sql` (tabla `band_defaults`) › Run.
2. Banda › Ajustes › «Quién toca»: arma la formación y guarda. Luego «Aplicar a las canciones sin formación» o «Aplicar a todo el repertorio», o desde cada setlist el botón «Formación de la banda».

## Afinación en el link del setlist — migración 0048
Supabase › SQL Editor › pega `supabase/pendiente.sql` › Run.
