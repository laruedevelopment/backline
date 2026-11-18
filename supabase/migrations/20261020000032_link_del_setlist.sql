-- Link de solo lectura de un setlist: quien tenga el link ve el nombre, el orden y los datos básicos de cada canción (título, artista,
-- tono, BPM, duración y las etiquetas), sin cuenta. Nunca letras, notas ni nada de la banda. Solo el líder o admin lo crea o lo apaga. Repetible.
alter table public.setlists add column if not exists share_token text;
create unique index if not exists setlists_share_token_key on public.setlists (share_token) where share_token is not null;

-- La columna no se lee ni se escribe directo: se maneja con estas funciones.
revoke select (share_token) on public.setlists from authenticated, anon;

create or replace function public.set_setlist_share(p_setlist uuid, p_on boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare b uuid; tok text;
begin
  select band_id into b from public.setlists where id = p_setlist;
  if b is null or not exists (select 1 from public.band_members where band_id = b and profile_id = (select auth.uid()) and role in ('owner', 'admin')) then
    raise exception 'no puedes compartir este setlist';
  end if;
  if p_on then
    update public.setlists set share_token = coalesce(share_token, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) where id = p_setlist returning share_token into tok;
  else
    update public.setlists set share_token = null where id = p_setlist;
  end if;
  return tok;
end $$;
revoke all on function public.set_setlist_share from public, anon;
grant execute on function public.set_setlist_share to authenticated;

-- ¿Está compartido? (solo para el líder/admin de esa banda): devuelve el token o null.
create or replace function public.setlist_share_token(p_setlist uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.share_token from public.setlists s
  where s.id = p_setlist
    and exists (select 1 from public.band_members m where m.band_id = s.band_id and m.profile_id = (select auth.uid()) and m.role in ('owner', 'admin'));
$$;
revoke all on function public.setlist_share_token from public, anon;
grant execute on function public.setlist_share_token to authenticated;

-- Lo que ve quien abre el link (sin cuenta).
create or replace function public.shared_setlist(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', s.name,
    'band', b.name,
    'rows', coalesce((
      select jsonb_agg(
        case when e.value ->> 't' = 'l'
          then jsonb_build_object('kind', 'label', 'text', e.value ->> 'text')
          else jsonb_build_object('kind', 'song', 'title', so.title, 'artist', so.artist, 'key', so.key, 'bpm', so.bpm, 'minutes', so.minutes, 'tags', coalesce(e.value -> 'tags', '[]'::jsonb))
        end order by e.ord)
      from jsonb_array_elements(coalesce(s.items, (select jsonb_agg(jsonb_build_object('t', 's', 'id', sid)) from unnest(s.song_ids) as sid))) with ordinality as e(value, ord)
      left join public.songs so on e.value ->> 't' = 's' and so.id = (e.value ->> 'id')::uuid and so.band_id = s.band_id
      where e.value ->> 't' = 'l' or so.id is not null
    ), '[]'::jsonb))
  from public.setlists s join public.bands b on b.id = s.band_id
  where p_token is not null and char_length(p_token) >= 24 and s.share_token = p_token;
$$;
revoke all on function public.shared_setlist from public;
grant execute on function public.shared_setlist to anon, authenticated;
