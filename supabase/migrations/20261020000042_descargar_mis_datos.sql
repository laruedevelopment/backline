-- Derecho de acceso (Ley 1581 de 2012): cada persona puede descargar todo lo suyo en un archivo.
-- Solo devuelve filas propias (filtra por auth.uid()); es SECURITY DEFINER porque algunas tablas tienen permisos por columna.
-- Repetible.
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'no autenticado'; end if;
  return jsonb_build_object(
    'generado_el', now(),
    'cuenta', (select jsonb_build_object('id', u.id, 'correo', u.email, 'creada_el', u.created_at) from auth.users u where u.id = uid),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'bandas', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('banda', b.name)) from public.band_members m join public.bands b on b.id = m.band_id where m.profile_id = uid), '[]'),
    'bandas_creadas', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'nombre', b.name, 'ciudad', b.city)) from public.bands b where b.created_by = uid), '[]'),
    'mensajes_de_banda', coalesce((select jsonb_agg(to_jsonb(x)) from public.band_messages x where x.profile_id = uid), '[]'),
    'comentarios_en_canciones', coalesce((select jsonb_agg(to_jsonb(x)) from public.song_comments x where x.profile_id = uid), '[]'),
    'anotaciones_en_canciones', coalesce((select jsonb_agg(to_jsonb(x)) from public.song_member_notes x where x.profile_id = uid), '[]'),
    'mensajes_directos', coalesce((select jsonb_agg(to_jsonb(x)) from public.direct_messages x where x.sender = uid or x.recipient = uid), '[]'),
    'solicitudes_de_mensaje', coalesce((select jsonb_agg(to_jsonb(x)) from public.dm_contacts x where x.lo = uid or x.hi = uid), '[]'),
    'amistades', coalesce((select jsonb_agg(to_jsonb(x)) from public.friendships x where x.requester = uid or x.addressee = uid), '[]'),
    'bloqueos', coalesce((select jsonb_agg(to_jsonb(x)) from public.user_blocks x where x.blocker = uid), '[]'),
    'publicaciones', coalesce((select jsonb_agg(to_jsonb(x)) from public.posts x where x.author = uid), '[]'),
    'comentarios_en_publicaciones', coalesce((select jsonb_agg(to_jsonb(x)) from public.post_comments x where x.author = uid), '[]'),
    'me_gusta', coalesce((select jsonb_agg(to_jsonb(x)) from public.post_likes x where x.profile_id = uid), '[]'),
    'siguiendo', coalesce((select jsonb_agg(to_jsonb(x)) from public.follows x where x.follower = uid), '[]'),
    'anuncios_del_mercado', coalesce((select jsonb_agg(to_jsonb(x)) from public.listings x where x.seller = uid), '[]'),
    'preguntas_en_anuncios', coalesce((select jsonb_agg(to_jsonb(x)) from public.listing_questions x where x.author = uid), '[]'),
    'busquedas_de_musico', coalesce((select jsonb_agg(to_jsonb(x)) from public.band_openings x where x.created_by = uid), '[]'),
    'respuestas_a_busquedas', coalesce((select jsonb_agg(to_jsonb(x)) from public.opening_replies x where x.profile_id = uid), '[]'),
    'reservas_pedidas', coalesce((select jsonb_agg(to_jsonb(x)) from public.bookings x where x.requested_by = uid), '[]'),
    'mis_negocios', coalesce((select jsonb_agg(to_jsonb(x)) from public.venues x where x.owner_id = uid), '[]'),
    'denuncias_hechas', coalesce((select jsonb_agg(to_jsonb(x)) from public.content_reports x where x.reporter = uid), '[]')
  );
end $$;
revoke all on function public.export_my_data from public, anon;
grant execute on function public.export_my_data to authenticated;
