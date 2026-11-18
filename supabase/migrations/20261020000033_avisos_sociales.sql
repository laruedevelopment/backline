-- Marcas para que cada mensaje o solicitud se avise por push una sola vez (las usa la función `notify-social`). Repetible.
alter table public.band_messages add column if not exists notified_at timestamptz;
alter table public.direct_messages add column if not exists notified_at timestamptz;
alter table public.friendships add column if not exists notified_status text;
