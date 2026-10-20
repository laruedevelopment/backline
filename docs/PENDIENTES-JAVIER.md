# Lo que solo Javier puede hacer (para el final)

1. **Decidir el nombre** (Backline es provisional) y reservar dominio / @ en Instagram.
2. **Crear proyecto Supabase** gratis (cuenta propia o de la organización) y pasar `URL` y `anon key` → `.env.local` (ver `.env.example`). Nunca la `service_role` en el frontend.
3. **Repo en GitHub** dentro de la organización `laruedevelopment` (crear vacío `backline`).
4. **Spotify Developer** (gratis): crear app para obtener Client ID/Secret si se quiere búsqueda de canciones. (YouTube/Spotify embebidos no requieren claves.)
5. **Google OAuth** (login con Google): crear credenciales en Google Cloud Console.
6. **Su banda** como primera prueba: 2–3 compañeros para probar Fase 1.
7. **Amigo del ensayadero**: horarios, precios, equipo, fotos y cómo gestiona hoy las reservas (para la Fase 3).
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
