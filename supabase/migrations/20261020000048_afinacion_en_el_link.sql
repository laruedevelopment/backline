-- El link de solo lectura del setlist muestra también la afinación, el capo y el pitch shifter de cada canción (nunca de qué persona es). Repetible.
create or replace function public.shared_setlist(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', s.name,
    'band', b.name,
    'rows', coalesce((
      select jsonb_agg(
        case when e.value ->> 't' = 'l'
          then jsonb_build_object('kind', 'label', 'text', coalesce(e.value ->> 'text', ''))
          else jsonb_build_object('kind', 'song', 'title', so.title, 'artist', so.artist, 'key', so.key, 'bpm', so.bpm, 'minutes', so.minutes,
                                  'tunings', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('instrument', t ->> 'instrument', 'tuning', t ->> 'tuning', 'capo', t -> 'capo', 'shift', t -> 'shift'))), '[]'::jsonb)
                                              from jsonb_array_elements(case when jsonb_typeof(so.tunings) = 'array' then so.tunings else '[]'::jsonb end) t),
                                  'tags', case when jsonb_typeof(e.value -> 'tags') = 'array' then e.value -> 'tags' else '[]'::jsonb end)
        end order by e.ord)
      from jsonb_array_elements(coalesce(s.items, (select jsonb_agg(jsonb_build_object('t', 's', 'id', sid)) from unnest(s.song_ids) as sid))) with ordinality as e(value, ord)
      left join public.songs so on e.value ->> 't' = 's' and so.id::text = (e.value ->> 'id') and so.band_id = s.band_id
      where e.value ->> 't' = 'l' or so.id is not null
    ), '[]'::jsonb))
  from public.setlists s join public.bands b on b.id = s.band_id
  where p_token is not null and char_length(p_token) >= 24 and s.share_token = p_token;
$$;
