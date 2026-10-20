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
