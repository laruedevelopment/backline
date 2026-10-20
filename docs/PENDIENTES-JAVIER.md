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
