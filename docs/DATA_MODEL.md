# Modelo de datos (borrador — Supabase/Postgres)

Convenciones: `uuid` PK, `created_at`, RLS en todas las tablas, acceso por pertenencia a la banda.

## Identidad
- `profiles` (id = auth.users.id, handle único, display_name, avatar_url, city, bio, instruments[], genres[], is_public, birth_year/age_confirmed)
- `rig_items` (profile_id, kind: guitar|bass|drums|keys|wind|pedal|amp|other, name, brand, details jsonb [tuning, strings, signal_order], photo_url, is_public)

## Bandas
- `bands` (name, slug, genres[], city, bio, logo_url, is_public, looking_for jsonb)
- `band_members` (band_id, profile_id, role: owner|admin|member|guest, instrument, status: active|invited)
- `band_invites` (band_id, code, expires_at, role)

## Repertorio
- `songs` (band_id, title, artist, key, bpm, time_signature, duration_sec, status: learning|ready|paused, notes, lyrics, links jsonb [spotify, youtube], is_original)
- `song_tunings` (song_id, member_id, instrument, tuning text, capo int) — afinación por instrumento
- `song_key_changes` (song_id, position, section, from_key, to_key)
- `song_parts` (song_id, member_id, part: "guitarra 1", "voz principal", guest_name?) — quién toca qué / invitados
- `song_files` (song_id, kind: chart|tab|audio|demo, storage_path)

> Decisión Fase 1: `song_tunings` y `song_key_changes` se guardan como columnas `jsonb` (`tunings`, `key_changes`) en `songs`; `song_parts` queda para después.

## Setlists y agenda
- `setlists` (band_id, name, notes)
- `setlist_items` (setlist_id, position, song_id | break_label, note) → duración total y cambios de afinación se calculan
- `events` (band_id, kind: rehearsal|gig|other, title, starts_at, ends_at, venue_id?, place_text, pay, setlist_id?, notes, load_in_at)
- `event_rsvps` (event_id, profile_id, status: yes|no|maybe, note)
- `event_gear` (event_id, profile_id, item, status)

## Salas y reservas
- `venues` (owner_id, name, kind: rehearsal_room|venue|studio, city, address, lat, lng, description, amenities jsonb, price_per_hour, photos[])
- `venue_hours` (venue_id, weekday, opens, closes)
- `bookings` (venue_id, band_id?, profile_id, starts_at, ends_at, status: pending|confirmed|rejected|cancelled, note) — constraint de no-solape entre confirmadas (exclusion constraint con tstzrange)

## Social
- `posts` (author_profile_id | band_id, body, media jsonb, created_at)
- `follows` (follower_id, target_type, target_id)
- `reactions`, `comments`
- `classifieds_ads` (band_id | profile_id, kind: member_wanted|band_wanted|gig_wanted, instrument, genres[], city, text)
- `messages`, `threads` (DM; también con salas)
- `reports` (moderación)

## Marketplace (Fase 5)
- `listings` (seller_id, category, title, brand, condition, price, currency, city, photos[], status)
- `listing_threads` / reutilizar `threads`; `reviews` (reputación)

## Notas de seguridad
- RLS: un miembro solo lee/escribe filas de sus bandas; públicas solo si `is_public`.
- Storage: buckets con límite de tamaño y tipo MIME; rutas `band_id/...`.
- Nunca guardar medios con derechos de terceros; solo links/embeds.
